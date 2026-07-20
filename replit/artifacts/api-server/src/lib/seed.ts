import { db } from "../db";
import {
  carriers,
  yardZones,
  yardSlots,
  dockDoors,
  gates,
  appointments,
  visits,
  gateTransactions,
  moveTasks,
  exceptions,
  auditLogs,
  userProfiles,
  users,
  inspections,
  yardAuditItems,
  roles,
  tenants,
  userRoles,
  permissions,
  rolePermissions,
  modules     as modulesTable,
  plans       as plansTable,
  planModules as planModulesTable,
  subscriptions as subscriptionsTable,
  platformAdmins,
} from "@workspace/db";
import { count, eq, sql } from "drizzle-orm";

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3600000);
}

function minutesAgo(m: number): Date {
  return new Date(Date.now() - m * 60000);
}

function visitNum(i: number): string {
  return `VST-${(Date.now() - i * 100000).toString(36).toUpperCase()}`;
}

function aptRef(i: number): string {
  return `APT-${(1000 + i).toString(36).toUpperCase()}`;
}

export async function seedDatabase() {
  const [carrierCount] = await db.select({ c: count() }).from(carriers);
  if (Number(carrierCount.c) > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  // Upsert the default tenant (idempotent)
  const [tenant] = await db
    .insert(tenants)
    .values({ name: "Northwind Logistics", slug: "northwind", status: "active" })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: "Northwind Logistics", status: "active" } })
    .returning();
  const tid = tenant.id;
  // Stamp every inserted row with the tenant id
  const wt = <T extends object>(rows: T[]): Array<T & { tenantId: string }> =>
    rows.map((r) => ({ ...r, tenantId: tid }));

  console.log("Seeding database with comprehensive demo data...");

  const insertedCarriers = await db
    .insert(carriers)
    .values(wt([
      { name: "Swift Transportation", scacCode: "SWFT", contactName: "Mike Johnson", contactEmail: "dispatch@swift.com", contactPhone: "(602) 269-9700", address: "2200 S 75th Ave, Phoenix, AZ 85043", brandColour: "#FF6B00" },
      { name: "J.B. Hunt Transport Services", scacCode: "JBHT", contactName: "Sarah Williams", contactEmail: "ops@jbhunt.com", contactPhone: "(479) 820-0000", address: "615 JB Hunt Corporate Dr, Lowell, AR 72745", brandColour: "#2D6A2E" },
      { name: "Werner Enterprises", scacCode: "WERN", contactName: "Tom Davis", contactEmail: "yard@werner.com", contactPhone: "(402) 895-6640", address: "14507 Frontier Rd, Omaha, NE 68138", brandColour: "#006633" },
      { name: "Schneider National", scacCode: "SNDR", contactName: "Lisa Chen", contactEmail: "logistics@schneider.com", contactPhone: "(920) 592-2000", address: "3101 S Packerland Dr, Green Bay, WI 54313", brandColour: "#FF6600" },
      { name: "XPO Logistics", scacCode: "XPOL", contactName: "James Brown", contactEmail: "operations@xpo.com", contactPhone: "(855) 976-6427", address: "Five American Lane, Greenwich, CT 06831", brandColour: "#E31837" },
      { name: "FedEx Freight", scacCode: "FXFE", contactName: "Rachel Torres", contactEmail: "freight@fedex.com", contactPhone: "(866) 393-4585", address: "1000 FedEx Dr, Moon Township, PA 15108", brandColour: "#4D148C" },
      { name: "Old Dominion Freight", scacCode: "ODFL", contactName: "Kevin Patel", contactEmail: "dispatch@odfl.com", contactPhone: "(800) 235-5569", address: "500 Old Dominion Way, Thomasville, NC 27360", brandColour: "#C8960C" },
      { name: "YRC Worldwide", scacCode: "YRCW", contactName: "Dan Mitchell", contactEmail: "ops@yrcw.com", contactPhone: "(913) 696-6100", address: "10990 Roe Ave, Overland Park, KS 66211", brandColour: "#003087" },
      { name: "Estes Express Lines", scacCode: "EXLA", contactName: "Maria Santos", contactEmail: "dispatch@estes-express.com", contactPhone: "(804) 353-1900", address: "3901 W Broad St, Richmond, VA 23230", brandColour: "#003DA5" },
      { name: "Heartland Express", scacCode: "HTLD", contactName: "Bob Reynolds", contactEmail: "yard@heartlandexpress.com", contactPhone: "(319) 626-3600", address: "901 S Kansas Ave, North Liberty, IA 52317", brandColour: "#CC0000" },
      { name: "KLLM Transport", scacCode: "KLLM", contactName: "Angela Moore", contactEmail: "ops@kllm.com", contactPhone: "(601) 936-5556", address: "135 Riverview Dr, Richland, MS 39218", brandColour: "#1B5EA6" },
      { name: "USA Truck", scacCode: "USAT", contactName: "Derek Chang", contactEmail: "dispatch@usa-truck.com", contactPhone: "(479) 471-2500", address: "3200 Industrial Park Rd, Van Buren, AR 72956", brandColour: "#C41230" },
    ]))
    .returning();

  const c = (scac: string) => insertedCarriers.find((x) => x.scacCode === scac)!;

  const insertedZones = await db
    .insert(yardZones)
    .values(wt([
      { name: "Staging Area A", code: "STG-A", type: "staging", description: "Primary inbound staging near Gate 1" },
      { name: "Staging Area B", code: "STG-B", type: "staging", description: "Secondary staging for outbound prep" },
      { name: "Reefer Yard", code: "RFR", type: "reefer", description: "Temperature-controlled trailer parking" },
      { name: "Parking Lot C", code: "PKG-C", type: "parking", description: "Overflow and long-term bobtail parking" },
      { name: "Hazmat Isolation", code: "HAZ", type: "hazmat", description: "Hazmat-rated isolated parking zone" },
    ]))
    .returning();

  const z = (code: string) => insertedZones.find((x) => x.code === code)!;

  const slotsToCreate: Array<{
    zoneId: number;
    slotNumber: string;
    slotType: string;
    slotSize: string;
    isReefer: boolean;
    isHazmat: boolean;
    gridRow: number;
    gridCol: number;
  }> = [];

  for (let i = 1; i <= 15; i++) {
    slotsToCreate.push({
      zoneId: z("STG-A").id,
      slotNumber: `A-${String(i).padStart(2, "0")}`,
      slotType: "standard",
      slotSize: "standard",
      isReefer: false,
      isHazmat: false,
      gridRow: Math.floor((i - 1) / 5),
      gridCol: (i - 1) % 5,
    });
  }

  for (let i = 1; i <= 12; i++) {
    slotsToCreate.push({
      zoneId: z("STG-B").id,
      slotNumber: `B-${String(i).padStart(2, "0")}`,
      slotType: "standard",
      slotSize: "standard",
      isReefer: false,
      isHazmat: false,
      gridRow: Math.floor((i - 1) / 4),
      gridCol: (i - 1) % 4,
    });
  }

  for (let i = 1; i <= 8; i++) {
    slotsToCreate.push({
      zoneId: z("RFR").id,
      slotNumber: `R-${String(i).padStart(2, "0")}`,
      slotType: "reefer",
      slotSize: "standard",
      isReefer: true,
      isHazmat: false,
      gridRow: Math.floor((i - 1) / 4),
      gridCol: (i - 1) % 4,
    });
  }

  for (let i = 1; i <= 10; i++) {
    slotsToCreate.push({
      zoneId: z("PKG-C").id,
      slotNumber: `C-${String(i).padStart(2, "0")}`,
      slotType: i > 8 ? "oversized" : "standard",
      slotSize: i > 8 ? "large" : "standard",
      isReefer: false,
      isHazmat: false,
      gridRow: Math.floor((i - 1) / 5),
      gridCol: (i - 1) % 5,
    });
  }

  for (let i = 1; i <= 4; i++) {
    slotsToCreate.push({
      zoneId: z("HAZ").id,
      slotNumber: `H-${String(i).padStart(2, "0")}`,
      slotType: "hazmat",
      slotSize: "standard",
      isReefer: false,
      isHazmat: true,
      gridRow: 0,
      gridCol: i - 1,
    });
  }

  const insertedSlots = await db.insert(yardSlots).values(wt(slotsToCreate)).returning();

  const slot = (num: string) => insertedSlots.find((s) => s.slotNumber === num)!;

  const insertedDoors = await db
    .insert(dockDoors)
    .values(wt([
      { doorNumber: "D-01", compatibleType: "all", status: "available" },
      { doorNumber: "D-02", compatibleType: "all", status: "available" },
      { doorNumber: "D-03", compatibleType: "all", status: "available" },
      { doorNumber: "D-04", compatibleType: "all", status: "available" },
      { doorNumber: "D-05", compatibleType: "dry", status: "available" },
      { doorNumber: "D-06", compatibleType: "dry", status: "available" },
      { doorNumber: "D-07", compatibleType: "reefer", status: "available" },
      { doorNumber: "D-08", compatibleType: "reefer", status: "available" },
      { doorNumber: "D-09", compatibleType: "all", status: "available" },
      { doorNumber: "D-10", compatibleType: "all", status: "available" },
    ]))
    .returning();

  const door = (num: string) => insertedDoors.find((d) => d.doorNumber === num)!;

  const insertedGates = await db
    .insert(gates)
    .values(wt([
      { name: "Main Gate", type: "both" },
      { name: "Gate 2 - Inbound", type: "in" },
      { name: "Gate 3 - Outbound", type: "out" },
    ]))
    .returning();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysAgo = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };
  const daysFromNow = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return d; };

  const demoUsers = [
    { id: "demo-admin-001", firstName: "Sandra", lastName: "Mitchell", email: "s.mitchell@ymsnow.com", role: "admin", carrierId: null as number | null },
    { id: "demo-ym-001", firstName: "Robert", lastName: "Chen", email: "r.chen@ymsnow.com", role: "yard_manager", carrierId: null as number | null },
    { id: "demo-gg-001", firstName: "Maria", lastName: "Gonzalez", email: "m.gonzalez@ymsnow.com", role: "gate_guard", carrierId: null as number | null },
    { id: "demo-gg-002", firstName: "Jamal", lastName: "Williams", email: "j.williams@ymsnow.com", role: "gate_guard", carrierId: null as number | null },
    { id: "demo-yj-001", firstName: "Tommy", lastName: "Kowalski", email: "t.kowalski@ymsnow.com", role: "yard_jockey", carrierId: null as number | null },
    { id: "demo-yj-002", firstName: "DeShawn", lastName: "Carter", email: "d.carter@ymsnow.com", role: "yard_jockey", carrierId: null as number | null },
    { id: "demo-yj-003", firstName: "Jose", lastName: "Martinez", email: "j.martinez@ymsnow.com", role: "yard_jockey", carrierId: null as number | null },
    { id: "demo-du-001", firstName: "Lisa", lastName: "Park", email: "l.park@ymsnow.com", role: "dock_user", carrierId: null as number | null },
    { id: "demo-du-002", firstName: "Kevin", lastName: "O'Malley", email: "k.omalley@ymsnow.com", role: "dock_user", carrierId: null as number | null },
    { id: "demo-cr-001", firstName: "Tyler", lastName: "Brooks", email: "t.brooks@swifttrans.com", role: "carrier", carrierId: c("SWFT").id },
    { id: "demo-cr-002", firstName: "Amy", lastName: "Chen", email: "a.chen@jbhunt.com", role: "carrier", carrierId: c("JBHT").id },
    { id: "demo-cr-003", firstName: "Marcus", lastName: "Rivera", email: "m.rivera@werner.com", role: "carrier", carrierId: c("WERN").id },
  ];

  for (const u of demoUsers) {
    await db.insert(users).values({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, tenantId: tid }).onConflictDoNothing();
    await db.insert(userProfiles).values({ userId: u.id, role: u.role, carrierId: u.carrierId, tenantId: tid }).onConflictDoNothing();
  }

  const demoAppointments = await db
    .insert(appointments)
    .values(wt([
      // --- Past appointments (completed, scattered over past 7 days) ---
      { referenceNumber: aptRef(1), carrierId: c("SWFT").id, scheduledDate: daysAgo(5), timeWindowStart: "06:00", timeWindowEnd: "08:00", movementType: "inbound", loadType: "dry", trailerNumber: "SWFT-53201", truckNumber: "SW-4410", driverName: "Carlos Mendez", driverPhone: "(312) 555-0147", poNumber: "PO-2024-00812", bolNumber: "BOL-SW-90341", sealNumber: "SL-77201", status: "completed" },
      { referenceNumber: aptRef(2), carrierId: c("JBHT").id, scheduledDate: daysAgo(4), timeWindowStart: "07:00", timeWindowEnd: "09:00", movementType: "inbound", loadType: "dry", trailerNumber: "JBHU-832145", truckNumber: "JB-7721", driverName: "Marcus Thompson", driverPhone: "(469) 555-0233", poNumber: "PO-2024-00819", bolNumber: "BOL-JB-41205", sealNumber: "SL-88302", status: "completed" },
      { referenceNumber: aptRef(3), carrierId: c("WERN").id, scheduledDate: daysAgo(4), timeWindowStart: "10:00", timeWindowEnd: "12:00", movementType: "live_unload", loadType: "dry", trailerNumber: "WERN-49087", truckNumber: "WE-3315", driverName: "Brandon Miller", driverPhone: "(402) 555-0189", poNumber: "PO-2024-00825", bolNumber: "BOL-WE-55120", sealNumber: "SL-99103", status: "completed" },
      { referenceNumber: aptRef(4), carrierId: c("SNDR").id, scheduledDate: daysAgo(3), timeWindowStart: "09:00", timeWindowEnd: "11:00", movementType: "inbound", loadType: "reefer", trailerNumber: "SNDR-R42001", truckNumber: "SN-6100", driverName: "Ryan O'Brien", driverPhone: "(920) 555-0312", poNumber: "PO-2024-00830", bolNumber: "BOL-SN-63001", sealNumber: "SL-11404", status: "completed" },
      { referenceNumber: aptRef(5), carrierId: c("XPOL").id, scheduledDate: daysAgo(3), timeWindowStart: "14:00", timeWindowEnd: "16:00", movementType: "outbound", loadType: "dry", trailerNumber: "XPOU-71553", truckNumber: "XP-2205", driverName: "David Kim", driverPhone: "(503) 555-0421", poNumber: "PO-2024-00836", bolNumber: "BOL-XP-78055", sealNumber: "SL-22505", status: "completed" },
      { referenceNumber: aptRef(6), carrierId: c("FXFE").id, scheduledDate: daysAgo(2), timeWindowStart: "10:30", timeWindowEnd: "12:30", movementType: "inbound", loadType: "dry", trailerNumber: "FXFE-28900", truckNumber: "FX-8832", driverName: "Nathan Cruz", driverPhone: "(901) 555-0178", poNumber: "PO-2024-00841", bolNumber: "BOL-FX-82901", sealNumber: "SL-33606", status: "completed" },
      { referenceNumber: aptRef(7), carrierId: c("ODFL").id, scheduledDate: daysAgo(2), timeWindowStart: "07:00", timeWindowEnd: "09:00", movementType: "live_load", loadType: "dry", trailerNumber: "ODFL-61450", truckNumber: "OD-5508", driverName: "Patrick Sullivan", driverPhone: "(540) 555-0295", poNumber: "PO-2024-00847", bolNumber: "BOL-OD-14503", sealNumber: "SL-44707", status: "completed" },
      { referenceNumber: aptRef(8), carrierId: c("YRCW").id, scheduledDate: daysAgo(1), timeWindowStart: "11:30", timeWindowEnd: "13:30", movementType: "inbound", loadType: "dry", trailerNumber: "YRCW-33087", truckNumber: "YR-1204", driverName: "Trevor Hall", driverPhone: "(330) 555-0364", poNumber: "PO-2024-00853", bolNumber: "BOL-YR-33088", sealNumber: "SL-55808", status: "completed" },
      { referenceNumber: aptRef(9), carrierId: c("EXLA").id, scheduledDate: daysAgo(1), timeWindowStart: "08:00", timeWindowEnd: "10:00", movementType: "inbound", loadType: "reefer", trailerNumber: "EXLA-R19503", truckNumber: "EX-9011", driverName: "Anthony Reyes", driverPhone: "(804) 555-0437", poNumber: "PO-2024-00859", bolNumber: "BOL-EX-19504", sealNumber: "SL-66909", status: "completed" },
      // --- Today's appointments (mix of completed, confirmed, booked) ---
      { referenceNumber: aptRef(10), carrierId: c("HTLD").id, scheduledDate: today, timeWindowStart: "06:00", timeWindowEnd: "08:00", movementType: "outbound", loadType: "dry", trailerNumber: "HTLD-87201", truckNumber: "HT-6640", driverName: "Jason Lee", driverPhone: "(417) 555-0518", poNumber: "PO-2024-00864", bolNumber: "BOL-HT-87202", sealNumber: "SL-77010", status: "completed" },
      { referenceNumber: aptRef(11), carrierId: c("KLLM").id, scheduledDate: today, timeWindowStart: "08:00", timeWindowEnd: "10:00", movementType: "inbound", loadType: "reefer", trailerNumber: "KLLM-R05540", truckNumber: "KL-3301", driverName: "William Foster", driverPhone: "(601) 555-0276", poNumber: "PO-2024-00876", bolNumber: "BOL-KL-05541", sealNumber: "SL-88211", status: "completed" },
      { referenceNumber: aptRef(12), carrierId: c("USAT").id, scheduledDate: today, timeWindowStart: "10:00", timeWindowEnd: "12:00", movementType: "live_unload", loadType: "dry", trailerNumber: "USAT-44028", truckNumber: "US-7710", driverName: "Tyler Richardson", driverPhone: "(479) 555-0348", poNumber: "PO-2024-00882", bolNumber: "BOL-US-44029", sealNumber: "SL-99312", status: "completed" },
      { referenceNumber: aptRef(13), carrierId: c("SWFT").id, scheduledDate: today, timeWindowStart: "14:30", timeWindowEnd: "16:30", movementType: "inbound", loadType: "dry", trailerNumber: "SWFT-53500", truckNumber: "SW-4470", driverName: "Leo Castillo", driverPhone: "(210) 555-0574", poNumber: "PO-2024-00954", bolNumber: "BOL-SW-90383", sealNumber: "SL-33724", status: "completed" },
      { referenceNumber: aptRef(14), carrierId: c("WERN").id, scheduledDate: today, timeWindowStart: "15:00", timeWindowEnd: "17:00", movementType: "inbound", loadType: "dry", trailerNumber: "WERN-49330", truckNumber: "WE-3340", driverName: "Alan Fisher", driverPhone: "(531) 555-0249", poNumber: "PO-2024-00966", bolNumber: "BOL-WE-55148", sealNumber: "SL-55926", status: "completed" },
      { referenceNumber: aptRef(15), carrierId: c("ODFL").id, scheduledDate: today, timeWindowStart: "07:00", timeWindowEnd: "09:00", movementType: "inbound", loadType: "dry", trailerNumber: "ODFL-61570", truckNumber: "OD-5535", driverName: "Samuel Price", driverPhone: "(336) 555-0184", poNumber: "PO-2024-00990", bolNumber: "BOL-OD-14531", sealNumber: "SL-99530", status: "completed" },
      { referenceNumber: aptRef(16), carrierId: c("HTLD").id, scheduledDate: daysAgo(6), timeWindowStart: "06:00", timeWindowEnd: "08:00", movementType: "inbound", loadType: "dry", trailerNumber: "HTLD-87400", truckNumber: "HT-6670", driverName: "George Flores", driverPhone: "(816) 555-0408", poNumber: "PO-2024-01002", bolNumber: "BOL-HT-87401", sealNumber: "SL-11631", status: "completed" },
      { referenceNumber: aptRef(17), carrierId: c("SNDR").id, scheduledDate: today, timeWindowStart: "15:30", timeWindowEnd: "17:30", movementType: "outbound", loadType: "reefer", trailerNumber: "SNDR-R42015", truckNumber: "SN-6120", driverName: "Michael Barnes", driverPhone: "(715) 555-0167", poNumber: "PO-2024-00900", bolNumber: "BOL-SN-63015", sealNumber: "SL-33615", status: "completed" },
      { referenceNumber: aptRef(18), carrierId: c("JBHT").id, scheduledDate: today, timeWindowStart: "12:00", timeWindowEnd: "14:00", movementType: "inbound", loadType: "dry", trailerNumber: "JBHU-832400", truckNumber: "JB-7780", driverName: "Paul Jenkins", driverPhone: "(870) 555-0245", poNumber: "PO-2024-01026", bolNumber: "BOL-JB-41244", sealNumber: "SL-55035", status: "completed" },
      { referenceNumber: aptRef(19), carrierId: c("XPOL").id, scheduledDate: today, timeWindowStart: "18:00", timeWindowEnd: "20:00", movementType: "inbound", loadType: "dry", trailerNumber: "XPOU-71650", truckNumber: "XP-2240", driverName: "Larry Henderson", driverPhone: "(971) 555-0189", poNumber: "PO-2024-01050", bolNumber: "BOL-XP-78083", sealNumber: "SL-99639", status: "booked" },
      { referenceNumber: aptRef(20), carrierId: c("FXFE").id, scheduledDate: today, timeWindowStart: "18:30", timeWindowEnd: "20:30", movementType: "outbound", loadType: "dry", trailerNumber: "FXFE-29050", truckNumber: "FX-8875", driverName: "Wayne Phillips", driverPhone: "(865) 555-0291", poNumber: "PO-2024-01056", bolNumber: "BOL-FX-82943", sealNumber: "SL-11740", status: "booked" },
      // --- Future appointments (booked/confirmed, scattered over next 7 days) ---
      { referenceNumber: aptRef(21), carrierId: c("JBHT").id, scheduledDate: daysFromNow(1), timeWindowStart: "07:00", timeWindowEnd: "09:00", movementType: "inbound", loadType: "dry", trailerNumber: "JBHU-832500", truckNumber: "JB-7790", driverName: "Derek Walsh", driverPhone: "(469) 555-0301", poNumber: "PO-2024-01100", bolNumber: "BOL-JB-41300", sealNumber: "SL-60101", status: "confirmed" },
      { referenceNumber: aptRef(22), carrierId: c("SWFT").id, scheduledDate: daysFromNow(1), timeWindowStart: "10:00", timeWindowEnd: "12:00", movementType: "outbound", loadType: "dry", trailerNumber: "SWFT-53600", truckNumber: "SW-4490", driverName: "Hector Ramirez", driverPhone: "(312) 555-0488", poNumber: "PO-2024-01106", bolNumber: "BOL-SW-90400", sealNumber: "SL-60202", status: "booked" },
      { referenceNumber: aptRef(23), carrierId: c("WERN").id, scheduledDate: daysFromNow(1), timeWindowStart: "14:00", timeWindowEnd: "16:00", movementType: "live_unload", loadType: "dry", trailerNumber: "WERN-49500", truckNumber: "WE-3370", driverName: "Kevin Schultz", driverPhone: "(402) 555-0377", poNumber: "PO-2024-01112", bolNumber: "BOL-WE-55200", sealNumber: "SL-60303", status: "booked" },
      { referenceNumber: aptRef(24), carrierId: c("SNDR").id, scheduledDate: daysFromNow(2), timeWindowStart: "06:00", timeWindowEnd: "08:00", movementType: "inbound", loadType: "reefer", trailerNumber: "SNDR-R42100", truckNumber: "SN-6200", driverName: "Craig Patterson", driverPhone: "(920) 555-0455", poNumber: "PO-2024-01118", bolNumber: "BOL-SN-63100", sealNumber: "SL-60404", status: "confirmed" },
      { referenceNumber: aptRef(25), carrierId: c("ODFL").id, scheduledDate: daysFromNow(2), timeWindowStart: "11:00", timeWindowEnd: "13:00", movementType: "inbound", loadType: "dry", trailerNumber: "ODFL-61700", truckNumber: "OD-5560", driverName: "Victor Nguyen", driverPhone: "(540) 555-0512", poNumber: "PO-2024-01124", bolNumber: "BOL-OD-14600", sealNumber: "SL-60505", status: "booked" },
      { referenceNumber: aptRef(26), carrierId: c("FXFE").id, scheduledDate: daysFromNow(3), timeWindowStart: "08:00", timeWindowEnd: "10:00", movementType: "outbound", loadType: "dry", trailerNumber: "FXFE-29100", truckNumber: "FX-8890", driverName: "Eddie Morales", driverPhone: "(901) 555-0344", poNumber: "PO-2024-01130", bolNumber: "BOL-FX-83000", sealNumber: "SL-60606", status: "booked" },
      { referenceNumber: aptRef(27), carrierId: c("YRCW").id, scheduledDate: daysFromNow(3), timeWindowStart: "13:00", timeWindowEnd: "15:00", movementType: "inbound", loadType: "dry", trailerNumber: "YRCW-33200", truckNumber: "YR-1220", driverName: "Franklin Boyd", driverPhone: "(330) 555-0601", poNumber: "PO-2024-01136", bolNumber: "BOL-YR-33201", sealNumber: "SL-60707", status: "confirmed" },
      { referenceNumber: aptRef(28), carrierId: c("EXLA").id, scheduledDate: daysFromNow(4), timeWindowStart: "07:00", timeWindowEnd: "09:00", movementType: "inbound", loadType: "reefer", trailerNumber: "EXLA-R19600", truckNumber: "EX-9025", driverName: "Shane Cooper", driverPhone: "(804) 555-0688", poNumber: "PO-2024-01142", bolNumber: "BOL-EX-19601", sealNumber: "SL-60808", status: "booked" },
      { referenceNumber: aptRef(29), carrierId: c("KLLM").id, scheduledDate: daysFromNow(4), timeWindowStart: "12:00", timeWindowEnd: "14:00", movementType: "live_load", loadType: "reefer", trailerNumber: "KLLM-R05600", truckNumber: "KL-3320", driverName: "Jerome Davis", driverPhone: "(601) 555-0744", poNumber: "PO-2024-01148", bolNumber: "BOL-KL-05601", sealNumber: "SL-60909", status: "confirmed" },
      { referenceNumber: aptRef(30), carrierId: c("USAT").id, scheduledDate: daysFromNow(5), timeWindowStart: "09:00", timeWindowEnd: "11:00", movementType: "inbound", loadType: "dry", trailerNumber: "USAT-44100", truckNumber: "US-7730", driverName: "Raymond Ortiz", driverPhone: "(479) 555-0801", poNumber: "PO-2024-01154", bolNumber: "BOL-US-44101", sealNumber: "SL-61010", status: "booked" },
      { referenceNumber: aptRef(31), carrierId: c("HTLD").id, scheduledDate: daysFromNow(5), timeWindowStart: "15:00", timeWindowEnd: "17:00", movementType: "outbound", loadType: "dry", trailerNumber: "HTLD-87500", truckNumber: "HT-6690", driverName: "Dustin Black", driverPhone: "(417) 555-0878", poNumber: "PO-2024-01160", bolNumber: "BOL-HT-87501", sealNumber: "SL-61111", status: "booked" },
      { referenceNumber: aptRef(32), carrierId: c("SWFT").id, scheduledDate: daysFromNow(6), timeWindowStart: "06:00", timeWindowEnd: "08:00", movementType: "inbound", loadType: "dry", trailerNumber: "SWFT-53700", truckNumber: "SW-4505", driverName: "Oscar Peña", driverPhone: "(210) 555-0922", poNumber: "PO-2024-01166", bolNumber: "BOL-SW-90450", sealNumber: "SL-61212", status: "booked" },
      { referenceNumber: aptRef(33), carrierId: c("JBHT").id, scheduledDate: daysFromNow(6), timeWindowStart: "11:00", timeWindowEnd: "13:00", movementType: "live_unload", loadType: "dry", trailerNumber: "JBHU-832600", truckNumber: "JB-7800", driverName: "Terrence Cook", driverPhone: "(870) 555-0999", poNumber: "PO-2024-01172", bolNumber: "BOL-JB-41350", sealNumber: "SL-61313", status: "confirmed" },
      { referenceNumber: aptRef(34), carrierId: c("WERN").id, scheduledDate: daysFromNow(7), timeWindowStart: "08:00", timeWindowEnd: "10:00", movementType: "inbound", loadType: "dry", trailerNumber: "WERN-49600", truckNumber: "WE-3390", driverName: "Russell Grant", driverPhone: "(531) 555-0456", poNumber: "PO-2024-01178", bolNumber: "BOL-WE-55250", sealNumber: "SL-61414", status: "booked" },
      { referenceNumber: aptRef(35), carrierId: c("SNDR").id, scheduledDate: daysFromNow(7), timeWindowStart: "14:00", timeWindowEnd: "16:00", movementType: "outbound", loadType: "reefer", trailerNumber: "SNDR-R42200", truckNumber: "SN-6220", driverName: "Phillip Hart", driverPhone: "(715) 555-0533", poNumber: "PO-2024-01184", bolNumber: "BOL-SN-63200", sealNumber: "SL-61515", status: "booked" },
      // --- Past extra appointments for variety ---
      { referenceNumber: aptRef(36), carrierId: c("KLLM").id, scheduledDate: daysAgo(7), timeWindowStart: "09:00", timeWindowEnd: "11:00", movementType: "inbound", loadType: "reefer", trailerNumber: "KLLM-R05400", truckNumber: "KL-3290", driverName: "Daryl Hunt", driverPhone: "(601) 555-0155", poNumber: "PO-2024-00780", bolNumber: "BOL-KL-05401", sealNumber: "SL-50101", status: "completed" },
      { referenceNumber: aptRef(37), carrierId: c("USAT").id, scheduledDate: daysAgo(7), timeWindowStart: "14:00", timeWindowEnd: "16:00", movementType: "outbound", loadType: "dry", trailerNumber: "USAT-43900", truckNumber: "US-7690", driverName: "Calvin Woods", driverPhone: "(479) 555-0088", poNumber: "PO-2024-00786", bolNumber: "BOL-US-43901", sealNumber: "SL-50202", status: "completed" },
      { referenceNumber: aptRef(38), carrierId: c("XPOL").id, scheduledDate: daysAgo(6), timeWindowStart: "08:00", timeWindowEnd: "10:00", movementType: "inbound", loadType: "dry", trailerNumber: "XPOU-71400", truckNumber: "XP-2190", driverName: "Wesley Reid", driverPhone: "(971) 555-0066", poNumber: "PO-2024-00792", bolNumber: "BOL-XP-77950", sealNumber: "SL-50303", status: "completed" },
      { referenceNumber: aptRef(39), carrierId: c("FXFE").id, scheduledDate: daysAgo(5), timeWindowStart: "13:00", timeWindowEnd: "15:00", movementType: "live_load", loadType: "dry", trailerNumber: "FXFE-28800", truckNumber: "FX-8810", driverName: "Troy Benson", driverPhone: "(865) 555-0144", poNumber: "PO-2024-00798", bolNumber: "BOL-FX-82800", sealNumber: "SL-50404", status: "completed" },
      { referenceNumber: aptRef(40), carrierId: c("EXLA").id, scheduledDate: daysAgo(3), timeWindowStart: "06:00", timeWindowEnd: "08:00", movementType: "inbound", loadType: "reefer", trailerNumber: "EXLA-R19400", truckNumber: "EX-8995", driverName: "Grant Kelley", driverPhone: "(804) 555-0222", poNumber: "PO-2024-00804", bolNumber: "BOL-EX-19401", sealNumber: "SL-50505", status: "completed" },
      { referenceNumber: aptRef(41), carrierId: c("ODFL").id, scheduledDate: daysAgo(1), timeWindowStart: "15:00", timeWindowEnd: "17:00", movementType: "outbound", loadType: "dry", trailerNumber: "ODFL-61350", truckNumber: "OD-5490", driverName: "Ian Montgomery", driverPhone: "(336) 555-0311", poNumber: "PO-2024-00810", bolNumber: "BOL-OD-14400", sealNumber: "SL-50606", status: "completed" },
      { referenceNumber: aptRef(42), carrierId: c("HTLD").id, scheduledDate: daysAgo(2), timeWindowStart: "16:00", timeWindowEnd: "18:00", movementType: "inbound", loadType: "dry", trailerNumber: "HTLD-87100", truckNumber: "HT-6610", driverName: "Curtis Palmer", driverPhone: "(816) 555-0199", poNumber: "PO-2024-00816", bolNumber: "BOL-HT-87101", sealNumber: "SL-50707", status: "no_show" },
    ]))
    .returning();

  const apt = (i: number) => demoAppointments[i - 1];

  const demoVisits: Array<{
    visitNumber: string;
    appointmentId: number | null;
    carrierId: number;
    driverName: string;
    driverLicense: string;
    truckNumber: string;
    trailerNumber: string;
    sealNumber: string | null;
    movementType: string;
    visitStatus: string;
    locationStatus: string;
    holdStatus: string;
    currentSlotId: number | null;
    currentDockDoorId: number | null;
    checkInTime: Date;
    checkOutTime: Date | null;
    checkInBy: string;
    notes: string | null;
  }> = [
    // 1-2: checked_in (just arrived at gate)
    { visitNumber: visitNum(1), appointmentId: apt(18).id, carrierId: c("JBHT").id, driverName: "Paul Jenkins", driverLicense: "CDL-AR-770340", truckNumber: "JB-7780", trailerNumber: "JBHU-832400", sealNumber: "SL-770088", movementType: "inbound", visitStatus: "checked_in", locationStatus: "at_gate_in", holdStatus: "none", currentSlotId: null, currentDockDoorId: null, checkInTime: minutesAgo(5), checkOutTime: null, checkInBy: "demo-gg-002", notes: null },
    { visitNumber: visitNum(2), appointmentId: null, carrierId: c("WERN").id, driverName: "Brian Russell", driverLicense: "CDL-NE-550100", truckNumber: "WE-3355", trailerNumber: "WERN-49410", sealNumber: "SL-550223", movementType: "inbound", visitStatus: "checked_in", locationStatus: "at_gate_in", holdStatus: "documentation_hold", currentSlotId: null, currentDockDoorId: null, checkInTime: minutesAgo(12), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Missing BOL - docs hold placed" },

    // 3-7: in_yard (parked in yard slots)
    { visitNumber: visitNum(3), appointmentId: apt(1).id, carrierId: c("SWFT").id, driverName: "Carlos Mendez", driverLicense: "CDL-AZ-123456", truckNumber: "SW-4410", trailerNumber: "SWFT-53201", sealNumber: "SL-887401", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "none", currentSlotId: slot("A-01").id, currentDockDoorId: null, checkInTime: hoursAgo(8), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Awaiting dock assignment" },
    { visitNumber: visitNum(4), appointmentId: apt(4).id, carrierId: c("SNDR").id, driverName: "Ryan O'Brien", driverLicense: "CDL-WI-456789", truckNumber: "SN-6100", trailerNumber: "SNDR-R42001", sealNumber: "SL-662010", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "none", currentSlotId: slot("R-01").id, currentDockDoorId: null, checkInTime: hoursAgo(6), checkOutTime: null, checkInBy: "demo-gg-002", notes: "Reefer unit running - temp verified at 34°F" },
    { visitNumber: visitNum(5), appointmentId: apt(6).id, carrierId: c("FXFE").id, driverName: "Nathan Cruz", driverLicense: "CDL-PA-334455", truckNumber: "FX-8832", trailerNumber: "FXFE-28900", sealNumber: "SL-889077", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "none", currentSlotId: slot("A-02").id, currentDockDoorId: null, checkInTime: hoursAgo(5.5), checkOutTime: null, checkInBy: "demo-gg-001", notes: null },
    { visitNumber: visitNum(6), appointmentId: apt(8).id, carrierId: c("YRCW").id, driverName: "Trevor Hall", driverLicense: "CDL-KS-667788", truckNumber: "YR-1204", trailerNumber: "YRCW-33087", sealNumber: "SL-331120", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "none", currentSlotId: slot("A-03").id, currentDockDoorId: null, checkInTime: hoursAgo(5), checkOutTime: null, checkInBy: "demo-gg-002", notes: null },
    { visitNumber: visitNum(7), appointmentId: apt(9).id, carrierId: c("EXLA").id, driverName: "Anthony Reyes", driverLicense: "CDL-VA-112233", truckNumber: "EX-9011", trailerNumber: "EXLA-R19503", sealNumber: "SL-119088", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "none", currentSlotId: slot("R-02").id, currentDockDoorId: null, checkInTime: hoursAgo(4.5), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Reefer - temp OK at 36°F" },

    // 8: in_yard in staging (waiting for slot)
    { visitNumber: visitNum(8), appointmentId: apt(2).id, carrierId: c("JBHT").id, driverName: "Marcus Thompson", driverLicense: "CDL-AR-789012", truckNumber: "JB-7721", trailerNumber: "JBHU-832145", sealNumber: "SL-778320", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_staging", holdStatus: "none", currentSlotId: null, currentDockDoorId: null, checkInTime: hoursAgo(1), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Waiting for slot assignment" },

    // 9-12: at_dock / loading / unloading
    { visitNumber: visitNum(9), appointmentId: apt(3).id, carrierId: c("WERN").id, driverName: "Brandon Miller", driverLicense: "CDL-NE-345678", truckNumber: "WE-3315", trailerNumber: "WERN-49087", sealNumber: "SL-449087", movementType: "live_unload", visitStatus: "unloading", locationStatus: "at_dock_door", holdStatus: "none", currentSlotId: null, currentDockDoorId: door("D-01").id, checkInTime: hoursAgo(7), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Live unload in progress" },
    { visitNumber: visitNum(10), appointmentId: apt(5).id, carrierId: c("XPOL").id, driverName: "David Kim", driverLicense: "CDL-CT-567890", truckNumber: "XP-2205", trailerNumber: "XPOU-71553", sealNumber: null, movementType: "outbound", visitStatus: "loading", locationStatus: "at_dock_door", holdStatus: "none", currentSlotId: null, currentDockDoorId: door("D-02").id, checkInTime: hoursAgo(6), checkOutTime: null, checkInBy: "demo-gg-002", notes: "Loading outbound freight - 65% complete" },
    { visitNumber: visitNum(11), appointmentId: apt(7).id, carrierId: c("ODFL").id, driverName: "Patrick Sullivan", driverLicense: "CDL-NC-778899", truckNumber: "OD-5508", trailerNumber: "ODFL-61450", sealNumber: null, movementType: "live_load", visitStatus: "loading", locationStatus: "at_dock_door", holdStatus: "none", currentSlotId: null, currentDockDoorId: door("D-03").id, checkInTime: hoursAgo(5), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Live load - driver at break room" },
    { visitNumber: visitNum(12), appointmentId: apt(10).id, carrierId: c("HTLD").id, driverName: "Jason Lee", driverLicense: "CDL-IA-990011", truckNumber: "HT-6640", trailerNumber: "HTLD-87201", sealNumber: null, movementType: "outbound", visitStatus: "at_dock", locationStatus: "at_dock_door", holdStatus: "none", currentSlotId: null, currentDockDoorId: door("D-04").id, checkInTime: hoursAgo(4.5), checkOutTime: null, checkInBy: "demo-gg-002", notes: "Spotted at dock, waiting for load crew" },

    // 13-14: ready_out (dock work complete, awaiting checkout)
    { visitNumber: visitNum(13), appointmentId: apt(12).id, carrierId: c("USAT").id, driverName: "Tyler Richardson", driverLicense: "CDL-AR-445500", truckNumber: "US-7710", trailerNumber: "USAT-44028", sealNumber: "SL-440280", movementType: "live_unload", visitStatus: "ready_out", locationStatus: "in_yard_slot", holdStatus: "none", currentSlotId: slot("B-01").id, currentDockDoorId: null, checkInTime: hoursAgo(10), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Empty after unload - ready for departure" },
    { visitNumber: visitNum(14), appointmentId: apt(17).id, carrierId: c("SNDR").id, driverName: "Michael Barnes", driverLicense: "CDL-WI-223300", truckNumber: "SN-6120", trailerNumber: "SNDR-R42015", sealNumber: "SL-420150", movementType: "outbound", visitStatus: "ready_out", locationStatus: "at_gate_out", holdStatus: "none", currentSlotId: null, currentDockDoorId: null, checkInTime: hoursAgo(8), checkOutTime: null, checkInBy: "demo-gg-002", notes: "At exit gate awaiting final clearance" },

    // 15-17: in_yard with holds
    { visitNumber: visitNum(15), appointmentId: apt(13).id, carrierId: c("SWFT").id, driverName: "Leo Castillo", driverLicense: "CDL-AZ-334455", truckNumber: "SW-4470", trailerNumber: "SWFT-53500", sealNumber: "SL-535001", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "security_hold", currentSlotId: slot("A-04").id, currentDockDoorId: null, checkInTime: hoursAgo(6.5), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Security hold - random inspection required" },
    { visitNumber: visitNum(16), appointmentId: apt(14).id, carrierId: c("WERN").id, driverName: "Alan Fisher", driverLicense: "CDL-NE-889911", truckNumber: "WE-3340", trailerNumber: "WERN-49330", sealNumber: "SL-493300", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "damage_hold", currentSlotId: slot("A-05").id, currentDockDoorId: null, checkInTime: hoursAgo(5), checkOutTime: null, checkInBy: "demo-gg-002", notes: "Rear door damage reported on arrival" },
    { visitNumber: visitNum(17), appointmentId: apt(15).id, carrierId: c("ODFL").id, driverName: "Samuel Price", driverLicense: "CDL-NC-776600", truckNumber: "OD-5535", trailerNumber: "ODFL-61570", sealNumber: "SL-615700", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "customs_hold", currentSlotId: slot("A-06").id, currentDockDoorId: null, checkInTime: hoursAgo(9), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Customs clearance pending - bonded freight" },

    // 18: aged trailer (>24h)
    { visitNumber: visitNum(18), appointmentId: apt(16).id, carrierId: c("HTLD").id, driverName: "George Flores", driverLicense: "CDL-IA-556677", truckNumber: "HT-6670", trailerNumber: "HTLD-87400", sealNumber: "SL-874000", movementType: "inbound", visitStatus: "in_yard", locationStatus: "in_yard_slot", holdStatus: "none", currentSlotId: slot("C-01").id, currentDockDoorId: null, checkInTime: hoursAgo(28), checkOutTime: null, checkInBy: "demo-gg-001", notes: "Aged trailer - carrier notified for pickup" },

    // 19-20: recently closed (checked out today)
    { visitNumber: `VST-CLOSED01`, appointmentId: null, carrierId: c("SWFT").id, driverName: "Mike Torres", driverLicense: "CDL-AZ-990011", truckNumber: "SW-4401", trailerNumber: "SWFT-53100", sealNumber: "SL-531001", movementType: "inbound", visitStatus: "closed", locationStatus: "exited", holdStatus: "none", currentSlotId: null, currentDockDoorId: null, checkInTime: hoursAgo(12), checkOutTime: hoursAgo(4), checkInBy: "demo-gg-001", notes: "Completed - unloaded and departed" },
    { visitNumber: `VST-CLOSED02`, appointmentId: null, carrierId: c("KLLM").id, driverName: "Ray Washington", driverLicense: "CDL-AR-880099", truckNumber: "KL-3301", trailerNumber: "KLLM-R05540", sealNumber: "SL-770001", movementType: "inbound", visitStatus: "closed", locationStatus: "exited", holdStatus: "none", currentSlotId: null, currentDockDoorId: null, checkInTime: hoursAgo(10), checkOutTime: hoursAgo(3), checkInBy: "demo-gg-002", notes: "Reefer unloaded and released" },
  ];

  const insertedVisits = await db.insert(visits).values(wt(demoVisits)).returning();

  for (const v of insertedVisits) {
    if (v.currentSlotId) {
      await db.update(yardSlots).set({ currentVisitId: v.id }).where(
        eq(yardSlots.id, v.currentSlotId)
      );
    }
    if (v.currentDockDoorId) {
      await db.update(dockDoors).set({ currentVisitId: v.id }).where(
        eq(dockDoors.id, v.currentDockDoorId)
      );
    }
  }

  for (const v of insertedVisits) {
    await db.insert(gateTransactions).values({
      visitId: v.id,
      type: "check_in",
      gateId: insertedGates[0].id,
      userId: v.checkInBy,
      tenantId: tid,
    });
    if (v.visitStatus === "closed") {
      await db.insert(gateTransactions).values({
        visitId: v.id,
        type: "check_out",
        gateId: insertedGates[2].id,
        userId: v.checkInBy,
        tenantId: tid,
      });
    }
  }

  const visit = (i: number) => insertedVisits[i - 1];

  await db.insert(moveTasks).values(wt([
    { visitId: visit(1).id, fromLocationType: "gate", fromLocationId: insertedGates[0].id, fromLocationName: "Gate 1 - Main", toLocationType: "slot", toLocationId: slot("A-09").id, toLocationName: "A-09", moveType: "gate_to_slot", priority: "high", status: "open", source: "gate", notes: "New arrival JBHU-832400 — needs immediate slot placement", createdBy: "demo-gg-001", createdAt: minutesAgo(35) },
    { visitId: visit(3).id, fromLocationType: "slot", fromLocationId: slot("A-01").id, fromLocationName: "A-01", toLocationType: "dock", toLocationId: door("D-08").id, toLocationName: "Door D-08", moveType: "slot_to_dock", priority: "high", status: "open", notes: "Move SWFT trailer to dock for unloading — dock crew waiting", createdBy: "demo-ym-001", createdAt: minutesAgo(20) },
    { visitId: visit(5).id, fromLocationType: "slot", fromLocationId: slot("A-02").id, fromLocationName: "A-02", toLocationType: "dock", toLocationId: door("D-06").id, toLocationName: "Door D-06", moveType: "slot_to_dock", priority: "normal", status: "open", notes: "FedEx trailer scheduled for inbound unload at D-06", createdBy: "demo-ym-001", createdAt: minutesAgo(45) },
    { visitId: visit(6).id, fromLocationType: "slot", fromLocationId: slot("A-03").id, fromLocationName: "A-03", toLocationType: "slot", toLocationId: slot("R-03").id, toLocationName: "R-03", moveType: "reposition", priority: "low", status: "open", notes: "Reposition YRC trailer from staging to reefer yard", createdBy: "demo-ym-001", createdAt: minutesAgo(55) },
    { visitId: visit(8).id, fromLocationType: "staging", fromLocationId: null, fromLocationName: "Staging", toLocationType: "slot", toLocationId: slot("A-07").id, toLocationName: "A-07", moveType: "gate_to_slot", priority: "normal", status: "assigned", assignedTo: "demo-yj-001", notes: "Park inbound JB Hunt trailer in Staging Area A", createdBy: "demo-ym-001", createdAt: minutesAgo(40) },
    { visitId: visit(4).id, fromLocationType: "slot", fromLocationId: slot("R-01").id, fromLocationName: "R-01", toLocationType: "dock", toLocationId: door("D-05").id, toLocationName: "Door D-05", moveType: "slot_to_dock", priority: "high", status: "assigned", assignedTo: "demo-yj-002", notes: "Schneider reefer to dock — temp-sensitive freight", createdBy: "demo-ym-001", createdAt: minutesAgo(50) },
    { visitId: visit(7).id, fromLocationType: "slot", fromLocationId: slot("R-02").id, fromLocationName: "R-02", toLocationType: "dock", toLocationId: door("D-07").id, toLocationName: "Door D-07", moveType: "slot_to_dock", priority: "normal", status: "accepted", assignedTo: "demo-yj-001", acceptedAt: minutesAgo(8), notes: "Estes reefer trailer to dock D-07 for inspection", createdBy: "demo-ym-001", createdAt: minutesAgo(30) },
    { visitId: visit(13).id, fromLocationType: "slot", fromLocationId: slot("B-01").id, fromLocationName: "B-01", toLocationType: "gate", toLocationId: insertedGates[2].id, toLocationName: "Gate 3 - Outbound", moveType: "slot_to_gate", priority: "normal", status: "in_progress", assignedTo: "demo-yj-001", acceptedAt: minutesAgo(15), startedAt: minutesAgo(10), notes: "Move empty USAT trailer to exit gate", createdBy: "demo-ym-001", createdAt: minutesAgo(25) },
    { visitId: visit(14).id, fromLocationType: "slot", fromLocationId: null, fromLocationName: "Gate Out Area", toLocationType: "gate", toLocationId: insertedGates[2].id, toLocationName: "Gate 3 - Outbound", moveType: "slot_to_gate", priority: "normal", status: "in_progress", assignedTo: "demo-yj-002", acceptedAt: minutesAgo(20), startedAt: minutesAgo(12), notes: "Move Schneider outbound to exit gate — driver waiting", createdBy: "demo-ym-001", createdAt: minutesAgo(30) },
    { visitId: visit(19).id, fromLocationType: "dock", fromLocationId: door("D-01").id, fromLocationName: "Door D-01", toLocationType: "gate", toLocationId: insertedGates[2].id, toLocationName: "Gate 3 - Outbound", moveType: "dock_to_gate", priority: "normal", status: "completed", assignedTo: "demo-yj-001", acceptedAt: hoursAgo(5.5), startedAt: hoursAgo(5), completedAt: hoursAgo(4.5), notes: "Moved empty to gate — completed", createdBy: "demo-ym-001", createdAt: hoursAgo(6) },
    { visitId: visit(20).id, fromLocationType: "dock", fromLocationId: door("D-03").id, fromLocationName: "Door D-03", toLocationType: "slot", toLocationId: slot("B-05").id, toLocationName: "B-05", moveType: "dock_to_yard", priority: "normal", status: "completed", assignedTo: "demo-yj-002", acceptedAt: hoursAgo(3), startedAt: hoursAgo(2.8), completedAt: hoursAgo(2.5), notes: "Returned KLLM reefer to yard after unload", createdBy: "demo-du-001", source: "dock_request", createdAt: hoursAgo(3.5) },
    { visitId: visit(18).id, fromLocationType: "gate", fromLocationId: insertedGates[0].id, fromLocationName: "Gate 1 - Main", toLocationType: "slot", toLocationId: slot("C-01").id, toLocationName: "C-01", moveType: "gate_to_slot", priority: "low", status: "completed", assignedTo: "demo-yj-001", acceptedAt: hoursAgo(26), startedAt: hoursAgo(25.5), completedAt: hoursAgo(25), notes: "Parked Heartland trailer in Lot C", createdBy: "demo-gg-002", source: "gate", createdAt: hoursAgo(27) },
    { visitId: visit(2).id, fromLocationType: "gate", fromLocationId: insertedGates[0].id, fromLocationName: "Gate 1 - Main", toLocationType: "slot", toLocationId: slot("A-10").id, toLocationName: "A-10", moveType: "gate_to_slot", priority: "high", status: "escalated", assignedTo: "demo-yj-002", notes: "URGENT: Werner trailer on doc hold — park immediately, do not send to dock", createdBy: "demo-ym-001", createdAt: hoursAgo(2.5) },
    { visitId: visit(11).id, fromLocationType: "slot", fromLocationId: slot("C-02").id, fromLocationName: "C-02", toLocationType: "dock", toLocationId: door("D-09").id, toLocationName: "Door D-09", moveType: "slot_to_dock", priority: "normal", status: "assigned", assignedTo: "demo-yj-003", notes: "ODFL trailer ready for live load — door prepped by Lisa", createdBy: "demo-ym-001", createdAt: minutesAgo(35) },
    { visitId: visit(12).id, fromLocationType: "dock", fromLocationId: door("D-04").id, fromLocationName: "Door D-04", toLocationType: "slot", toLocationId: slot("B-06").id, toLocationName: "B-06", moveType: "dock_to_yard", priority: "normal", status: "rejected", assignedTo: "demo-yj-001", rejectionReason: "Door D-04 still has trailer spotted — cannot pull yet, dock crew not finished", notes: "Move Heartland from dock to yard", createdBy: "demo-du-001", source: "dock_request", createdAt: hoursAgo(2) },
  ]));

  await db.insert(exceptions).values(wt([
    { visitId: visit(2).id, type: "documentation_hold", severity: "medium", description: "Missing Bill of Lading for WERN-49410. Driver does not have copy. Carrier dispatch contacted.", status: "open", createdBy: "demo-gg-001" },
    { visitId: visit(15).id, type: "security_hold", severity: "high", description: "Random security inspection selected for SWFT-53500. USDA agricultural hold flagged by system.", status: "open", assignedTo: "demo-ym-001", createdBy: "demo-gg-001" },
    { visitId: visit(16).id, type: "damage_hold", severity: "medium", description: "Rear door hinge damaged on WERN-49330. Right door does not close fully. Photos documented at check-in.", status: "open", createdBy: "demo-gg-002" },
    { visitId: visit(17).id, type: "customs_hold", severity: "critical", description: "ODFL-61570 contains bonded international freight. Customs Form 7501 pending review. Cannot unload until cleared.", status: "open", assignedTo: "demo-ym-001", createdBy: "demo-gg-001" },
    { visitId: visit(19).id, type: "seal_mismatch", severity: "medium", description: "Previous seal exception on SWFT-53100 resolved - confirmed admin entry error by carrier.", status: "resolved", resolvedBy: "demo-ym-001", resolutionNotes: "Carrier confirmed correct seal number. Updated records.", createdBy: "demo-gg-001" },
  ]));

  const auditEntries = [];
  for (let i = 0; i < insertedVisits.length; i++) {
    const v = insertedVisits[i];
    const guardId = v.checkInBy || "demo-gg-001";
    const guardName = v.checkInBy === "demo-gg-002" ? "Jamal Williams" : "Maria Gonzalez";
    auditEntries.push({
      action: "gate_check_in",
      entityType: "visit",
      entityId: v.id,
      userId: guardId,
      userName: guardName,
      details: { visitNumber: v.visitNumber, trailerNumber: v.trailerNumber, truckNumber: v.truckNumber },
    });
  }
  for (const v of insertedVisits.filter((x) => x.visitStatus === "closed")) {
    auditEntries.push({
      action: "gate_check_out",
      entityType: "visit",
      entityId: v.id,
      userId: v.checkInBy || "demo-gg-001",
      userName: "Maria Gonzalez",
      details: { visitNumber: v.visitNumber },
    });
  }
  auditEntries.push(
    { action: "slot_assigned", entityType: "visit", entityId: visit(3).id, userId: "demo-ym-001", userName: "Robert Chen", details: { slotId: slot("A-01").id, slotNumber: "A-01" } },
    { action: "dock_assigned", entityType: "visit", entityId: visit(9).id, userId: "demo-ym-001", userName: "Robert Chen", details: { dockDoorId: door("D-01").id, doorNumber: "D-01" } },
    { action: "dock_start_unloading", entityType: "visit", entityId: visit(9).id, userId: "demo-du-001", userName: "Lisa Park", details: { action: "start_unloading" } },
    { action: "dock_assigned", entityType: "visit", entityId: visit(10).id, userId: "demo-ym-001", userName: "Robert Chen", details: { dockDoorId: door("D-02").id, doorNumber: "D-02" } },
    { action: "dock_start_loading", entityType: "visit", entityId: visit(10).id, userId: "demo-du-001", userName: "Lisa Park", details: { action: "start_loading" } },
    { action: "move_task_updated", entityType: "move_task", entityId: 3, userId: "demo-yj-001", userName: "Tommy Kowalski", details: { status: "in_progress" } },
    { action: "exception_resolved", entityType: "exception", entityId: 5, userId: "demo-ym-001", userName: "Robert Chen", details: { resolutionNotes: "Seal confirmed correct by carrier" } },
    { action: "move_task_accepted", entityType: "move_task", entityId: 6, userId: "demo-yj-003", userName: "Jose Martinez", details: { status: "accepted" } },
  );

  await db.insert(auditLogs).values(wt(auditEntries));

  await db.insert(inspections).values(wt([
    {
      visitId: visit(3).id,
      inspectionType: "gate_inbound",
      trailerNumber: visit(3).trailerNumber,
      carrierName: "Swift Transportation",
      currentLocation: "Staging Area A - A-01",
      equipmentType: "dry_van",
      sealNumber: visit(3).sealNumber,
      result: "pass",
      checklist: {
        groups: [
          { name: "Exterior", items: [
            { label: "Roof condition", status: "pass" },
            { label: "Side panels", status: "pass" },
            { label: "Rear doors", status: "pass" },
            { label: "Landing gear", status: "pass" },
          ]},
          { name: "Safety", items: [
            { label: "Lights operational", status: "pass" },
            { label: "Reflective tape", status: "pass" },
            { label: "Mud flaps", status: "pass" },
          ]},
          { name: "Seal & Security", items: [
            { label: "Seal intact", status: "pass" },
            { label: "Seal number matches", status: "pass" },
          ]},
        ]
      },
      remarks: "Trailer in good condition. Seal verified. Cleared for yard.",
      inspectorId: "demo-gg-001",
      inspectorName: "Maria Gonzalez",
      submittedAt: hoursAgo(7),
    },
    {
      visitId: visit(16).id,
      inspectionType: "damage_assessment",
      trailerNumber: visit(16).trailerNumber,
      carrierName: "Werner Enterprises",
      currentLocation: "Staging Area A - A-05",
      equipmentType: "dry_van",
      result: "fail",
      checklist: {
        groups: [
          { name: "Exterior", items: [
            { label: "Roof condition", status: "pass" },
            { label: "Side panels", status: "pass" },
            { label: "Rear doors", status: "fail", notes: "Right door hinge bent, door does not close flush" },
            { label: "Landing gear", status: "pass" },
          ]},
          { name: "Safety", items: [
            { label: "Lights operational", status: "pass" },
            { label: "Reflective tape", status: "pass" },
            { label: "Mud flaps", status: "pass" },
          ]},
          { name: "Interior", items: [
            { label: "Floor condition", status: "pass" },
            { label: "Wall condition", status: "pass" },
            { label: "Odor/contamination", status: "pass" },
          ]},
        ]
      },
      remarks: "Rear door hinge damaged — right door does not close fully. Carrier notified. Photos documented.",
      issueSeverity: "medium",
      inspectorId: "demo-gg-002",
      inspectorName: "Jamal Williams",
      submittedAt: hoursAgo(4),
    },
    {
      visitId: visit(9).id,
      inspectionType: "yard_spot_check",
      trailerNumber: visit(9).trailerNumber,
      carrierName: "Werner Enterprises",
      currentLocation: "Dock Door D-01",
      equipmentType: "dry_van",
      result: "pass",
      checklist: {
        groups: [
          { name: "Dock Check", items: [
            { label: "Trailer secured at dock", status: "pass" },
            { label: "Wheel chocks in place", status: "pass" },
            { label: "Dock leveler engaged", status: "pass" },
          ]},
          { name: "Load", items: [
            { label: "Load condition acceptable", status: "pass" },
            { label: "No shifting cargo", status: "pass" },
          ]},
        ]
      },
      remarks: "Dock spot check passed. Unloading proceeding normally.",
      inspectorId: "demo-du-001",
      inspectorName: "Lisa Park",
      submittedAt: hoursAgo(2),
    },
  ]));

  // ── RBAC Seed ────────────────────────────────────────────────────────────────
  const systemRoles = [
    { roleName: "Yard Admin",       roleDescription: "Full system access and configuration",        roleLevel: 100, isSystem: true },
    { roleName: "Yard Supervisor",  roleDescription: "Operational oversight and task assignments",   roleLevel: 80,  isSystem: true },
    { roleName: "Gate Operator",    roleDescription: "Gate check-in and check-out operations only",  roleLevel: 60,  isSystem: true },
    { roleName: "Dock Operator",    roleDescription: "Dock door management and ready-to-go actions", roleLevel: 60,  isSystem: true },
    { roleName: "Yard Marshal",     roleDescription: "Yard slot assignment and move task execution",  roleLevel: 50,  isSystem: true },
    { roleName: "Carrier User",     roleDescription: "Appointment visibility and status tracking",    roleLevel: 20,  isSystem: true },
  ];
  const insertedRoles = await db.insert(roles).values(systemRoles).onConflictDoNothing().returning();
  const role = (name: string) => insertedRoles.find((r) => r.roleName === name)!;

  const moduleList = [
    { moduleName: "appointments", actionName: "access", description: "Appointment scheduling and management" },
    { moduleName: "gate",         actionName: "access", description: "Gate check-in and check-out operations" },
    { moduleName: "dock",         actionName: "access", description: "Dock door assignment and management" },
    { moduleName: "yard_slot",    actionName: "access", description: "Yard slot assignment and management" },
    { moduleName: "move",         actionName: "access", description: "Yard move task creation and execution" },
    { moduleName: "hold",         actionName: "access", description: "Hold placement and removal approval" },
    { moduleName: "ready_to_go",  actionName: "access", description: "Ready-to-go approval and dispatch" },
    { moduleName: "reports",      actionName: "access", description: "Reports and analytics access" },
    { moduleName: "user_mgmt",    actionName: "access", description: "User account management" },
    { moduleName: "role_mgmt",    actionName: "access", description: "Role and permission configuration" },
  ];
  const insertedPerms = await db.insert(permissions).values(moduleList).onConflictDoNothing().returning();
  const perm = (mod: string) => insertedPerms.find((p) => p.moduleName === mod)!;

  type P = { canView: boolean; canCreate: boolean; canModify: boolean; canExecute: boolean; canApprove: boolean };
  const ALL: P    = { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true  };
  const VIEW: P   = { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false };
  const NONE: P   = { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false };
  const VC: P     = { canView: true,  canCreate: true,  canModify: false, canExecute: false, canApprove: false };
  const VCM: P    = { canView: true,  canCreate: true,  canModify: true,  canExecute: false, canApprove: false };
  const VCME: P   = { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: false };
  const VME: P    = { canView: true,  canCreate: false, canModify: true,  canExecute: true,  canApprove: false };
  const VE: P     = { canView: true,  canCreate: false, canModify: false, canExecute: true,  canApprove: false };

  const rbacMatrix: Array<{ roleId: number; permissionId: number } & P> = [];
  function addPerms(roleName: string, entries: Record<string, P>) {
    const r = role(roleName);
    if (!r) return;
    for (const [mod, p] of Object.entries(entries)) {
      const pm = perm(mod);
      if (!pm) continue;
      rbacMatrix.push({ roleId: r.id, permissionId: pm.id, ...p });
    }
  }

  addPerms("Yard Admin", {
    appointments: ALL, gate: ALL, dock: ALL, yard_slot: ALL, move: ALL,
    hold: ALL, ready_to_go: ALL, reports: ALL, user_mgmt: ALL, role_mgmt: ALL,
  });
  addPerms("Yard Supervisor", {
    appointments: ALL, gate: ALL, dock: ALL, yard_slot: ALL, move: ALL,
    hold: ALL, ready_to_go: ALL, reports: VIEW, user_mgmt: VIEW, role_mgmt: VIEW,
  });
  addPerms("Gate Operator", {
    appointments: VIEW, gate: VCME, dock: VIEW, yard_slot: VIEW, move: VIEW,
    hold: VC, ready_to_go: VIEW, reports: NONE, user_mgmt: NONE, role_mgmt: NONE,
  });
  addPerms("Dock Operator", {
    appointments: VIEW, gate: VIEW, dock: VCM, yard_slot: VIEW, move: VC,
    hold: VIEW, ready_to_go: VE, reports: VIEW, user_mgmt: NONE, role_mgmt: NONE,
  });
  addPerms("Yard Marshal", {
    appointments: VIEW, gate: VIEW, dock: VIEW, yard_slot: VME, move: VME,
    hold: VIEW, ready_to_go: VIEW, reports: NONE, user_mgmt: NONE, role_mgmt: NONE,
  });
  addPerms("Carrier User", {
    appointments: VIEW, gate: NONE, dock: NONE, yard_slot: NONE, move: NONE,
    hold: NONE, ready_to_go: NONE, reports: NONE, user_mgmt: NONE, role_mgmt: NONE,
  });

  if (rbacMatrix.length > 0) {
    await db.insert(rolePermissions).values(rbacMatrix).onConflictDoNothing();
  }

  const roleKeyToName: Record<string, string> = {
    admin: "Yard Admin", yard_manager: "Yard Supervisor",
    gate_guard: "Gate Operator", dock_user: "Dock Operator",
    yard_jockey: "Yard Marshal", carrier: "Carrier User",
  };
  const userRoleEntries = demoUsers
    .map((u) => {
      const roleName = roleKeyToName[u.role];
      const r = insertedRoles.find((ir) => ir.roleName === roleName);
      if (!r) return null;
      return { userId: u.id, roleId: r.id, assignedBy: "demo-admin-001", isPrimary: true, tenantId: tid };
    })
    .filter(Boolean) as Array<{ userId: string; roleId: number; assignedBy: string; isPrimary: boolean; tenantId: string }>;
  if (userRoleEntries.length > 0) {
    await db.insert(userRoles).values(userRoleEntries).onConflictDoNothing();
  }
  // ── End RBAC Seed ────────────────────────────────────────────────────────────

  console.log("Database seeded successfully!");
  console.log(
    `  - ${insertedCarriers.length} carriers`,
    `\n  - ${insertedZones.length} zones`,
    `\n  - ${slotsToCreate.length} slots`,
    `\n  - ${insertedDoors.length} dock doors`,
    `\n  - ${insertedGates.length} gates`,
    `\n  - ${demoAppointments.length} appointments`,
    `\n  - ${insertedVisits.length} visits (active + closed)`,
    `\n  - 15 move tasks (open + assigned + in-progress + completed + rejected)`,
    `\n  - 5 exceptions (open + resolved)`,
    `\n  - 3 inspections (pass + fail + spot check)`,
    `\n  - ${auditEntries.length} audit log entries`,
    `\n  - ${demoUsers.length} user profiles (1 admin, 1 yard manager, 2 gate guards, 3 jockeys, 2 dock ops, 3 carriers)`
  );
}

export async function seedRbacIfEmpty() {
  const [roleCount] = await db.select({ c: count() }).from(roles);
  if (Number(roleCount.c) > 0) {
    console.log("RBAC tables already seeded, skipping.");
    return;
  }
  console.log("Seeding RBAC data...");

  const systemRoles = [
    { roleName: "Yard Admin",      roleDescription: "Full system access and configuration",        roleLevel: 100, isSystem: true },
    { roleName: "Yard Supervisor", roleDescription: "Operational oversight and task assignments",   roleLevel: 80,  isSystem: true },
    { roleName: "Gate Operator",   roleDescription: "Gate check-in and check-out operations only",  roleLevel: 60,  isSystem: true },
    { roleName: "Dock Operator",   roleDescription: "Dock door management and ready-to-go actions", roleLevel: 60,  isSystem: true },
    { roleName: "Yard Marshal",    roleDescription: "Yard slot assignment and move task execution",  roleLevel: 50,  isSystem: true },
    { roleName: "Carrier User",    roleDescription: "Appointment visibility and status tracking",    roleLevel: 20,  isSystem: true },
  ];
  const insertedRoles = await db.insert(roles).values(systemRoles).onConflictDoNothing().returning();
  const findRole = (name: string) => insertedRoles.find((r) => r.roleName === name)!;

  const moduleList = [
    { moduleName: "appointments", actionName: "access", description: "Appointment scheduling and management" },
    { moduleName: "gate",         actionName: "access", description: "Gate check-in and check-out operations" },
    { moduleName: "dock",         actionName: "access", description: "Dock door assignment and management" },
    { moduleName: "yard_slot",    actionName: "access", description: "Yard slot assignment and management" },
    { moduleName: "move",         actionName: "access", description: "Yard move task creation and execution" },
    { moduleName: "hold",         actionName: "access", description: "Hold placement and removal approval" },
    { moduleName: "ready_to_go",  actionName: "access", description: "Ready-to-go approval and dispatch" },
    { moduleName: "reports",      actionName: "access", description: "Reports and analytics access" },
    { moduleName: "user_mgmt",    actionName: "access", description: "User account management" },
    { moduleName: "role_mgmt",    actionName: "access", description: "Role and permission configuration" },
  ];
  const insertedPerms = await db.insert(permissions).values(moduleList).onConflictDoNothing().returning();
  const findPerm = (mod: string) => insertedPerms.find((p) => p.moduleName === mod)!;

  type P = { canView: boolean; canCreate: boolean; canModify: boolean; canExecute: boolean; canApprove: boolean };
  const ALL: P  = { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true  };
  const VIEW: P = { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false };
  const NONE: P = { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false };
  const VC: P   = { canView: true,  canCreate: true,  canModify: false, canExecute: false, canApprove: false };
  const VCM: P  = { canView: true,  canCreate: true,  canModify: true,  canExecute: false, canApprove: false };
  const VCME: P = { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: false };
  const VME: P  = { canView: true,  canCreate: false, canModify: true,  canExecute: true,  canApprove: false };
  const VE: P   = { canView: true,  canCreate: false, canModify: false, canExecute: true,  canApprove: false };

  const rbacMatrix: Array<{ roleId: number; permissionId: number } & P> = [];
  function ap(roleName: string, entries: Record<string, P>) {
    const r = findRole(roleName);
    if (!r) return;
    for (const [mod, p] of Object.entries(entries)) {
      const pm = findPerm(mod);
      if (!pm) continue;
      rbacMatrix.push({ roleId: r.id, permissionId: pm.id, ...p });
    }
  }
  ap("Yard Admin",      { appointments: ALL,  gate: ALL,  dock: ALL,  yard_slot: ALL,  move: ALL,  hold: ALL,  ready_to_go: ALL,  reports: ALL,  user_mgmt: ALL,  role_mgmt: ALL });
  ap("Yard Supervisor", { appointments: ALL,  gate: ALL,  dock: ALL,  yard_slot: ALL,  move: ALL,  hold: ALL,  ready_to_go: ALL,  reports: VIEW, user_mgmt: VIEW, role_mgmt: VIEW });
  ap("Gate Operator",   { appointments: VIEW, gate: VCME, dock: VIEW, yard_slot: VIEW, move: VIEW, hold: VC,   ready_to_go: VIEW, reports: NONE, user_mgmt: NONE, role_mgmt: NONE });
  ap("Dock Operator",   { appointments: VIEW, gate: VIEW, dock: VCM,  yard_slot: VIEW, move: VC,   hold: VIEW, ready_to_go: VE,   reports: VIEW, user_mgmt: NONE, role_mgmt: NONE });
  ap("Yard Marshal",    { appointments: VIEW, gate: VIEW, dock: VIEW, yard_slot: VME,  move: VME,  hold: VIEW, ready_to_go: VIEW, reports: NONE, user_mgmt: NONE, role_mgmt: NONE });
  ap("Carrier User",    { appointments: VIEW, gate: NONE, dock: NONE, yard_slot: NONE, move: NONE, hold: NONE, ready_to_go: NONE, reports: NONE, user_mgmt: NONE, role_mgmt: NONE });

  if (rbacMatrix.length > 0) {
    await db.insert(rolePermissions).values(rbacMatrix).onConflictDoNothing();
  }

  const roleKeyToName: Record<string, string> = {
    admin: "Yard Admin", yard_manager: "Yard Supervisor",
    gate_guard: "Gate Operator", dock_user: "Dock Operator",
    yard_jockey: "Yard Marshal", carrier: "Carrier User",
  };

  // Assign roles to ALL user profiles, each stamped with their own tenantId.
  // Previously this was hardcoded to Northwind; fixing it here covers all tenants.
  const allUserProfiles = await db.select().from(userProfiles);
  const userRoleEntries = allUserProfiles
    .map((u) => {
      const roleName = roleKeyToName[u.role];
      const r = insertedRoles.find((ir) => ir.roleName === roleName);
      if (!r) return null;
      // Use the profile's own tenantId so Acme/Riverton users get correct context
      return { userId: u.userId, roleId: r.id, assignedBy: "demo-admin-001", isPrimary: true, tenantId: u.tenantId };
    })
    .filter(Boolean) as Array<{ userId: string; roleId: number; assignedBy: string; isPrimary: boolean; tenantId: string }>;
  if (userRoleEntries.length > 0) {
    await db.insert(userRoles).values(userRoleEntries).onConflictDoNothing();
  }

  console.log(`RBAC seeded: ${insertedRoles.length} roles, ${insertedPerms.length} permissions, ${rbacMatrix.length} role-permission mappings, ${userRoleEntries.length} user role assignments.`);
}

// ─── Billing catalog seed ─────────────────────────────────────────────────────
export async function seedBillingIfEmpty() {
  const [moduleCount] = await db.select({ c: count() }).from(modulesTable);
  if (Number(moduleCount.c) > 0) {
    console.log("Billing catalog already seeded, skipping.");
    return;
  }
  console.log("Seeding billing catalog...");

  // ── 13 module catalog ──────────────────────────────────────────────────────
  const MODULE_CATALOG = [
    { code: "gate",          name: "Gate Operations",             category: "operations", description: "Gate check-in, check-out, and driver management" },
    { code: "appointments",  name: "Appointment Management",      category: "operations", description: "Scheduling, confirmation, and appointment lifecycle" },
    { code: "yard_inventory",name: "Yard Inventory",              category: "operations", description: "Real-time trailer inventory and status tracking" },
    { code: "yard_map",      name: "Yard Map & Layout",           category: "operations", description: "Visual yard map with slot and zone management" },
    { code: "dock",          name: "Dock Door Management",        category: "operations", description: "Dock door assignment, status, and capacity management" },
    { code: "move_tasks",    name: "Move Task Management",        category: "operations", description: "Yard jockey move task creation and execution" },
    { code: "hold_mgmt",     name: "Hold Management",             category: "operations", description: "Hold placement, tracking, and removal workflow" },
    { code: "ready_to_go",   name: "Ready-to-Go Dispatch",        category: "operations", description: "Driver ready-to-go approval and dispatch" },
    { code: "inspections",   name: "Inspection Management",       category: "compliance", description: "Vehicle and trailer inspection workflows and records" },
    { code: "yard_audit",    name: "Yard Audit Workflow",         category: "compliance", description: "Physical yard audit and discrepancy reconciliation" },
    { code: "reports",       name: "Reports & Analytics",         category: "analytics",  description: "Operational reports, KPIs, and data exports" },
    { code: "user_mgmt",     name: "User & Role Management",      category: "admin",      description: "User accounts, roles, and permission configuration" },
    { code: "ai_copilot",    name: "AI Copilot & Predictive Ops", category: "ai",         description: "AI-powered insights, predictions, and automation" },
  ];
  const insertedModules = await db.insert(modulesTable).values(MODULE_CATALOG).returning();
  const modByCode = new Map(insertedModules.map((m) => [m.code, m]));

  // ── 3 plans ────────────────────────────────────────────────────────────────
  const PLAN_DEFS = [
    { code: "core",         name: "Core",         description: "Essential gate and yard operations for growing facilities" },
    { code: "professional", name: "Professional", description: "Full operational suite with compliance and reporting" },
    { code: "enterprise",   name: "Enterprise",   description: "All modules including AI copilot and advanced analytics" },
  ];
  const insertedPlans = await db.insert(plansTable).values(PLAN_DEFS).returning();
  const planByCode = new Map(insertedPlans.map((p) => [p.code, p]));

  // ── Plan → module tier map ─────────────────────────────────────────────────
  const CORE_CODES = [
    "gate", "appointments", "yard_inventory", "yard_map",
    "dock", "move_tasks", "hold_mgmt", "ready_to_go",
  ]; // 8 modules
  const PRO_CODES  = [...CORE_CODES, "inspections", "yard_audit", "reports"]; // 11 modules
  const ENT_CODES  = [...PRO_CODES,  "user_mgmt", "ai_copilot"];              // 13 modules

  const planModuleRows: Array<{ planId: number; moduleId: number; limits: null }> = [];
  const addTier = (planCode: string, codes: string[]) => {
    const plan = planByCode.get(planCode)!;
    for (const code of codes) {
      const mod = modByCode.get(code);
      if (mod) planModuleRows.push({ planId: plan.id, moduleId: mod.id, limits: null });
    }
  };
  addTier("core",         CORE_CODES);
  addTier("professional", PRO_CODES);
  addTier("enterprise",   ENT_CODES);

  await db.insert(planModulesTable).values(planModuleRows);

  // ── Tenant subscriptions ───────────────────────────────────────────────────
  // northwind (demo) → Enterprise   acme (test) → Core
  const tenantSubs: Array<{ tenantId: string; planId: number; status: string }> = [];

  const [northwindRow] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, "northwind"));
  if (northwindRow) {
    tenantSubs.push({ tenantId: northwindRow.id, planId: planByCode.get("enterprise")!.id, status: "active" });
  }

  const [acmeRow] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, "acme"));
  if (acmeRow) {
    tenantSubs.push({ tenantId: acmeRow.id, planId: planByCode.get("core")!.id, status: "active" });
  }

  if (tenantSubs.length > 0) {
    await db.insert(subscriptionsTable).values(tenantSubs);
  }

  console.log(
    `Billing seeded: ${insertedModules.length} modules, ${insertedPlans.length} plans, ` +
    `${planModuleRows.length} plan-module entries (core:${CORE_CODES.length} / pro:${PRO_CODES.length} / ent:${ENT_CODES.length}), ` +
    `${tenantSubs.length} subscriptions.`
  );
}

export async function resetAndReseed() {
  console.log("Resetting database to seed state...");
  await db.delete(yardAuditItems);
  await db.delete(inspections);
  await db.delete(auditLogs);
  await db.delete(moveTasks);
  await db.delete(exceptions);
  await db.delete(gateTransactions);
  await db.delete(visits);
  await db.delete(appointments);
  await db.execute(sql`UPDATE ${dockDoors} SET current_visit_id = NULL`);
  await db.execute(sql`UPDATE ${yardSlots} SET current_visit_id = NULL`);
  await db.delete(dockDoors);
  await db.delete(yardSlots);
  await db.delete(yardZones);
  await db.delete(gates);
  await db.delete(userRoles);
  await db.delete(rolePermissions);
  await db.delete(permissions);
  await db.delete(roles);
  await db.delete(userProfiles);
  await db.delete(carriers);
  await db.delete(users);
  console.log("All tables cleared. Re-seeding...");
  await seedDatabase();
}

/**
 * seedMissingMultiTenantUsers — idempotent patch seed.
 *
 * Ensures Acme Corp and Riverton Freight tenants, their demo users, RBAC role
 * assignments, and billing subscriptions all exist.  Safe to call on every
 * startup (every insert uses onConflictDoNothing).
 *
 * Run order: after seedDatabase + seedRbacIfEmpty + seedBillingIfEmpty.
 */
export async function seedMissingMultiTenantUsers(): Promise<void> {
  // ── Tenants ───────────────────────────────────────────────────────────────
  const [acmeTenant] = await db
    .insert(tenants)
    .values({ name: "Acme Corp", slug: "acme", status: "active" })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: "Acme Corp", status: "active" } })
    .returning();
  const acmeTid = acmeTenant.id;

  const [rivertonTenant] = await db
    .insert(tenants)
    .values({ name: "Riverton Freight", slug: "riverton", status: "suspended" })
    .onConflictDoUpdate({ target: tenants.slug, set: { name: "Riverton Freight", status: "suspended" } })
    .returning();
  const rivertonTid = rivertonTenant.id;

  // ── Users + profiles ─────────────────────────────────────────────────────
  const acmeUsers: Array<{ id: string; firstName: string; lastName: string; email: string; role: string }> = [
    { id: "acme-admin",    firstName: "James",   lastName: "O'Connor", email: "j.oconnor@acmecorp.com",      role: "admin" },
    { id: "acme-ym-001",   firstName: "Carlos",  lastName: "Vega",     email: "c.vega@acmecorp.com",         role: "yard_manager" },
    { id: "acme-gate-001", firstName: "Priya",   lastName: "Sharma",   email: "p.sharma@acmecorp.com",       role: "gate_guard" },
    { id: "acme-yj-001",   firstName: "Darnell", lastName: "Scott",    email: "d.scott@acmecorp.com",        role: "yard_jockey" },
    { id: "acme-du-001",   firstName: "Angela",  lastName: "White",    email: "a.white@acmecorp.com",        role: "dock_user" },
  ];
  for (const u of acmeUsers) {
    await db.insert(users).values({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, tenantId: acmeTid }).onConflictDoNothing();
    await db.insert(userProfiles).values({ userId: u.id, role: u.role, carrierId: null, tenantId: acmeTid }).onConflictDoNothing();
  }

  const rivertonUsers: Array<{ id: string; firstName: string; lastName: string; email: string; role: string }> = [
    { id: "riverton-admin", firstName: "Morgan", lastName: "Reed",  email: "m.reed@rivertonfreight.com",   role: "admin" },
    { id: "riverton-gate",  firstName: "Devon",  lastName: "Hayes", email: "d.hayes@rivertonfreight.com",  role: "gate_guard" },
  ];
  for (const u of rivertonUsers) {
    await db.insert(users).values({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, tenantId: rivertonTid }).onConflictDoNothing();
    await db.insert(userProfiles).values({ userId: u.id, role: u.role, carrierId: null, tenantId: rivertonTid }).onConflictDoNothing();
  }

  // ── RBAC role assignments ─────────────────────────────────────────────────
  const roleKeyToName: Record<string, string> = {
    admin: "Yard Admin", yard_manager: "Yard Supervisor",
    gate_guard: "Gate Operator", dock_user: "Dock Operator",
    yard_jockey: "Yard Marshal", carrier: "Carrier User",
  };
  const allRoles = await db.select().from(roles);
  if (allRoles.length > 0) {
    const allNew = [
      ...acmeUsers.map(u => ({ ...u, tenantId: acmeTid })),
      ...rivertonUsers.map(u => ({ ...u, tenantId: rivertonTid })),
    ];
    for (const u of allNew) {
      const roleName = roleKeyToName[u.role];
      const roleRow = allRoles.find(r => r.roleName === roleName);
      if (!roleRow) continue;
      await db.insert(userRoles)
        .values({ userId: u.id, roleId: roleRow.id, assignedBy: "demo-admin-001", isPrimary: true, tenantId: u.tenantId })
        .onConflictDoNothing();
    }
  }

  // ── Billing subscriptions ────────────────────────────────────────────────
  const allPlans = await db.select().from(plansTable);
  const corePlan = allPlans.find(p => p.code === "core");
  if (corePlan) {
    // Acme — active Core
    const [acmeSub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.tenantId, acmeTid)).limit(1);
    if (!acmeSub) {
      await db.insert(subscriptionsTable).values({ tenantId: acmeTid, planId: corePlan.id, status: "active" }).onConflictDoNothing();
    }
    // Riverton — suspended Core (all modules blocked)
    const [rivertonSub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.tenantId, rivertonTid)).limit(1);
    if (!rivertonSub) {
      await db.insert(subscriptionsTable).values({ tenantId: rivertonTid, planId: corePlan.id, status: "suspended" }).onConflictDoNothing();
    } else if (rivertonSub.status !== "suspended") {
      await db.update(subscriptionsTable).set({ status: "suspended" }).where(eq(subscriptionsTable.tenantId, rivertonTid));
    }
  }

  console.log("Multi-tenant patch: Acme Corp (5 users) + Riverton Freight (2 users) ensured.");
}

/**
 * Inserts the canonical KSAP platform admin account if it does not yet exist.
 * Platform admins live outside the tenant-scoped `users` table; they have no
 * tenantId and are identified by isPlatformAdmin: true in their session token.
 */
export async function seedPlatformAdminIfEmpty(): Promise<void> {
  const [existing] = await db.select({ id: platformAdmins.id }).from(platformAdmins).limit(1);
  if (existing) {
    console.log("Platform admin already seeded, skipping.");
    return;
  }
  await db.insert(platformAdmins).values({
    id:        "ksap-admin",
    email:     "admin@ksap.io",
    firstName: "KSAP",
    lastName:  "Admin",
  });
  console.log("Platform admin seeded: ksap-admin (admin@ksap.io)");
}
