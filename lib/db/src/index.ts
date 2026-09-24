import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

let dbInstance: any;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "[DB] FATAL: DATABASE_URL environment variable is required. " +
    "Set it to your PostgreSQL connection string (e.g., postgres://user:pass@host/db)"
  );
}

try {
  const client = new Client({ connectionString: databaseUrl });
  dbInstance = drizzle(client, { schema });
  console.log("[DB] PostgreSQL database initialized successfully");
} catch (err) {
  console.error("[DB] FATAL DATABASE INITIALIZATION ERROR:", err);
  throw err;
}

export const db = dbInstance;

export * from "./schema";

