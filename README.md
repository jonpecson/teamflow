# TeamFlow

Fast desktop chat for small teams with huddle-style video calls.

## Features

- **Real-time messaging** - Channels, DMs, link previews, message history
- **Huddle calls** - Voice, video, screen sharing (WebRTC + AWS Chime SDK)
- **Desktop native** - Built with Tauri, backend embedded in the app
- **Self-hosted** - Shared PostgreSQL, all compute on your machine
- **Session protection** - Auto-cleanup of orphaned calls, rate limiting, disconnect detection

## Tech Stack

- **Backend:** Rust, Axum, SQLx, PostgreSQL, AWS Chime SDK
- **Frontend:** React 19, TypeScript, Vite
- **Desktop:** Tauri 2
- **Media:** WebRTC peer-to-peer, STUN/TURN

## Quick Start

### Prerequisites

- Rust toolchain (`rustup`)
- Node.js 18+
- PostgreSQL database (local or AWS RDS)
- AWS credentials (for Chime video calls)

### Setup

```bash
# Clone
git clone https://github.com/jonpecson/teamflow.git
cd teamflow

# Environment
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, AWS_REGION

# Install frontend deps
cd frontend && npm install && cd ..

# Run (backend + frontend)
cargo run
# Open http://localhost:8080
```

### Build Desktop App

```bash
cargo tauri build
# Output: src-tauri/target/release/bundle/dmg/TeamFlow_0.1.0_aarch64.dmg
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | required | PostgreSQL connection string |
| `JWT_SECRET` | required | JWT signing key |
| `BIND_ADDR` | `0.0.0.0:8080` | Server bind address |
| `AWS_REGION` | `us-east-1` | AWS region for Chime SDK |
| `HEARTBEAT_INTERVAL_SECS` | `15` | WebSocket heartbeat interval |
| `CALL_MAX_DURATION_SECS` | `14400` | Max call duration (4 hours) |
| `CALL_RATE_LIMIT_PER_MIN` | `5` | Max call starts per user per minute |

## Project Structure

```
teamflow/
  src/                  # Rust backend (Axum server)
    calls/              # Call system (provider, domain, cleanup, WebRTC signaling)
    auth/               # JWT auth + Argon2 password hashing
    channels/           # Channel + DM management
    ws/                 # WebSocket handler + presence
  frontend/             # React + TypeScript + Vite
    src/
      components/       # UI components (huddle, messages, modals)
      hooks/            # Custom hooks (useAuth, useCalls, useLocalMedia, usePeerConnections)
      context/          # App state (Context + useReducer)
  src-tauri/            # Tauri desktop wrapper (embeds backend)
  migrations/           # PostgreSQL migrations
  landing/              # Landing page (deployed to Netlify)
  scripts/              # Utility scripts (cleanup, force-end)
```

## Scripts

```bash
# Force-end all active calls
./scripts/force-end-all.sh USERNAME PASSWORD

# Run tests
cargo test                      # 15 Rust tests
cd frontend && npm test         # 24 React tests
```

## License

MIT
