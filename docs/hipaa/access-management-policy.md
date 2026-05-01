# Access Management Policy — StatLingo Comms

## 1. User Authentication
- **Password requirements:** Minimum 8 characters, must contain uppercase, lowercase, digit, and special character
- **MFA:** TOTP (Google Authenticator) — required for all users accessing PHI channels
- **Session duration:** JWT tokens expire after 24 hours
- **Account lockout:** 5 failed login attempts triggers 15-minute lockout

## 2. Authorization
- **Channel-based access:** Users must be members of a channel to read/write messages
- **Invite codes:** New user registration requires an invite code
- **Call access:** Only channel members can start/join calls in that channel

## 3. Administrative Access
- **AWS Console:** MFA-protected, IAM roles with least privilege
- **Database:** No direct access; all queries through application layer
- **ECS tasks:** No SSH access; logs via CloudWatch only
- **Secrets Manager:** Access restricted to ECS task execution role

## 4. Access Reviews
- Review user accounts quarterly
- Remove inactive accounts after 90 days
- Audit admin access monthly
- Review IAM policies annually

## 5. Workforce Termination
- Immediately revoke all active sessions on termination
- Remove from all channels
- Disable account (do not delete — retain for audit)
- Rotate any shared credentials the person had access to
