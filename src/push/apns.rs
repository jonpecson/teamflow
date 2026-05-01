use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize)]
struct ApnsClaims {
    iss: String, // Team ID
    iat: u64,
}

#[derive(Debug, Serialize)]
struct ApnsPayload {
    aps: ApnsAps,
    #[serde(flatten)]
    data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct ApnsAps {
    alert: ApnsAlert,
    sound: String,
    #[serde(rename = "mutable-content")]
    mutable_content: u8,
}

#[derive(Debug, Serialize)]
struct ApnsAlert {
    title: String,
    body: String,
}

pub struct ApnsClient {
    http: Client,
    key: EncodingKey,
    key_id: String,
    team_id: String,
    topic: String,
    base_url: String,
    // Cache the JWT token (valid for ~50 min, refresh every 45 min)
    cached_token: RwLock<Option<(String, u64)>>,
}

impl ApnsClient {
    pub fn new(
        key_pem: &[u8],
        key_id: String,
        team_id: String,
        topic: String,
        sandbox: bool,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let key = EncodingKey::from_ec_pem(key_pem)?;
        let base_url = if sandbox {
            "https://api.sandbox.push.apple.com"
        } else {
            "https://api.push.apple.com"
        }
        .to_string();

        Ok(Self {
            http: Client::builder()
                .http2_prior_knowledge()
                .build()?,
            key,
            key_id,
            team_id,
            topic,
            base_url,
            cached_token: RwLock::new(None),
        })
    }

    fn get_token(&self) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Return cached token if still fresh (< 45 min old)
        if let Ok(cached) = self.cached_token.read() {
            if let Some((ref token, issued_at)) = *cached {
                if now - issued_at < 2700 {
                    return Ok(token.clone());
                }
            }
        }

        // Generate new token
        let claims = ApnsClaims {
            iss: self.team_id.clone(),
            iat: now,
        };

        let mut header = Header::new(Algorithm::ES256);
        header.kid = Some(self.key_id.clone());

        let token = encode(&header, &claims, &self.key)
            .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { Box::new(e) })?;

        if let Ok(mut cached) = self.cached_token.write() {
            *cached = Some((token.clone(), now));
        }

        Ok(token)
    }

    pub async fn send(
        &self,
        device_token: &str,
        title: &str,
        body: &str,
        data: Option<serde_json::Value>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let jwt = self.get_token()?;

        let payload = ApnsPayload {
            aps: ApnsAps {
                alert: ApnsAlert {
                    title: title.to_string(),
                    body: body.to_string(),
                },
                sound: "default".to_string(),
                mutable_content: 1,
            },
            data,
        };

        let url = format!("{}/3/device/{}", self.base_url, device_token);

        let resp = self
            .http
            .post(&url)
            .header("authorization", format!("bearer {jwt}"))
            .header("apns-topic", &self.topic)
            .header("apns-push-type", "alert")
            .header("apns-priority", "10")
            .json(&payload)
            .send()
            .await?;

        if resp.status().is_success() {
            Ok(())
        } else {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            Err(format!("APNs error {status}: {body}").into())
        }
    }
}
