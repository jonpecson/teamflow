use async_trait::async_trait;
use aws_sdk_chimesdkmeetings::Client as ChimeClient;

use super::provider::{AttendeeInfo, CallError, CallProvider, MeetingInfo};

pub struct ChimeProvider {
    client: ChimeClient,
}

impl ChimeProvider {
    pub fn new(client: ChimeClient) -> Self {
        Self { client }
    }
}

#[async_trait]
impl CallProvider for ChimeProvider {
    async fn create_meeting(
        &self,
        external_id: &str,
        region: &str,
    ) -> Result<MeetingInfo, CallError> {
        let result = self
            .client
            .create_meeting()
            .external_meeting_id(external_id)
            .media_region(region)
            .send()
            .await
            .map_err(|e| CallError::Provider(format!("Chime CreateMeeting failed: {e:?}")))?;

        let meeting = result
            .meeting()
            .ok_or_else(|| CallError::Provider("No meeting in response".into()))?;

        let meeting_id = meeting
            .meeting_id()
            .ok_or_else(|| CallError::Provider("No meeting_id".into()))?
            .to_string();

        let media_placement = meeting
            .media_placement()
            .map(|mp| {
                serde_json::json!({
                    "audio_host_url": mp.audio_host_url(),
                    "audio_fallback_url": mp.audio_fallback_url(),
                    "signaling_url": mp.signaling_url(),
                    "turn_control_url": mp.turn_control_url(),
                    "event_ingestion_url": mp.event_ingestion_url(),
                })
            })
            .unwrap_or_else(|| serde_json::json!({}));

        Ok(MeetingInfo {
            meeting_id,
            external_id: external_id.to_string(),
            media_region: region.to_string(),
            media_placement,
        })
    }

    async fn create_attendee(
        &self,
        meeting_id: &str,
        user_id: &str,
    ) -> Result<AttendeeInfo, CallError> {
        let result = self
            .client
            .create_attendee()
            .meeting_id(meeting_id)
            .external_user_id(user_id)
            .send()
            .await
            .map_err(|e| CallError::MeetingExpired(format!("Chime CreateAttendee failed: {e}")))?;

        let attendee = result
            .attendee()
            .ok_or_else(|| CallError::Provider("No attendee in response".into()))?;

        Ok(AttendeeInfo {
            attendee_id: attendee.attendee_id().unwrap_or_default().to_string(),
            join_token: attendee.join_token().unwrap_or_default().to_string(),
        })
    }

    async fn delete_meeting(&self, meeting_id: &str) -> Result<(), CallError> {
        self.client
            .delete_meeting()
            .meeting_id(meeting_id)
            .send()
            .await
            .map_err(|e| CallError::Provider(format!("Chime DeleteMeeting failed: {e}")))?;
        Ok(())
    }
}
