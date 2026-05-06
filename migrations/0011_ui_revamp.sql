-- Migration 0011: UI Revamp features
-- Message editing, full-text search, URL previews, custom status

-- Message editing
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Full-text search
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_messages_search_vector ON messages USING GIN (search_vector);

-- Backfill search vectors for existing unencrypted messages
UPDATE messages SET search_vector = to_tsvector('english', content)
  WHERE search_vector IS NULL
  AND encrypted IS NOT TRUE
  AND content != ''
  AND deleted_at IS NULL;

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
  IF NEW.content IS NOT NULL AND NEW.content != '' AND (NEW.encrypted IS NOT TRUE) THEN
    NEW.search_vector := to_tsvector('english', NEW.content);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_search_vector ON messages;
CREATE TRIGGER trg_messages_search_vector
  BEFORE INSERT OR UPDATE OF content ON messages
  FOR EACH ROW
  EXECUTE FUNCTION messages_search_vector_update();

-- URL preview cache
CREATE TABLE IF NOT EXISTS url_previews (
    url TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    image_url TEXT,
    site_name TEXT,
    fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Custom user status
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_emoji TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_text TEXT;
