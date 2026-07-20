import { Router } from "express";
import { db } from "../db";
import { users, userProfiles, platformAdmins } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, verifyToken } from "../lib/session";

const router = Router();
const COOKIE  = "ymsnow_session";
const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, secure: false, path: "/" };
const DEMO_PASSWORD = "12345";

/**
 * POST /api/auth/login
 * Body: { userId: string, password: string }
 *
 * Tries tenant users first; falls back to platform_admins.
 * Platform admins receive a token with tenantId: null and isPlatformAdmin: true.
 */
router.post("/login", async (req, res) => {
  const { userId, password } = req.body ?? {};

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId is required" });
  }
  if (password !== DEMO_PASSWORD) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // ── 1. Try tenant user ────────────────────────────────────────────────────
  const [row] = await db
    .select({
      userId:    users.id,
      tenantId:  users.tenantId,
      firstName: users.firstName,
      lastName:  users.lastName,
      email:     users.email,
      role:      userProfiles.role,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (row) {
    const tenantId = row.tenantId;
    if (!tenantId) {
      return res.status(500).json({ error: "User has no tenant assigned" });
    }
    const role = row.role ?? "admin";
    const token = signToken({ userId: row.userId, tenantId, role });
    res.cookie(COOKIE, token, COOKIE_OPTS);
    return res.json({
      userId:    row.userId,
      tenantId,
      role,
      isPlatformAdmin: false,
      firstName: row.firstName,
      lastName:  row.lastName,
      email:     row.email,
    });
  }

  // ── 2. Try platform admin ─────────────────────────────────────────────────
  const [adminRow] = await db
    .select()
    .from(platformAdmins)
    .where(eq(platformAdmins.id, userId))
    .limit(1);

  if (adminRow) {
    const token = signToken({
      userId:          adminRow.id,
      tenantId:        null,
      role:            "platform_admin",
      isPlatformAdmin: true,
    });
    res.cookie(COOKIE, token, COOKIE_OPTS);
    return res.json({
      userId:          adminRow.id,
      tenantId:        null,
      role:            "platform_admin",
      isPlatformAdmin: true,
      firstName:       adminRow.firstName,
      lastName:        adminRow.lastName,
      email:           adminRow.email,
    });
  }

  return res.status(401).json({ error: "User not found" });
});

/**
 * POST /api/auth/logout
 * Clears the session cookie. No auth required (intentionally).
 */
router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

/**
 * GET /api/auth/me
 * Returns the full session payload (including isPlatformAdmin when applicable).
 * Auth middleware skips /auth/*, so we verify the token ourselves.
 */
router.get("/me", (req, res) => {
  const token: string | undefined = (req as any).cookies?.ymsnow_session;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid or expired session" });

  res.json(payload);
});

export default router;
