use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::domain::{CallStatus, CallType};

#[derive(Debug, sqlx::FromRow)]
pub struct CallSessionRow {
    pub id: Uuid,
    pub meeting_id: String,
    pub external_id: String,
    pub channel_id: Uuid,
    pub call_type: CallType,
    pub status: CallStatus,
    pub started_by: Uuid,
    pub started_at: DateTime<Utc>,
    pub answered_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub end_reason: Option<String>,
    pub media_region: String,
    pub media_placement: Option<serde_json::Value>,
    pub max_participants: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct CallParticipantRow {
    pub id: Uuid,
    pub call_session_id: Uuid,
    pub user_id: Uuid,
    pub attendee_id: Option<String>,
    pub joined_at: DateTime<Utc>,
    pub left_at: Option<DateTime<Utc>>,
    pub is_muted: bool,
    pub has_video: bool,
    pub is_sharing: bool,
}

pub async fn insert_call_session(
    pool: &PgPool,
    meeting_id: &str,
    external_id: &str,
    channel_id: Uuid,
    call_type: CallType,
    started_by: Uuid,
    media_region: &str,
    media_placement: &serde_json::Value,
) -> Result<CallSessionRow, sqlx::Error> {
    sqlx::query_as::<_, CallSessionRow>(
        r#"INSERT INTO call_sessions (meeting_id, external_id, channel_id, call_type, status, started_by, media_region, media_placement)
           VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
           RETURNING *"#,
    )
    .bind(meeting_id)
    .bind(external_id)
    .bind(channel_id)
    .bind(call_type)
    .bind(started_by)
    .bind(media_region)
    .bind(media_placement)
    .fetch_one(pool)
    .await
}

pub async fn update_call_status(
    pool: &PgPool,
    meeting_id: &str,
    status: CallStatus,
    end_reason: Option<&str>,
) -> Result<(), sqlx::Error> {
    let ended_at = if status.is_terminal() {
        Some(Utc::now())
    } else {
        None
    };
    let answered_at = if status == CallStatus::Active {
        Some(Utc::now())
    } else {
        None
    };

    sqlx::query(
        r#"UPDATE call_sessions SET status = $1, end_reason = $2, ended_at = COALESCE($3, ended_at), answered_at = COALESCE($4, answered_at)
           WHERE meeting_id = $5"#,
    )
    .bind(status)
    .bind(end_reason)
    .bind(ended_at)
    .bind(answered_at)
    .bind(meeting_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_participant(
    pool: &PgPool,
    meeting_id: &str,
    user_id: Uuid,
    attendee_id: &str,
) -> Result<(), sqlx::Error> {
    let session_id: (Uuid,) =
        sqlx::query_as("SELECT id FROM call_sessions WHERE meeting_id = $1")
            .bind(meeting_id)
            .fetch_one(pool)
            .await?;

    sqlx::query(
        r#"INSERT INTO call_participants (call_session_id, user_id, attendee_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (call_session_id, user_id) DO UPDATE SET left_at = NULL, attendee_id = $3"#,
    )
    .bind(session_id.0)
    .bind(user_id)
    .bind(attendee_id)
    .execute(pool)
    .await?;

    // Update max_participants
    sqlx::query(
        r#"UPDATE call_sessions SET max_participants = GREATEST(max_participants,
           (SELECT COUNT(*) FROM call_participants WHERE call_session_id = $1 AND left_at IS NULL)::int)
           WHERE id = $1"#,
    )
    .bind(session_id.0)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn remove_participant(
    pool: &PgPool,
    meeting_id: &str,
    user_id: Uuid,
) -> Result<i64, sqlx::Error> {
    let session_id: (Uuid,) =
        sqlx::query_as("SELECT id FROM call_sessions WHERE meeting_id = $1")
            .bind(meeting_id)
            .fetch_one(pool)
            .await?;

    // Set left_at
    sqlx::query(
        "UPDATE call_participants SET left_at = now() WHERE call_session_id = $1 AND user_id = $2 AND left_at IS NULL",
    )
    .bind(session_id.0)
    .bind(user_id)
    .execute(pool)
    .await?;

    // Return remaining active participants
    let (count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM call_participants WHERE call_session_id = $1 AND left_at IS NULL",
    )
    .bind(session_id.0)
    .fetch_one(pool)
    .await?;

    Ok(count)
}

pub async fn update_participant_media(
    pool: &PgPool,
    meeting_id: &str,
    user_id: Uuid,
    is_muted: Option<bool>,
    has_video: Option<bool>,
    is_sharing: Option<bool>,
) -> Result<(), sqlx::Error> {
    let session_id: (Uuid,) =
        sqlx::query_as("SELECT id FROM call_sessions WHERE meeting_id = $1")
            .bind(meeting_id)
            .fetch_one(pool)
            .await?;

    if let Some(muted) = is_muted {
        sqlx::query(
            "UPDATE call_participants SET is_muted = $1 WHERE call_session_id = $2 AND user_id = $3",
        )
        .bind(muted)
        .bind(session_id.0)
        .bind(user_id)
        .execute(pool)
        .await?;
    }
    if let Some(video) = has_video {
        sqlx::query(
            "UPDATE call_participants SET has_video = $1 WHERE call_session_id = $2 AND user_id = $3",
        )
        .bind(video)
        .bind(session_id.0)
        .bind(user_id)
        .execute(pool)
        .await?;
    }
    if let Some(sharing) = is_sharing {
        sqlx::query(
            "UPDATE call_participants SET is_sharing = $1 WHERE call_session_id = $2 AND user_id = $3",
        )
        .bind(sharing)
        .bind(session_id.0)
        .bind(user_id)
        .execute(pool)
        .await?;
    }
    Ok(())
}

pub async fn insert_call_event(
    pool: &PgPool,
    meeting_id: &str,
    user_id: Option<Uuid>,
    event_type: &str,
    metadata: Option<&serde_json::Value>,
) -> Result<(), sqlx::Error> {
    let session_id: (Uuid,) =
        sqlx::query_as("SELECT id FROM call_sessions WHERE meeting_id = $1")
            .bind(meeting_id)
            .fetch_one(pool)
            .await?;

    sqlx::query(
        "INSERT INTO call_events (call_session_id, user_id, event_type, metadata) VALUES ($1, $2, $3, $4)",
    )
    .bind(session_id.0)
    .bind(user_id)
    .bind(event_type)
    .bind(metadata)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_call_usage(
    pool: &PgPool,
    meeting_id: &str,
    user_id: Uuid,
    duration_secs: i32,
    has_video: bool,
    has_screen_share: bool,
    media_region: &str,
) -> Result<(), sqlx::Error> {
    let session_id: (Uuid,) =
        sqlx::query_as("SELECT id FROM call_sessions WHERE meeting_id = $1")
            .bind(meeting_id)
            .fetch_one(pool)
            .await?;

    sqlx::query(
        r#"INSERT INTO call_usage (call_session_id, user_id, duration_secs, has_video, has_screen_share, media_region)
           VALUES ($1, $2, $3, $4, $5, $6)"#,
    )
    .bind(session_id.0)
    .bind(user_id)
    .bind(duration_secs)
    .bind(has_video)
    .bind(has_screen_share)
    .bind(media_region)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_active_sessions(pool: &PgPool) -> Result<Vec<CallSessionRow>, sqlx::Error> {
    sqlx::query_as::<_, CallSessionRow>(
        "SELECT * FROM call_sessions WHERE status IN ('ringing', 'active')",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_active_participants(
    pool: &PgPool,
    meeting_id: &str,
) -> Result<Vec<(Uuid, String)>, sqlx::Error> {
    sqlx::query_as::<_, (Uuid, String)>(
        r#"SELECT cp.user_id, u.username
           FROM call_participants cp
           JOIN call_sessions cs ON cs.id = cp.call_session_id
           JOIN users u ON u.id = cp.user_id
           WHERE cs.meeting_id = $1 AND cp.left_at IS NULL"#,
    )
    .bind(meeting_id)
    .fetch_all(pool)
    .await
}

pub async fn get_stale_ringing(
    pool: &PgPool,
    timeout_secs: i64,
) -> Result<Vec<CallSessionRow>, sqlx::Error> {
    sqlx::query_as::<_, CallSessionRow>(
        r#"SELECT * FROM call_sessions
           WHERE status = 'ringing'
           AND started_at < now() - make_interval(secs => $1)"#,
    )
    .bind(timeout_secs as f64)
    .fetch_all(pool)
    .await
}

pub async fn get_empty_active(pool: &PgPool, timeout_secs: i64) -> Result<Vec<CallSessionRow>, sqlx::Error> {
    sqlx::query_as::<_, CallSessionRow>(
        r#"SELECT cs.* FROM call_sessions cs
           WHERE cs.status = 'active'
           AND NOT EXISTS (
               SELECT 1 FROM call_participants cp
               WHERE cp.call_session_id = cs.id AND cp.left_at IS NULL
           )
           AND cs.started_at < now() - make_interval(secs => $1)"#,
    )
    .bind(timeout_secs as f64)
    .fetch_all(pool)
    .await
}
