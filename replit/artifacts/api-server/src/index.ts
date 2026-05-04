import app from "./app";
import { seedDatabase, seedRbacIfEmpty } from "./lib/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Neon serverless databases auto-suspend when idle. On cold start the first
// query may hit a suspended endpoint. This helper retries with backoff until
// the endpoint wakes up (typically within a few seconds).
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

async function withDbRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 10,
  initialDelayMs = 2000,
): Promise<T> {
  let delayMs = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (isNeonWakeupError(err) && attempt < maxAttempts) {
        console.log(
          `[${label}] Database endpoint waking up — retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(Math.round(delayMs * 1.5), 12000);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`[${label}] Max retry attempts (${maxAttempts}) reached`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  withDbRetry(() => seedDatabase(), "seed")
    .then(() => withDbRetry(() => seedRbacIfEmpty(), "rbac"))
    .catch((err) => {
      console.error("Startup seed failed:", err);
    });
});
