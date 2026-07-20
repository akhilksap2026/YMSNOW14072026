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
  modules,
  tenantModuleOverrides,
} from "@workspace/db";
import { requirePlatformAdmin } from "../lib/auth-middleware";
import {
  invalidateEntitlements,
  resolveEntitlementsWithSource,
} from "../lib/entitlements";

const router = Router();

// Guard every route in this namespace
router.use(requirePlatformAdmin);

// ── Probe (identity check) ────────────────────────────────────────────────────
router.get("/probe", (req, res) => {
  res.json({ ok: true, identity: req.auth });
});

// ── Tenant list ───────────────────────────────────────────────────────────────
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
router.post("/tenants", async (req, res) => {
  const { name, adminFirstName, adminLastName, adminEmail, adminUserId } = req.body ?? {};

  if (!name || typeof name !== "string" || !name.trim())
    return res.status(400).json({ error: "name is required" });
  if (!adminFirstName || !adminLastName)
    return res.status(400).json({ error: "adminFirstName and adminLastName are required" });

  const slug = name.trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (existing.length > 0)
    return res.status(409).json({ error: `A tenant with slug "${slug}" already exists` });

  const [corePlan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, "core")).limit(1);
  if (!corePlan)
    return res.status(500).json({ error: "Core plan not found — run seed first" });

  try {
    const [tenant] = await db.insert(tenants).values({ name: name.trim(), slug, status: "active" }).returning();
    const userId = adminUserId?.trim() || `${slug}-admin-${randomBytes(3).toString("hex")}`;
    await db.insert(users).values({ id: userId, tenantId: tenant.id, email: adminEmail?.trim() || null, firstName: adminFirstName.trim(), lastName: adminLastName.trim() });
    await db.insert(userProfiles).values({ userId, tenantId: tenant.id, role: "admin", carrierId: null });
    await db.insert(subscriptions).values({ tenantId: tenant.id, planId: corePlan.id, status: "active" });
    res.status(201).json({ ...tenant, adminUserId: userId });
  } catch (err: any) {
    console.error("[platform/tenants POST]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update tenant (rename / suspend / reactivate) ─────────────────────────────
router.patch("/tenants/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body ?? {};

  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    if (name && typeof name === "string" && name.trim())
      await db.update(tenants).set({ name: name.trim() }).where(eq(tenants.id, id));

    if (status === "suspended" || status === "active") {
      await db.update(tenants).set({ status }).where(eq(tenants.id, id));
      await db.update(subscriptions).set({ status }).where(eq(subscriptions.tenantId, id));
      invalidateEntitlements(id);
    }

    const [updated] = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug, status: tenants.status, createdAt: tenants.createdAt, subscriptionStatus: subscriptions.status, planCode: plans.code, planName: plans.name })
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

// ── Tenant entitlements with source metadata ──────────────────────────────────
/**
 * GET /api/platform/tenants/:id/entitlements
 * Returns the full module matrix with: enabled, source ("plan" | "not-in-plan" |
 * "override-on" | "override-off"), stored override data, and all plans for the
 * plan-change selector. Uncached — for admin inspection only.
 */
router.get("/tenants/:id/entitlements", async (req, res) => {
  const { id } = req.params;

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  try {
    // Subscription + plan details (for the card)
    const [sub] = await db
      .select({
        subId:            subscriptions.id,
        planId:           subscriptions.planId,
        planCode:         plans.code,
        planName:         plans.name,
        status:           subscriptions.status,
        trialEnd:         subscriptions.trialEnd,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(plans.id, subscriptions.planId))
      .where(eq(subscriptions.tenantId, id))
      .orderBy(desc(subscriptions.id))
      .limit(1);

    // All plans for the plan-selector dropdown
    const allPlans = await db
      .select({ id: plans.id, code: plans.code, name: plans.name })
      .from(plans)
      .orderBy(plans.id);

    // Source-annotated module matrix
    const moduleRows = await resolveEntitlementsWithSource(id);

    res.json({
      tenantId:     tenant.id,
      tenantName:   tenant.name,
      subscription: sub ?? null,
      plans:        allPlans,
      modules:      moduleRows,
    });
  } catch (err: any) {
    console.error("[platform/tenants/:id/entitlements GET]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update subscription (plan change / status / trialEnd) ─────────────────────
/**
 * PUT /api/platform/tenants/:id/subscription
 * Body: { planId?, status?, trialEnd? }
 * Invalidates entitlement cache after write.
 */
router.put("/tenants/:id/subscription", async (req, res) => {
  const { id } = req.params;
  const { planId, status, trialEnd } = req.body ?? {};

  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const updates: Record<string, any> = {};
  if (planId   != null) updates.planId   = Number(planId);
  if (status   != null) updates.status   = String(status);
  if (trialEnd !== undefined) updates.trialEnd = trialEnd ? new Date(trialEnd) : null;
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "No fields to update" });

  try {
    await db.update(subscriptions).set(updates).where(eq(subscriptions.tenantId, id));

    // Keep tenant.status in sync with subscription status
    if (updates.status === "suspended" || updates.status === "active") {
      await db.update(tenants).set({ status: updates.status }).where(eq(tenants.id, id));
    }

    invalidateEntitlements(id);
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[platform/tenants/:id/subscription PUT]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Upsert per-module overrides ───────────────────────────────────────────────
/**
 * PUT /api/platform/tenants/:id/overrides
 * Body: { overrides: Array<{ moduleCode, enabled, reason?, expiresAt? }> }
 *
 * Full-replace: deletes all existing overrides for this tenant, then inserts
 * the supplied list. Send an empty array to clear all overrides.
 * Invalidates entitlement cache after write.
 */
router.put("/tenants/:id/overrides", async (req, res) => {
  const { id } = req.params;
  const { overrides } = req.body ?? {};

  if (!Array.isArray(overrides))
    return res.status(400).json({ error: "overrides must be an array" });

  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, id)).limit(1);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  // Build moduleCode → id map
  const allMods = await db.select({ id: modules.id, code: modules.code }).from(modules);
  const modIdMap = new Map(allMods.map((m) => [m.code, m.id]));

  try {
    // Full replace: clear then insert
    await db.delete(tenantModuleOverrides).where(eq(tenantModuleOverrides.tenantId, id));

    const validRows = overrides
      .filter((o) => modIdMap.has(o.moduleCode) && typeof o.enabled === "boolean")
      .map((o) => ({
        tenantId:  id,
        moduleId:  modIdMap.get(o.moduleCode)!,
        enabled:   o.enabled,
        reason:    o.reason  ?? null,
        expiresAt: o.expiresAt ? new Date(o.expiresAt) : null,
      }));

    if (validRows.length > 0) {
      await db.insert(tenantModuleOverrides).values(validRows);
    }

    invalidateEntitlements(id);
    res.json({ ok: true, overridesApplied: validRows.length });
  } catch (err: any) {
    console.error("[platform/tenants/:id/overrides PUT]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
