import { Router } from "express";
import { resolveEntitlements } from "../lib/entitlements";

const router = Router();

/**
 * GET /api/me/entitlements
 *
 * Returns the resolved entitlement map for the authenticated tenant.
 * Protected by authMiddleware (session cookie required).
 *
 * Response shape:
 *   { [moduleCode: string]: { enabled: boolean, limits?: object } }
 */
router.get("/entitlements", async (req: any, res) => {
  try {
    const map = await resolveEntitlements(req.auth.tenantId);
    res.json(map);
  } catch (err: any) {
    console.error("[me/entitlements]", err);
    res.status(500).json({ error: "Failed to resolve entitlements" });
  }
});

export default router;
