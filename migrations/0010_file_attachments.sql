-- Phase 3: File attachments on messages

CREATE TABLE IF NOT EXISTS message_attachments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_name   TEXT NOT NULL,
    file_size   BIGINT NOT NULL,
    content_type TEXT NOT NULL,
    s3_key      TEXT NOT NULL,
    url         TEXT NOT NULL,
    width       INT,
    height      INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON message_attachments(message_id);
