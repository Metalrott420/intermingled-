-- Migration: 0002_gameplay_archives_and_analytics.sql
-- Adds archival, history, and analytics tables without altering existing rows.

BEGIN;

DO $$ BEGIN
  CREATE TYPE archive_match_status AS ENUM ('matched', 'unmatched', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS game_archives (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id),
  final_participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  elimination_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions_asked jsonb NOT NULL DEFAULT '[]'::jsonb,
  round_durations jsonb NOT NULL DEFAULT '[]'::jsonb,
  winner_id text,
  winner_name text,
  match_status archive_match_status NOT NULL DEFAULT 'unknown',
  completion_timestamp timestamp NOT NULL DEFAULT now(),
  analytics_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (room_id)
);

CREATE TABLE IF NOT EXISTS player_game_stats (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  games_played integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  matches integer NOT NULL DEFAULT 0,
  total_rounds_survived integer NOT NULL DEFAULT 0,
  last_played_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_game_history (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  room_id text NOT NULL REFERENCES rooms(id),
  participant_id text NOT NULL REFERENCES participants(id),
  role text NOT NULL,
  is_winner boolean NOT NULL DEFAULT false,
  match_status archive_match_status NOT NULL DEFAULT 'unknown',
  rounds_survived integer NOT NULL DEFAULT 0,
  eliminated_at_round integer,
  completion_timestamp timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gameplay_events (
  id text PRIMARY KEY,
  room_id text REFERENCES rooms(id),
  user_id text REFERENCES users(id),
  participant_id text REFERENCES participants(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gameplay_events_room_id ON gameplay_events(room_id);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_event_type ON gameplay_events(event_type);
CREATE INDEX IF NOT EXISTS idx_player_game_history_user_id ON player_game_history(user_id);
CREATE INDEX IF NOT EXISTS idx_player_game_history_room_id ON player_game_history(room_id);
CREATE INDEX IF NOT EXISTS idx_game_archives_room_id ON game_archives(room_id);

COMMIT;
