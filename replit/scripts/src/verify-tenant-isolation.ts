/**
 * Prompt 0.4 verification script.
 *
 * Creates a second tenant (Acme Corp) with its own user and carrier, then
 * proves via the live API that each session sees only its own carrier list.
 *
 * Run: cd replit && pnpm --filter @workspace/scripts run verify-isolation
 */
import { db, tenants, users, carriers } from "@workspace/db";
import { userProfiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const API = "http://localhost:8080";

async function loginAndGetCookie(userId: string): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password: "12345" }),
  });
  if (!res.ok) throw new Error(`Login failed for ${userId}: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/ymsnow_session=[^;]+/);
  if (!match) throw new Error(`No session cookie returned for ${userId}`);
  return match[0];
}

async function getCarriers(cookie: string): Promise<any[]> {
  const res = await fetch(`${API}/api/carriers`, { headers: { Cookie: cookie } });
  if (!res.ok) throw new Error(`GET /api/carriers failed: ${res.status}`);
  return res.json();
}

async function main() {
  console.log("=== Prompt 0.4 Tenant Isolation Verification ===\n");

  const ACME_SLUG = "acme";
  const ACME_USER = "acme-admin";
  const ACME_CARRIER = "Acme Freight Co.";

  // 1. Ensure Acme Corp tenant
  let [acmeTenant] = await db.select().from(tenants).where(eq(tenants.slug, ACME_SLUG));
  if (!acmeTenant) {
    [acmeTenant] = await db
      .insert(tenants)
      .values({ name: "Acme Corp", slug: ACME_SLUG, status: "active" })
      .returning();
    console.log(`✓ Created tenant: ${acmeTenant.name} (${acmeTenant.id})`);
  } else {
    console.log(`  Tenant already exists: ${acmeTenant.name} (${acmeTenant.id})`);
  }

  // 2. Ensure Acme user
  let [acmeUser] = await db.select().from(users).where(eq(users.id, ACME_USER));
  if (!acmeUser) {
    [acmeUser] = await db
      .insert(users)
      .values({
        id: ACME_USER,
        tenantId: acmeTenant.id,
        email: "admin@acme.example.com",
        firstName: "Acme",
        lastName: "Admin",
      })
      .returning();
    console.log(`✓ Created user: ${acmeUser.id}`);
  } else {
    console.log(`  User already exists: ${acmeUser.id}`);
  }

  // 3. Ensure Acme user profile (needed so login's getUserProfile resolves the role)
  const [existingProfile] = await db
    .select()
    .from(userProfiles)
    .where(and(eq(userProfiles.userId, ACME_USER), eq(userProfiles.tenantId, acmeTenant.id)));
  if (!existingProfile) {
    await db.insert(userProfiles).values({
      userId: ACME_USER,
      tenantId: acmeTenant.id,
      role: "admin",
      isActive: true,
    });
    console.log(`✓ Created user profile for ${ACME_USER}`);
  } else {
    console.log(`  Profile already exists for ${ACME_USER}`);
  }

  // 4. Ensure Acme-only carrier
  const [existingCarrier] = await db
    .select()
    .from(carriers)
    .where(and(eq(carriers.tenantId, acmeTenant.id), eq(carriers.name, ACME_CARRIER)));
  if (!existingCarrier) {
    await db.insert(carriers).values({
      tenantId: acmeTenant.id,
      name: ACME_CARRIER,
      scacCode: "ACME",
      isActive: true,
    });
    console.log(`✓ Created carrier: ${ACME_CARRIER}\n`);
  } else {
    console.log(`  Carrier already exists: ${ACME_CARRIER}\n`);
  }

  // 5. API isolation test
  console.log("--- Tenant isolation test ---\n");
  const northwindCookie = await loginAndGetCookie("demo-user");
  const acmeCookie = await loginAndGetCookie(ACME_USER);

  const northwindCarriers = await getCarriers(northwindCookie);
  const acmeCarriers = await getCarriers(acmeCookie);

  const northwindNames: string[] = northwindCarriers.map((c: any) => c.name);
  const acmeNames: string[] = acmeCarriers.map((c: any) => c.name);

  console.log(`Northwind carrier count : ${northwindCarriers.length}`);
  console.log(`Acme carrier count      : ${acmeCarriers.length}`);
  console.log(`Northwind carriers      : ${northwindNames.slice(0, 3).join(", ")}…`);
  console.log(`Acme carriers           : ${acmeNames.join(", ")}`);
  console.log();

  // Acme should not see any Northwind-only carrier names
  const leakToAcme = acmeNames.filter((n) => northwindNames.includes(n));
  // Northwind should not see the Acme-only carrier
  const leakToNorthwind = northwindNames.filter((n) => n === ACME_CARRIER);

  if (leakToAcme.length > 0) {
    console.error(`✗ ISOLATION FAILURE: Acme session sees Northwind carriers: ${leakToAcme.join(", ")}`);
    process.exit(1);
  }
  if (leakToNorthwind.length > 0) {
    console.error(`✗ ISOLATION FAILURE: Northwind session sees Acme carrier: ${leakToNorthwind.join(", ")}`);
    process.exit(1);
  }

  console.log(`✓ Northwind session does NOT see "${ACME_CARRIER}" (Acme-only)`);
  console.log(`✓ Acme session sees only its own ${acmeCarriers.length} carrier(s)`);
  console.log(`✓ No cross-tenant data leakage detected`);
  console.log("\n=== PASS — Prompt 0.4 tenant isolation verified ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
