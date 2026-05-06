use crate::calls::provider::CallProvider;
use crate::calls::rate_limit::CallRateLimiter;
use crate::calls::state::CallState;
use crate::config::Config;
use crate::push::PushService;
use crate::ws::messages::ServerMsg;
use dashmap::DashMap;
use sqlx::PgPool;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use uuid::Uuid;

pub type ConnMap = Arc<DashMap<Uuid, mpsc::UnboundedSender<ServerMsg>>>;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub connections: ConnMap,
    pub calls: CallState,
    pub call_provider: Arc<dyn CallProvider>,
    pub rate_limiter: Arc<CallRateLimiter>,
    pub push: Option<Arc<PushService>>,
    pub s3: Arc<aws_sdk_s3::Client>,
    /// Tracks pending grace-period cleanup tasks per user to prevent duplicates
    pub pending_cleanups: Arc<DashMap<Uuid, JoinHandle<()>>>,
}
