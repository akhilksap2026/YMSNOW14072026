/**
 * One-off backfill: create the "Northwind Logistics" default tenant and stamp
 * tenant_id on every existing row in every tenant-owned table.
 *
 * Run once, before the NOT NULL migration:
 *   cd replit && pnpm --filter @workspace/scripts run backfill-tenant
 */

import { db, pool, tenants } from "@workspace/db";

const TENANT = {
  name: "Northwind Logistics",
  slug: "northwind",
  status: "active" as const,
};

// Every tenant-owned table (DB name → TS label for the report)
const TABLES: Array<{ db: string; label: string }> = [
  { db: "users",                     label: "users" },
  { db: "user_profiles",             label: "user_profiles" },
  { db: "user_roles",                label: "user_roles" },
  { db: "carriers",                  label: "carriers" },
  { db: "yard_zones",                label: "yard_zones" },
  { db: "yard_slots",                label: "yard_slots" },
  { db: "dock_doors",                label: "dock_doors" },
  { db: "gates",                     label: "gates" },
  { db: "appointments",              label: "appointments" },
  { db: "visits",                    label: "visits" },
  { db: "gate_transactions",         label: "gate_transactions" },
  { db: "move_tasks",                label: "move_tasks" },
  { db: "exceptions",                label: "exceptions" },
  { db: "photos",                    label: "photos" },
  { db: "audit_logs",                label: "audit_logs" },
  { db: "yard_audit_items",          label: "yard_audit_items" },
  { db: "inspections",               label: "inspections" },
  { db: "ai_config",                 label: "ai_config" },
  { db: "ai_audit_logs",             label: "ai_audit_logs" },
  { db: "revenue_rates",             label: "revenue_rates" },
  { db: "carrier_contacts",          label: "carrier_contacts" },
  { db: "inbound_email_log",         label: "inbound_email_log" },
  { db: "email_ai_alerts",           label: "email_ai_alerts" },
  { db: "email_intelligence_config", label: "email_intelligence_config" },
];

async function main() {
  // 1. Upsert the default tenant
  const [tenant] = await db
    .insert(tenants)
    .values(TENANT)
    .onConflictDoUpdate({
      target: tenants.slug,
      set: { name: TENANT.name, status: TENANT.status },
    })
    .returning();

  console.log(`\nTenant: "${tenant.name}"  id=${tenant.id}\n`);
  console.log("Backfilling tenant_id on all tenant-owned tables...");

  const client = await pool.connect();
  let totalUpdated = 0;

  try {
    for (const t of TABLES) {
      const res = await client.query(
        `UPDATE "${t.db}" SET tenant_id = $1 WHERE tenant_id IS NULL`,
        [tenant.id],
      );
      const n = res.rowCount ?? 0;
      totalUpdated += n;
      console.log(`  ${t.label.padEnd(30)} ${n} rows updated`);
    }

    console.log(`\nTotal rows updated: ${totalUpdated}`);

    // 2. Verify zero nulls remain
    console.log("\nVerifying — checking for remaining NULL tenant_id values...");
    let allClean = true;
    for (const t of TABLES) {
      const res = await client.query(
        `SELECT COUNT(*) AS n FROM "${t.db}" WHERE tenant_id IS NULL`,
      );
      const nulls = Number(res.rows[0].n);
      if (nulls > 0) {
        console.error(`  ERROR: ${t.db} still has ${nulls} null tenant_id row(s)!`);
        allClean = false;
      }
    }

    if (allClean) {
      console.log("  All tables clean — no NULL tenant_id orphans remain.");
    } else {
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log("\nBackfill complete.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nBackfill failed:", err);
  process.exit(1);
});
