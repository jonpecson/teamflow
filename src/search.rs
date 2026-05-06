use axum::extract::{Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::jwt::Claims;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct SearchParams {
    pub q: String,
    #[serde(rename = "type")]
    pub search_type: Option<String>,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub messages: Vec<MessageSearchResult>,
    pub channels: Vec<ChannelSearchResult>,
    pub users: Vec<UserSearchResult>,
}

#[derive(Serialize)]
pub struct MessageSearchResult {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub channel_name: String,
    pub username: String,
    pub content: String,
    pub headline: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct ChannelSearchResult {
    pub id: Uuid,
    pub name: String,
    pub is_dm: bool,
}

#[derive(Serialize)]
pub struct UserSearchResult {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

pub async fn search(
    State(state): State<AppState>,
    claims: Claims,
    Query(params): Query<SearchParams>,
) -> Result<Json<SearchResult>, AppError> {
    let q = params.q.trim();
    if q.is_empty() || q.len() > 200 {
        return Ok(Json(SearchResult {
            messages: vec![],
            channels: vec![],
            users: vec![],
        }));
    }

    let search_type = params.search_type.as_deref().unwrap_or("all");

    let mut result = SearchResult {
        messages: vec![],
        channels: vec![],
        users: vec![],
    };

    if search_type == "all" || search_type == "channels" {
        let pattern = format!("%{}%", q);
        let channels = sqlx::query_as::<_, (Uuid, String, bool)>(
            "SELECT c.id, c.name, c.is_dm FROM channels c \
             JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = $1 \
             WHERE c.name ILIKE $2 AND c.is_dm = false \
             ORDER BY c.name LIMIT 10",
        )
        .bind(claims.sub)
        .bind(&pattern)
        .fetch_all(&state.db)
        .await?;

        result.channels = channels
            .into_iter()
            .map(|(id, name, is_dm)| ChannelSearchResult { id, name, is_dm })
            .collect();
    }

    if search_type == "all" || search_type == "users" {
        let pattern = format!("%{}%", q);
        let users = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>)>(
            "SELECT id, username, display_name, avatar_url FROM users \
             WHERE username ILIKE $1 OR display_name ILIKE $1 \
             ORDER BY username LIMIT 10",
        )
        .bind(&pattern)
        .fetch_all(&state.db)
        .await?;

        result.users = users
            .into_iter()
            .map(|(id, username, display_name, avatar_url)| UserSearchResult {
                id,
                username,
                display_name,
                avatar_url,
            })
            .collect();
    }

    if search_type == "all" || search_type == "messages" {
        let messages = sqlx::query_as::<_, (Uuid, Uuid, String, String, String, String, chrono::DateTime<chrono::Utc>)>(
            "SELECT m.id, m.channel_id, c.name, u.username, m.content, \
             ts_headline('english', m.content, plainto_tsquery('english', $1), \
               'StartSel=<<, StopSel=>>, MaxWords=35, MinWords=15') as headline, \
             m.created_at \
             FROM messages m \
             JOIN users u ON u.id = m.user_id \
             JOIN channels c ON c.id = m.channel_id \
             JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = $2 \
             WHERE m.search_vector @@ plainto_tsquery('english', $1) \
             AND m.deleted_at IS NULL \
             ORDER BY m.created_at DESC \
             LIMIT 20",
        )
        .bind(q)
        .bind(claims.sub)
        .fetch_all(&state.db)
        .await?;

        result.messages = messages
            .into_iter()
            .map(|(id, channel_id, channel_name, username, content, headline, created_at)| {
                MessageSearchResult {
                    id,
                    channel_id,
                    channel_name,
                    username,
                    content,
                    headline,
                    created_at,
                }
            })
            .collect();
    }

    Ok(Json(result))
}
