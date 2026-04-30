use std::sync::Arc;

use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use super::domain::CallStatus;
use super::provider::CallProvider;
use super::state::CallState;
use crate::ws::messages::ServerMsg;
use tokio::sync::mpsc;

pub type ConnMap = Arc<dashmap::DashMap<Uuid, mpsc::UnboundedSender<ServerMsg>>>;

pub async fn run_cleanup(
    pool: PgPool,
    call_state: CallState,
    provider: Arc<dyn CallProvider>,
    connections: ConnMap,
    ring_timeout_secs: u64,
    empty_timeout_secs: u64,
    max_duration_secs: u64,
    interval_secs: u64,
) {
    let mut interval = tokio::time::interval(std::time::Duration::from_secs(interval_secs));

    loop {
        interval.tick().await;
        let now = Utc::now();

        let mut ended_meetings: Vec<(String, Uuid)> = Vec::new();

        // Scan all in-memory meetings for cleanup
        let meeting_ids: Vec<String> = call_state
            .meetings
            .iter()
            .map(|e| e.key().clone())
            .collect();

        for meeting_id in meeting_ids {
            let should_end = {
                let meeting = match call_state.meetings.get(&meeting_id) {
                    Some(m) => m,
                    None => continue,
                };

                let age_secs = (now - meeting.started_at).num_seconds().max(0) as u64;

                // 1. Hard cap: max duration exceeded
                if age_secs >= max_duration_secs {
                    tracing::warn!(
                        meeting_id = %meeting_id,
                        age_secs = age_secs,
                        "Ending call: max duration ({max_duration_secs}s) exceeded"
                    );
                    true
                }
                // 2. Empty call (no participants) for too long
                else if meeting.participants.is_empty() && age_secs >= empty_timeout_secs {
                    tracing::info!(
                        meeting_id = %meeting_id,
                        "Ending call: empty for >{empty_timeout_secs}s"
                    );
                    true
                }
                // 3. Stale: no connected participants (all offline)
                else if !meeting.participants.is_empty() {
                    let any_online = meeting
                        .participants
                        .iter()
                        .any(|(uid, _)| connections.contains_key(uid));

                    if !any_online && age_secs >= ring_timeout_secs {
                        tracing::info!(
                            meeting_id = %meeting_id,
                            "Ending call: all participants disconnected for >{ring_timeout_secs}s"
                        );
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            };

            if should_end {
                if let Some((_, meeting)) = call_state.meetings.remove(&meeting_id) {
                    call_state.channel_meetings.remove(&meeting.channel_id);
                    ended_meetings.push((meeting_id.clone(), meeting.channel_id));
                }

                // Delete Chime meeting (best-effort, prevents further billing)
                let _ = provider.delete_meeting(&meeting_id).await;

                // Update DB if table exists
                let _ = sqlx::query(
                    "UPDATE call_sessions SET status = 'ended', ended_at = now(), end_reason = 'cleanup' WHERE meeting_id = $1 AND status IN ('ringing', 'active')"
                )
                .bind(&meeting_id)
                .execute(&pool)
                .await;
            }
        }

        // Broadcast CallEnded for cleaned-up meetings
        for (meeting_id, channel_id) in &ended_meetings {
            let members = sqlx::query_as::<_, (Uuid,)>(
                "SELECT user_id FROM channel_members WHERE channel_id = $1",
            )
            .bind(channel_id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default();

            let msg = ServerMsg::CallEnded {
                meeting_id: meeting_id.clone(),
                channel_id: *channel_id,
            };

            for (member_id,) in members {
                if let Some(sender) = connections.get(&member_id) {
                    let _ = sender.send(msg.clone());
                }
            }
        }

        if !ended_meetings.is_empty() {
            tracing::info!(
                "Cleanup: ended {} stale/expired call(s), {} active remaining",
                ended_meetings.len(),
                call_state.meetings.len()
            );
        }
    }
}
