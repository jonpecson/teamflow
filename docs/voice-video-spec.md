# Voice & Video Call Specification — Amazon Chime SDK

## Overview
Add real-time voice and video calling to TeamFlow channels and DMs using
Amazon Chime SDK. Calls are per-channel — any member can start or join an
active call. Designed for 5-10 concurrent users.

## Architecture

```
Browser (Chime SDK JS)
    │
    │  1. POST /api/calls          → Backend creates Chime Meeting
    │  2. POST /api/calls/:id/join → Backend creates Attendee, returns tokens
    │  3. Browser connects directly to Chime media servers (WebRTC)
    │
    ▼
┌─────────────────────────────────┐
│  TeamFlow Backend (Axum)        │
│  calls/handlers.rs              │
│    → AWS Chime SDK (REST API)   │
│    → Active meetings (DashMap)  │
│    → WS notifications           │
└────────────┬────────────────────┘
             │
     ┌───────▼────────┐
     │  Amazon Chime   │
     │  Media Service  │  (fully managed, no infra)
     └────────────────┘
```

## API Endpoints

### POST /api/calls
Start a new call in a channel/DM.

Request:
```json
{ "channel_id": "uuid" }
```

Response (201):
```json
{
  "meeting_id": "chime-meeting-id",
  "channel_id": "uuid",
  "started_by": "username",
  "attendee": {
    "attendee_id": "chime-attendee-id",
    "join_token": "..."
  },
  "media_placement": { ... }
}
```

Side effect: Broadcasts `call_started` to all channel members via WebSocket.

### POST /api/calls/:meeting_id/join
Join an existing active call.

Response (200): Same shape as create (meeting + attendee info).

### POST /api/calls/:meeting_id/leave
Leave a call. If last participant, ends the meeting.

### DELETE /api/calls/:meeting_id
Force-end a call (creator only).

### GET /api/calls/active
List all active calls across channels the user is a member of.

Response (200):
```json
[
  {
    "meeting_id": "...",
    "channel_id": "uuid",
    "channel_name": "general",
    "started_by": "alice",
    "participants": ["alice", "bob"],
    "started_at": "2026-04-30T..."
  }
]
```

## WebSocket Events

### Server → Client
```json
{ "type": "call_started", "meeting_id": "...", "channel_id": "uuid", "started_by": "alice" }
{ "type": "call_ended", "meeting_id": "...", "channel_id": "uuid" }
{ "type": "call_participant_joined", "meeting_id": "...", "channel_id": "uuid", "username": "bob" }
{ "type": "call_participant_left", "meeting_id": "...", "channel_id": "uuid", "username": "bob" }
```

## Frontend UI

### Channel Header
- Phone icon button → starts or joins active call
- Green badge when call is active in channel
- Shows participant count

### Call Panel (replaces messages area when in call)
- Video grid: up to 10 tiles, auto-layout
- Self-view in bottom-right corner
- Controls bar: Mute/Unmute, Camera On/Off, Screen Share, Leave Call
- Participant names overlaid on video tiles
- Audio-only participants show avatar

### Ringing
- Toast notification: "Alice started a call in #general — Join"
- Clicking toast joins the call

## State Management

### Backend (in-memory)
```rust
struct ActiveMeeting {
    meeting_id: String,
    channel_id: Uuid,
    started_by: Uuid,
    started_by_name: String,
    participants: HashSet<(Uuid, String)>, // (user_id, username)
    media_placement: serde_json::Value,
    started_at: DateTime<Utc>,
}

// DashMap<String, ActiveMeeting>  keyed by meeting_id
// DashMap<Uuid, String>           channel_id → meeting_id (1 active call per channel)
```

### Frontend
- `activeCallMeetingId` — currently joined meeting ID (null if not in call)
- `activeCalls` Map — channel_id → { meeting_id, participants }
- Chime `MeetingSession` object manages media

## AWS Resources Required
- IAM user/role with `chime:CreateMeeting`, `chime:CreateAttendee`,
  `chime:DeleteMeeting`, `chime:DeleteAttendee` permissions
- Region: us-east-1 (Chime SDK meetings require specific regions)
- No additional infrastructure — Chime is fully serverless

## Environment Variables
| Var | Required | Description |
|-----|----------|-------------|
| `AWS_REGION` | yes | AWS region (us-east-1 for Chime) |
| `AWS_ACCESS_KEY_ID` | yes | IAM credentials |
| `AWS_SECRET_ACCESS_KEY` | yes | IAM credentials |

## Constraints
- Max 1 active call per channel
- Max 10 participants per call (Chime supports 250, but our app targets 5-10)
- No call recording in v1
- No screen share in v1 (can add later)
- Calls are ephemeral — no persistence, no call history

## Security
- Only channel members can start/join calls in that channel
- Attendee tokens are single-use, scoped to meeting
- Media flows directly browser ↔ Chime servers (not through our backend)
