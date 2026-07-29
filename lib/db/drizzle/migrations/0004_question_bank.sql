-- Migration: 0004_question_bank.sql
-- Adds persistent question bank with categories, packs, difficulty, and dedupe hashing.

BEGIN;

DO $$ BEGIN
  CREATE TYPE question_category AS ENUM ('general', 'fun', 'deep');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE question_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS question_bank (
  id text PRIMARY KEY,
  pack_slug text NOT NULL DEFAULT 'core',
  category question_category NOT NULL DEFAULT 'general',
  difficulty question_difficulty NOT NULL DEFAULT 'easy',
  content text NOT NULL,
  normalized_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  usage_count integer NOT NULL DEFAULT 0,
  created_by_user_id text REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (normalized_hash)
);

CREATE INDEX IF NOT EXISTS idx_question_bank_active ON question_bank(is_active);
CREATE INDEX IF NOT EXISTS idx_question_bank_pack ON question_bank(pack_slug);
CREATE INDEX IF NOT EXISTS idx_question_bank_category ON question_bank(category);
CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON question_bank(difficulty);

COMMIT;
