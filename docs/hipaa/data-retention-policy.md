# Data Retention Policy — StatLingo Comms

## 1. Message Data
- **Default retention:** 30 days (configurable per-channel)
- **Minimum retention:** 24 hours
- **Maximum retention:** Unlimited (admin-configured)
- **Deletion method:** Automated daily worker purges expired messages
- **Encrypted messages:** Ciphertext and nonce deleted; encryption key not needed for deletion

## 2. Audit Logs
- **CloudWatch Logs:** 90-day active retention
- **S3 Archive:** 6-year immutable retention (Object Lock)
- **Audit logs are NEVER deleted** before 6 years (HIPAA requirement)

## 3. Call Records
- **Call metadata:** Retained in `call_sessions` table for 1 year
- **Call recordings:** NOT recorded (WebRTC P2P, no server-side recording)
- **Call events:** Retained in `call_events` table for 90 days

## 4. User Accounts
- **Active accounts:** Retained indefinitely while active
- **Deactivated accounts:** Data retained for 6 years after deactivation
- **Deletion requests:** Anonymize user data, retain audit logs

## 5. Device Tokens (Push Notifications)
- **Retention:** Until device unregisters or token expires
- **Invalid tokens:** Auto-removed on push failure

## 6. Backup Data
- **RDS automated backups:** 7-day retention
- **Manual snapshots:** Encrypted, retained per operational needs
- **Backup encryption:** AES-256 (RDS managed)
