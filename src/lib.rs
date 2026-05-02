pub mod audit;
pub mod auth;
pub mod calls;
pub mod channels;
pub mod config;
pub mod crypto;
pub mod error;
pub mod invites;
pub mod mfa;
pub mod push;
pub mod retention;
pub mod state;
pub mod ws;

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::routing::{get, post};
use axum::{Json, Router};
use dashmap::DashMap;
use sqlx::postgres::PgPoolOptions;
use std::collections::HashSet;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::auth::jwt::{validate_token, Claims};
use crate::calls::chime_provider::ChimeProvider;
use crate::calls::rate_limit::CallRateLimiter;
use crate::calls::state::{CallState, MeetingData};
use crate::state::AppState;
use crate::ws::presence::get_online_users;

// Implement Claims as an Axum extractor
impl<S> axum::extract::FromRequestParts<S> for Claims
where
    AppState: axum::extract::FromRef<S>,
    S: Send + Sync,
{
    type Rejection = error::AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &S,
    ) -> Result<Self, Self::Rejection> {
        let app_state = <AppState as axum::extract::FromRef<S>>::from_ref(state);

        // HIPAA [C3]: Check HttpOnly cookie first, then Authorization header
        let token = extract_token_from_cookie(&parts.headers)
            .or_else(|| extract_token_from_header(&parts.headers))
            .ok_or_else(|| error::AppError::Auth("Missing authentication".into()))?;

        validate_token(&token, &app_state.config.jwt_secret)
            .map_err(error::AppError::Auth)
    }
}

#[derive(serde::Serialize)]
struct OnlineUser {
    user_id: uuid::Uuid,
    username: String,
}

/// HIPAA [C3]: Extract JWT from tf_token HttpOnly cookie
/// HMAC-SHA1 for TURN REST API credential generation
fn hmac_sha1(key: &[u8], data: &[u8]) -> [u8; 20] {
    use std::convert::TryInto;
    let block_size = 64;
    let mut key_block = [0u8; 64];
    if key.len() > block_size {
        // Hash key if too long (simplified — use a proper HMAC in production)
        key_block[..key.len().min(64)].copy_from_slice(&key[..key.len().min(64)]);
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }
    let mut ipad = [0x36u8; 64];
    let mut opad = [0x5cu8; 64];
    for i in 0..64 {
        ipad[i] ^= key_block[i];
        opad[i] ^= key_block[i];
    }
    use sha1_smol::Sha1;
    let mut hasher = Sha1::new();
    hasher.update(&ipad);
    hasher.update(data);
    let inner = hasher.digest().bytes();
    let mut hasher2 = Sha1::new();
    hasher2.update(&opad);
    hasher2.update(&inner);
    hasher2.digest().bytes()
}

fn extract_token_from_cookie(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get(axum::http::header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|cookies| {
            cookies.split(';').find_map(|c| {
                let c = c.trim();
                c.strip_prefix("tf_token=").map(|t| t.to_string())
            })
        })
}

/// Extract JWT from Authorization: Bearer header
fn extract_token_from_header(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|t| t.to_string())
}

