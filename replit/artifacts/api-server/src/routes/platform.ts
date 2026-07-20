/**
 * /api/platform/* — KSAP platform-admin routes.
 * All routes here require isPlatformAdmin: true in the session token.
 * Handlers use `db` directly — never `storage` (which is tenant-scoped).
 */
import { Router } from "express";
import { randomBytes } from "crypto";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  tenants,
  users,
  userProfiles,
  plans,
  subscriptions,
} from "@workspace/db";
import { requirePlatformAdmin } from "../lib/auth-middleware";
import { invalidateEntitlements } from "../lib/entitlements";

const router = Router();

// Guard every route in this namespace
router.use(requirePlatformAdmin);

// ── Probe (identity check) ────────────────────────────────────────────────────
router.get("/probe", (req, res) => {
  res.json({ ok: true, identity: req.auth });
});

// ── Tenant list ───────────────────────────────────────────────────────────────
/**
 * GET /api/platform/tenants
 * Returns all tenants with their current plan and subscription status.
 */
router.get("/tenants", async (_req, res) => {
  try {
    const rows = await db
      .select({
        id:                 tenants.id,
        name:               tenants.name,
        slug:               tenants.slug,
        status:             tenants.status,
        createdAt:          tenants.createdAt,
        subscriptionId:     subscriptions.id,
        subscriptionStatus: subscriptions.status,
        planId:             plans.id,
        planCode:           plans.code,
        planName:           plans.name,
      })
      .from(tenants)
      .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .orderBy(desc(tenants.createdAt));

    // Deduplicate: if a tenant somehow has multiple subscriptions, keep the latest
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    res.json(deduped);
  } catch (err: any) {
    console.error("[platform/tenants GET]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Create tenant ─────────────────────────────────────────────────────────────
/**
 * POST /api/platform/tenants
 * Body: { name, adminFirstName, adminLastName, adminEmail?, adminUserId? }
 *
 * Creates: tenant → admin user → user profile (role:admin) → Core subscription.
 */
router.post("/tenants", async (req, res) => {
  const { name, adminFirstName, adminLastName, adminEmail, adminUserId } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!adminFirstName || !adminLastName) {
    return res.status(400).json({ error: "adminFirstName and adminLastName are required" });
  }

  const slug = name.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Ensure slug uniqueness
  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: `A tenant with slug "${slug}" already exists` });
  }

  // Find the Core plan (default for new tenants)
  const [corePlan] = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.code, "core"))
    .limit(1);
  if (!corePlan) {
    return res.status(500).json({ error: "Core plan not found — run seed first" });
  }

  try {
    // 1. Create tenant
    const [tenant] = await db
      .insert(tenants)
      .values({ name: name.trim(), slug, status: "active" })
      .returning();

    // 2. Create admin user (auto-generate userId if not supplied)
    const userId = (adminUserId?.trim()) || `${slug}-admin-${randomBytes(3).toString("hex")}`;
    await db.insert(users).values({
      id:        userId,
      tenantId:  tenant.id,
      email:     adminEmail?.trim() || null,
      firstName: adminFirstName.trim(),
      lastName:  adminLastName.trim(),
    });

    // 3. User profile — role: admin
    await db.insert(userProfiles).values({
      userId,
      tenantId:  tenant.id,
      role:      "admin",
      carrierId: null,
    });

    // 4. Core subscription
    await db.insert(subscriptions).values({
      tenantId: tenant.id,
      planId:   corePlan.id,
      status:   "active",
    });

    res.status(201).json({
      ...tenant,
      adminUserId: userId,
    });
  } catch (err: any) {
    console.error("[platform/tenants POST]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update tenant ─────────────────────────────────────────────────────────────
/**
 * PATCH /api/platform/tenants/:id
 * Body: { name?, status? }   status: "active" | "suspended"
 *
 * Suspending sets both tenant.status and subscription.status to "suspended",
 * then invalidates the entitlement cache so the resolver immediately disables
 * all modules for that tenant's users.
 */
router.patch("/tenants/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body ?? {};

  // Verify tenant exists
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }

  try {
    if (name && typeof name === "string" && name.trim()) {
      await db.update(tenants).set({ name: name.trim() }).where(eq(tenants.id, id));
    }

    if (status === "suspended" || status === "active") {
      // Update both the tenant row and its subscription(s)
      await db.update(tenants).set({ status }).where(eq(tenants.id, id));
      await db.update(subscriptions).set({ status }).where(eq(subscriptions.tenantId, id));
      // Bust the entitlement cache so the resolver sees the new status immediately
      invalidateEntitlements(id);
    }

    // Return the updated tenant with plan info
    const [updated] = await db
      .select({
        id:                 tenants.id,
        name:               tenants.name,
        slug:               tenants.slug,
        status:             tenants.status,
        createdAt:          tenants.createdAt,
        subscriptionStatus: subscriptions.status,
        planCode:           plans.code,
        planName:           plans.name,
      })
      .from(tenants)
      .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(tenants.id, id))
      .limit(1);

    res.json(updated);
  } catch (err: any) {
    console.error("[platform/tenants PATCH]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
