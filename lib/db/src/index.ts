import path from "path";
import fs from "fs";
import * as schema from "./schema";

let dbInstance: any;

const databaseUrl = process.env.DATABASE_URL;
const isPostgres = databaseUrl && databaseUrl.startsWith("postgres");

try {
  if (isPostgres) {
    // Production: use PostgreSQL via pg
    const { drizzle } = require("drizzle-orm/node-postgres");
    const { Client } = require("pg");
    
    const client = new Client({ connectionString: databaseUrl });
    // Don't connect immediately - let drizzle manage the connection pool
    dbInstance = drizzle(client, { schema });
    console.log("[DB] PostgreSQL database initialized successfully");
  } else {
    // Development: use SQLite
    const { drizzle } = require("drizzle-orm/better-sqlite3");
    const Database = require("better-sqlite3");
    
    const envPath = process.env.SQLITE_DB_PATH || process.env.DATABASE_PATH;
    const fallbackPath = path.resolve(__dirname, "../../../lib/db/local_db.sqlite");
    let dbPath = envPath || fallbackPath;

    let sqlite: any;
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

    dbInstance = drizzle(sqlite, { schema });
    console.log(`[DB] SQLite database initialized successfully at: ${dbPath}`);
  }
} catch (err) {
  console.error("FATAL DATABASE INITIALIZATION ERROR:", err);
  throw err;
}

export const db = dbInstance;

export * from "./schema";

