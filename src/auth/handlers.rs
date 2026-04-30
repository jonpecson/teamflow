use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::auth::jwt::sign_token;
use crate::error::AppError;
use crate::state::AppState;

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::SaltString;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};

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
}

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterReq>,
) -> Result<(StatusCode, Json<AuthResp>), AppError> {
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
    if body.password.len() < 6 {
        return Err(AppError::BadRequest(
            "Password must be at least 6 characters".into(),
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
            AppError::BadRequest("Username already taken".into())
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

    Ok((
        StatusCode::CREATED,
        Json(AuthResp {
            token,
            user_id: row.0,
            username: username.to_string(),
        }),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginReq>,
) -> Result<Json<AuthResp>, AppError> {
    let row = sqlx::query_as::<_, (uuid::Uuid, String, String)>(
        "SELECT id, username, password_hash FROM users WHERE username = $1",
    )
    .bind(&body.username)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Auth("Invalid username or password".into()))?;

    let parsed_hash =
        PasswordHash::new(&row.2).map_err(|e| AppError::Auth(format!("Hash parse error: {e}")))?;

    Argon2::default()
        .verify_password(body.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Auth("Invalid username or password".into()))?;

    let token = sign_token(
        row.0,
        &row.1,
        &state.config.jwt_secret,
        state.config.jwt_expiry_secs,
    );

    Ok(Json(AuthResp {
        token,
        user_id: row.0,
        username: row.1,
    }))
}
