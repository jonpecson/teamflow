use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMsg {
    Message { channel_id: Uuid, content: String },
    Ping,
    JoinChannel { channel_id: Uuid },
    LeaveChannel { channel_id: Uuid },
    // Call media state messages
    CallMute { meeting_id: String },
    CallUnmute { meeting_id: String },
    CallVideoOn { meeting_id: String },
    CallVideoOff { meeting_id: String },
    CallScreenShareOn { meeting_id: String },
    CallScreenShareOff { meeting_id: String },
    CallSpeaking { meeting_id: String, speaking: bool },
    CallNetworkQuality { meeting_id: String, quality: u8 },
    CallDecline { meeting_id: String },
    // Thread reply
    ThreadReply { channel_id: Uuid, parent_id: Uuid, content: String },
    // Typing indicator
    Typing { channel_id: Uuid },
    // WebRTC signaling
    RtcSignal {
        meeting_id: String,
        target_user: String,
        signal_type: String,
        data: serde_json::Value,
    },
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMsg {
    Message {
        id: Uuid,
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
        content: String,
        timestamp: DateTime<Utc>,
    },
    Pong,
    Presence {
        user_id: Uuid,
        username: String,
        status: PresenceStatus,
    },
    Error {
        message: String,
    },
    ChannelJoined {
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    ChannelLeft {
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    Invited {
        channel_id: Uuid,
        channel_name: String,
        invited_by: String,
    },
    CallStarted {
        meeting_id: String,
        channel_id: Uuid,
        started_by: String,
        channel_name: String,
    },
    CallEnded {
        meeting_id: String,
        channel_id: Uuid,
    },
    CallParticipantJoined {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    CallParticipantLeft {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    // New call media events
    CallMuted {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    CallUnmuted {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    CallVideoOn {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    CallVideoOff {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    CallScreenShareOn {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    CallScreenShareOff {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    CallSpeaking {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
        speaking: bool,
    },
    CallNetworkQuality {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
        quality: u8,
    },
    CallRinging {
        meeting_id: String,
        channel_id: Uuid,
        caller: String,
        call_type: String,
    },
    CallDeclined {
        meeting_id: String,
        channel_id: Uuid,
        username: String,
    },
    // Typing indicator
    Typing {
        channel_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    // Reaction update
    ReactionUpdate {
        message_id: Uuid,
        channel_id: Uuid,
        emoji: String,
        user_id: Uuid,
        username: String,
        added: bool,
    },
    // Thread reply (same as Message but with parent_id)
    ThreadReply {
        id: Uuid,
        channel_id: Uuid,
        parent_id: Uuid,
        user_id: Uuid,
        username: String,
        display_name: Option<String>,
        avatar_url: Option<String>,
        content: String,
        timestamp: DateTime<Utc>,
    },
    // Message deleted
    MessageDeleted {
        message_id: Uuid,
        channel_id: Uuid,
    },
    // WebRTC signaling relay
    RtcSignal {
        meeting_id: String,
        from_user: String,
        signal_type: String,
        data: serde_json::Value,
    },
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum PresenceStatus {
    Online,
    Offline,
}
