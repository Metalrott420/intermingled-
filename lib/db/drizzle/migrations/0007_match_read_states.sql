-- Migration: 0007_match_read_states.sql
-- Adds per-user read cursors for private match conversations.

BEGIN;

CREATE TABLE IF NOT EXISTS match_read_states (
  id text PRIMARY KEY,
  match_id text NOT NULL REFERENCES matches(id),
  user_id text NOT NULL REFERENCES users(id),
  last_read_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_read_states_match_id ON match_read_states(match_id);
CREATE INDEX IF NOT EXISTS idx_match_read_states_user_id ON match_read_states(user_id);

COMMIT;
