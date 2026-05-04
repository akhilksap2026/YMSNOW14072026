import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import router from "./routes";
import { registerYmsRoutes } from "./lib/register-yms-routes";

const app: Express = express();

app.use(compression());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

registerYmsRoutes(app);

// Global error handler — catches Neon endpoint wake-up errors and any other
// unhandled errors from route handlers, returning structured JSON responses.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const msg = String(
    (err as any)?.message ?? (err as any)?.cause?.message ?? err,
  );
  const isNeonWakeup =
    msg.includes("endpoint has been disabled") ||
    msg.includes("endpoint is disabled") ||
    msg.includes("Enable it using the API");

  if (isNeonWakeup) {
    res.status(503).json({
      error: "Database is waking up — please retry in a few seconds.",
      code: "DB_WAKING_UP",
    });
    return;
  }

  console.error("Unhandled route error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
