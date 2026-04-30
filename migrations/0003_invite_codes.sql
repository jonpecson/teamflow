CREATE TABLE invite_codes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         TEXT UNIQUE NOT NULL,
    created_by   UUID REFERENCES users(id),
    max_uses     INT NOT NULL DEFAULT 10,
    uses         INT NOT NULL DEFAULT 0,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
