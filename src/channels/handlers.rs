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

#[derive(Deserialize)]
pub struct CreateChannelReq {
    pub name: String,
}

#[derive(Serialize)]
pub struct ChannelResp {
    pub id: Uuid,
    pub name: String,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub is_dm: bool,
}

#[derive(Serialize)]
pub struct UserResp {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct InviteReq {
    pub user_id: Uuid,
}

#[derive(Serialize)]
pub struct MemberResp {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    pub before: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct MessageResp {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub role: Option<String>,
    pub avatar_url: Option<String>,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub parent_id: Option<Uuid>,
    pub reply_count: i32,
    pub last_reply_at: Option<DateTime<Utc>>,
    pub reactions: Vec<crate::reactions::ReactionData>,
    pub attachments: Vec<crate::files::AttachmentResp>,
}

pub async fn list_channels(
    State(state): State<AppState>,
    _claims: Claims,
) -> Result<Json<Vec<ChannelResp>>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, Uuid, DateTime<Utc>, bool)>(
        "SELECT id, name, created_by, created_at, is_dm FROM channels WHERE is_dm = false ORDER BY created_at",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| ChannelResp {
                id: r.0,
                name: r.1,
                created_by: r.2,
                created_at: r.3,
                is_dm: r.4,
            })
            .collect(),
    ))
}

pub async fn list_users(
    State(state): State<AppState>,
    _claims: Claims,
) -> Result<Json<Vec<UserResp>>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>, Option<String>, DateTime<Utc>)>(
        "SELECT id, username, display_name, role, avatar_url, created_at FROM users ORDER BY COALESCE(display_name, username)",
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| UserResp {
                id: r.0,
                username: r.1,
                display_name: r.2,
                role: r.3,
                avatar_url: r.4,
                created_at: r.5,
            })
            .collect(),
    ))
}

