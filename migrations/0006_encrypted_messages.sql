-- HIPAA: Add encrypted message storage columns
-- Messages will be encrypted with AES-256-GCM before storage.
-- The plaintext 'content' column will be deprecated and eventually dropped.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_encrypted TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS content_nonce TEXT;

-- Encrypt device tokens
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS token_encrypted TEXT;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS token_nonce TEXT;

-- Add channel retention policy
ALTER TABLE channels ADD COLUMN IF NOT EXISTS retention_days INT DEFAULT NULL;

-- Add audit metadata
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT false;
