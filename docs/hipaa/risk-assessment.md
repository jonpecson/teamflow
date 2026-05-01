# Risk Assessment — StatLingo Comms
## Date: May 2, 2026

## System Overview
StatLingo Comms is a real-time communication platform for hospital staff using WebRTC audio/video and encrypted messaging.

## Completed Remediation

| # | Risk | Severity | Remediation | Status |
|---|------|----------|-------------|--------|
| C1 | Hardcoded secrets | Critical | Moved to AWS Secrets Manager | ✅ Fixed |
| C2 | No TLS internally | Critical | DB SSL, HSTS header | ✅ Fixed |
| C3 | localStorage tokens | Critical | HttpOnly Secure cookies | ✅ Fixed |
| C4 | No encryption at rest | Critical | AES-256-GCM + RDS encryption | ✅ Fixed |
| H1 | Permissive CORS | High | Restricted to production origin | ✅ Fixed |
| H2 | No MFA | High | TOTP (Google Authenticator) | ✅ Fixed |
| H3 | No audit trail | High | CloudWatch + DB audit logging | ✅ Fixed |
| H4 | No session revocation | High | Revoked tokens table + lockout | ✅ Fixed |
| H5 | Public TURN server | High | API endpoint for credentials | ✅ Fixed (self-hosted pending) |
| H6 | No DB SSL | High | sslmode=require | ✅ Fixed |
| M1 | No CSP | Medium | Full security headers suite | ✅ Fixed |
| M2 | Unencrypted device tokens | Medium | App-level encryption | ✅ Fixed |
| M3 | Error enumeration | Medium | Generic error messages | ✅ Fixed |
| M4 | No login rate limiting | Medium | Account lockout (5 fails) | ✅ Fixed |
| M5 | RTC log sanitization | Medium | Only metadata logged | ✅ Verified |

## Remaining Actions
1. Sign AWS BAA (legal, not technical)
2. Deploy self-hosted Coturn TURN server on EC2
3. Third-party penetration test
4. Annual security training for all staff

## Residual Risks (Accepted)
- L1: Health endpoint reveals service status (low risk, standard practice)
- L2: No automated data retention enforcement for all tables (manual cleanup acceptable)
- L3: No reserved username protection (mitigated by invite-only registration)
