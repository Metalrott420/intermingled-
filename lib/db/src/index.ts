import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[DB] FATAL: DATABASE_URL environment variable is required");
  console.error("[DB] Set it to your PostgreSQL connection string on the Railway service");
  throw new Error("DATABASE_URL is required");
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

