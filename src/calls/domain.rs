use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "call_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CallStatus {
    Ringing,
    Active,
    Ended,
    Cancelled,
    Missed,
    Declined,
    Failed,
}

impl CallStatus {
    pub fn can_transition_to(&self, next: CallStatus) -> bool {
        matches!(
            (self, next),
            (CallStatus::Ringing, CallStatus::Active)
                | (CallStatus::Ringing, CallStatus::Cancelled)
                | (CallStatus::Ringing, CallStatus::Missed)
                | (CallStatus::Ringing, CallStatus::Declined)
                | (CallStatus::Ringing, CallStatus::Failed)
                | (CallStatus::Active, CallStatus::Ended)
                | (CallStatus::Active, CallStatus::Failed)
        )
    }

    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            CallStatus::Ended
                | CallStatus::Cancelled
                | CallStatus::Missed
                | CallStatus::Declined
                | CallStatus::Failed
        )
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "call_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CallType {
    Direct,
    Channel,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        assert!(CallStatus::Ringing.can_transition_to(CallStatus::Active));
        assert!(CallStatus::Ringing.can_transition_to(CallStatus::Cancelled));
        assert!(CallStatus::Ringing.can_transition_to(CallStatus::Missed));
        assert!(CallStatus::Ringing.can_transition_to(CallStatus::Declined));
        assert!(CallStatus::Ringing.can_transition_to(CallStatus::Failed));
        assert!(CallStatus::Active.can_transition_to(CallStatus::Ended));
        assert!(CallStatus::Active.can_transition_to(CallStatus::Failed));
    }

    #[test]
    fn test_invalid_transitions() {
        assert!(!CallStatus::Ringing.can_transition_to(CallStatus::Ended));
        assert!(!CallStatus::Active.can_transition_to(CallStatus::Ringing));
        assert!(!CallStatus::Active.can_transition_to(CallStatus::Cancelled));
        assert!(!CallStatus::Ended.can_transition_to(CallStatus::Active));
        assert!(!CallStatus::Cancelled.can_transition_to(CallStatus::Active));
    }

    #[test]
    fn test_terminal_states() {
        assert!(CallStatus::Ended.is_terminal());
        assert!(CallStatus::Cancelled.is_terminal());
        assert!(CallStatus::Missed.is_terminal());
        assert!(CallStatus::Declined.is_terminal());
        assert!(CallStatus::Failed.is_terminal());
        assert!(!CallStatus::Ringing.is_terminal());
        assert!(!CallStatus::Active.is_terminal());
    }
}
