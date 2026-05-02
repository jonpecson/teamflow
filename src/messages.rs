use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;
use crate::ws::messages::ServerMsg;

#[derive(Serialize)]
pub struct ThreadReplyResp {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub parent_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub avatar_url: Option<String>,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct ThreadQuery {
    pub limit: Option<i64>,
}

/// GET /api/messages/:id/replies — get thread replies
pub async fn thread_replies(
    State(state): State<AppState>,
    _claims: Claims,
    Path(message_id): Path<Uuid>,
    Query(params): Query<ThreadQuery>,
) -> Result<Json<Vec<ThreadReplyResp>>, AppError> {
    let limit = params.limit.unwrap_or(100).min(200);

    let rows = sqlx::query_as::<_, (Uuid, Uuid, Uuid, Uuid, String, Option<String>, Option<String>, Option<String>, String, DateTime<Utc>)>(
        "SELECT m.id, m.channel_id, m.parent_id, m.user_id, u.username, \
         u.display_name, u.role, u.avatar_url, m.content, m.created_at \
         FROM messages m JOIN users u ON u.id = m.user_id \
         WHERE m.parent_id = $1 AND m.deleted_at IS NULL \
         ORDER BY m.created_at ASC LIMIT $2",
    )
    .bind(message_id)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| ThreadReplyResp {
                id: r.0,
                channel_id: r.1,
                parent_id: r.2,
                user_id: r.3,
                username: r.4,
                display_name: r.5,
                role: r.6,
                avatar_url: r.7,
                content: r.8,
                created_at: r.9,
            })
            .collect(),
    ))
}

/// DELETE /api/messages/:id — soft-delete own message
pub async fn delete_message(
    State(state): State<AppState>,
    claims: Claims,
    Path(message_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Only allow deleting own messages
    let row = sqlx::query_as::<_, (Uuid, Uuid)>(
        "SELECT user_id, channel_id FROM messages WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(message_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Message not found".into()))?;

    if row.0 != claims.sub {
        return Err(AppError::Auth("Can only delete your own messages".into()));
    }

    // Soft delete
    sqlx::query("UPDATE messages SET deleted_at = now(), content = '[deleted]' WHERE id = $1")
        .bind(message_id)
        .execute(&state.db)
        .await?;

    // Broadcast deletion to channel members
    let channel_id = row.1;
    let members = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM channel_members WHERE channel_id = $1",
    )
    .bind(channel_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let delete_msg = ServerMsg::MessageDeleted {
        message_id,
        channel_id,
    };

    for (member_id,) in members {
        if let Some(sender) = state.connections.get(&member_id) {
            let _ = sender.send(delete_msg.clone());
        }
    }

    Ok(StatusCode::OK)
}
