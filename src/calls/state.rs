use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct ActiveMeeting {
    pub meeting_id: String,
    pub channel_id: Uuid,
    pub started_by: Uuid,
    pub started_by_name: String,
    pub participants: Vec<(Uuid, String)>,
    pub media_placement: serde_json::Value,
    pub started_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct CallState {
    /// meeting_id → ActiveMeeting
    pub meetings: Arc<DashMap<String, MeetingData>>,
    /// channel_id → meeting_id (one active call per channel)
    pub channel_meetings: Arc<DashMap<Uuid, String>>,
}

pub struct MeetingData {
    pub meeting_id: String,
    pub channel_id: Uuid,
    pub started_by: Uuid,
    pub started_by_name: String,
    pub participants: HashSet<(Uuid, String)>,
    pub media_placement: serde_json::Value,
    pub external_meeting_id: String,
    pub started_at: DateTime<Utc>,
}

impl CallState {
    pub fn new() -> Self {
        Self {
            meetings: Arc::new(DashMap::new()),
            channel_meetings: Arc::new(DashMap::new()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn make_meeting(meeting_id: &str, channel_id: Uuid, users: &[(Uuid, &str)]) -> MeetingData {
        let mut participants = HashSet::new();
        for (uid, name) in users {
            participants.insert((*uid, name.to_string()));
        }
        MeetingData {
            meeting_id: meeting_id.to_string(),
            channel_id,
            started_by: users.first().map(|(u, _)| *u).unwrap_or_default(),
            started_by_name: users.first().map(|(_, n)| n.to_string()).unwrap_or_default(),
            participants,
            media_placement: serde_json::json!({}),
            external_meeting_id: format!("tf-{meeting_id}"),
            started_at: Utc::now(),
        }
    }

    #[test]
    fn test_leave_removes_participant() {
        let state = CallState::new();
        let ch = Uuid::new_v4();
        let user1 = Uuid::new_v4();
        let user2 = Uuid::new_v4();
        state.meetings.insert("m1".into(), make_meeting("m1", ch, &[(user1, "alice"), (user2, "bob")]));
        state.channel_meetings.insert(ch, "m1".into());

        // Alice leaves
        {
            let mut meeting = state.meetings.get_mut("m1").unwrap();
            meeting.participants.retain(|(uid, _)| *uid != user1);
            assert_eq!(meeting.participants.len(), 1);
            assert!(meeting.participants.iter().any(|(uid, _)| *uid == user2));
        }
    }

    #[test]
    fn test_leave_last_participant_makes_empty() {
        let state = CallState::new();
        let ch = Uuid::new_v4();
        let user1 = Uuid::new_v4();
        state.meetings.insert("m2".into(), make_meeting("m2", ch, &[(user1, "alice")]));
        state.channel_meetings.insert(ch, "m2".into());

        // Alice leaves — should be empty
        let is_empty = {
            let mut meeting = state.meetings.get_mut("m2").unwrap();
            meeting.participants.retain(|(uid, _)| *uid != user1);
            meeting.participants.is_empty()
        };

        assert!(is_empty);

        // Clean up empty meeting
        state.meetings.remove("m2");
        state.channel_meetings.remove(&ch);
        assert!(state.meetings.is_empty());
        assert!(state.channel_meetings.is_empty());
    }

    #[test]
    fn test_end_call_removes_meeting_and_channel_mapping() {
        let state = CallState::new();
        let ch = Uuid::new_v4();
        let user1 = Uuid::new_v4();
        let user2 = Uuid::new_v4();
        state.meetings.insert("m3".into(), make_meeting("m3", ch, &[(user1, "alice"), (user2, "bob")]));
        state.channel_meetings.insert(ch, "m3".into());

        // End call — removes regardless of participants
        let removed = state.meetings.remove("m3");
        assert!(removed.is_some());
        state.channel_meetings.remove(&ch);

        assert!(state.meetings.is_empty());
        assert!(state.channel_meetings.is_empty());
    }

    #[test]
    fn test_leave_nonexistent_meeting_is_safe() {
        let state = CallState::new();
        // Should not panic
        let meeting = state.meetings.get_mut("nonexistent");
        assert!(meeting.is_none());
    }

    #[test]
    fn test_leave_user_not_in_meeting_is_noop() {
        let state = CallState::new();
        let ch = Uuid::new_v4();
        let user1 = Uuid::new_v4();
        let user_not_in_call = Uuid::new_v4();
        state.meetings.insert("m4".into(), make_meeting("m4", ch, &[(user1, "alice")]));

        {
            let mut meeting = state.meetings.get_mut("m4").unwrap();
            let before = meeting.participants.len();
            meeting.participants.retain(|(uid, _)| *uid != user_not_in_call);
            assert_eq!(meeting.participants.len(), before); // unchanged
        }
    }

    #[test]
    fn test_one_call_per_channel() {
        let state = CallState::new();
        let ch = Uuid::new_v4();
        let user1 = Uuid::new_v4();

        state.meetings.insert("m5".into(), make_meeting("m5", ch, &[(user1, "alice")]));
        state.channel_meetings.insert(ch, "m5".into());

        // Channel already has a meeting
        assert!(state.channel_meetings.contains_key(&ch));
        assert_eq!(state.channel_meetings.get(&ch).unwrap().value(), "m5");
    }
}
