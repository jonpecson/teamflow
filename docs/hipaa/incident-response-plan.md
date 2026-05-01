# Incident Response Plan — StatLingo Comms

## 1. Purpose
This plan establishes procedures for responding to security incidents involving Protected Health Information (PHI) in the StatLingo Comms system.

## 2. Scope
Applies to all team members with access to production systems, databases, or user data.

## 3. Incident Classification

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| Critical | Active breach, PHI exposed | Immediate (< 1 hour) | DB credentials leaked, unauthorized access confirmed |
| High | Potential breach, vulnerability exploited | < 4 hours | Suspicious login patterns, unpatched CVE |
| Medium | Security weakness identified | < 24 hours | Misconfiguration, access control gap |
| Low | Minor issue, no PHI risk | < 1 week | Log anomaly, non-critical update needed |

## 4. Response Procedures

### 4.1 Detection
- Monitor CloudWatch audit logs for anomalous access patterns
- Review failed login attempts (account lockout triggers)
- Monitor ECS task health and resource usage
- Check for unauthorized API access patterns

### 4.2 Containment (Critical/High)
1. Revoke all active user sessions (`POST /api/admin/revoke-user/{id}`)
2. Rotate compromised credentials immediately
3. Isolate affected ECS tasks (update security group)
4. Enable RDS audit logging if not already active
5. Preserve all logs (do NOT delete)

### 4.3 Investigation
1. Review CloudWatch audit logs for the affected timeframe
2. Check `audit_log` table for unauthorized access
3. Review ECS task logs for error patterns
4. Check RDS slow query log for data exfiltration
5. Document timeline of events

### 4.4 Notification
- HIPAA requires breach notification within 60 days of discovery
- Notify affected individuals if >500 records: media notification required
- Notify HHS Secretary via breach portal
- Document all notifications

### 4.5 Recovery
1. Deploy patched version
2. Force password reset for affected users
3. Re-enable MFA if disabled
4. Verify all security controls restored
5. Update this plan based on lessons learned

## 5. Contact Information
- Security Lead: [TBD]
- AWS Support: [TBD]
- Legal Counsel: [TBD]
- HHS Breach Portal: https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf

## 6. Review Schedule
This plan must be reviewed and updated annually, or after any incident.
