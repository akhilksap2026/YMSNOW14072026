import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Allow time for Neon serverless endpoints to wake up from auto-suspend
  connectionTimeoutMillis: 15000,
  // Keep idle clients alive so subsequent requests don't re-pay the wake-up cost
  idleTimeoutMillis: 60000,
  max: 10,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
