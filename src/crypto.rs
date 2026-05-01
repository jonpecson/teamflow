use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};

/// Encrypt plaintext using AES-256-GCM.
/// Returns (ciphertext, nonce) both as hex strings.
pub fn encrypt(plaintext: &str, key_hex: &str) -> Result<(String, String), String> {
    let key_bytes = hex::decode(key_hex).map_err(|e| format!("Invalid key: {e}"))?;
    if key_bytes.len() != 32 {
        return Err("Key must be 32 bytes (64 hex chars)".into());
    }

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| format!("Cipher init failed: {e}"))?;

    // Generate random 12-byte nonce
    let nonce_bytes: [u8; 12] = {
        use aes_gcm::aead::rand_core::RngCore;
        let mut buf = [0u8; 12];
        OsRng.fill_bytes(&mut buf);
        buf
    };
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {e}"))?;

    Ok((hex::encode(ciphertext), hex::encode(nonce_bytes)))
}

/// Decrypt ciphertext using AES-256-GCM.
pub fn decrypt(ciphertext_hex: &str, nonce_hex: &str, key_hex: &str) -> Result<String, String> {
    let key_bytes = hex::decode(key_hex).map_err(|e| format!("Invalid key: {e}"))?;
    let ciphertext = hex::decode(ciphertext_hex).map_err(|e| format!("Invalid ciphertext: {e}"))?;
    let nonce_bytes = hex::decode(nonce_hex).map_err(|e| format!("Invalid nonce: {e}"))?;

    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| format!("Cipher init failed: {e}"))?;

    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| format!("Decryption failed: {e}"))?;

    String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let plaintext = "Hello, this is a HIPAA-protected message!";

        let (ciphertext, nonce) = encrypt(plaintext, key).unwrap();
        assert_ne!(ciphertext, plaintext);

        let decrypted = decrypt(&ciphertext, &nonce, key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_different_nonces() {
        let key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let plaintext = "Same message";

        let (ct1, n1) = encrypt(plaintext, key).unwrap();
        let (ct2, n2) = encrypt(plaintext, key).unwrap();

        // Same plaintext should produce different ciphertexts (random nonce)
        assert_ne!(ct1, ct2);
        assert_ne!(n1, n2);
    }

    #[test]
    fn test_wrong_key_fails() {
        let key1 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let key2 = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

        let (ciphertext, nonce) = encrypt("secret", key1).unwrap();
        let result = decrypt(&ciphertext, &nonce, key2);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_key_length() {
        let result = encrypt("test", "tooshort");
        assert!(result.is_err());
    }
}