pub async fn invite_to_channel(
    State(state): State<AppState>,
    claims: Claims,
    Path(channel_id): Path<Uuid>,
    Json(body): Json<InviteReq>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify channel exists and is not a DM
    let channel = sqlx::query_as::<_, (Uuid, String, bool)>(
        "SELECT id, name, is_dm FROM channels WHERE id = $1",
    )
    .bind(channel_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Channel not found".into()))?;

    if channel.2 {
        return Err(AppError::BadRequest("Cannot invite to a DM channel".into()));
    }

    // Verify inviter is a member
    sqlx::query_as::<_, (Uuid,)>(
        "SELECT channel_id FROM channel_members WHERE channel_id = $1 AND user_id = $2",
    )
    .bind(channel_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::BadRequest("You are not a member of this channel".into()))?;

    // Verify target user exists
    let target = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, username FROM users WHERE id = $1",
    )
    .bind(body.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Add them to channel
    sqlx::query(
        "INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(channel_id)
    .bind(body.user_id)
    .execute(&state.db)
    .await?;

    // Notify the invited user via WS
    let invite_msg = ServerMsg::Invited {
        channel_id,
        channel_name: channel.1.clone(),
        invited_by: claims.username.clone(),
    };
    if let Some(sender) = state.connections.get(&body.user_id) {
        let _ = sender.send(invite_msg);
    }

    // Notify channel members about the new join
    let join_msg = ServerMsg::ChannelJoined {
        channel_id,
        user_id: body.user_id,
        username: target.1,
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
            let _ = sender.send(join_msg.clone());
        }
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn get_or_create_dm(
    State(state): State<AppState>,
    claims: Claims,
    Path(target_user_id): Path<Uuid>,
) -> Result<Json<ChannelResp>, AppError> {
    if claims.sub == target_user_id {
        return Err(AppError::BadRequest("Cannot DM yourself".into()));
    }

    // Verify target exists
    let target = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, username FROM users WHERE id = $1",
    )
    .bind(target_user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    // Check if DM channel already exists between these two users
    let existing = sqlx::query_as::<_, (Uuid, String, Uuid, DateTime<Utc>, bool)>(
        "SELECT c.id, c.name, c.created_by, c.created_at, c.is_dm FROM channels c \
         WHERE c.is_dm = true \
         AND EXISTS (SELECT 1 FROM channel_members cm1 WHERE cm1.channel_id = c.id AND cm1.user_id = $1) \
         AND EXISTS (SELECT 1 FROM channel_members cm2 WHERE cm2.channel_id = c.id AND cm2.user_id = $2) \
         LIMIT 1",
    )
    .bind(claims.sub)
    .bind(target_user_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(r) = existing {
        return Ok(Json(ChannelResp {
            id: r.0,
            name: r.1,
            created_by: r.2,
            created_at: r.3,
            is_dm: r.4,
        }));
    }

    // Create new DM channel
    let dm_name = format!("dm-{}-{}", claims.username, target.1);
    let row = sqlx::query_as::<_, (Uuid, String, Uuid, DateTime<Utc>, bool)>(
        "INSERT INTO channels (name, created_by, is_dm) VALUES ($1, $2, true) RETURNING id, name, created_by, created_at, is_dm",
    )
    .bind(&dm_name)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await?;

    // Add both users
    sqlx::query("INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2), ($1, $3)")
        .bind(row.0)
        .bind(claims.sub)
        .bind(target_user_id)
        .execute(&state.db)
        .await?;

    Ok(Json(ChannelResp {
        id: row.0,
        name: row.1,
        created_by: row.2,
        created_at: row.3,
        is_dm: row.4,
    }))
}

pub async fn create_channel(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<CreateChannelReq>,
) -> Result<(StatusCode, Json<ChannelResp>), AppError> {
    let name = body.name.trim();
    if name.len() < 2 || name.len() > 64 {
        return Err(AppError::BadRequest(
            "Channel name must be 2-64 characters".into(),
        ));
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::BadRequest(
            "Channel name must be alphanumeric, hyphens, or underscores".into(),
        ));
    }

    let row = sqlx::query_as::<_, (Uuid, String, Uuid, DateTime<Utc>)>(
        "INSERT INTO channels (name, created_by) VALUES ($1, $2) RETURNING id, name, created_by, created_at",
    )
    .bind(name)
    .bind(claims.sub)
    .fetch_one(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.is_unique_violation() => {
            AppError::BadRequest("Channel name already exists".into())
        }
        _ => AppError::Db(e),
    })?;

    // Auto-join creator
    let _ = sqlx::query("INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(row.0)
        .bind(claims.sub)
        .execute(&state.db)
        .await;

    Ok((
        StatusCode::CREATED,
        Json(ChannelResp {
            id: row.0,
            name: row.1,
            created_by: row.2,
            created_at: row.3,
            is_dm: false,
        }),
    ))
}

pub async fn join_channel(
    State(state): State<AppState>,
    claims: Claims,
    Path(channel_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Verify channel exists
    sqlx::query_as::<_, (Uuid,)>("SELECT id FROM channels WHERE id = $1")
        .bind(channel_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Channel not found".into()))?;

    sqlx::query(
        "INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    )
    .bind(channel_id)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}

pub async fn leave_channel(
    State(state): State<AppState>,
    claims: Claims,
    Path(channel_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    sqlx::query("DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2")
        .bind(channel_id)
        .bind(claims.sub)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::OK)
}

pub async fn channel_members(
    State(state): State<AppState>,
    _claims: Claims,
    Path(channel_id): Path<Uuid>,
) -> Result<Json<Vec<MemberResp>>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>, Option<String>)>(
        "SELECT u.id, u.username, u.display_name, u.role, u.avatar_url \
         FROM channel_members cm JOIN users u ON u.id = cm.user_id \
         WHERE cm.channel_id = $1 ORDER BY COALESCE(u.display_name, u.username)",
    )
    .bind(channel_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| MemberResp {
                user_id: r.0,
                username: r.1,
                display_name: r.2,
                role: r.3,
                avatar_url: r.4,
            })
            .collect(),
    ))
}

pub async fn channel_history(
    State(state): State<AppState>,
    _claims: Claims,
    Path(channel_id): Path<Uuid>,
    Query(params): Query<HistoryQuery>,
) -> Result<Json<Vec<MessageResp>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(200);
    let before = params.before.unwrap_or_else(|| Utc::now() + chrono::Duration::days(1));

    // HIPAA: Fetch with encrypted content support + user profile data + threading
    let rows = sqlx::query_as::<_, (Uuid, Uuid, Uuid, String, String, Option<String>, Option<String>, Option<bool>, DateTime<Utc>, Option<String>, Option<String>, Option<String>, Option<Uuid>, i32, Option<DateTime<Utc>>)>(
        "SELECT m.id, m.channel_id, m.user_id, u.username, m.content, \
         m.content_encrypted, m.content_nonce, m.encrypted, m.created_at, \
         u.display_name, u.role, u.avatar_url, \
         m.parent_id, COALESCE(m.reply_count, 0), m.last_reply_at \
         FROM messages m JOIN users u ON u.id = m.user_id \
         WHERE m.channel_id = $1 AND m.created_at < $2 \
         AND m.parent_id IS NULL AND m.deleted_at IS NULL \
         ORDER BY m.created_at DESC LIMIT $3",
    )
    .bind(channel_id)
    .bind(before)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    let enc_key = state.config.message_encryption_key.as_deref();
    let message_ids: Vec<Uuid> = rows.iter().map(|r| r.0).collect();

    // Fetch reactions and attachments for all messages in batch
    let reactions_map = crate::reactions::get_reactions_for_messages(&state.db, &message_ids)
        .await
        .unwrap_or_default();

    let attachments_map = get_attachments_for_messages(&state.db, &message_ids)
        .await
        .unwrap_or_default();

    let mut messages: Vec<MessageResp> = rows
        .into_iter()
        .map(|r| {
            let is_encrypted = r.7.unwrap_or(false);
            let content = if is_encrypted {
                match (&r.5, &r.6, enc_key) {
                    (Some(ct), Some(nonce), Some(key)) => {
                        crate::crypto::decrypt(ct, nonce, key)
                            .unwrap_or_else(|_| "[encrypted]".to_string())
                    }
                    _ => "[encrypted]".to_string(),
                }
            } else {
                r.4.clone()
            };
            let msg_id = r.0;
            MessageResp {
                id: msg_id,
                channel_id: r.1,
                user_id: r.2,
                username: r.3,
                display_name: r.9,
                role: r.10,
                avatar_url: r.11,
                content,
                created_at: r.8,
                parent_id: r.12,
                reply_count: r.13,
                last_reply_at: r.14,
                reactions: reactions_map.get(&msg_id).cloned().unwrap_or_default(),
                attachments: attachments_map.get(&msg_id).cloned().unwrap_or_default(),
            }
        })
        .collect();

    messages.reverse(); // oldest first
    Ok(Json(messages))
}

async fn get_attachments_for_messages(
    db: &sqlx::PgPool,
    message_ids: &[Uuid],
) -> Result<std::collections::HashMap<Uuid, Vec<crate::files::AttachmentResp>>, sqlx::Error> {
    if message_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }
    let rows = sqlx::query_as::<_, (Uuid, Uuid, String, i64, String, String, Option<i32>, Option<i32>)>(
        "SELECT message_id, id, file_name, file_size, content_type, url, width, height \
         FROM message_attachments WHERE message_id = ANY($1) ORDER BY created_at",
    )
    .bind(message_ids)
    .fetch_all(db)
    .await?;

    let mut result: std::collections::HashMap<Uuid, Vec<crate::files::AttachmentResp>> = std::collections::HashMap::new();
    for r in rows {
        result.entry(r.0).or_default().push(crate::files::AttachmentResp {
            id: r.1,
            file_name: r.2,
            file_size: r.3,
            content_type: r.4,
            url: r.5,
            width: r.6,
            height: r.7,
        });
    }
    Ok(result)
}

pub async fn my_channels(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<ChannelResp>>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, Uuid, DateTime<Utc>, bool)>(
        "SELECT c.id, c.name, c.created_by, c.created_at, c.is_dm FROM channels c \
         JOIN channel_members cm ON cm.channel_id = c.id \
         WHERE cm.user_id = $1 ORDER BY c.name",
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|r| ChannelResp {
                id: r.0,
                name: r.1,
                created_by: r.2,
                created_at: r.3,
                is_dm: r.4,
            })
            .collect(),
    ))
}

/// POST /api/channels/:id/read — mark all messages in a channel as read for the current user
pub async fn mark_channel_read(
    State(state): State<AppState>,
    claims: Claims,
    Path(channel_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    // Verify membership
    sqlx::query_as::<_, (Uuid,)>(
        "SELECT channel_id FROM channel_members WHERE channel_id = $1 AND user_id = $2",
    )
    .bind(channel_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Auth("Not a member of this channel".into()))?;

    sqlx::query(
        "INSERT INTO channel_read_positions (channel_id, user_id, last_read_at) \
         VALUES ($1, $2, now()) \
         ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = now()",
    )
    .bind(channel_id)
    .bind(claims.sub)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}
