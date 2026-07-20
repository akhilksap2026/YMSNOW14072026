/**
 * /api/platform/* — KSAP platform-admin routes.
 * All routes here require isPlatformAdmin: true in the session token.
 * Management endpoints themselves land in 2.2+; this file bootstraps the
 * prefix and provides a probe endpoint for identity verification.
 */
import { Router } from "express";
import { requirePlatformAdmin } from "../lib/auth-middleware";

const router = Router();

// Apply the guard to every route in this namespace
router.use(requirePlatformAdmin);

/**
 * GET /api/platform/probe
 * Returns identity confirmation for the authenticated platform admin.
 * Used for integration testing; harmless to leave in production.
 */
router.get("/probe", (req, res) => {
  res.json({
    ok: true,
    identity: req.auth,
  });
});

export default router;
