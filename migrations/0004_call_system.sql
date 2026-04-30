-- Call system tables for persistent call state

CREATE TYPE call_status AS ENUM ('ringing', 'active', 'ended', 'cancelled', 'missed', 'declined', 'failed');
CREATE TYPE call_type AS ENUM ('direct', 'channel');

CREATE TABLE call_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      TEXT UNIQUE NOT NULL,
    external_id     TEXT NOT NULL,
    channel_id      UUID NOT NULL REFERENCES channels(id),
    call_type       call_type NOT NULL DEFAULT 'channel',
    status          call_status NOT NULL DEFAULT 'ringing',
    started_by      UUID NOT NULL REFERENCES users(id),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    answered_at     TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    end_reason      TEXT,
    media_region    TEXT NOT NULL DEFAULT 'us-east-1',
    media_placement JSONB,
    max_participants INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_call_sessions_channel ON call_sessions(channel_id, status);
CREATE INDEX idx_call_sessions_active ON call_sessions(status) WHERE status IN ('ringing', 'active');

CREATE TABLE call_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    attendee_id     TEXT,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at         TIMESTAMPTZ,
    is_muted        BOOLEAN NOT NULL DEFAULT false,
    has_video       BOOLEAN NOT NULL DEFAULT false,
    is_sharing      BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(call_session_id, user_id)
);

CREATE TABLE call_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    event_type      TEXT NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE call_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_session_id UUID NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    duration_secs   INT NOT NULL DEFAULT 0,
    has_video       BOOLEAN NOT NULL DEFAULT false,
    has_screen_share BOOLEAN NOT NULL DEFAULT false,
    media_region    TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
