use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

use crate::auth::jwt::Claims;
use crate::calls::domain::CallType;
use crate::calls::state::MeetingData;
use crate::error::AppError;
use crate::state::AppState;
use crate::ws::messages::ServerMsg;

use super::repository;

#[derive(Deserialize)]
pub struct StartCallReq {
    pub channel_id: Uuid,
}

#[derive(Serialize)]
pub struct CallResp {
    pub meeting_id: String,
    pub channel_id: Uuid,
    pub started_by: String,
    pub attendee: AttendeeInfo,
    pub media_placement: serde_json::Value,
}

#[derive(Serialize)]
pub struct AttendeeInfo {
    pub attendee_id: String,
    pub join_token: String,
}

#[derive(Serialize)]
pub struct ActiveCallResp {
    pub meeting_id: String,
    pub channel_id: Uuid,
    pub channel_name: String,
    pub started_by: String,
    pub participants: Vec<String>,
    pub started_at: chrono::DateTime<chrono::Utc>,
}

pub async fn start_call(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<StartCallReq>,
) -> Result<(StatusCode, Json<CallResp>), AppError> {
    // Rate limit check
    if !state.rate_limiter.check(claims.sub) {
        return Err(AppError::BadRequest("Too many call attempts. Please wait.".into()));
    }

    // Verify channel exists and user is member
    sqlx::query_as::<_, (Uuid,)>(
        "SELECT channel_id FROM channel_members WHERE channel_id = $1 AND user_id = $2",
    )
    .bind(body.channel_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::BadRequest("Not a member of this channel".into()))?;

    // Check if there's already an active call in this channel
    if let Some(existing_meeting_id) = state.calls.channel_meetings.get(&body.channel_id) {
        return join_existing_call(&state, &claims, &existing_meeting_id).await;
    }

    // Create meeting via provider
    let short_id = &Uuid::new_v4().to_string()[..8];
    let external_meeting_id = format!("tf-{}", short_id);

    let meeting_info = state
        .call_provider
        .create_meeting(&external_meeting_id, &state.config.aws_region)
        .await
        .map_err(|e| {
            tracing::error!("Create meeting error: {e}");
            AppError::BadRequest(format!("Create meeting failed: {e}"))
        })?;

    // Create attendee via provider
    let attendee_info = state
        .call_provider
        .create_attendee(&meeting_info.meeting_id, &claims.sub.to_string())
        .await
        .map_err(|e| AppError::BadRequest(format!("Create attendee failed: {e}")))?;

    // Write to DB first
    let _ = repository::insert_call_session(
        &state.db,
        &meeting_info.meeting_id,
        &external_meeting_id,
        body.channel_id,
        CallType::Channel,
        claims.sub,
        &meeting_info.media_region,
        &meeting_info.media_placement,
    )
    .await;

    let _ = repository::insert_participant(
        &state.db,
        &meeting_info.meeting_id,
        claims.sub,
        &attendee_info.attendee_id,
    )
    .await;

    let _ = repository::insert_call_event(
        &state.db,
        &meeting_info.meeting_id,
        Some(claims.sub),
        "call_started",
        None,
    )
    .await;

    // Then update in-memory cache
    let mut participants = HashSet::new();
    participants.insert((claims.sub, claims.username.clone()));

    state.calls.meetings.insert(
        meeting_info.meeting_id.clone(),
        MeetingData {
            meeting_id: meeting_info.meeting_id.clone(),
            channel_id: body.channel_id,
            started_by: claims.sub,
            started_by_name: claims.username.clone(),
            participants,
            media_placement: meeting_info.media_placement.clone(),
            external_meeting_id,
            started_at: Utc::now(),
        },
    );
    state
        .calls
        .channel_meetings
        .insert(body.channel_id, meeting_info.meeting_id.clone());

    // Broadcast call_started to channel members
    let channel_name = sqlx::query_as::<_, (String,)>(
        "SELECT name FROM channels WHERE id = $1",
    )
    .bind(body.channel_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None)
    .map(|r| r.0)
    .unwrap_or_default();

    let call_msg = ServerMsg::CallStarted {
        meeting_id: meeting_info.meeting_id.clone(),
        channel_id: body.channel_id,
        started_by: claims.username.clone(),
        channel_name,
    };

    // Exclude the caller — they already know they started the call
    broadcast_call_event_excluding(&state, body.channel_id, call_msg, Some(claims.sub)).await;

    Ok((
        StatusCode::CREATED,
        Json(CallResp {
            meeting_id: meeting_info.meeting_id,
            channel_id: body.channel_id,
            started_by: claims.username,
            attendee: AttendeeInfo {
                attendee_id: attendee_info.attendee_id,
                join_token: attendee_info.join_token,
            },
            media_placement: meeting_info.media_placement,
        }),
    ))
}

