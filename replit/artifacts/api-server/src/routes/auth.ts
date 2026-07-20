import { Router } from "express";
import { db } from "../db";
import { users, userProfiles } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, verifyToken } from "../lib/session";

const router = Router();
const COOKIE  = "ymsnow_session";
const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, secure: false, path: "/" };
const DEMO_PASSWORD = "12345";

/**
 * POST /api/auth/login
 * Body: { userId: string, password: string }
 * Returns identity JSON + sets httpOnly session cookie.
 */
router.post("/login", async (req, res) => {
  const { userId, password } = req.body ?? {};

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "userId is required" });
  }
  if (password !== DEMO_PASSWORD) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

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

  if (!row) {
    return res.status(401).json({ error: "User not found" });
  }

  const tenantId = row.tenantId;
  if (!tenantId) {
    return res.status(500).json({ error: "User has no tenant assigned" });
  }
  const role = row.role ?? "admin";

  const token = signToken({ userId: row.userId, tenantId, role });
  res.cookie(COOKIE, token, COOKIE_OPTS);

  res.json({
    userId:    row.userId,
    tenantId,
    role,
    firstName: row.firstName,
    lastName:  row.lastName,
    email:     row.email,
  });
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
 * Returns { userId, tenantId, role } from the session cookie.
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
