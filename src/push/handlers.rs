use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use serde::Deserialize;

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct RegisterDeviceReq {
    pub token: String,
    pub platform: Option<String>,
}

pub async fn register_device(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<RegisterDeviceReq>,
) -> Result<StatusCode, AppError> {
    let platform = body.platform.unwrap_or_else(|| "apns".to_string());

    sqlx::query(
        "INSERT INTO device_tokens (user_id, token, platform) VALUES ($1, $2, $3) ON CONFLICT (user_id, token) DO NOTHING",
    )
    .bind(claims.sub)
    .bind(&body.token)
    .bind(&platform)
    .execute(&state.db)
    .await?;

    tracing::info!(user_id = %claims.sub, platform = %platform, "Device token registered");
    Ok(StatusCode::CREATED)
}

pub async fn unregister_device(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<RegisterDeviceReq>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM device_tokens WHERE user_id = $1 AND token = $2")
        .bind(claims.sub)
        .bind(&body.token)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::OK)
}
