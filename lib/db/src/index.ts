import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

const envDb = process.env.DATABASE_URL;
const dbPath = (envDb && !envDb.startsWith("postgres")) ? envDb : path.join(process.cwd(), "lib/db/local_db.sqlite");
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

export * from "./schema";
