use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Serialize)]
pub struct SavedMessageResp {
    pub id: Uuid,
    pub message_id: Uuid,
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub saved_at: chrono::DateTime<chrono::Utc>,
}

/// POST /api/messages/:id/bookmark — toggle bookmark
pub async fn toggle_bookmark(
    State(state): State<AppState>,
    claims: Claims,
    Path(message_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let existing = sqlx::query_as::<_, (Uuid,)>(
        "SELECT id FROM saved_messages WHERE user_id = $1 AND message_id = $2",
    )
    .bind(claims.sub)
    .bind(message_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some((id,)) = existing {
        sqlx::query("DELETE FROM saved_messages WHERE id = $1")
            .bind(id)
            .execute(&state.db)
            .await?;
        Ok(StatusCode::OK)
    } else {
        sqlx::query(
            "INSERT INTO saved_messages (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(claims.sub)
        .bind(message_id)
        .execute(&state.db)
        .await?;
        Ok(StatusCode::CREATED)
    }
}

/// GET /api/bookmarks — list saved messages
pub async fn list_bookmarks(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<SavedMessageResp>>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, Uuid, Uuid, Uuid, String, Option<String>, String, chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>)>(
        "SELECT sm.id, m.id, m.channel_id, m.user_id, u.username, u.display_name, \
         COALESCE(m.content, ''), m.created_at, sm.created_at \
         FROM saved_messages sm \
         JOIN messages m ON m.id = sm.message_id \
         JOIN users u ON u.id = m.user_id \
         WHERE sm.user_id = $1 AND m.deleted_at IS NULL \
         ORDER BY sm.created_at DESC \
         LIMIT 100",
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| SavedMessageResp {
                id: r.0,
                message_id: r.1,
                channel_id: r.2,
                user_id: r.3,
                username: r.4,
                display_name: r.5,
                content: r.6,
                created_at: r.7,
                saved_at: r.8,
            })
            .collect(),
    ))
}
