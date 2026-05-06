use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;
use crate::ws::messages::ServerMsg;

#[derive(Deserialize)]
pub struct StatusRequest {
    pub emoji: Option<String>,
    pub text: Option<String>,
}

pub async fn update_status(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<StatusRequest>,
) -> Result<axum::http::StatusCode, AppError> {
    // Validate
    if let Some(ref emoji) = req.emoji {
        if emoji.len() > 32 {
            return Err(AppError::Validation("Emoji too long".into()));
        }
    }
    if let Some(ref text) = req.text {
        if text.len() > 128 {
            return Err(AppError::Validation("Status text too long".into()));
        }
    }

    sqlx::query("UPDATE users SET status_emoji = $1, status_text = $2 WHERE id = $3")
        .bind(&req.emoji)
        .bind(&req.text)
        .bind(claims.sub)
        .execute(&state.db)
        .await?;

    // Broadcast to all connected users
    let msg = ServerMsg::UserStatusChanged {
        user_id: claims.sub,
        username: claims.username.clone(),
        status_emoji: req.emoji,
        status_text: req.text,
    };

    for entry in state.connections.iter() {
        let _ = entry.value().send(msg.clone());
    }

    Ok(axum::http::StatusCode::OK)
}
