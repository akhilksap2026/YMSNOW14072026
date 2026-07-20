/**
 * requireModule(moduleCode) — server-side module entitlement gate.
 *
 * Resolves the tenant's entitlement map (cached ~30 s) and short-circuits
 * with 403 if the module is disabled.  Must run after authMiddleware so
 * req.auth is already populated.
 *
 * Chain order: authMiddleware → requireModule → requirePermission → handler
 */
import type { Request, Response, NextFunction } from "express";
import { resolveEntitlements } from "./entitlements";

export function requireModule(moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = (req as any).auth?.tenantId;
      if (!tenantId) {
        // authMiddleware should have rejected this already; guard just in case
        res.status(401).json({ error: "unauthenticated" });
        return;
      }
      const map = await resolveEntitlements(tenantId);
      const ent = map[moduleCode];
      if (!ent?.enabled) {
        res.status(403).json({ error: "module_not_licensed", module: moduleCode });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
