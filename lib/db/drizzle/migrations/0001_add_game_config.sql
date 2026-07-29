-- Migration: 0001_add_game_config.sql
-- Adds game configuration fields to 'rooms' table in a backward-compatible way.
-- Steps:
-- 1) Add nullable columns
-- 2) Backfill sensible defaults for existing rows
-- 3) Set column defaults (keep round_ends_at nullable)

BEGIN;

ALTER TABLE IF EXISTS rooms
  ADD COLUMN IF NOT EXISTS number_of_rounds integer;

ALTER TABLE IF EXISTS rooms
  ADD COLUMN IF NOT EXISTS round_duration_seconds integer;

ALTER TABLE IF EXISTS rooms
  ADD COLUMN IF NOT EXISTS answer_time_seconds integer;

ALTER TABLE IF EXISTS rooms
  ADD COLUMN IF NOT EXISTS round_ends_at timestamptz;

-- Backfill existing rows with safe defaults to preserve behavior
UPDATE rooms SET number_of_rounds = 3 WHERE number_of_rounds IS NULL;
UPDATE rooms SET round_duration_seconds = 30 WHERE round_duration_seconds IS NULL;
UPDATE rooms SET answer_time_seconds = 15 WHERE answer_time_seconds IS NULL;

-- Set sensible defaults for new rows
ALTER TABLE rooms ALTER COLUMN number_of_rounds SET DEFAULT 3;
ALTER TABLE rooms ALTER COLUMN round_duration_seconds SET DEFAULT 30;
ALTER TABLE rooms ALTER COLUMN answer_time_seconds SET DEFAULT 15;

COMMIT;