async fn join_existing_call(
    state: &AppState,
    claims: &Claims,
    meeting_id: &str,
) -> Result<(StatusCode, Json<CallResp>), AppError> {
    let channel_id = {
        let meeting = state
            .calls
            .meetings
            .get(meeting_id)
            .ok_or_else(|| AppError::NotFound("Meeting not found".into()))?;
        meeting.channel_id
    };

    // Create attendee via provider — if this fails, clean up stale state
    let attendee_info = match state
        .call_provider
        .create_attendee(meeting_id, &claims.sub.to_string())
        .await
    {
        Ok(info) => info,
        Err(e) => {
            tracing::warn!("Create attendee failed for meeting {meeting_id}, cleaning up: {e}");
            if let Some((_, dead_meeting)) = state.calls.meetings.remove(meeting_id) {
                state.calls.channel_meetings.remove(&dead_meeting.channel_id);
            }
            // Update DB status
            let _ = repository::update_call_status(
                &state.db,
                meeting_id,
                super::domain::CallStatus::Failed,
                Some("provider_error"),
            )
            .await;
            return Err(AppError::BadRequest(
                "Call session expired. Please start a new call.".into(),
            ));
        }
    };

    // Write to DB
    let _ = repository::insert_participant(
        &state.db,
        meeting_id,
        claims.sub,
        &attendee_info.attendee_id,
    )
    .await;

    let _ = repository::insert_call_event(
        &state.db,
        meeting_id,
        Some(claims.sub),
        "participant_joined",
        None,
    )
    .await;

    // Update in-memory cache
    let (media_placement, started_by_name) = {
        let mut meeting = state
            .calls
            .meetings
            .get_mut(meeting_id)
            .ok_or_else(|| AppError::NotFound("Meeting not found".into()))?;
        meeting
            .participants
            .insert((claims.sub, claims.username.clone()));
        (meeting.media_placement.clone(), meeting.started_by_name.clone())
    };

    // Broadcast participant joined — exclude the joiner
    broadcast_call_event_excluding(state, channel_id, ServerMsg::CallParticipantJoined {
        meeting_id: meeting_id.to_string(),
        channel_id,
        username: claims.username.clone(),
    }, Some(claims.sub))
    .await;

    Ok((
        StatusCode::CREATED,
        Json(CallResp {
            meeting_id: meeting_id.to_string(),
            channel_id,
            started_by: started_by_name,
            attendee: AttendeeInfo {
                attendee_id: attendee_info.attendee_id,
                join_token: attendee_info.join_token,
            },
            media_placement,
        }),
    ))
}

pub async fn join_call(
    State(state): State<AppState>,
    claims: Claims,
    Path(meeting_id): Path<String>,
) -> Result<(StatusCode, Json<CallResp>), AppError> {
    let channel_id = {
        let meeting = state
            .calls
            .meetings
            .get(&meeting_id)
            .ok_or_else(|| AppError::NotFound("Meeting not found".into()))?;
        meeting.channel_id
    };

    sqlx::query_as::<_, (Uuid,)>(
        "SELECT channel_id FROM channel_members WHERE channel_id = $1 AND user_id = $2",
    )
    .bind(channel_id)
    .bind(claims.sub)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::BadRequest("Not a member of this channel".into()))?;

    join_existing_call(&state, &claims, &meeting_id).await
}

pub async fn leave_call(
    State(state): State<AppState>,
    claims: Claims,
    Path(meeting_id): Path<String>,
) -> Result<StatusCode, AppError> {
    let (channel_id, is_empty) = {
        let mut meeting = match state.calls.meetings.get_mut(&meeting_id) {
            Some(m) => m,
            None => return Ok(StatusCode::OK),
        };
        meeting
            .participants
            .retain(|(uid, _)| *uid != claims.sub);
        (meeting.channel_id, meeting.participants.is_empty())
    };

    // Write to DB
    let _ = repository::remove_participant(&state.db, &meeting_id, claims.sub).await;
    let _ = repository::insert_call_event(
        &state.db,
        &meeting_id,
        Some(claims.sub),
        "participant_left",
        None,
    )
    .await;

    // Broadcast participant left — exclude the leaver
    broadcast_call_event_excluding(&state, channel_id, ServerMsg::CallParticipantLeft {
        meeting_id: meeting_id.clone(),
        channel_id,
        username: claims.username.clone(),
    }, Some(claims.sub))
    .await;

    if is_empty {
        end_meeting(&state, &meeting_id).await?;
    }

    Ok(StatusCode::OK)
}

pub async fn end_call(
    State(state): State<AppState>,
    claims: Claims,
    Path(meeting_id): Path<String>,
) -> Result<StatusCode, AppError> {
    {
        let meeting = state
            .calls
            .meetings
            .get(&meeting_id)
            .ok_or_else(|| AppError::NotFound("Meeting not found".into()))?;
        if meeting.started_by != claims.sub {
            return Err(AppError::BadRequest("Only the call creator can end it".into()));
        }
    }

    end_meeting(&state, &meeting_id).await?;
    Ok(StatusCode::OK)
}

