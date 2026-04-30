use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CallError {
    #[error("Provider error: {0}")]
    Provider(String),
    #[error("Meeting not found: {0}")]
    MeetingNotFound(String),
    #[error("Meeting expired: {0}")]
    MeetingExpired(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingInfo {
    pub meeting_id: String,
    pub external_id: String,
    pub media_region: String,
    pub media_placement: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttendeeInfo {
    pub attendee_id: String,
    pub join_token: String,
}

#[async_trait]
pub trait CallProvider: Send + Sync {
    async fn create_meeting(
        &self,
        external_id: &str,
        region: &str,
    ) -> Result<MeetingInfo, CallError>;

    async fn create_attendee(
        &self,
        meeting_id: &str,
        user_id: &str,
    ) -> Result<AttendeeInfo, CallError>;

    async fn delete_meeting(&self, meeting_id: &str) -> Result<(), CallError>;
}
