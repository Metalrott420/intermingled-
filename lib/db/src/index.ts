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
  const dbPath = envPath || ((envDb && !envDb.startsWith("postgres")) ? envDb : fallbackPath);

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[DB] Created missing database parent directory: ${dbDir}`);
  }

  console.log(`[DB] Initializing SQLite database at: ${dbPath}`);
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
  } catch (pErr) {
    console.warn("[DB] Warning: Could not set WAL mode pragma:", pErr);
  }

  dbInstance = drizzle(sqlite, { schema });
  console.log(`[DB] SQLite database initialized successfully.`);
} catch (err) {
  console.error("FATAL DATABASE INITIALIZATION ERROR:", err);
  throw err;
}

export const db = dbInstance;

export * from "./schema";