async fn online_users(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<OnlineUser>>, error::AppError> {
    // HIPAA [C3]: Accept token from cookie or header
    let token = extract_token_from_cookie(&headers)
        .or_else(|| extract_token_from_header(&headers))
        .ok_or_else(|| error::AppError::Auth("Missing authentication".into()))?;

    validate_token(&token, &state.config.jwt_secret)
        .map_err(error::AppError::Auth)?;

    let user_ids = get_online_users(&state);
    let mut users = Vec::new();

    for uid in user_ids {
        if let Ok(Some(row)) =
            sqlx::query_as::<_, (String,)>("SELECT username FROM users WHERE id = $1")
                .bind(uid)
                .fetch_optional(&state.db)
                .await
        {
            users.push(OnlineUser {
                user_id: uid,
                username: row.0,
            });
        }
    }

    Ok(Json(users))
}

async fn health() -> StatusCode {
    StatusCode::OK
}

/// HIPAA [C3]: Logout clears the HttpOnly cookie
async fn auth_logout(
    State(state): State<AppState>,
    claims: Claims,
) -> impl axum::response::IntoResponse {
    audit::log_logout(&state.db, claims.sub).await;
    let mut headers = HeaderMap::new();
    headers.insert(
        axum::http::header::SET_COOKIE,
        "tf_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0".parse().unwrap(),
    );
    (headers, StatusCode::OK)
}

/// HIPAA [H5]: Return self-hosted TURN server credentials.
/// Generates ephemeral credentials using TURN REST API (RFC 5766 shared secret).
async fn turn_credentials(
    State(state): State<AppState>,
    _claims: Claims,
) -> Json<serde_json::Value> {
    let ttl = 86400u64; // 24 hours
    let timestamp = chrono::Utc::now().timestamp() as u64 + ttl;
    let username = format!("{}:teamflow", timestamp);

    // Generate HMAC-SHA1 credential from shared secret (TURN REST API)
    let turn_secret = std::env::var("TURN_SECRET").unwrap_or_default();
    let turn_server = std::env::var("TURN_SERVER").unwrap_or_else(|_| "turn:34.211.52.20:3478".into());

    let credential = if !turn_secret.is_empty() {
        use base64::Engine;
        let key = hmac_sha1(turn_secret.as_bytes(), username.as_bytes());
        base64::engine::general_purpose::STANDARD.encode(key)
    } else {
        "".to_string()
    };

    Json(serde_json::json!({
        "iceServers": [
            { "urls": "stun:stun.l.google.com:19302" },
            {
                "urls": [&turn_server],
                "username": username,
                "credential": credential
            }
        ],
        "ttl": ttl
    }))
}

fn build_router(state: AppState, static_path: &str) -> Router {
    let api = Router::new()
        .route("/auth/register", post(auth::handlers::register))
        .route("/auth/login", post(auth::handlers::login))
        .route("/auth/logout", post(auth_logout))
        // HIPAA: MFA endpoints
        .route("/mfa/status", get(mfa::handlers::mfa_status))
        .route("/mfa/setup", post(mfa::handlers::setup_mfa))
        .route("/mfa/verify", post(mfa::handlers::verify_mfa))
        .route("/mfa/validate", post(mfa::handlers::validate_mfa))
        .route("/channels", get(channels::handlers::list_channels))
        .route("/channels", post(channels::handlers::create_channel))
        .route("/channels/mine", get(channels::handlers::my_channels))
        .route("/channels/{id}/join", post(channels::handlers::join_channel))
        .route("/channels/{id}/leave", post(channels::handlers::leave_channel))
        .route("/channels/{id}/members", get(channels::handlers::channel_members))
        .route("/channels/{id}/messages", get(channels::handlers::channel_history))
        .route("/invites", post(invites::handlers::create_invite))
        .route("/invites", get(invites::handlers::list_invites))
        .route("/invites/{id}", axum::routing::delete(invites::handlers::revoke_invite))
        .route("/users", get(channels::handlers::list_users))
        .route("/channels/{id}/invite", post(channels::handlers::invite_to_channel))
        .route("/dm/{user_id}", post(channels::handlers::get_or_create_dm))
        .route("/calls", post(calls::handlers::start_call))
        .route("/calls/active", get(calls::handlers::active_calls))
        .route("/calls/{meeting_id}/join", post(calls::handlers::join_call))
        .route("/calls/{meeting_id}/leave", post(calls::handlers::leave_call))
        .route("/calls/{meeting_id}", axum::routing::delete(calls::handlers::end_call))
        .route("/calls/force-end-all", post(calls::handlers::force_end_all_calls))
        .route("/devices", post(push::handlers::register_device))
        .route("/devices", axum::routing::delete(push::handlers::unregister_device))
        .route("/online", get(online_users))
        .route("/turn-credentials", get(turn_credentials))
        .route("/health", get(health));

    // HIPAA: Restrict CORS to production origin only
    let cors = CorsLayer::new()
        .allow_origin([
            "https://teamflow.statlingo.ai".parse::<axum::http::HeaderValue>().unwrap(),
            "http://localhost:8080".parse::<axum::http::HeaderValue>().unwrap(), // dev only
        ])
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ])
        .allow_credentials(true);

    // HIPAA: Security headers middleware [M1]
    let security_headers = tower_http::set_header::SetResponseHeaderLayer::overriding(
        axum::http::header::HeaderName::from_static("x-content-type-options"),
        axum::http::HeaderValue::from_static("nosniff"),
    );
    let frame_options = tower_http::set_header::SetResponseHeaderLayer::overriding(
        axum::http::header::HeaderName::from_static("x-frame-options"),
        axum::http::HeaderValue::from_static("DENY"),
    );
    let referrer = tower_http::set_header::SetResponseHeaderLayer::overriding(
        axum::http::header::HeaderName::from_static("referrer-policy"),
        axum::http::HeaderValue::from_static("no-referrer"),
    );
    let hsts = tower_http::set_header::SetResponseHeaderLayer::overriding(
        axum::http::header::HeaderName::from_static("strict-transport-security"),
        axum::http::HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );
    let csp = tower_http::set_header::SetResponseHeaderLayer::overriding(
        axum::http::header::HeaderName::from_static("content-security-policy"),
        axum::http::HeaderValue::from_static(
            "default-src 'self'; connect-src 'self' wss://teamflow.statlingo.ai ws://localhost:8080; \
             script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; \
             style-src 'self' 'unsafe-inline'; \
             img-src 'self' data: blob:; \
             media-src 'self' blob: mediastream:; \
             frame-ancestors 'none'"
        ),
    );

    Router::new()
        .nest("/api", api)
        .route("/ws", get(ws::handler::ws_upgrade))
        .fallback_service(ServeDir::new(static_path))
        .layer(cors)
        .layer(security_headers)
        .layer(frame_options)
        .layer(referrer)
        .layer(hsts)
        .layer(csp)
        .with_state(state)
}

