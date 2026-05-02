use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::Json;
use axum::response::IntoResponse;
use serde::{Deserialize, Serialize};

use crate::auth::jwt::sign_token;
use crate::error::AppError;
use crate::state::AppState;

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::SaltString;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};

/// HIPAA [C3]: Set HttpOnly Secure cookie with JWT token
fn make_auth_cookie(token: &str) -> HeaderMap {
    let mut headers = HeaderMap::new();
    let cookie = format!(
        "tf_token={}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400",
        token
    );
    headers.insert(
        axum::http::header::SET_COOKIE,
        cookie.parse().unwrap(),
    );
    headers
}

#[derive(Deserialize)]
pub struct RegisterReq {
    pub username: String,
    pub password: String,
    pub invite_code: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginReq {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResp {
    pub token: String,
    pub user_id: uuid::Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub avatar_url: Option<String>,
    pub theme: String,
    pub onboarded: bool,
}

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterReq>,
) -> Result<(StatusCode, HeaderMap, Json<AuthResp>), AppError> {
    // Check if any users exist — first user doesn't need invite code
    let user_count = sqlx::query_as::<_, (i64,)>("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await?;
    let is_first_user = user_count.0 == 0;

    // Validate invite code (required unless first user)
    if !is_first_user {
        let code = body.invite_code.as_deref().unwrap_or("").trim();
        if code.is_empty() {
            return Err(AppError::BadRequest(
                "Invite code is required to register".into(),
            ));
        }
        crate::invites::handlers::validate_and_consume(&state.db, code).await?;
    }

    let username = body.username.trim();
    if username.len() < 3 || username.len() > 32 {
        return Err(AppError::BadRequest(
            "Username must be 3-32 characters".into(),
        ));
    }
    if !username
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_')
    {
        return Err(AppError::BadRequest(
            "Username must be alphanumeric or underscore".into(),
        ));
    }
    // HIPAA: Password policy — minimum 8 chars with complexity [4.1]
    if body.password.len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters".into(),
        ));
    }
    let has_upper = body.password.chars().any(|c| c.is_uppercase());
    let has_lower = body.password.chars().any(|c| c.is_lowercase());
    let has_digit = body.password.chars().any(|c| c.is_ascii_digit());
    let has_special = body.password.chars().any(|c| !c.is_alphanumeric());
    if !has_upper || !has_lower || !has_digit || !has_special {
        return Err(AppError::BadRequest(
            "Password must contain uppercase, lowercase, digit, and special character".into(),
        ));
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(body.password.as_bytes(), &salt)
        .map_err(|e| AppError::BadRequest(format!("Hash error: {e}")))?
        .to_string();

    let row = sqlx::query_as::<_, (uuid::Uuid,)>(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
    )
    .bind(username)
    .bind(&hash)
    .fetch_one(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            AppError::BadRequest("Registration failed".into())
        }
        _ => AppError::Db(e),
    })?;

    // Auto-join #general if it exists
    let _ = sqlx::query(
        "INSERT INTO channel_members (channel_id, user_id) \
         SELECT id, $1 FROM channels WHERE name = 'general' AND is_dm = false \
         ON CONFLICT DO NOTHING",
    )
    .bind(row.0)
    .execute(&state.db)
    .await;

    let token = sign_token(
        row.0,
        username,
        &state.config.jwt_secret,
        state.config.jwt_expiry_secs,
    );

    // HIPAA [C3]: Set HttpOnly cookie
    let cookie_headers = make_auth_cookie(&token);

    Ok((
        StatusCode::CREATED,
        cookie_headers,
        Json(AuthResp {
            token,
            user_id: row.0,
            username: username.to_string(),
            display_name: None,
            role: None,
            avatar_url: None,
            theme: "system".to_string(),
            onboarded: false,
        }),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginReq>,
) -> Result<axum::response::Response, AppError> {
    // HIPAA: Generic error message prevents username enumeration [M3]
    let auth_error = || AppError::Auth("Authentication failed".into());

    let row = sqlx::query_as::<_, (uuid::Uuid, String, String, bool, i32, Option<chrono::DateTime<chrono::Utc>>, Option<String>, Option<String>, Option<String>, String, bool)>(
        "SELECT id, username, password_hash, COALESCE(mfa_enabled, false), \
         COALESCE(failed_login_attempts, 0), locked_until, \
         display_name, role, avatar_url, theme, onboarded \
         FROM users WHERE username = $1",
    )
    .bind(&body.username)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(auth_error)?;

    let (user_id, username, hash, mfa_enabled, failed_attempts, locked_until) =
        (row.0, row.1.clone(), row.2, row.3, row.4, row.5);
    let (display_name, role, avatar_url, theme, onboarded) =
        (row.6, row.7, row.8, row.9, row.10);

    // HIPAA: Account lockout after 5 failed attempts [H2/4.2]
    if let Some(locked) = locked_until {
        if locked > chrono::Utc::now() {
            crate::audit::log_login(&state.db, user_id, &username, false, None).await;
            return Err(AppError::Auth("Account temporarily locked. Try again later.".into()));
        }
    }

    // Verify password
    let parsed_hash = PasswordHash::new(&hash).map_err(|_| auth_error())?;
    if Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed_hash)
        .is_err()
    {
        // Increment failed attempts
        let new_attempts = failed_attempts + 1;
        let lock_until = if new_attempts >= 5 {
            Some(chrono::Utc::now() + chrono::Duration::minutes(15))
        } else {
            None
        };
        let _ = sqlx::query(
            "UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3",
        )
        .bind(new_attempts)
        .bind(lock_until)
        .bind(user_id)
        .execute(&state.db)
        .await;

        crate::audit::log_login(&state.db, user_id, &username, false, None).await;
        return Err(auth_error());
    }

    // Reset failed attempts on success
    let _ = sqlx::query(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1",
    )
    .bind(user_id)
    .execute(&state.db)
    .await;

    // HIPAA: Check if MFA is required [H2]
    if mfa_enabled {
        crate::audit::log_login(&state.db, user_id, &username, true, None).await;
        return Ok(Json(serde_json::json!({
            "mfa_required": true,
            "user_id": user_id,
        })).into_response());
    }

    // No MFA — issue token directly
    let token = sign_token(user_id, &username, &state.config.jwt_secret, state.config.jwt_expiry_secs);
    crate::audit::log_login(&state.db, user_id, &username, true, None).await;

    // HIPAA [C3]: Set HttpOnly cookie + return token in body (for native apps)
    let cookie_headers = make_auth_cookie(&token);
    Ok((
        cookie_headers,
        Json(serde_json::json!({
            "token": token,
            "user_id": user_id,
            "username": username,
            "display_name": display_name,
            "role": role,
            "avatar_url": avatar_url,
            "theme": theme,
            "onboarded": onboarded,
        })),
    ).into_response())
}
