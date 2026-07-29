-- Migration: 0006_ballroom_events.sql
-- Adds scheduled ballroom events for featured launches and reminders.

BEGIN;

DO $$ BEGIN
  CREATE TYPE ballroom_event_status AS ENUM ('scheduled', 'live', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS ballroom_events (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  status ballroom_event_status NOT NULL DEFAULT 'scheduled',
  starts_at timestamp NOT NULL,
  ends_at timestamp,
  is_featured boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id text REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ballroom_events_status_starts_at ON ballroom_events(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_ballroom_events_featured_starts_at ON ballroom_events(is_featured, starts_at);

COMMIT;
