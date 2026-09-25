import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

let dbInstance: any;
try {
  const envPath = process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH;
  const envDb = process.env.DATABASE_URL;

  const fallbackPath = path.resolve(__dirname, "../../../lib/db/local_db.sqlite");
  let dbPath = envPath || ((envDb && !envDb.startsWith("postgres")) ? envDb : fallbackPath);

  let sqlite: InstanceType<typeof Database>;
  try {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    sqlite = new Database(dbPath);
  } catch (openErr) {
    console.warn(`[DB] Cannot open ${dbPath}, falling back to /tmp/local_db.sqlite:`, openErr);
    dbPath = "/tmp/local_db.sqlite";
    sqlite = new Database(dbPath);
  }

  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
  } catch (pErr) {
    console.warn("[DB] Warning: Could not set WAL mode pragma:", pErr);
  }

  // Self-healing full schema DDL initialization
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY NOT NULL,
      "clerk_id" text UNIQUE,
      "email" text,
      "name" text NOT NULL,
      "bio" text,
      "date_of_birth" text,
      "gender" text,
      "show_me_gender" text DEFAULT 'everyone',
      "photos" text DEFAULT '[]',
      "personality_vector" text,
      "profile_prompts" text DEFAULT '[]',
      "password_hash" text,
      "role" text,
      "status" text NOT NULL DEFAULT 'looking',
      "stripe_customer_id" text,
      "stripe_subscription_id" text,
      "chooser_sessions_today" integer NOT NULL DEFAULT 0,
      "chooser_last_session_date" text,
      "expo_push_token" text,
      "is_admin" integer NOT NULL DEFAULT 0,
      "is_banned" integer NOT NULL DEFAULT 0,
      "age_verified" integer NOT NULL DEFAULT 0,
      "terms_accepted" integer NOT NULL DEFAULT 0,
      "privacy_accepted" integer NOT NULL DEFAULT 0,
      "terms_version" text DEFAULT '1.0',
      "consent_timestamp" integer,
      "is_verified" integer NOT NULL DEFAULT 0,
      "verification_token" text,
      "verification_token_expires_at" integer,
      "is_premium" integer NOT NULL DEFAULT 0,
      "is_organizer" integer NOT NULL DEFAULT 0,
      "is_super_admin" integer NOT NULL DEFAULT 0,
      "qualifications" text DEFAULT '[]',
      "last_lat" text,
      "last_lng" text,
      "is_visible" integer NOT NULL DEFAULT 0,
      "identity_session_id" text,
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "rooms" (
      "id" text PRIMARY KEY NOT NULL,
      "title" text NOT NULL,
      "topic" text,
      "status" text NOT NULL DEFAULT 'lobby',
      "current_round" integer NOT NULL DEFAULT 1,
      "total_rounds" integer NOT NULL DEFAULT 5,
      "chooser_id" text,
      "winner_id" text,
      "category" text,
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "participants" (
      "id" text PRIMARY KEY NOT NULL,
      "room_id" text NOT NULL,
      "user_id" text NOT NULL,
      "role" text NOT NULL,
      "suitor_slot" integer,
      "is_eliminated" integer NOT NULL DEFAULT 0,
      "eliminated_in_round" integer,
      "is_bot" integer NOT NULL DEFAULT 0,
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "matches" (
      "id" text PRIMARY KEY NOT NULL,
      "room_id" text,
      "chooser_id" text NOT NULL,
      "winner_id" text NOT NULL,
      "status" text NOT NULL DEFAULT 'active',
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS "direct_messages" (
      "id" text PRIMARY KEY NOT NULL,
      "match_id" text,
      "sender_id" text NOT NULL,
      "recipient_id" text NOT NULL,
      "content" text NOT NULL,
      "read" integer NOT NULL DEFAULT 0,
      "created_at" integer NOT NULL DEFAULT (unixepoch())
    );
  `);

  dbInstance = drizzle(sqlite, { schema });
  console.log(`[DB] SQLite database initialized successfully at: ${dbPath}`);
} catch (err) {
  console.error("FATAL DATABASE INITIALIZATION ERROR:", err);
  throw err;
}

export const db = dbInstance;

export * from "./schema";
