import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./session";
import { tenantContext } from "./storage";

// Extend Express Request so route handlers can read req.auth
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        /** null for platform admins who are not bound to any tenant. */
        tenantId: string | null;
        role: string;
        isPlatformAdmin?: boolean;
      };
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
 *
 * Platform admins (isPlatformAdmin: true) bypass tenantContext — they are
 * not scoped to any single tenant and must not have tenant storage applied.
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

  if (payload.isPlatformAdmin) {
    // Platform admins are not bound to a tenant — skip AsyncLocalStorage scoping.
    // Their routes access the DB directly via requirePlatformAdmin-guarded handlers.
    return next();
  }

  // Bind the tenant to AsyncLocalStorage for the rest of this request's call chain.
  // DatabaseStorage's proxy reads this to scope every query automatically.
  tenantContext.run(payload.tenantId!, next);
}

/**
 * requirePlatformAdmin — 403 for every request that is not from a platform admin.
 * Chain after authMiddleware.
 *
 * @example
 *   app.get("/api/platform/tenants", requirePlatformAdmin, handler)
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.isPlatformAdmin) {
    res.status(403).json({ error: "platform_admin_required" });
    return;
  }
  next();
}
