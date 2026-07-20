/**
 * Entitlement resolver — the single authoritative source of truth for
 * whether a module is accessible for a given tenant.
 *
 * Resolution order:
 *   1. Look up the tenant's subscription. If none, or status ∉ {active, trialing},
 *      every module is disabled.
 *   2. Start from the plan's module set (all enabled, limits from plan_modules).
 *   3. Apply tenant_module_overrides (enabled=true adds, enabled=false removes).
 *      Overrides with expiresAt in the past are skipped.
 *
 * Results are cached in-process for TTL_MS (~30 s).
 * Call invalidateEntitlements(tenantId) whenever a subscription or override changes.
 */
import { db } from "../db";
import {
  subscriptions,
  planModules,
  modules,
  tenantModuleOverrides,
} from "@workspace/db";
import { eq, and, or, isNull, gt, desc } from "drizzle-orm";

// ─── Public types ─────────────────────────────────────────────────────────────
export interface ModuleEntitlement {
  enabled: boolean;
  limits?: Record<string, unknown> | null;
}
export type EntitlementMap = Record<string, ModuleEntitlement>;

// ─── TTL cache ────────────────────────────────────────────────────────────────
const TTL_MS = 30_000; // 30 seconds
const cache = new Map<string, { data: EntitlementMap; expiresAt: number }>();

export function invalidateEntitlements(tenantId: string): void {
  cache.delete(tenantId);
}

// ─── Public resolver ──────────────────────────────────────────────────────────
export async function resolveEntitlements(tenantId: string): Promise<EntitlementMap> {
  const now = Date.now();
  const hit = cache.get(tenantId);
  if (hit && hit.expiresAt > now) return hit.data;

  const data = await _resolve(tenantId);
  cache.set(tenantId, { data, expiresAt: now + TTL_MS });
  return data;
}

// ─── Internal implementation ──────────────────────────────────────────────────
async function _resolve(tenantId: string): Promise<EntitlementMap> {
  // Fetch all known module codes so we can build a complete map
  const allModules = await db
    .select({ code: modules.code })
    .from(modules)
    .orderBy(modules.id);

  // Start with everything disabled
  const result: EntitlementMap = {};
  for (const m of allModules) result[m.code] = { enabled: false };

  // 1. Find the most-recent subscription for this tenant
  const [sub] = await db
    .select({ planId: subscriptions.planId, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.id))
    .limit(1);

  const activeStatuses = ["active", "trialing"];
  if (!sub || !activeStatuses.includes(sub.status)) {
    // No subscription or inactive — return all-disabled map
    return result;
  }

  // 2. Enable every module that is part of the plan
  const planMods = await db
    .select({
      code:   modules.code,
      limits: planModules.limits,
    })
    .from(planModules)
    .innerJoin(modules, eq(modules.id, planModules.moduleId))
    .where(eq(planModules.planId, sub.planId));

  for (const pm of planMods) {
    result[pm.code] = {
      enabled: true,
      ...(pm.limits != null ? { limits: pm.limits as Record<string, unknown> } : {}),
    };
  }

  // 3. Apply per-tenant overrides; skip any that have already expired
  const nowDate = new Date();
  const overrides = await db
    .select({
      code:      modules.code,
      enabled:   tenantModuleOverrides.enabled,
      expiresAt: tenantModuleOverrides.expiresAt,
    })
    .from(tenantModuleOverrides)
    .innerJoin(modules, eq(modules.id, tenantModuleOverrides.moduleId))
    .where(
      and(
        eq(tenantModuleOverrides.tenantId, tenantId),
        or(
          isNull(tenantModuleOverrides.expiresAt),
          gt(tenantModuleOverrides.expiresAt, nowDate)
        )
      )
    );

  for (const ov of overrides) {
    if (result[ov.code] !== undefined) {
      // Preserve existing limits when toggling via override
      result[ov.code] = { ...result[ov.code], enabled: ov.enabled };
    }
  }

  return result;
}