/// Start the TeamFlow server. Call from main or embed in Tauri.
/// Returns when the server shuts down.
pub async fn start_server(static_dir: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
    let config = config::Config::from_env();
    let bind_addr = config.bind_addr.clone();

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Database connected and migrations applied");

    let _ = sqlx::query("INSERT INTO channels (name, created_by) SELECT 'general', id FROM users LIMIT 1 ON CONFLICT (name) DO NOTHING")
        .execute(&pool)
        .await;

    let aws_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(aws_config::Region::new(config.aws_region.clone()))
        .load()
        .await;
    let chime_client = aws_sdk_chimesdkmeetings::Client::new(&aws_config);
    let call_provider: Arc<dyn calls::provider::CallProvider> =
        Arc::new(ChimeProvider::new(chime_client));
    tracing::info!("AWS Chime SDK provider initialized (region: {})", config.aws_region);

    let call_state = CallState::new();
    let rate_limiter = Arc::new(CallRateLimiter::new(config.call_rate_limit_per_min));

    // Rehydrate call state from DB
    if let Ok(active_sessions) = calls::repository::get_active_sessions(&pool).await {
        for session in active_sessions {
            let participants = calls::repository::get_active_participants(&pool, &session.meeting_id)
                .await
                .unwrap_or_default();

            let started_by_name = sqlx::query_as::<_, (String,)>(
                "SELECT username FROM users WHERE id = $1",
            )
            .bind(session.started_by)
            .fetch_optional(&pool)
            .await
            .unwrap_or(None)
            .map(|r| r.0)
            .unwrap_or_default();

            let participant_set: HashSet<(uuid::Uuid, String)> =
                participants.into_iter().collect();

            call_state.meetings.insert(
                session.meeting_id.clone(),
                MeetingData {
                    meeting_id: session.meeting_id.clone(),
                    channel_id: session.channel_id,
                    started_by: session.started_by,
                    started_by_name,
                    participants: participant_set,
                    media_placement: session.media_placement.unwrap_or_else(|| serde_json::json!({})),
                    external_meeting_id: session.external_id,
                    started_at: session.started_at,
                },
            );
            call_state
                .channel_meetings
                .insert(session.channel_id, session.meeting_id);
        }
        tracing::info!("Rehydrated {} active call sessions from DB", call_state.meetings.len());
    }

    // Initialize push notifications (optional — works without APNs config)
    let push_service = match (
        std::env::var("APNS_KEY_PATH"),
        std::env::var("APNS_KEY_ID"),
        std::env::var("APNS_TOPIC"),
    ) {
        (Ok(key_path), Ok(key_id), Ok(topic)) => {
            match std::fs::read(&key_path) {
                Ok(key_data) => {
                    let team_id = std::env::var("APNS_TEAM_ID").unwrap_or_else(|_| "R4DHNFSJKM".into());
                    let sandbox = std::env::var("APNS_SANDBOX").unwrap_or_else(|_| "true".into()) == "true";
                    match push::apns::ApnsClient::new(&key_data, key_id, team_id, topic, sandbox) {
                        Ok(apns) => {
                            tracing::info!("APNs push notifications enabled");
                            Some(Arc::new(push::PushService::new(apns, pool.clone())))
                        }
                        Err(e) => { tracing::warn!("APNs init failed: {e}"); None }
                    }
                }
                Err(e) => { tracing::warn!("APNs key file not found at {key_path}: {e}"); None }
            }
        }
        _ => {
            tracing::info!("APNs not configured — push notifications disabled");
            None
        }
    };

    let state = AppState {
        db: pool.clone(),
        config: config.clone(),
        connections: Arc::new(DashMap::new()),
        calls: call_state.clone(),
        call_provider: call_provider.clone(),
        rate_limiter,
        push: push_service,
    };

    tokio::spawn(calls::cleanup::run_cleanup(
        pool,
        call_state,
        call_provider,
        state.connections.clone(),
        config.call_ring_timeout_secs,
        config.call_empty_timeout_secs,
        config.call_max_duration_secs,
        config.call_cleanup_interval_secs,
    ));

    // HIPAA: Message retention worker (daily cleanup of expired messages)
    tokio::spawn(retention::run_retention_worker(state.db.clone()));

    let static_path = static_dir.unwrap_or("static");
    let app = build_router(state, static_path);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("Server listening on {bind_addr}");
    axum::serve(listener, app).await?;
    Ok(())
}
