/**
 * Verification query for prompt 0.5 billing catalog seed.
 * Run: cd replit && pnpm --filter @workspace/scripts run verify-billing
 */
import { db, pool } from "@workspace/db";
import {
  modules,
  plans,
  planModules,
  subscriptions,
  tenants,
} from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  // 1. Modules
  const mods = await db.select().from(modules).orderBy(modules.id);
  console.log(`\n=== MODULES (${mods.length}) ===`);
  for (const m of mods) {
    console.log(`  ${String(m.id).padStart(2)}  ${m.code.padEnd(16)}  ${m.category.padEnd(12)}  ${m.name}`);
  }

  // 2. Plans
  const ps = await db.select().from(plans).orderBy(plans.id);
  console.log(`\n=== PLANS (${ps.length}) ===`);
  for (const p of ps) {
    console.log(`  ${p.id}  ${p.code.padEnd(14)}  ${p.name}`);
  }

  // 3. plan_modules counts per plan
  const pmRows = await db.select().from(planModules);
  const byPlan = new Map<number, number>();
  for (const r of pmRows) byPlan.set(r.planId, (byPlan.get(r.planId) ?? 0) + 1);
  console.log(`\n=== PLAN_MODULES (total ${pmRows.length}) ===`);
  for (const p of ps) {
    console.log(`  plan_id=${p.id} (${p.code.padEnd(14)})  module_count=${byPlan.get(p.id) ?? 0}`);
  }

  // 4. Subscriptions with tenant names
  const subs = await db
    .select({
      subId:      subscriptions.id,
      status:     subscriptions.status,
      planId:     subscriptions.planId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(subscriptions)
    .innerJoin(tenants, eq(tenants.id, subscriptions.tenantId))
    .orderBy(subscriptions.id);

  console.log(`\n=== SUBSCRIPTIONS (${subs.length}) ===`);
  for (const s of subs) {
    const planName = ps.find((p) => p.id === s.planId)?.code ?? String(s.planId);
    console.log(`  sub_id=${s.subId}  tenant=${s.tenantSlug.padEnd(12)}  plan=${planName.padEnd(14)}  status=${s.status}`);
  }

  // 5. Assertions
  console.log("\n=== ASSERTIONS ===");
  const pass = (label: string, ok: boolean) => console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  pass("13 modules", mods.length === 13);
  pass("3 plans",    ps.length === 3);
  pass("core has 8 modules",         (byPlan.get(ps.find(p => p.code === "core")!.id) ?? 0) === 8);
  pass("professional has 11 modules",(byPlan.get(ps.find(p => p.code === "professional")!.id) ?? 0) === 11);
  pass("enterprise has 13 modules",  (byPlan.get(ps.find(p => p.code === "enterprise")!.id) ?? 0) === 13);
  pass("total plan_modules = 32",    pmRows.length === 32);
  pass("2 subscriptions",            subs.length === 2);
  const northwindSub = subs.find(s => s.tenantSlug === "northwind");
  const acmeSub      = subs.find(s => s.tenantSlug === "acme");
  pass("northwind → enterprise",     !!northwindSub && ps.find(p => p.id === northwindSub.planId)?.code === "enterprise");
  pass("acme → core",                !!acmeSub      && ps.find(p => p.id === acmeSub.planId)?.code === "core");
  pass("both subscriptions active",  subs.every(s => s.status === "active"));

  const allPass = [
    mods.length === 13, ps.length === 3,
    (byPlan.get(ps.find(p => p.code === "core")!.id) ?? 0) === 8,
    (byPlan.get(ps.find(p => p.code === "professional")!.id) ?? 0) === 11,
    (byPlan.get(ps.find(p => p.code === "enterprise")!.id) ?? 0) === 13,
    pmRows.length === 32, subs.length === 2,
    !!northwindSub && ps.find(p => p.id === northwindSub.planId)?.code === "enterprise",
    !!acmeSub && ps.find(p => p.id === acmeSub.planId)?.code === "core",
    subs.every(s => s.status === "active"),
  ].every(Boolean);

  console.log(allPass ? "\n=== PASS ===" : "\n=== FAIL ===");
  await pool.end();
  process.exit(allPass ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
