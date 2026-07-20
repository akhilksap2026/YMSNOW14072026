import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./session";

// Extend Express Request so route handlers can read req.auth
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; tenantId: string; role: string };
    }
  }
}

/**
 * Mounted at app.use("/api", authMiddleware).
 * req.path is therefore relative to /api (e.g. "/visits", "/auth/login").
 *
 * Skipped paths (no cookie required):
 *   /auth/*   — login, logout, me all live here
 *   /health   — uptime probe
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/auth/") || req.path === "/health" || req.path === "/healthz") {
    return next();
  }

  const token: string | undefined = (req as any).cookies?.ymsnow_session;
  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  req.auth = payload;
  next();
}
