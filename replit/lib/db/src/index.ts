import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function isNeonWakeupError(err: unknown): boolean {
  const msg = String(
    (err as any)?.message ?? (err as any)?.cause?.message ?? err,
  );
  return (
    msg.includes("endpoint has been disabled") ||
    msg.includes("endpoint is disabled") ||
    msg.includes("Enable it using the API")
  );
}

const rawPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 60000,
  max: 10,
});

// Wrap pool.query with Neon cold-start retry logic so every Drizzle query
// automatically handles the "endpoint has been disabled" wake-up error.
// This is the single place retry logic lives — storage.ts and routes need
// no changes.
const originalQuery = rawPool.query.bind(rawPool);
(rawPool as any).query = async function (...args: Parameters<typeof originalQuery>) {
  const maxAttempts = 8;
  let delayMs = 1500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await (originalQuery as any)(...args);
    } catch (err) {
      if (isNeonWakeupError(err) && attempt < maxAttempts) {
        console.log(
          `[db] Neon endpoint waking up — retry ${attempt}/${maxAttempts} in ${delayMs}ms`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(Math.round(delayMs * 1.5), 10000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("[db] Max Neon wake-up retry attempts reached");
};

export const pool = rawPool;
export const db = drizzle(pool, { schema });

export * from "./schema";
