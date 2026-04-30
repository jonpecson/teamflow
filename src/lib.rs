pub mod auth;
pub mod calls;
pub mod channels;
pub mod config;
pub mod error;
pub mod invites;
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
        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| error::AppError::Auth("Missing authorization header".into()))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or_else(|| error::AppError::Auth("Invalid authorization format".into()))?;

        validate_token(token, &app_state.config.jwt_secret)
            .map_err(error::AppError::Auth)
    }
}

#[derive(serde::Serialize)]
struct OnlineUser {
    user_id: uuid::Uuid,
    username: String,
}

async fn online_users(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<OnlineUser>>, error::AppError> {
    let auth = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| error::AppError::Auth("Missing token".into()))?;

    validate_token(auth, &state.config.jwt_secret)
        .map_err(|e| error::AppError::Auth(e))?;

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

fn build_router(state: AppState) -> Router {
    let api = Router::new()
        .route("/auth/register", post(auth::handlers::register))
        .route("/auth/login", post(auth::handlers::login))
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
        .route("/online", get(online_users))
        .route("/health", get(health));

    Router::new()
        .nest("/api", api)
        .route("/ws", get(ws::handler::ws_upgrade))
        .fallback_service(ServeDir::new("static"))
        .layer(CorsLayer::permissive())
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

    let state = AppState {
        db: pool.clone(),
        config: config.clone(),
        connections: Arc::new(DashMap::new()),
        calls: call_state.clone(),
        call_provider: call_provider.clone(),
        rate_limiter,
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

    let app = if let Some(dir) = static_dir {
        // Use custom static dir (e.g., from Tauri resource path)
        let api = build_router(state.clone());
        // Replace the fallback service with the custom dir
        let api_routes = Router::new()
            .nest("/api", Router::new()
                .route("/auth/register", post(auth::handlers::register))
                .route("/auth/login", post(auth::handlers::login))
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
                .route("/online", get(online_users))
                .route("/health", get(health)))
            .route("/ws", get(ws::handler::ws_upgrade))
            .fallback_service(ServeDir::new(dir))
            .layer(CorsLayer::permissive())
            .with_state(state);
        api_routes
    } else {
        build_router(state)
    };

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("Server listening on {bind_addr}");
    axum::serve(listener, app).await?;
    Ok(())
}
