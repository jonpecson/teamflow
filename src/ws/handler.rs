use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::auth::jwt::validate_token;
use crate::calls::handlers::{broadcast_call_event, broadcast_call_event_excluding};
use crate::calls::repository;
use crate::state::AppState;
use crate::ws::messages::{ClientMsg, PresenceStatus, ServerMsg};
use crate::ws::presence::broadcast_presence;

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: String,
}

pub async fn ws_upgrade(
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let claims = match validate_token(&query.token, &state.config.jwt_secret) {
        Ok(c) => c,
        Err(_) => {
            return axum::http::StatusCode::UNAUTHORIZED.into_response();
        }
    };

    ws.on_upgrade(move |socket| handle_socket(socket, state, claims.sub, claims.username))
}

async fn handle_socket(socket: WebSocket, state: AppState, user_id: Uuid, username: String) {
    let (mut ws_sink, mut ws_stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMsg>();

    // Register connection
    state.connections.insert(user_id, tx);
    tracing::info!(user_id = %user_id, username = %username, "WebSocket connected");

    // Broadcast online
    broadcast_presence(&state, user_id, &username, PresenceStatus::Online).await;

    // Task: forward mpsc messages to WebSocket sink
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let text = serde_json::to_string(&msg).unwrap();
            if ws_sink.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });

    // Heartbeat timeout
    let heartbeat_secs = state.config.heartbeat_interval_secs;
    let timeout_duration = std::time::Duration::from_secs(heartbeat_secs * 2);

    // Receive loop
    loop {
        let msg = tokio::time::timeout(timeout_duration, ws_stream.next()).await;

        match msg {
            Ok(Some(Ok(Message::Text(text)))) => {
                handle_client_msg(&state, user_id, &username, &text).await;
            }
            Ok(Some(Ok(Message::Close(_)))) | Ok(None) => break,
            Err(_) => {
                tracing::info!(user_id = %user_id, "Heartbeat timeout, disconnecting");
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    state.connections.remove(&user_id);
    send_task.abort();

    // Auto-leave calls on WS disconnect — with grace period for reconnection
    // Don't remove participants immediately; let the cleanup worker handle it
    // after the grace period expires. This prevents calls from ending during deployments.
    let meeting_ids: Vec<String> = state
        .calls
        .meetings
        .iter()
        .filter(|e| e.value().participants.iter().any(|(uid, _)| *uid == user_id))
        .map(|e| e.key().clone())
        .collect();

    if !meeting_ids.is_empty() {
        let grace_secs = state.config.call_disconnect_grace_secs;
        tracing::info!(
            user_id = %user_id, username = %username,
            calls = ?meeting_ids, grace_secs = grace_secs,
            "WS disconnected during active call(s), grace period started"
        );

        // Schedule delayed cleanup — if user reconnects within grace period,
        // the cleanup worker will see they're back online and skip removal
        let state_clone = state.clone();
        let username_clone = username.to_string();
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(grace_secs)).await;

            // Check if user reconnected
            if state_clone.connections.contains_key(&user_id) {
                tracing::info!(user_id = %user_id, "User reconnected within grace period, keeping in call(s)");
                return;
            }

            // User didn't reconnect — remove from calls
            for meeting_id in meeting_ids {
                let (channel_id, is_empty) = {
                    let mut meeting = match state_clone.calls.meetings.get_mut(&meeting_id) {
                        Some(m) => m,
                        None => continue,
                    };
                    // Double-check user is still in the meeting
                    if !meeting.participants.iter().any(|(uid, _)| *uid == user_id) {
                        continue;
                    }
                    meeting.participants.retain(|(uid, _)| *uid != user_id);
                    (meeting.channel_id, meeting.participants.is_empty())
                };

                tracing::info!(user_id = %user_id, meeting_id = %meeting_id, "Removing from call after grace period");

                broadcast_call_event(&state_clone, channel_id, ServerMsg::CallParticipantLeft {
                    meeting_id: meeting_id.clone(),
                    channel_id,
                    username: username_clone.to_string(),
                })
                .await;

                if is_empty {
                    if let Some((_, dead)) = state_clone.calls.meetings.remove(&meeting_id) {
                        state_clone.calls.channel_meetings.remove(&dead.channel_id);
                    }
                    let _ = state_clone.call_provider.delete_meeting(&meeting_id).await;
                    broadcast_call_event(&state_clone, channel_id, ServerMsg::CallEnded {
                        meeting_id: meeting_id.clone(),
                        channel_id,
                    })
                    .await;
                    tracing::info!(meeting_id = %meeting_id, "Auto-ended empty call after grace period");
                }
            }
        });
    }

    broadcast_presence(&state, user_id, &username, PresenceStatus::Offline).await;
    tracing::info!(user_id = %user_id, username = %username, "WebSocket disconnected");
}

