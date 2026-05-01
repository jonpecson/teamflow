pub mod apns;
pub mod handlers;

use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::push::apns::ApnsClient;

pub struct PushService {
    apns: ApnsClient,
    db: PgPool,
}

impl PushService {
    pub fn new(apns: ApnsClient, db: PgPool) -> Self {
        Self { apns, db }
    }

    /// Send a push notification to all offline devices for a user
    pub async fn notify_user(&self, user_id: Uuid, title: &str, body: &str, data: Option<serde_json::Value>) {
        let tokens = match sqlx::query_as::<_, (String, String)>(
            "SELECT token, platform FROM device_tokens WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_all(&self.db)
        .await
        {
            Ok(t) => t,
            Err(e) => {
                tracing::warn!("Failed to fetch device tokens for {user_id}: {e}");
                return;
            }
        };

        for (token, _platform) in tokens {
            if let Err(e) = self.apns.send(
                &token,
                title,
                body,
                data.clone(),
            ).await {
                tracing::warn!("APNs push failed for token {}: {e}", &token[..8.min(token.len())]);
                // Remove invalid tokens
                if e.to_string().contains("BadDeviceToken") || e.to_string().contains("Unregistered") {
                    let _ = sqlx::query("DELETE FROM device_tokens WHERE token = $1")
                        .bind(&token)
                        .execute(&self.db)
                        .await;
                }
            }
        }
    }

    /// Send push to all offline members of a channel
    pub async fn notify_channel_offline(
        &self,
        channel_id: Uuid,
        online_users: &dashmap::DashMap<Uuid, tokio::sync::mpsc::UnboundedSender<crate::ws::messages::ServerMsg>>,
        title: &str,
        body: &str,
        data: Option<serde_json::Value>,
    ) {
        let members = sqlx::query_as::<_, (Uuid,)>(
            "SELECT user_id FROM channel_members WHERE channel_id = $1",
        )
        .bind(channel_id)
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        for (member_id,) in members {
            // Only push to offline users (not in connections map)
            if !online_users.contains_key(&member_id) {
                self.notify_user(member_id, title, body, data.clone()).await;
            }
        }
    }
}
