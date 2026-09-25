import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[DB] ERROR: DATABASE_URL environment variable is not set");
  console.error("[DB] This is required to connect to PostgreSQL");
  console.error("[DB] Set it on your Railway service to: ${{Postgres.DATABASE_URL}}");
  throw new Error("DATABASE_URL environment variable is required");
}

let dbInstance: any;

try {
  const client = new Client({ connectionString: databaseUrl });
  dbInstance = drizzle(client, { schema });
  console.log("[DB] PostgreSQL database initialized");
} catch (err) {
  console.error("[DB] FATAL: Failed to initialize database:", err);
  throw err;
}

export const db = dbInstance;
export * from "./schema";

