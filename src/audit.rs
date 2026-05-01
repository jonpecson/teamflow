use sqlx::PgPool;
use uuid::Uuid;

/// HIPAA §164.312(b) — Audit Controls
/// Log all access to PHI, authentication events, and administrative actions.
/// NEVER log message content — only metadata.
pub struct AuditLogger {
    db: PgPool,
}

impl AuditLogger {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn log(
        &self,
        user_id: Option<Uuid>,
        action: &str,
        resource: Option<&str>,
        ip: Option<&str>,
        metadata: Option<serde_json::Value>,
    ) {
        let _ = sqlx::query(
            "INSERT INTO audit_log (user_id, action, resource, ip_address, metadata) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(user_id)
        .bind(action)
        .bind(resource)
        .bind(ip)
        .bind(metadata)
        .execute(&self.db)
        .await;

        // Also log to tracing for CloudWatch
        tracing::info!(
            user_id = ?user_id,
            action = %action,
            resource = ?resource,
            "AUDIT"
        );
    }
}

// Convenience functions for common audit events
pub async fn log_login(db: &PgPool, user_id: Uuid, username: &str, success: bool, ip: Option<&str>) {
    let action = if success { "auth.login.success" } else { "auth.login.failed" };
    let meta = serde_json::json!({ "username": username });
    AuditLogger::new(db.clone())
        .log(Some(user_id), action, None, ip, Some(meta))
        .await;
}

pub async fn log_logout(db: &PgPool, user_id: Uuid) {
    AuditLogger::new(db.clone())
        .log(Some(user_id), "auth.logout", None, None, None)
        .await;
}

pub async fn log_message_send(db: &PgPool, user_id: Uuid, channel_id: Uuid) {
    AuditLogger::new(db.clone())
        .log(
            Some(user_id),
            "message.send",
            Some(&channel_id.to_string()),
            None,
            None,
        )
        .await;
}

pub async fn log_channel_access(db: &PgPool, user_id: Uuid, channel_id: Uuid) {
    AuditLogger::new(db.clone())
        .log(
            Some(user_id),
            "channel.access",
            Some(&channel_id.to_string()),
            None,
            None,
        )
        .await;
}

pub async fn log_call_event(db: &PgPool, user_id: Uuid, meeting_id: &str, event: &str) {
    let meta = serde_json::json!({ "meeting_id": meeting_id });
    AuditLogger::new(db.clone())
        .log(Some(user_id), &format!("call.{event}"), None, None, Some(meta))
        .await;
}

pub async fn log_mfa_event(db: &PgPool, user_id: Uuid, event: &str, success: bool) {
    let meta = serde_json::json!({ "success": success });
    AuditLogger::new(db.clone())
        .log(Some(user_id), &format!("mfa.{event}"), None, None, Some(meta))
        .await;
}
