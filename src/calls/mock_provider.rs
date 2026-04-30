use async_trait::async_trait;
use std::sync::atomic::{AtomicU64, Ordering};

use super::provider::{AttendeeInfo, CallError, CallProvider, MeetingInfo};

pub struct MockProvider {
    counter: AtomicU64,
}

impl MockProvider {
    pub fn new() -> Self {
        Self {
            counter: AtomicU64::new(1),
        }
    }
}

#[async_trait]
impl CallProvider for MockProvider {
    async fn create_meeting(
        &self,
        external_id: &str,
        region: &str,
    ) -> Result<MeetingInfo, CallError> {
        let id = self.counter.fetch_add(1, Ordering::Relaxed);
        Ok(MeetingInfo {
            meeting_id: format!("mock-meeting-{id}"),
            external_id: external_id.to_string(),
            media_region: region.to_string(),
            media_placement: serde_json::json!({
                "audio_host_url": format!("wss://mock-audio-{id}.example.com"),
                "audio_fallback_url": format!("wss://mock-audio-fallback-{id}.example.com"),
                "signaling_url": format!("wss://mock-signaling-{id}.example.com"),
                "turn_control_url": format!("https://mock-turn-{id}.example.com"),
                "event_ingestion_url": format!("https://mock-events-{id}.example.com"),
            }),
        })
    }

    async fn create_attendee(
        &self,
        _meeting_id: &str,
        user_id: &str,
    ) -> Result<AttendeeInfo, CallError> {
        let id = self.counter.fetch_add(1, Ordering::Relaxed);
        Ok(AttendeeInfo {
            attendee_id: format!("mock-attendee-{id}"),
            join_token: format!("mock-token-{user_id}-{id}"),
        })
    }

    async fn delete_meeting(&self, _meeting_id: &str) -> Result<(), CallError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_meeting() {
        let provider = MockProvider::new();
        let meeting = provider.create_meeting("tf-test", "us-east-1").await.unwrap();
        assert!(meeting.meeting_id.starts_with("mock-meeting-"));
        assert_eq!(meeting.external_id, "tf-test");
        assert_eq!(meeting.media_region, "us-east-1");
    }

    #[tokio::test]
    async fn test_create_attendee() {
        let provider = MockProvider::new();
        let attendee = provider.create_attendee("mock-meeting-1", "user-123").await.unwrap();
        assert!(attendee.attendee_id.starts_with("mock-attendee-"));
        assert!(attendee.join_token.contains("user-123"));
    }

    #[tokio::test]
    async fn test_delete_meeting() {
        let provider = MockProvider::new();
        assert!(provider.delete_meeting("any-id").await.is_ok());
    }
}
