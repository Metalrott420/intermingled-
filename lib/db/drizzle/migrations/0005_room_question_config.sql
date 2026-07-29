-- Migration: 0005_room_question_config.sql
-- Adds room-level question configuration and selected/used question tracking.

BEGIN;

ALTER TABLE IF EXISTS rooms
  ADD COLUMN IF NOT EXISTS question_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE IF EXISTS rooms
  ADD COLUMN IF NOT EXISTS current_round_question_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS rooms
  ADD COLUMN IF NOT EXISTS used_question_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
