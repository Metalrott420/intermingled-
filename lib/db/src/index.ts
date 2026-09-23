import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

let dbInstance: any;
try {
  const envDb = process.env.DATABASE_URL;
  const fallbackPath = path.resolve(__dirname, "../../../lib/db/local_db.sqlite");
  const dbPath = (envDb && !envDb.startsWith("postgres")) ? envDb : fallbackPath;
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");

  dbInstance = drizzle(sqlite, { schema });
} catch (err) {
  console.error("FATAL DATABASE INITIALIZATION ERROR:", err);
  throw err;
}

export const db = dbInstance;

export * from "./schema";
