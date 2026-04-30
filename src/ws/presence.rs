use uuid::Uuid;

use crate::state::AppState;
use crate::ws::messages::{PresenceStatus, ServerMsg};

pub async fn broadcast_presence(
    state: &AppState,
    user_id: Uuid,
    username: &str,
    status: PresenceStatus,
) {
    let msg = ServerMsg::Presence {
        user_id,
        username: username.to_string(),
        status,
    };

    for entry in state.connections.iter() {
        let _ = entry.value().send(msg.clone());
    }
}

pub fn get_online_users(state: &AppState) -> Vec<Uuid> {
    state.connections.iter().map(|e| *e.key()).collect()
}
