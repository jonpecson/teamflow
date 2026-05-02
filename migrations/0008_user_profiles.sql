-- Phase 1: User profiles, theme preferences, avatar, last-read tracking

-- User profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'system';

-- Track last-read position per channel per user
ALTER TABLE channel_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- Onboarding flag (has the user completed onboarding?)
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT false;
