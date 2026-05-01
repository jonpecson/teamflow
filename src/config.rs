use std::env;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub bind_addr: String,
    pub heartbeat_interval_secs: u64,
    pub jwt_expiry_secs: u64,
    pub aws_region: String,
    pub call_ring_timeout_secs: u64,
    pub call_empty_timeout_secs: u64,
    pub call_cleanup_interval_secs: u64,
    pub call_rate_limit_per_min: usize,
    pub call_max_duration_secs: u64,
    pub call_disconnect_grace_secs: u64,
    pub message_encryption_key: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
            jwt_secret: env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
            bind_addr: env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".into()),
            heartbeat_interval_secs: env::var("HEARTBEAT_INTERVAL_SECS")
                .unwrap_or_else(|_| "15".into())
                .parse()
                .expect("HEARTBEAT_INTERVAL_SECS must be a number"),
            jwt_expiry_secs: env::var("JWT_EXPIRY_SECS")
                .unwrap_or_else(|_| "86400".into())
                .parse()
                .expect("JWT_EXPIRY_SECS must be a number"),
            aws_region: env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".into()),
            call_ring_timeout_secs: env::var("CALL_RING_TIMEOUT_SECS")
                .unwrap_or_else(|_| "60".into())
                .parse()
                .unwrap_or(60),
            call_empty_timeout_secs: env::var("CALL_EMPTY_TIMEOUT_SECS")
                .unwrap_or_else(|_| "120".into())
                .parse()
                .unwrap_or(120),
            call_cleanup_interval_secs: env::var("CALL_CLEANUP_INTERVAL_SECS")
                .unwrap_or_else(|_| "30".into())
                .parse()
                .unwrap_or(30),
            call_rate_limit_per_min: env::var("CALL_RATE_LIMIT_PER_MIN")
                .unwrap_or_else(|_| "5".into())
                .parse()
                .unwrap_or(5),
            // Hard cap: 4 hours max per call (Chime bills per minute)
            call_max_duration_secs: env::var("CALL_MAX_DURATION_SECS")
                .unwrap_or_else(|_| "14400".into())
                .parse()
                .unwrap_or(14400),
            // Grace period for reconnection after disconnect
            call_disconnect_grace_secs: env::var("CALL_DISCONNECT_GRACE_SECS")
                .unwrap_or_else(|_| "30".into())
                .parse()
                .unwrap_or(30),
            message_encryption_key: env::var("MESSAGE_ENCRYPTION_KEY").ok(),
        }
    }
}