async fn end_meeting(state: &AppState, meeting_id: &str) -> Result<(), AppError> {
    let channel_id = {
        if let Some((_, meeting)) = state.calls.meetings.remove(meeting_id) {
            state.calls.channel_meetings.remove(&meeting.channel_id);
            meeting.channel_id
        } else {
            return Ok(());
        }
    };

    // Update DB
    let _ = repository::update_call_status(
        &state.db,
        meeting_id,
        super::domain::CallStatus::Ended,
        Some("normal"),
    )
    .await;

    let _ = repository::insert_call_event(
        &state.db,
        meeting_id,
        None,
        "call_ended",
        None,
    )
    .await;

    // Delete via provider (best-effort)
    let _ = state.call_provider.delete_meeting(meeting_id).await;

    // Broadcast call ended
    broadcast_call_event(state, channel_id, ServerMsg::CallEnded {
        meeting_id: meeting_id.to_string(),
        channel_id,
    })
    .await;

    Ok(())
}

pub async fn active_calls(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Json<Vec<ActiveCallResp>>, AppError> {
    let my_channels = sqlx::query_as::<_, (Uuid,)>(
        "SELECT channel_id FROM channel_members WHERE user_id = $1",
    )
    .bind(claims.sub)
    .fetch_all(&state.db)
    .await?;

    let my_channel_ids: std::collections::HashSet<Uuid> =
        my_channels.into_iter().map(|(id,)| id).collect();

    let mut calls = Vec::new();
    for entry in state.calls.meetings.iter() {
        let m = entry.value();
        if my_channel_ids.contains(&m.channel_id) {
            let channel_name = sqlx::query_as::<_, (String,)>(
                "SELECT name FROM channels WHERE id = $1",
            )
            .bind(m.channel_id)
            .fetch_optional(&state.db)
            .await?
            .map(|r| r.0)
            .unwrap_or_default();

            calls.push(ActiveCallResp {
                meeting_id: m.meeting_id.clone(),
                channel_id: m.channel_id,
                channel_name,
                started_by: m.started_by_name.clone(),
                participants: m.participants.iter().map(|(_, name)| name.clone()).collect(),
                started_at: m.started_at,
            });
        }
    }

    Ok(Json(calls))
}

/// Admin endpoint: force-end ALL active calls and delete their Chime meetings.
/// Any authenticated user can call this (for dev/ops use).
pub async fn force_end_all_calls(
    State(state): State<AppState>,
    _claims: Claims,
) -> Result<Json<serde_json::Value>, AppError> {
    let meeting_ids: Vec<String> = state
        .calls
        .meetings
        .iter()
        .map(|e| e.key().clone())
        .collect();

    let count = meeting_ids.len();

    for meeting_id in &meeting_ids {
        // Remove from in-memory state
        if let Some((_, meeting)) = state.calls.meetings.remove(meeting_id.as_str()) {
            state.calls.channel_meetings.remove(&meeting.channel_id);

            // Broadcast CallEnded to channel members
            broadcast_call_event(&state, meeting.channel_id, ServerMsg::CallEnded {
                meeting_id: meeting_id.clone(),
                channel_id: meeting.channel_id,
            })
            .await;
        }

        // Delete Chime meeting (best-effort, stops billing)
        match state.call_provider.delete_meeting(meeting_id).await {
            Ok(_) => tracing::info!(meeting_id = %meeting_id, "Force-deleted Chime meeting"),
            Err(e) => tracing::warn!(meeting_id = %meeting_id, "Chime delete failed (may be expired): {e}"),
        }

        // Update DB
        let _ = repository::update_call_status(
            &state.db,
            meeting_id,
            super::domain::CallStatus::Ended,
            Some("force_cleanup"),
        )
        .await;
    }

    tracing::info!("Force-ended {count} call(s)");

    Ok(Json(serde_json::json!({
        "ended": count,
        "meeting_ids": meeting_ids,
    })))
}

/// Broadcast a call event to all channel members EXCEPT the excluded user.
pub(crate) async fn broadcast_call_event_excluding(
    state: &AppState,
    channel_id: Uuid,
    msg: ServerMsg,
    exclude: Option<Uuid>,
) {
    let members = sqlx::query_as::<_, (Uuid,)>(
        "SELECT user_id FROM channel_members WHERE channel_id = $1",
    )
    .bind(channel_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for (member_id,) in members {
        if Some(member_id) == exclude {
            continue;
        }
        if let Some(sender) = state.connections.get(&member_id) {
            let _ = sender.send(msg.clone());
        }
    }
}

pub(crate) async fn broadcast_call_event(state: &AppState, channel_id: Uuid, msg: ServerMsg) {
    broadcast_call_event_excluding(state, channel_id, msg, None).await;
}
