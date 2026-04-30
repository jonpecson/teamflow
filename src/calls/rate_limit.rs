use dashmap::DashMap;
use std::time::Instant;
use uuid::Uuid;

pub struct CallRateLimiter {
    attempts: DashMap<Uuid, Vec<Instant>>,
    max_per_minute: usize,
}

impl CallRateLimiter {
    pub fn new(max_per_minute: usize) -> Self {
        Self {
            attempts: DashMap::new(),
            max_per_minute,
        }
    }

    pub fn check(&self, user_id: Uuid) -> bool {
        let now = Instant::now();
        let one_minute_ago = now - std::time::Duration::from_secs(60);

        let mut entry = self.attempts.entry(user_id).or_default();
        entry.retain(|t| *t > one_minute_ago);

        if entry.len() >= self.max_per_minute {
            return false;
        }

        entry.push(now);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allow_within_limit() {
        let limiter = CallRateLimiter::new(3);
        let user = Uuid::new_v4();
        assert!(limiter.check(user));
        assert!(limiter.check(user));
        assert!(limiter.check(user));
    }

    #[test]
    fn test_block_when_exceeded() {
        let limiter = CallRateLimiter::new(2);
        let user = Uuid::new_v4();
        assert!(limiter.check(user));
        assert!(limiter.check(user));
        assert!(!limiter.check(user));
    }

    #[test]
    fn test_different_users_independent() {
        let limiter = CallRateLimiter::new(1);
        let user1 = Uuid::new_v4();
        let user2 = Uuid::new_v4();
        assert!(limiter.check(user1));
        assert!(!limiter.check(user1));
        assert!(limiter.check(user2));
    }
}
