pub mod handlers;

use totp_rs::{Algorithm, Secret, TOTP};

/// Generate a new TOTP secret for a user.
pub fn generate_totp_secret(username: &str) -> Result<(String, String), String> {
    let secret = Secret::generate_secret();
    let secret_bytes = secret.to_bytes().map_err(|e| format!("Secret error: {e}"))?;

    let totp = TOTP::new(
        Algorithm::SHA1,
        6,      // digits
        1,      // skew
        30,     // step
        secret_bytes,
        Some("StatLingo Comms".to_string()),
        format!("{username}"),
    )
    .map_err(|e| format!("TOTP error: {e}"))?;

    let secret_base32 = secret.to_encoded().to_string();
    let uri = totp.get_url();

    Ok((secret_base32, uri))
}

/// Verify a TOTP code against a stored secret.
pub fn verify_totp(secret_base32: &str, code: &str) -> bool {
    let secret = match Secret::Encoded(secret_base32.to_string()).to_bytes() {
        Ok(b) => b,
        Err(_) => return false,
    };

    let totp = match TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret,
        Some("StatLingo Comms".to_string()),
        "verify".to_string(),
    ) {
        Ok(t) => t,
        Err(_) => return false,
    };

    totp.check_current(code).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_secret() {
        let (secret, uri) = generate_totp_secret("testuser").unwrap();
        assert!(!secret.is_empty());
        assert!(uri.contains("otpauth://"));
        assert!(uri.contains("StatLingo"));
    }

    #[test]
    fn test_verify_with_current_code() {
        let (secret, _) = generate_totp_secret("testuser").unwrap();
        let secret_bytes = Secret::Encoded(secret.clone()).to_bytes().unwrap();
        let totp = TOTP::new(Algorithm::SHA1, 6, 1, 30, secret_bytes, Some("test".to_string()), "test".to_string()).unwrap();
        let current_code = totp.generate_current().unwrap();

        assert!(verify_totp(&secret, &current_code));
    }

    #[test]
    fn test_verify_wrong_code() {
        let (secret, _) = generate_totp_secret("testuser").unwrap();
        assert!(!verify_totp(&secret, "000000"));
    }
}
