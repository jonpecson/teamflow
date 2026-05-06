use axum::extract::{Multipart, Path, State};
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;

const MAX_FILE_SIZE: usize = 25 * 1024 * 1024; // 25MB

const ALLOWED_IMAGE_TYPES: &[&str] = &["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_DOC_TYPES: &[&str] = &[
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
];

#[derive(Serialize, Clone)]
pub struct AttachmentResp {
    pub id: Uuid,
    pub file_name: String,
    pub file_size: i64,
    pub content_type: String,
    pub url: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

/// POST /api/channels/:id/upload — upload file attachment
pub async fn upload_file(
    State(state): State<AppState>,
    claims: Claims,
    Path(channel_id): Path<Uuid>,
    mut multipart: Multipart,
) -> Result<Json<AttachmentResp>, AppError> {
    // Verify membership
    sqlx::query_as::<_, (Uuid,)>(
        "SELECT channel_id FROM channel_members WHERE channel_id = $1 AND user_id = $2",
    )
    .bind(channel_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Auth("Not a member of this channel".into()))?;

    let bucket = std::env::var("FILES_S3_BUCKET")
        .or_else(|_| std::env::var("AVATAR_S3_BUCKET"))
        .unwrap_or_else(|_| "teamflow-avatars".into());

    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name = "file".to_string();
    let mut content_type = "application/octet-stream".to_string();

    while let Some(field) = multipart.next_field().await.map_err(|e| {
        AppError::BadRequest(format!("Multipart error: {e}"))
    })? {
        if field.name() == Some("file") {
            file_name = field.file_name().unwrap_or("file").to_string();
            content_type = field.content_type().unwrap_or("application/octet-stream").to_string();

            // Validate content type
            let is_allowed = ALLOWED_IMAGE_TYPES.contains(&content_type.as_str())
                || ALLOWED_DOC_TYPES.contains(&content_type.as_str());
            if !is_allowed {
                return Err(AppError::BadRequest(
                    "File type not allowed. Supported: images (JPEG, PNG, GIF, WebP), documents (PDF, DOC, XLS, CSV, TXT)".into(),
                ));
            }

            let data = field.bytes().await.map_err(|e| {
                AppError::BadRequest(format!("Failed to read file: {e}"))
            })?;

            if data.len() > MAX_FILE_SIZE {
                return Err(AppError::BadRequest("File must be under 25MB".into()));
            }

            file_data = Some(data.to_vec());
        }
    }

    let data = file_data.ok_or_else(|| AppError::BadRequest("No file provided".into()))?;
    let file_size = data.len() as i64;

    // Get image dimensions if it's an image
    let (width, height) = if ALLOWED_IMAGE_TYPES.contains(&content_type.as_str()) {
        image::load_from_memory(&data)
            .ok()
            .map(|img| (Some(img.width() as i32), Some(img.height() as i32)))
            .unwrap_or((None, None))
    } else {
        (None, None)
    };

    // Upload to S3
    let file_id = Uuid::new_v4();
    let ext = file_name.rsplit('.').next().unwrap_or("bin");
    let s3_key = format!("files/{channel_id}/{file_id}.{ext}");

    state.s3.put_object()
        .bucket(&bucket)
        .key(&s3_key)
        .body(data.into())
        .content_type(&content_type)
        .content_disposition(format!("inline; filename=\"{}\"", file_name))
        .send()
        .await
        .map_err(|e| AppError::BadRequest(format!("S3 upload failed: {e}")))?;

    let url = format!("https://{bucket}.s3.amazonaws.com/{s3_key}");

    // Create a message with the attachment
    let msg_content = if ALLOWED_IMAGE_TYPES.contains(&content_type.as_str()) {
        format!("[image: {}]", file_name)
    } else {
        format!("[file: {}]", file_name)
    };

    let (msg_id, created_at) = sqlx::query_as::<_, (Uuid, chrono::DateTime<chrono::Utc>)>(
        "INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id, created_at",
    )
    .bind(channel_id)
    .bind(claims.sub)
    .bind(&msg_content)
    .fetch_one(&state.db)
    .await?;

    // Store attachment metadata
    let attachment_id = sqlx::query_as::<_, (Uuid,)>(
        "INSERT INTO message_attachments (message_id, file_name, file_size, content_type, s3_key, url, width, height) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    )
    .bind(msg_id)
    .bind(&file_name)
    .bind(file_size)
    .bind(&content_type)
    .bind(&s3_key)
    .bind(&url)
    .bind(width)
    .bind(height)
    .fetch_one(&state.db)
    .await?
    .0;

    // Broadcast message with attachment to channel
    let profile = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        "SELECT display_name, avatar_url FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or((None, None));

    let server_msg = crate::ws::messages::ServerMsg::Message {
        id: msg_id,
        channel_id,
        user_id: claims.sub,
        username: claims.username.clone(),
        content: msg_content,
        timestamp: created_at,
    };

    let members = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM channel_members WHERE channel_id = $1",
    )
    .bind(channel_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (member_id,) in members {
        if let Some(sender) = state.connections.get(&member_id) {
            let _ = sender.send(server_msg.clone());
        }
    }

    crate::audit::log_message_send(&state.db, claims.sub, channel_id).await;

    Ok(Json(AttachmentResp {
        id: attachment_id,
        file_name,
        file_size,
        content_type,
        url,
        width,
        height,
    }))
}

/// GET /api/messages/:id/attachments — get attachments for a message
pub async fn message_attachments(
    State(state): State<AppState>,
    claims: Claims,
    Path(message_id): Path<Uuid>,
) -> Result<Json<Vec<AttachmentResp>>, AppError> {
    // Verify the requesting user is a member of the channel this message belongs to
    sqlx::query_as::<_, (Uuid,)>(
        "SELECT cm.channel_id FROM channel_members cm \
         JOIN messages m ON m.channel_id = cm.channel_id \
         WHERE m.id = $1 AND cm.user_id = $2",
    )
    .bind(message_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Auth("Not a member of this channel".into()))?;

    let rows = sqlx::query_as::<_, (Uuid, String, i64, String, String, Option<i32>, Option<i32>)>(
        "SELECT id, file_name, file_size, content_type, url, width, height \
         FROM message_attachments WHERE message_id = $1 ORDER BY created_at",
    )
    .bind(message_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| AttachmentResp {
                id: r.0,
                file_name: r.1,
                file_size: r.2,
                content_type: r.3,
                url: r.4,
                width: r.5,
                height: r.6,
            })
            .collect(),
    ))
}