// ─── Source-annotated resolver (platform admin only, never cached) ────────────

export type OverrideSource = "plan" | "not-in-plan" | "override-on" | "override-off";

export interface ModuleRowWithSource {
  code:        string;
  name:        string;
  category:    string;
  description: string | null;
  /** Fully-resolved enabled value (accounts for subscription status). */
  enabled:     boolean;
  limits:      Record<string, unknown> | null;
  /** Where the decision comes from in the current configuration. */
  source:      OverrideSource;
  /** Raw stored override row, or null when no row exists. */
  override: {
    enabled:   boolean;
    reason:    string | null;
    expiresAt: Date | null;
  } | null;
}

/**
 * resolveEntitlementsWithSource — like _resolve but annotates every module
 * with source metadata so the platform-admin UI can show "plan vs override".
 *
 * Resolution rules are IDENTICAL to _resolve; only metadata is added.
 * Results are NOT cached — this is an admin-only introspection path.
 */
export async function resolveEntitlementsWithSource(
  tenantId: string
): Promise<ModuleRowWithSource[]> {
  // All modules in catalog order
  const allMods = await db
    .select({
      id:          modules.id,
      code:        modules.code,
      name:        modules.name,
      category:    modules.category,
      description: modules.description,
    })
    .from(modules)
    .orderBy(modules.id);

  // Subscription (same query as _resolve)
  const [sub] = await db
    .select({ planId: subscriptions.planId, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .orderBy(desc(subscriptions.id))
    .limit(1);

  const subActive = sub && ["active", "trialing"].includes(sub.status);

  // Plan module set (only meaningful when subscription is active)
  const planSet   = new Set<string>();
  const limitsMap = new Map<string, Record<string, unknown> | null>();
  if (subActive) {
    const pm = await db
      .select({ code: modules.code, limits: planModules.limits })
      .from(planModules)
      .innerJoin(modules, eq(modules.id, planModules.moduleId))
      .where(eq(planModules.planId, sub!.planId));
    for (const r of pm) {
      planSet.add(r.code);
      limitsMap.set(r.code, r.limits as Record<string, unknown> | null);
    }
  }

  // ALL stored override rows for this tenant (including expired — admin needs to see them)
  const ovRows = await db
    .select({
      code:      modules.code,
      enabled:   tenantModuleOverrides.enabled,
      reason:    tenantModuleOverrides.reason,
      expiresAt: tenantModuleOverrides.expiresAt,
    })
    .from(tenantModuleOverrides)
    .innerJoin(modules, eq(modules.id, tenantModuleOverrides.moduleId))
    .where(eq(tenantModuleOverrides.tenantId, tenantId));
  const ovMap = new Map(ovRows.map((r) => [r.code, r]));

  const now = new Date();

  return allMods.map((m) => {
    const ov       = ovMap.get(m.code) ?? null;
    const ovActive = ov != null && (!ov.expiresAt || ov.expiresAt > now);

    let enabled: boolean;
    let source: OverrideSource;

    if (!subActive) {
      // Subscription inactive → all disabled, but show what config WOULD give
      enabled = false;
      source  = ovActive
        ? (ov!.enabled ? "override-on" : "override-off")
        : (planSet.has(m.code) ? "plan" : "not-in-plan");
    } else if (ovActive) {
      enabled = ov!.enabled;
      source  = ov!.enabled ? "override-on" : "override-off";
    } else if (planSet.has(m.code)) {
      enabled = true;
      source  = "plan";
    } else {
      enabled = false;
      source  = "not-in-plan";
    }

    return {
      code:        m.code,
      name:        m.name,
      category:    m.category,
      description: m.description,
      enabled,
      limits:      limitsMap.get(m.code) ?? null,
      source,
      override:    ov
        ? { enabled: ov.enabled, reason: ov.reason, expiresAt: ov.expiresAt }
        : null,
    };
  });
}
