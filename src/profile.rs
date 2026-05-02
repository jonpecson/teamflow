use axum::extract::{Multipart, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Serialize)]
pub struct ProfileResp {
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub avatar_url: Option<String>,
    pub theme: String,
    pub onboarded: bool,
}

#[derive(Deserialize)]
pub struct UpdateProfileReq {
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub theme: Option<String>,
}

/// GET /api/profile — fetch current user's profile
pub async fn get_profile(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<ProfileResp>, AppError> {
    let row = sqlx::query_as::<_, (Option<String>, Option<String>, Option<String>, String, bool)>(
        "SELECT display_name, role, avatar_url, theme, onboarded FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ProfileResp {
        display_name: row.0,
        role: row.1,
        avatar_url: row.2,
        theme: row.3,
        onboarded: row.4,
    }))
}

/// PUT /api/profile — update display name, role, theme
pub async fn update_profile(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<UpdateProfileReq>,
) -> Result<StatusCode, AppError> {
    // Validate display name
    if let Some(ref name) = body.display_name {
        let name = name.trim();
        if name.is_empty() || name.len() > 64 {
            return Err(AppError::BadRequest("Display name must be 1-64 characters".into()));
        }
    }

    // Validate role
    if let Some(ref role) = body.role {
        if role.trim().len() > 64 {
            return Err(AppError::BadRequest("Role must be under 64 characters".into()));
        }
    }

    // Validate theme
    if let Some(ref theme) = body.theme {
        if !["dark", "light", "system"].contains(&theme.as_str()) {
            return Err(AppError::BadRequest("Theme must be 'dark', 'light', or 'system'".into()));
        }
    }

    sqlx::query(
        "UPDATE users SET \
         display_name = COALESCE($1, display_name), \
         role = COALESCE($2, role), \
         theme = COALESCE($3, theme), \
         onboarded = true \
         WHERE id = $4",
    )
    .bind(body.display_name.as_deref().map(|s| s.trim()))
    .bind(body.role.as_deref().map(|s| s.trim()))
    .bind(&body.theme)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}

/// POST /api/avatar — upload avatar image (multipart)
pub async fn upload_avatar(
    State(state): State<AppState>,
    claims: Claims,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    let bucket = std::env::var("AVATAR_S3_BUCKET")
        .unwrap_or_else(|_| "teamflow-avatars".into());

    let mut image_data: Option<Vec<u8>> = None;
    let mut content_type = "image/jpeg".to_string();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::BadRequest(format!("Multipart error: {e}"))
    })? {
        if field.name() == Some("avatar") {
            content_type = field.content_type()
                .unwrap_or("image/jpeg")
                .to_string();

            // Validate content type
            if !["image/jpeg", "image/png", "image/webp"].contains(&content_type.as_str()) {
                return Err(AppError::BadRequest("Only JPEG, PNG, and WebP images are allowed".into()));
            }

            let data = field.bytes().await.map_err(|e| {
                AppError::BadRequest(format!("Failed to read file: {e}"))
            })?;

            // 5MB limit for avatars
            if data.len() > 5 * 1024 * 1024 {
                return Err(AppError::BadRequest("Avatar must be under 5MB".into()));
            }

            image_data = Some(data.to_vec());
        }
    }

    let data = image_data.ok_or_else(|| {
        AppError::BadRequest("No avatar file provided".into())
    })?;

    // Resize to 200x200 using the image crate
    let resized = resize_avatar(&data)?;

    // Upload to S3
    let key = format!("avatars/{}.jpg", claims.sub);
    let aws_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(aws_config::Region::new(
            std::env::var("AWS_REGION").unwrap_or_else(|_| "us-west-2".into()),
        ))
        .load()
        .await;
    let s3 = aws_sdk_s3::Client::new(&aws_config);

    s3.put_object()
        .bucket(&bucket)
        .key(&key)
        .body(resized.into())
        .content_type("image/jpeg")
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("S3 upload failed: {e}")))?;

    let avatar_url = format!("https://{bucket}.s3.amazonaws.com/{key}");

    // Update user record
    sqlx::query("UPDATE users SET avatar_url = $1 WHERE id = $2")
        .bind(&avatar_url)
        .bind(claims.sub)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "avatar_url": avatar_url })))
}

fn resize_avatar(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(data)
        .map_err(|e| AppError::BadRequest(format!("Invalid image: {e}")))?;

    let resized = img.resize_to_fill(200, 200, image::imageops::FilterType::Lanczos3);

    let mut buf = std::io::Cursor::new(Vec::new());
    resized.write_to(&mut buf, image::ImageFormat::Jpeg)
        .map_err(|e| AppError::BadRequest(format!("Image processing failed: {e}")))?;

    Ok(buf.into_inner())
}
