# TeamFlow (StatLingo Comms)

Fast, secure team chat with huddle-style video calls. Deployed as **StatLingo Comms** for hospital floor staff communication at [teamflow.statlingo.ai](https://teamflow.statlingo.ai/).

## Features

- **Real-time messaging** — Channels, DMs, link previews, message history, typing indicators
- **Huddle calls** — Voice, video, screen sharing via WebRTC + AWS Chime SDK
- **Desktop native** — Tauri 2 desktop app (macOS universal + x64 builds)
- **MFA / TOTP** — Two-factor authentication with authenticator app support
- **HIPAA compliance** — Encryption at rest, HttpOnly cookies, audit logging, security headers, message retention policies
- **Push notifications** — APNs support for desktop/mobile alerts
- **Invite codes** — Team-managed onboarding with invite code system

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Rust, Axum 0.8, SQLx, PostgreSQL (RDS) |
| Frontend | React 19, TypeScript, Vite |
| Desktop | Tauri 2 |
| Media | WebRTC peer-to-peer, AWS Chime SDK, self-hosted Coturn TURN server |
| Auth | JWT (HttpOnly cookies) + Argon2 + TOTP MFA |
| Encryption | AES-256-GCM (message content at rest), TLS in transit |
| Infrastructure | AWS ECS Fargate, ECR, RDS, ALB, Route 53 |

## Quick Start

### Prerequisites

- Rust toolchain (`rustup`)
- Node.js 18+
- PostgreSQL (local or RDS)
- AWS credentials (for Chime SDK video calls)

### Local Development

```bash
# Clone
git clone https://github.com/jonpecson/teamflow.git
cd teamflow

# Environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, AWS_REGION

# Install frontend deps and build
cd frontend && npm install && npm run build && cd ..

# Run backend (serves frontend from static/)
cargo run
# Open http://localhost:8080
```

### Build Desktop App

```bash
cargo tauri build
# Output: src-tauri/target/release/bundle/dmg/TeamFlow_0.2.0_aarch64.dmg
```

Pre-built DMGs are in `landing/`:
- `TeamFlow_0.2.0_aarch64.dmg` (Apple Silicon)
- `TeamFlow_0.2.0_universal.dmg` (Universal)

### Run Tests

```bash
cargo test                      # Rust unit tests (domain, rate_limit, mock_provider)
cd frontend && npm test         # React tests (Vitest + React Testing Library)
```

## Deployment

### Architecture

```
Route 53 (teamflow.statlingo.ai)
  → ALB (TLS termination, HTTPS:443)
    → ECS Fargate (teamflow container, port 8080)
      → RDS PostgreSQL (encrypted, sslmode=verify-full)
      → AWS Chime SDK (video/audio meetings)
      → Coturn TURN server (EC2, WebRTC relay)
```

### Deploy Steps

The app runs on **AWS ECS Fargate** in `us-west-2`. There is no CI/CD pipeline — deployment is manual:

```bash
# 1. Build frontend
cd frontend && npm run build && cd ..

# 2. Login to ECR
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin 274118516334.dkr.ecr.us-west-2.amazonaws.com

# 3. Build Docker image (linux/amd64 for Fargate)
docker build --platform linux/amd64 -t teamflow:latest .

# 4. Tag and push to ECR
docker tag teamflow:latest 274118516334.dkr.ecr.us-west-2.amazonaws.com/teamflow:latest
docker push 274118516334.dkr.ecr.us-west-2.amazonaws.com/teamflow:latest

# 5. Force new deployment on ECS
aws ecs update-service --cluster teamflow --service teamflow-api \
  --force-new-deployment --region us-west-2
```

### AWS Resources

| Resource | Name / ID | Region |
|----------|-----------|--------|
| ECS Cluster | `teamflow` | us-west-2 |
| ECS Service | `teamflow-api` | us-west-2 |
| ECR Repository | `teamflow` | us-west-2 |
| ECR URI | `274118516334.dkr.ecr.us-west-2.amazonaws.com/teamflow` | us-west-2 |
| Target Group | `teamflow-tg` | us-west-2 |
| Launch Type | Fargate | — |
| Container Port | 8080 | — |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (with `sslmode=verify-full` for RDS) |
| `JWT_SECRET` | Yes | JWT signing key (64-char random) |
| `BIND_ADDR` | No | Server bind address (default: `0.0.0.0:8080`) |
| `AWS_REGION` | No | AWS region for Chime SDK (default: `us-west-2`) |
| `TURN_SERVER` | No | Self-hosted TURN server address (e.g., `turn:34.211.52.20:3478`) |
| `TURN_SECRET` | No | TURN REST API shared secret for ephemeral credentials |
| `MESSAGE_ENCRYPTION_KEY` | No | AES-256-GCM key for encrypting message content at rest |
| `HEARTBEAT_INTERVAL_SECS` | No | WebSocket heartbeat interval (default: `15`) |
| `CALL_MAX_DURATION_SECS` | No | Max call duration (default: `14400` = 4 hours) |
| `CALL_RATE_LIMIT_PER_MIN` | No | Max call starts per user per minute (default: `5`) |
| `APNS_KEY_PATH` | No | Path to APNs .p8 key file |
| `APNS_KEY_ID` | No | APNs key ID |
| `APNS_TOPIC` | No | APNs topic (bundle ID) |
| `APNS_TEAM_ID` | No | Apple team ID |
| `APNS_SANDBOX` | No | Use APNs sandbox (default: `true`) |

## Project Structure

```
teamflow/
  src/                          # Rust backend (Axum server)
    auth/                       # JWT auth + Argon2 password hashing
      handlers.rs               # Login, register (HttpOnly cookie auth)
      jwt.rs                    # JWT creation + validation
    calls/                      # Call system
      chime_provider.rs         # AWS Chime SDK integration
      mock_provider.rs          # Mock provider for testing
      provider.rs               # CallProvider trait (abstraction)
      domain.rs                 # CallStatus enum, state machine
      state.rs                  # In-memory call state (DashMap)
      repository.rs             # DB persistence for call sessions
      handlers.rs               # REST endpoints (start, join, leave, end)
      cleanup.rs                # Background worker for stale/empty calls
      rate_limit.rs             # Per-user call rate limiting
    channels/                   # Channel + DM management
      handlers.rs               # CRUD, join/leave, history, invite
    invites/                    # Invite code system
      handlers.rs               # Create, list, revoke invite codes
    mfa/                        # HIPAA: Two-factor authentication
      handlers.rs               # TOTP setup, verify, validate
    ws/                         # WebSocket handler + presence
      handler.rs                # WS upgrade, message routing, typing, signals
      presence.rs               # Online user tracking
    push/                       # Push notifications
      apns.rs                   # APNs client
      handlers.rs               # Device registration
    audit.rs                    # HIPAA: Audit event logging
    crypto.rs                   # HIPAA: AES-256-GCM encrypt/decrypt
    retention.rs                # HIPAA: Message retention worker
    config.rs                   # Environment config loader
    error.rs                    # Error types
    state.rs                    # AppState (shared server state)
    lib.rs                      # Router, middleware, server setup
    main.rs                     # Entry point
  frontend/                     # React + TypeScript + Vite
    src/
      api/client.ts             # API client (credentials: include)
      context/AppContext.tsx     # App state (Context + useReducer)
      hooks/
        useAuth.tsx             # Auth hook (login, register, MFA)
        useChannels.ts          # Channel state management
        useCalls.ts             # Call lifecycle management
        useLocalMedia.ts        # Camera/mic access
        usePeerConnections.ts   # WebRTC peer connections
        usePresence.ts          # Online user tracking
        useWebSocket.ts         # WebSocket connection
      components/
        auth/AuthScreen.tsx     # Login/register + MFA code entry
        layout/Sidebar.tsx      # Main sidebar navigation
        channels/               # Channel list, DM list
        messages/               # Message display, input, threads
        huddle/                 # HuddleBar, HuddleRoom, HuddleMiniWindow
        calls/                  # ParticipantGrid, DevicePicker, ScreenShareView
        settings/               # SettingsModal, MfaSetup
        modals/                 # CreateChannel, InviteCode
        users/                  # OnlineList
      utils/colors.ts           # Avatar colors + initials
      styles/globals.css        # Full CSS (glassmorphism theme)
  src-tauri/                    # Tauri 2 desktop wrapper
    tauri.conf.json             # Tauri config
  migrations/                   # PostgreSQL migrations (0001-0007)
    0001_init.sql               # Users, channels, messages
    0002_dm_and_invites.sql     # DMs and invite system
    0003_invite_codes.sql       # Invite code table
    0004_call_system.sql        # call_sessions, call_participants, call_events, call_usage
    0005_device_tokens.sql      # Push notification device tokens
    0006_encrypted_messages.sql # HIPAA: content_encrypted + content_nonce columns
    0007_mfa_and_security.sql   # HIPAA: MFA fields, password policy, login attempts
  landing/                      # Landing page + desktop DMG downloads
  scripts/                      # Utility scripts
    cleanup-chime.sh            # Clean up orphaned Chime meetings
    force-end-all.sh            # Force-end all active calls
  Dockerfile                    # Multi-stage build (cargo-chef + debian:trixie-slim)
  Cargo.toml                    # Rust dependencies
```

## HIPAA Compliance

This application is designed to handle PHI for hospital staff communication. The following security measures are implemented:

### Authentication & Access Control
- **HttpOnly cookies** — JWT stored in `tf_token` HttpOnly/Secure/SameSite=Strict cookie (not localStorage)
- **CSRF protection** — X-CSRF-Token header validation for state-changing requests
- **MFA (TOTP)** — Optional two-factor authentication via authenticator apps
- **Password hashing** — Argon2 with salt
- **Generic error messages** — Login errors don't reveal whether username or password is wrong

### Encryption
- **In transit** — TLS via ALB, HSTS header (`max-age=31536000; includeSubDomains`), WSS-only WebSockets
- **At rest** — RDS storage encryption (AES-256), application-level AES-256-GCM for message content
- **DB connection** — `sslmode=verify-full` for RDS connections

### Security Headers
- `Content-Security-Policy` — Restrictive CSP (self + Chime SDK CDN)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Strict-Transport-Security` — HSTS enabled

### CORS
- Restricted to `https://teamflow.statlingo.ai` and `http://localhost:8080` (dev)
- Credentials allowed, explicit method and header allowlist

### Infrastructure
- **Self-hosted TURN** — Coturn on EC2 (no third-party relay)
- **TURN credentials** — Ephemeral via TURN REST API (HMAC-SHA1, 24h TTL)
- **Audit logging** — Auth events, message sends, call lifecycle logged (never message content)
- **Message retention** — Configurable per-channel TTL with daily cleanup worker

### Remaining Items
- AWS BAA (Business Associate Agreement) — sign via AWS Artifact
- Penetration test — schedule with third-party firm
- Incident Response Plan, Breach Notification Procedures — documentation
- Session revocation / refresh tokens — planned

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register new user (with invite code) |
| POST | `/api/auth/login` | No | Login (returns HttpOnly cookie or MFA challenge) |
| POST | `/api/auth/logout` | Yes | Logout (clears cookie) |
| POST | `/api/mfa/setup` | Yes | Generate TOTP secret + QR URI |
| POST | `/api/mfa/verify` | Yes | Verify TOTP code to enable MFA |
| POST | `/api/mfa/validate` | No | Validate TOTP code during login |
| GET | `/api/channels` | Yes | List all channels |
| POST | `/api/channels` | Yes | Create channel |
| GET | `/api/channels/mine` | Yes | List joined channels |
| POST | `/api/channels/{id}/join` | Yes | Join channel |
| POST | `/api/channels/{id}/leave` | Yes | Leave channel |
| GET | `/api/channels/{id}/members` | Yes | List channel members |
| GET | `/api/channels/{id}/messages` | Yes | Get message history |
| POST | `/api/channels/{id}/invite` | Yes | Invite user to channel |
| POST | `/api/dm/{user_id}` | Yes | Get or create DM channel |
| POST | `/api/calls` | Yes | Start a call in a channel |
| GET | `/api/calls/active` | Yes | List active calls |
| POST | `/api/calls/{id}/join` | Yes | Join a call |
| POST | `/api/calls/{id}/leave` | Yes | Leave a call |
| DELETE | `/api/calls/{id}` | Yes | End a call |
| POST | `/api/calls/force-end-all` | Yes | Force-end all calls |
| POST | `/api/invites` | Yes | Create invite code |
| GET | `/api/invites` | Yes | List invite codes |
| DELETE | `/api/invites/{id}` | Yes | Revoke invite code |
| POST | `/api/devices` | Yes | Register device for push notifications |
| DELETE | `/api/devices` | Yes | Unregister device |
| GET | `/api/online` | Yes | List online users |
| GET | `/api/turn-credentials` | Yes | Get TURN server credentials |
| GET | `/api/health` | No | Health check |
| GET | `/ws` | Cookie | WebSocket connection |

## Scripts

```bash
# Force-end all active calls
./scripts/force-end-all.sh USERNAME PASSWORD

# Clean up orphaned Chime meetings
./scripts/cleanup-chime.sh
```

## License

MIT