async fn handle_client_msg(state: &AppState, user_id: Uuid, username: &str, text: &str) {
    let msg: ClientMsg = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            send_error(state, user_id, &format!("Invalid message: {e}"));
            return;
        }
    };

    match msg {
        ClientMsg::Ping => {
            if let Some(sender) = state.connections.get(&user_id) {
                let _ = sender.send(ServerMsg::Pong);
            }
        }
        ClientMsg::Message {
            channel_id,
            content,
        } => {
            if content.len() > 4000 {
                send_error(state, user_id, "Message too long (max 4000 chars)");
                return;
            }
            if content.trim().is_empty() {
                send_error(state, user_id, "Message cannot be empty");
                return;
            }

            let is_member = sqlx::query_as::<_, (Uuid,)>(
                "SELECT channel_id FROM channel_members WHERE channel_id = $1 AND user_id = $2",
            )
            .bind(channel_id)
            .bind(user_id)
            .fetch_optional(&state.db)
            .await;

            match is_member {
                Ok(Some(_)) => {}
                _ => {
                    send_error(state, user_id, "Not a member of this channel");
                    return;
                }
            }

            // HIPAA: Encrypt message content before storing
            let row = if let Some(ref key) = state.config.message_encryption_key {
                match crate::crypto::encrypt(&content, key) {
                    Ok((ciphertext, nonce)) => {
                        sqlx::query_as::<_, (Uuid, chrono::DateTime<chrono::Utc>)>(
                            "INSERT INTO messages (channel_id, user_id, content, content_encrypted, content_nonce, encrypted) VALUES ($1, $2, '', $3, $4, true) RETURNING id, created_at",
                        )
                        .bind(channel_id)
                        .bind(user_id)
                        .bind(&ciphertext)
                        .bind(&nonce)
                        .fetch_one(&state.db)
                        .await
                    }
                    Err(e) => {
                        tracing::error!("Message encryption failed: {e}");
                        send_error(state, user_id, "Failed to send message");
                        return;
                    }
                }
            } else {
                // Fallback: store plaintext if no encryption key configured
                sqlx::query_as::<_, (Uuid, chrono::DateTime<chrono::Utc>)>(
                    "INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3) RETURNING id, created_at",
                )
                .bind(channel_id)
                .bind(user_id)
                .bind(&content)
                .fetch_one(&state.db)
                .await
            };

            let (msg_id, created_at) = match row {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Failed to insert message: {e}");
                    send_error(state, user_id, "Failed to send message");
                    return;
                }
            };

            // HIPAA: Audit log message send (metadata only, NOT content)
            crate::audit::log_message_send(&state.db, user_id, channel_id).await;

            let server_msg = ServerMsg::Message {
                id: msg_id,
                channel_id,
                user_id,
                username: username.to_string(),
                content,
                timestamp: created_at,
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
                    let _ = sender.send(server_msg.clone());
                }
            }
        }
        ClientMsg::ThreadReply { channel_id, parent_id, content } => {
            if content.len() > 4000 || content.trim().is_empty() {
                send_error(state, user_id, "Invalid message");
                return;
            }

            // Verify membership
            let is_member = sqlx::query_as::<_, (Uuid,)>(
                "SELECT channel_id FROM channel_members WHERE channel_id = $1 AND user_id = $2",
            )
            .bind(channel_id)
            .bind(user_id)
            .fetch_optional(&state.db)
            .await;

            if !matches!(is_member, Ok(Some(_))) {
                send_error(state, user_id, "Not a member of this channel");
                return;
            }

            // Insert thread reply
            let row = sqlx::query_as::<_, (Uuid, chrono::DateTime<chrono::Utc>)>(
                "INSERT INTO messages (channel_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
            )
            .bind(channel_id)
            .bind(user_id)
            .bind(&content)
            .bind(parent_id)
            .fetch_one(&state.db)
            .await;

            let (msg_id, created_at) = match row {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!("Failed to insert thread reply: {e}");
                    send_error(state, user_id, "Failed to send reply");
                    return;
                }
            };

            // Update parent reply count
            let _ = sqlx::query(
                "UPDATE messages SET reply_count = reply_count + 1, last_reply_at = $1 WHERE id = $2",
            )
            .bind(created_at)
            .bind(parent_id)
            .execute(&state.db)
            .await;

            // Get user profile for display
            let profile = sqlx::query_as::<_, (Option<String>, Option<String>)>(
                "SELECT display_name, avatar_url FROM users WHERE id = $1",
            )
            .bind(user_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None)
            .unwrap_or((None, None));

            let reply_msg = ServerMsg::ThreadReply {
                id: msg_id,
                channel_id,
                parent_id,
                user_id,
                username: username.to_string(),
                display_name: profile.0,
                avatar_url: profile.1,
                content,
                timestamp: created_at,
            };

            // Broadcast to channel members
            let members = sqlx::query_as::<_, (Uuid,)>(
                "SELECT user_id FROM channel_members WHERE channel_id = $1",
            )
            .bind(channel_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

            for (member_id,) in members {
                if let Some(sender) = state.connections.get(&member_id) {
                    let _ = sender.send(reply_msg.clone());
                }
            }
        }
        ClientMsg::Typing { channel_id } => {
            // Broadcast typing indicator to channel members (except sender)
            let members = sqlx::query_as::<_, (Uuid,)>(
                "SELECT user_id FROM channel_members WHERE channel_id = $1",
            )
            .bind(channel_id)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

            let typing_msg = ServerMsg::Typing {
                channel_id,
                user_id,
                username: username.to_string(),
            };

            for (member_id,) in members {
                if member_id != user_id {
                    if let Some(sender) = state.connections.get(&member_id) {
                        let _ = sender.send(typing_msg.clone());
                    }
                }
            }
        }
        ClientMsg::JoinChannel { channel_id } => {
            let exists = sqlx::query_as::<_, (Uuid,)>("SELECT id FROM channels WHERE id = $1")
                .bind(channel_id)
                .fetch_optional(&state.db)
                .await;

            if !matches!(exists, Ok(Some(_))) {
                send_error(state, user_id, "Channel not found");
                return;
            }

            let _ = sqlx::query(
                "INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(channel_id)
            .bind(user_id)
            .execute(&state.db)
            .await;

            let join_msg = ServerMsg::ChannelJoined {
                channel_id,
                user_id,
                username: username.to_string(),
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
        }
        ClientMsg::LeaveChannel { channel_id } => {
            let _ = sqlx::query(
                "DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2",
            )
            .bind(channel_id)
            .bind(user_id)
            .execute(&state.db)
            .await;

            let leave_msg = ServerMsg::ChannelLeft {
                channel_id,
                user_id,
                username: username.to_string(),
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
                    let _ = sender.send(leave_msg.clone());
                }
            }

            if let Some(sender) = state.connections.get(&user_id) {
                let _ = sender.send(leave_msg);
            }
        }
        // Call media state messages — exclude sender from broadcast
        ClientMsg::CallMute { meeting_id } => {
            if let Some(ch) = validate_call_participant(state, &meeting_id, user_id) {
                let _ = repository::update_participant_media(&state.db, &meeting_id, user_id, Some(true), None, None).await;
                broadcast_call_event_excluding(state, ch, ServerMsg::CallMuted { meeting_id, channel_id: ch, username: username.to_string() }, Some(user_id)).await;
            }
        }
        ClientMsg::CallUnmute { meeting_id } => {
            if let Some(ch) = validate_call_participant(state, &meeting_id, user_id) {
                let _ = repository::update_participant_media(&state.db, &meeting_id, user_id, Some(false), None, None).await;
                broadcast_call_event_excluding(state, ch, ServerMsg::CallUnmuted { meeting_id, channel_id: ch, username: username.to_string() }, Some(user_id)).await;
            }
        }
        ClientMsg::CallVideoOn { meeting_id } => {
            if let Some(ch) = validate_call_participant(state, &meeting_id, user_id) {
                let _ = repository::update_participant_media(&state.db, &meeting_id, user_id, None, Some(true), None).await;
                broadcast_call_event_excluding(state, ch, ServerMsg::CallVideoOn { meeting_id, channel_id: ch, username: username.to_string() }, Some(user_id)).await;
            }
        }
        ClientMsg::CallVideoOff { meeting_id } => {
            if let Some(ch) = validate_call_participant(state, &meeting_id, user_id) {
                let _ = repository::update_participant_media(&state.db, &meeting_id, user_id, None, Some(false), None).await;
                broadcast_call_event_excluding(state, ch, ServerMsg::CallVideoOff { meeting_id, channel_id: ch, username: username.to_string() }, Some(user_id)).await;
            }
        }
        ClientMsg::CallScreenShareOn { meeting_id } => {
            if let Some(ch) = validate_call_participant(state, &meeting_id, user_id) {
                let _ = repository::update_participant_media(&state.db, &meeting_id, user_id, None, None, Some(true)).await;
                broadcast_call_event_excluding(state, ch, ServerMsg::CallScreenShareOn { meeting_id, channel_id: ch, username: username.to_string() }, Some(user_id)).await;
            }
        }
        ClientMsg::CallScreenShareOff { meeting_id } => {
            if let Some(ch) = validate_call_participant(state, &meeting_id, user_id) {
                let _ = repository::update_participant_media(&state.db, &meeting_id, user_id, None, None, Some(false)).await;
                broadcast_call_event_excluding(state, ch, ServerMsg::CallScreenShareOff { meeting_id, channel_id: ch, username: username.to_string() }, Some(user_id)).await;
            }
        }
        ClientMsg::CallSpeaking { meeting_id, speaking } => {
            if let Some(ch) = validate_call_participant(state, &meeting_id, user_id) {
                broadcast_call_event_excluding(state, ch, ServerMsg::CallSpeaking {
                    meeting_id, channel_id: ch, username: username.to_string(), speaking,
                }, Some(user_id)).await;
            }
        }
        ClientMsg::CallNetworkQuality { meeting_id, quality } => {
            if let Some(ch) = validate_call_participant(state, &meeting_id, user_id) {
                broadcast_call_event_excluding(state, ch, ServerMsg::CallNetworkQuality {
                    meeting_id, channel_id: ch, username: username.to_string(), quality,
                }, Some(user_id)).await;
            }
        }
        ClientMsg::CallDecline { meeting_id } => {
            if let Some(meeting) = state.calls.meetings.get(&meeting_id) {
                let ch = meeting.channel_id;
                drop(meeting);
                let _ = repository::insert_call_event(&state.db, &meeting_id, Some(user_id), "call_declined", None).await;
                broadcast_call_event_excluding(state, ch, ServerMsg::CallDeclined {
                    meeting_id, channel_id: ch, username: username.to_string(),
                }, Some(user_id)).await;
            }
        }
        // WebRTC signaling — relay to target user (no participant check — signals must flow freely)
        ClientMsg::RtcSignal { meeting_id, target_user, signal_type, data } => {
            if let Ok(Some((target_uid,))) = sqlx::query_as::<_, (Uuid,)>(
                "SELECT id FROM users WHERE username = $1",
            )
            .bind(&target_user)
            .fetch_optional(&state.db)
            .await
            {
                if let Some(sender) = state.connections.get(&target_uid) {
                    tracing::info!(
                        from = %username, to = %target_user,
                        signal = %signal_type, "Relaying RTC signal"
                    );
                    let _ = sender.send(ServerMsg::RtcSignal {
                        meeting_id,
                        from_user: username.to_string(),
                        signal_type,
                        data,
                    });
                } else {
                    tracing::warn!(target = %target_user, uid = %target_uid, "RTC signal target not connected");
                }
            } else {
                tracing::warn!(target = %target_user, "RTC signal target user not found in DB");
            }
        }
    }
}

fn validate_call_participant(state: &AppState, meeting_id: &str, user_id: Uuid) -> Option<Uuid> {
    state.calls.meetings.get(meeting_id).and_then(|meeting| {
        if meeting.participants.iter().any(|(uid, _)| *uid == user_id) {
            Some(meeting.channel_id)
        } else {
            None
        }
    })
}

fn send_error(state: &AppState, user_id: Uuid, message: &str) {
    if let Some(sender) = state.connections.get(&user_id) {
        let _ = sender.send(ServerMsg::Error {
            message: message.to_string(),
        });
    }
}
