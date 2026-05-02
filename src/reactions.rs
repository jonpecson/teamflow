use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;
use crate::ws::messages::ServerMsg;

#[derive(Deserialize)]
pub struct ReactionReq {
    pub emoji: String,
}

#[derive(Serialize, Clone)]
pub struct ReactionData {
    pub emoji: String,
    pub count: i64,
    pub users: Vec<String>,
}

/// POST /api/messages/:id/reactions — toggle a reaction
pub async fn toggle_reaction(
    State(state): State<AppState>,
    claims: Claims,
    Path(message_id): Path<Uuid>,
    Json(body): Json<ReactionReq>,
) -> Result<StatusCode, AppError> {
    // Validate emoji (max 32 chars, covers multi-codepoint emoji)
    if body.emoji.is_empty() || body.emoji.len() > 32 {
        return Err(AppError::BadRequest("Invalid emoji".into()));
    }

    // Check if reaction already exists
    let existing = sqlx::query_as::<_, (Uuid,)>(
        "SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
    )
    .bind(message_id)
    .bind(claims.sub)
    .bind(&body.emoji)
    .fetch_optional(&state.db)
    .await?;

    let added = if let Some((id,)) = existing {
        // Remove reaction
        sqlx::query("DELETE FROM message_reactions WHERE id = $1")
            .bind(id)
            .execute(&state.db)
            .await?;
        false
    } else {
        // Add reaction
        sqlx::query(
            "INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        )
        .bind(message_id)
        .bind(claims.sub)
        .bind(&body.emoji)
        .execute(&state.db)
        .await?;
        true
    };

    // Get channel_id for broadcasting
    let (channel_id,): (Uuid,) = sqlx::query_as(
        "SELECT channel_id FROM messages WHERE id = $1",
    )
    .bind(message_id)
    .fetch_one(&state.db)
    .await?;

    // Broadcast reaction update to channel members
    let members = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM channel_members WHERE channel_id = $1",
    )
    .bind(channel_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let reaction_msg = ServerMsg::ReactionUpdate {
        message_id,
        channel_id,
        emoji: body.emoji,
        user_id: claims.sub,
        username: claims.username,
        added,
    };

    for (member_id,) in members {
        if let Some(sender) = state.connections.get(&member_id) {
            let _ = sender.send(reaction_msg.clone());
        }
    }

    Ok(if added { StatusCode::CREATED } else { StatusCode::OK })
}

/// Get reactions for a message (used in channel_history enrichment)
pub async fn get_reactions_for_messages(
    db: &sqlx::PgPool,
    message_ids: &[Uuid],
) -> Result<std::collections::HashMap<Uuid, Vec<ReactionData>>, sqlx::Error> {
    if message_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let rows = sqlx::query_as::<_, (Uuid, String, i64, String)>(
        "SELECT mr.message_id, mr.emoji, COUNT(*), STRING_AGG(u.username, ',') \
         FROM message_reactions mr \
         JOIN users u ON u.id = mr.user_id \
         WHERE mr.message_id = ANY($1) \
         GROUP BY mr.message_id, mr.emoji \
         ORDER BY MIN(mr.created_at)",
    )
    .bind(message_ids)
    .fetch_all(db)
    .await?;

    let mut result: std::collections::HashMap<Uuid, Vec<ReactionData>> = std::collections::HashMap::new();
    for (msg_id, emoji, count, users_str) in rows {
        result.entry(msg_id).or_default().push(ReactionData {
            emoji,
            count,
            users: users_str.split(',').map(|s| s.to_string()).collect(),
        });
    }
    Ok(result)
}
