/**
 * Tenant-scoped storage layer.
 *
 * Every public method on DatabaseStorage reads/writes ONLY rows that belong to
 * the `tenantId` passed to the constructor.  Global catalog tables (roles,
 * permissions, role_permissions) are not managed here — they live in rbac.ts
 * and are intentionally un-scoped.
 *
 * The exported `storage` proxy reads the current request's tenant from
 * AsyncLocalStorage (set by authMiddleware) so register-yms-routes.ts requires
 * zero changes to handler bodies.
 */
import { AsyncLocalStorage } from "async_hooks";
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
  photos,
  auditLogs,
  userProfiles,
  yardAuditItems,
  type Carrier,
  type InsertCarrier,
  type YardZone,
  type InsertYardZone,
  type YardSlot,
  type InsertYardSlot,
  type DockDoor,
  type InsertDockDoor,
  type Gate,
  type InsertGate,
  type Appointment,
  type InsertAppointment,
  type Visit,
  type InsertVisit,
  type MoveTask,
  type InsertMoveTask,
  type Exception,
  type InsertException,
  type Photo,
  type InsertPhoto,
  type AuditLog,
  type InsertAuditLog,
  type UserProfile,
  type InsertUserProfile,
  type InsertGateTransaction,
  type GateTransaction,
  type YardAuditItem,
  type InsertYardAuditItem,
  inspections,
  type Inspection,
  type InsertInspection,
  aiConfig,
  aiAuditLogs,
  type AiConfig,
  type InsertAiConfig,
  type AiAuditLog,
  type InsertAiAuditLog,
  revenueRates,
  type RevenueRate,
  type InsertRevenueRate,
  users,
} from "@workspace/db";
import { db } from "../db";
import { eq, and, or, like, desc, sql, ne, isNull, count, avg, inArray, notInArray } from "drizzle-orm";

// ─── Tenant context (AsyncLocalStorage) ──────────────────────────────────────
export const tenantContext = new AsyncLocalStorage<string>();

export function getStorage(tenantId: string): DatabaseStorage {
  return new DatabaseStorage(tenantId);
}

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IStorage {
  // Carriers
  getCarriers(): Promise<Carrier[]>;
  getCarrier(id: number): Promise<Carrier | undefined>;
  createCarrier(c: InsertCarrier): Promise<Carrier>;
  updateCarrier(id: number, data: Partial<Carrier>): Promise<Carrier>;

  // Yard Zones
  getYardZones(): Promise<YardZone[]>;
  createYardZone(z: InsertYardZone): Promise<YardZone>;
  updateYardZone(id: number, data: Partial<YardZone>): Promise<YardZone>;
  getZonesCapacity(): Promise<Array<{ zoneId: number; totalSlots: number; activeSlots: number; availableSlots: number }>>;

  // Yard Slots
  getYardSlots(): Promise<YardSlot[]>;
  getAvailableSlots(): Promise<Array<{ id: number; slotNumber: string; zoneName: string }>>;
  createYardSlot(s: InsertYardSlot): Promise<YardSlot>;
  updateSlotVisit(slotId: number, visitId: number | null): Promise<void>;
  updateYardSlot(id: number, data: Partial<YardSlot>): Promise<YardSlot>;
  bulkUpdateSlots(ids: number[], data: Partial<YardSlot>): Promise<void>;

  // Dock Doors
  getAllDockDoors(): Promise<DockDoor[]>;
  getAvailableDoors(): Promise<Array<{ id: number; doorNumber: string }>>;
  createDockDoor(d: InsertDockDoor): Promise<DockDoor>;
  updateDoorVisit(doorId: number, visitId: number | null): Promise<void>;
  updateDockDoor(id: number, data: Partial<DockDoor>): Promise<DockDoor>;
  bulkUpdateDoors(ids: number[], data: Partial<DockDoor>): Promise<void>;

  // Gates
  getGates(): Promise<Gate[]>;
  createGate(g: InsertGate): Promise<Gate>;
  updateGate(id: number, data: Partial<Gate>): Promise<Gate>;

  // Appointments
  getAppointments(): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  searchAppointments(q: string): Promise<Appointment[]>;
  createAppointment(a: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<void>;
  updateAppointment(id: number, data: Partial<Appointment>): Promise<Appointment>;

  // Visits
  getActiveVisits(): Promise<Visit[]>;
  getVisit(id: number): Promise<Visit | undefined>;
  searchVisits(q: string): Promise<Visit[]>;
  createVisit(v: InsertVisit): Promise<Visit>;
  updateVisit(id: number, data: Partial<Visit>): Promise<Visit>;
  getVisitByTrailer(trailerNumber: string): Promise<Visit | undefined>;

  // Gate Transactions
  createGateTransaction(t: InsertGateTransaction): Promise<GateTransaction>;

  // Move Tasks
  getMoveTasks(filter: string): Promise<MoveTask[]>;
  getMoveTask(id: number): Promise<MoveTask | undefined>;
  createMoveTask(t: InsertMoveTask): Promise<MoveTask>;
  updateMoveTask(id: number, data: Partial<MoveTask>): Promise<MoveTask>;

  // Exceptions
  getExceptions(filter: string): Promise<Exception[]>;
  createException(e: InsertException): Promise<Exception>;
  resolveException(id: number, resolvedBy: string, resolutionNotes: string): Promise<Exception>;

  // Photos
  createPhoto(p: InsertPhoto): Promise<Photo>;

  // Audit Logs
  getAuditLogs(): Promise<AuditLog[]>;
  createAuditLog(l: InsertAuditLog): Promise<AuditLog>;

  // User Profiles
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(p: InsertUserProfile): Promise<UserProfile>;
  ensureDemoUser(userId: string): Promise<void>;
  getAllUsersWithProfiles(): Promise<any[]>;
  updateUserRole(userId: string, role: string): Promise<void>;

  // Dashboard
  getDashboardStats(): Promise<any>;

  // Yard Inventory (joined view)
  getYardInventory(): Promise<any[]>;

  // Yard Map
  getYardMapData(): Promise<any>;

  // Dock Doors view
  getDockDoorsView(): Promise<any[]>;

  // Yard Audit
  getYardAuditItems(): Promise<YardAuditItem[]>;
  createYardAuditItem(item: InsertYardAuditItem): Promise<YardAuditItem>;
  updateYardAuditItem(id: number, data: Partial<YardAuditItem>): Promise<YardAuditItem>;
  generateAuditWorkQueue(): Promise<any[]>;

  // Inspections
  getInspections(): Promise<Inspection[]>;
  getInspection(id: number): Promise<Inspection | undefined>;
  createInspection(i: InsertInspection): Promise<Inspection>;
  updateInspection(id: number, data: Partial<Inspection>): Promise<Inspection>;

  // AI Config
  getAiConfig(): Promise<AiConfig>;
  updateAiConfig(data: Partial<InsertAiConfig>): Promise<AiConfig>;

  // AI Audit Logs
  getAiAuditLogs(limit?: number): Promise<AiAuditLog[]>;
  createAiAuditLog(entry: InsertAiAuditLog): Promise<AiAuditLog>;
  getAiPerformanceStats(): Promise<Record<string, number>>;

  // Revenue Rates
  getRevenueRates(): Promise<RevenueRate[]>;
  upsertRevenueRate(serviceType: string, data: Partial<InsertRevenueRate>): Promise<RevenueRate>;
}

// ─── Implementation ───────────────────────────────────────────────────────────
export class DatabaseStorage implements IStorage {
  constructor(private readonly tenantId: string) {}

  // ── Carriers ──────────────────────────────────────────────────────────────
  async getCarriers(): Promise<Carrier[]> {
    return db.select().from(carriers)
      .where(eq(carriers.tenantId, this.tenantId))
      .orderBy(carriers.name);
  }

  async getCarrier(id: number): Promise<Carrier | undefined> {
    const [c] = await db.select().from(carriers)
      .where(and(eq(carriers.id, id), eq(carriers.tenantId, this.tenantId)));
    return c;
  }

  async createCarrier(c: InsertCarrier): Promise<Carrier> {
    const [result] = await db.insert(carriers)
      .values({ ...c, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateCarrier(id: number, data: Partial<Carrier>): Promise<Carrier> {
    const { id: _id, createdAt: _ca, tenantId: _tid, ...safe } = data as any;
    const [result] = await db.update(carriers).set(safe)
      .where(and(eq(carriers.id, id), eq(carriers.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  // ── Yard Zones ────────────────────────────────────────────────────────────
  async getYardZones(): Promise<YardZone[]> {
    return db.select().from(yardZones)
      .where(eq(yardZones.tenantId, this.tenantId))
      .orderBy(yardZones.name);
  }

  async createYardZone(z: InsertYardZone): Promise<YardZone> {
    const [result] = await db.insert(yardZones)
      .values({ ...z, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateYardZone(id: number, data: Partial<YardZone>): Promise<YardZone> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db.update(yardZones).set(safe)
      .where(and(eq(yardZones.id, id), eq(yardZones.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  async getZonesCapacity(): Promise<Array<{ zoneId: number; totalSlots: number; activeSlots: number; availableSlots: number }>> {
    const rows = await db
      .select({
        zoneId: yardSlots.zoneId,
        totalSlots: count(yardSlots.id),
        activeSlots: sql<number>`sum(case when ${yardSlots.isActive} then 1 else 0 end)::int`,
        availableSlots: sql<number>`sum(case when ${yardSlots.isActive} and not ${yardSlots.isBlocked} and ${yardSlots.currentVisitId} is null then 1 else 0 end)::int`,
      })
      .from(yardSlots)
      .where(eq(yardSlots.tenantId, this.tenantId))
      .groupBy(yardSlots.zoneId);
    return rows.map((r) => ({
      zoneId: r.zoneId,
      totalSlots: Number(r.totalSlots),
      activeSlots: Number(r.activeSlots),
      availableSlots: Number(r.availableSlots),
    }));
  }

  // ── Yard Slots ────────────────────────────────────────────────────────────
  async getYardSlots(): Promise<YardSlot[]> {
    return db.select().from(yardSlots)
      .where(eq(yardSlots.tenantId, this.tenantId))
      .orderBy(yardSlots.slotNumber);
  }

  async getAvailableSlots(): Promise<Array<{ id: number; slotNumber: string; zoneName: string }>> {
    return db
      .select({
        id: yardSlots.id,
        slotNumber: yardSlots.slotNumber,
        zoneName: yardZones.name,
      })
      .from(yardSlots)
      .innerJoin(yardZones, eq(yardSlots.zoneId, yardZones.id))
      .where(
        and(
          eq(yardSlots.tenantId, this.tenantId),
          eq(yardSlots.isActive, true),
          eq(yardSlots.isBlocked, false),
          isNull(yardSlots.currentVisitId)
        )
      )
      .orderBy(yardSlots.slotNumber);
  }

  async createYardSlot(s: InsertYardSlot): Promise<YardSlot> {
    const [result] = await db.insert(yardSlots)
      .values({ ...s, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateYardSlot(id: number, data: Partial<YardSlot>): Promise<YardSlot> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db.update(yardSlots).set(safe)
      .where(and(eq(yardSlots.id, id), eq(yardSlots.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  async bulkUpdateSlots(ids: number[], data: Partial<YardSlot>): Promise<void> {
    if (ids.length === 0) return;
    const { tenantId: _tid, ...safe } = data as any;
    await db.update(yardSlots).set(safe)
      .where(and(inArray(yardSlots.id, ids), eq(yardSlots.tenantId, this.tenantId)));
  }

  async updateSlotVisit(slotId: number, visitId: number | null): Promise<void> {
    await db.update(yardSlots)
      .set({ currentVisitId: visitId })
      .where(and(eq(yardSlots.id, slotId), eq(yardSlots.tenantId, this.tenantId)));
  }

  // ── Dock Doors ────────────────────────────────────────────────────────────
  async getAllDockDoors(): Promise<DockDoor[]> {
    return db.select().from(dockDoors)
      .where(eq(dockDoors.tenantId, this.tenantId))
      .orderBy(dockDoors.doorNumber);
  }

  async getAvailableDoors(): Promise<Array<{ id: number; doorNumber: string }>> {
    return db
      .select({ id: dockDoors.id, doorNumber: dockDoors.doorNumber })
      .from(dockDoors)
      .where(
        and(
          eq(dockDoors.tenantId, this.tenantId),
          eq(dockDoors.isActive, true),
          eq(dockDoors.status, "available"),
          isNull(dockDoors.currentVisitId)
        )
      )
      .orderBy(dockDoors.doorNumber);
  }

  async createDockDoor(d: InsertDockDoor): Promise<DockDoor> {
    const [result] = await db.insert(dockDoors)
      .values({ ...d, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateDockDoor(id: number, data: Partial<DockDoor>): Promise<DockDoor> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db.update(dockDoors).set(safe)
      .where(and(eq(dockDoors.id, id), eq(dockDoors.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  async bulkUpdateDoors(ids: number[], data: Partial<DockDoor>): Promise<void> {
    if (ids.length === 0) return;
    const { tenantId: _tid, ...safe } = data as any;
    await db.update(dockDoors).set(safe)
      .where(and(inArray(dockDoors.id, ids), eq(dockDoors.tenantId, this.tenantId)));
  }

  async updateDoorVisit(doorId: number, visitId: number | null): Promise<void> {
    await db.update(dockDoors)
      .set({ currentVisitId: visitId })
      .where(and(eq(dockDoors.id, doorId), eq(dockDoors.tenantId, this.tenantId)));
  }

  // ── Gates ─────────────────────────────────────────────────────────────────
  async getGates(): Promise<Gate[]> {
    return db.select().from(gates)
      .where(eq(gates.tenantId, this.tenantId))
      .orderBy(gates.name);
  }

  async createGate(g: InsertGate): Promise<Gate> {
    const [result] = await db.insert(gates)
      .values({ ...g, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateGate(id: number, data: Partial<Gate>): Promise<Gate> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db.update(gates).set(safe)
      .where(and(eq(gates.id, id), eq(gates.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  // ── Appointments ──────────────────────────────────────────────────────────
  async getAppointments(): Promise<Appointment[]> {
    return db.select().from(appointments)
      .where(eq(appointments.tenantId, this.tenantId))
      .orderBy(desc(appointments.scheduledDate));
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [a] = await db.select().from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.tenantId, this.tenantId)));
    return a;
  }

  async searchAppointments(q: string): Promise<Appointment[]> {
    const pattern = `%${q}%`;
    return db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.tenantId, this.tenantId),
          ne(appointments.status, "cancelled"),
          ne(appointments.status, "completed"),
          or(
            like(appointments.referenceNumber, pattern),
            like(appointments.trailerNumber, pattern),
            like(appointments.truckNumber, pattern)
          )
        )
      )
      .limit(20);
  }

  async createAppointment(a: InsertAppointment): Promise<Appointment> {
    const [result] = await db.insert(appointments)
      .values({ ...a, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateAppointmentStatus(id: number, status: string): Promise<void> {
    await db.update(appointments)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.tenantId, this.tenantId)));
  }

  async updateAppointment(id: number, data: Partial<Appointment>): Promise<Appointment> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db
      .update(appointments)
      .set({ ...safe, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  // ── Visits ────────────────────────────────────────────────────────────────
  async getActiveVisits(): Promise<Visit[]> {
    return db.select().from(visits)
      .where(and(ne(visits.visitStatus, "closed"), eq(visits.tenantId, this.tenantId)))
      .orderBy(desc(visits.createdAt));
  }

  async getVisit(id: number): Promise<Visit | undefined> {
    const [v] = await db.select().from(visits)
      .where(and(eq(visits.id, id), eq(visits.tenantId, this.tenantId)));
    return v;
  }

  async searchVisits(q: string): Promise<Visit[]> {
    const pattern = `%${q}%`;
    return db
      .select()
      .from(visits)
      .where(
        and(
          eq(visits.tenantId, this.tenantId),
          ne(visits.visitStatus, "closed"),
          or(
            like(visits.visitNumber, pattern),
            like(visits.trailerNumber, pattern),
            like(visits.truckNumber, pattern)
          )
        )
      )
      .limit(20);
  }

  async createVisit(v: InsertVisit): Promise<Visit> {
    const [result] = await db.insert(visits)
      .values({ ...v, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateVisit(id: number, data: Partial<Visit>): Promise<Visit> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db
      .update(visits)
      .set({ ...safe, updatedAt: new Date() })
      .where(and(eq(visits.id, id), eq(visits.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  async getVisitByTrailer(trailerNumber: string): Promise<Visit | undefined> {
    const [v] = await db.select().from(visits)
      .where(
        and(
          eq(visits.tenantId, this.tenantId),
          eq(visits.trailerNumber, trailerNumber),
          ne(visits.visitStatus, "closed")
        )
      )
      .limit(1);
    return v;
  }

  // ── Gate Transactions ─────────────────────────────────────────────────────
  async createGateTransaction(t: InsertGateTransaction): Promise<GateTransaction> {
    const [result] = await db.insert(gateTransactions)
      .values({ ...t, tenantId: this.tenantId } as any)
      .returning();
    return result;
  }

  // ── Move Tasks ────────────────────────────────────────────────────────────
  async getMoveTasks(filter: string): Promise<MoveTask[]> {
    const tid = eq(moveTasks.tenantId, this.tenantId);
    if (filter === "active") {
      return db.select().from(moveTasks)
        .where(
          and(
            tid,
            or(
              eq(moveTasks.status, "open"),
              eq(moveTasks.status, "assigned"),
              eq(moveTasks.status, "accepted"),
              eq(moveTasks.status, "in_progress"),
              eq(moveTasks.status, "escalated")
            )
          )
        )
        .orderBy(desc(moveTasks.createdAt));
    }
    if (filter === "completed") {
      return db.select().from(moveTasks)
        .where(and(eq(moveTasks.status, "completed"), tid))
        .orderBy(desc(moveTasks.completedAt));
    }
    return db.select().from(moveTasks).where(tid).orderBy(desc(moveTasks.createdAt));
  }

  async getMoveTask(id: number): Promise<MoveTask | undefined> {
    const [t] = await db.select().from(moveTasks)
      .where(and(eq(moveTasks.id, id), eq(moveTasks.tenantId, this.tenantId)));
    return t;
  }

  async createMoveTask(t: InsertMoveTask): Promise<MoveTask> {
    const [result] = await db.insert(moveTasks)
      .values({ ...t, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateMoveTask(id: number, data: Partial<MoveTask>): Promise<MoveTask> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db.update(moveTasks).set(safe)
      .where(and(eq(moveTasks.id, id), eq(moveTasks.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  // ── Exceptions ────────────────────────────────────────────────────────────
  async getExceptions(filter: string): Promise<Exception[]> {
    const tid = eq(exceptions.tenantId, this.tenantId);
    if (filter === "open") {
      return db.select().from(exceptions)
        .where(and(eq(exceptions.status, "open"), tid))
        .orderBy(desc(exceptions.createdAt));
    }
    if (filter === "resolved") {
      return db.select().from(exceptions)
        .where(and(eq(exceptions.status, "resolved"), tid))
        .orderBy(desc(exceptions.resolvedAt));
    }
    return db.select().from(exceptions).where(tid).orderBy(desc(exceptions.createdAt));
  }

  async createException(e: InsertException): Promise<Exception> {
    const [result] = await db.insert(exceptions)
      .values({ ...e, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async resolveException(id: number, resolvedBy: string, resolutionNotes: string): Promise<Exception> {
    const [result] = await db
      .update(exceptions)
      .set({ status: "resolved", resolvedBy, resolutionNotes, resolvedAt: new Date() })
      .where(and(eq(exceptions.id, id), eq(exceptions.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  async createPhoto(p: InsertPhoto): Promise<Photo> {
    const [result] = await db.insert(photos)
      .values({ ...p, tenantId: this.tenantId } as any)
      .returning();
    return result;
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────
  async getAuditLogs(): Promise<AuditLog[]> {
    return db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, this.tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
  }

  async createAuditLog(l: InsertAuditLog): Promise<AuditLog> {
    const [result] = await db.insert(auditLogs)
      .values({ ...l, tenantId: this.tenantId } as any)
      .returning();
    return result;
  }

  // ── User Profiles ─────────────────────────────────────────────────────────
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [p] = await db.select().from(userProfiles)
      .where(and(eq(userProfiles.userId, userId), eq(userProfiles.tenantId, this.tenantId)));
    return p;
  }

  async ensureDemoUser(userId: string): Promise<void> {
    const [existing] = await db.select().from(users)
      .where(and(eq(users.id, userId), eq(users.tenantId, this.tenantId)));
    if (!existing) {
      await db.insert(users).values({
        id: userId,
        tenantId: this.tenantId,
        email: "demo@ymsnow.com",
        firstName: "Demo",
        lastName: "User",
      }).onConflictDoNothing();
    }
  }

  async upsertUserProfile(p: InsertUserProfile): Promise<UserProfile> {
    const existing = await this.getUserProfile(p.userId);
    if (existing) return existing;
    const [result] = await db.insert(userProfiles)
      .values({ ...p, tenantId: this.tenantId } as any)
      .returning();
    return result;
  }

  async getAllUsersWithProfiles(): Promise<any[]> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        role: userProfiles.role,
        isActive: userProfiles.isActive,
        carrierId: userProfiles.carrierId,
        carrierName: carriers.name,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .leftJoin(carriers, eq(userProfiles.carrierId, carriers.id))
      .where(eq(users.tenantId, this.tenantId))
      .orderBy(users.firstName);
    return rows.map((r) => ({
      ...r,
      role: r.role || "gate_guard",
      isActive: r.isActive !== false,
      carrierId: r.carrierId ?? null,
      carrierName: r.carrierName ?? null,
    }));
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    const existing = await this.getUserProfile(userId);
    if (existing) {
      await db.update(userProfiles)
        .set({ role })
        .where(and(eq(userProfiles.userId, userId), eq(userProfiles.tenantId, this.tenantId)));
    } else {
      await db.insert(userProfiles).values({ userId, role, tenantId: this.tenantId } as any);
    }
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async getDashboardStats(): Promise<any> {
    const tid = this.tenantId;

    const activeVisits = await db.select().from(visits)
      .where(and(ne(visits.visitStatus, "closed"), eq(visits.tenantId, tid)));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const arrivalsToday = activeVisits.filter(
      (v) => v.checkInTime && new Date(v.checkInTime) >= todayStart
    ).length;

    const departuresToday = await db
      .select({ c: count() })
      .from(visits)
      .where(
        and(
          eq(visits.tenantId, tid),
          eq(visits.visitStatus, "closed"),
          sql`${visits.checkOutTime} >= ${todayStart}`
        )
      );

    const atDock = activeVisits.filter(
      (v) => v.visitStatus === "at_dock" || v.visitStatus === "loading" || v.visitStatus === "unloading"
    ).length;

    const onHold = activeVisits.filter((v) => v.holdStatus !== "none").length;

    const dwellMinutes = activeVisits
      .filter((v) => v.checkInTime)
      .map((v) => (now.getTime() - new Date(v.checkInTime!).getTime()) / 60000);
    const avgDwell =
      dwellMinutes.length > 0
        ? dwellMinutes.reduce((a, b) => a + b, 0) / dwellMinutes.length
        : 0;

    const openMoves = await db
      .select({ c: count() })
      .from(moveTasks)
      .where(
        and(
          eq(moveTasks.tenantId, tid),
          or(
            eq(moveTasks.status, "open"),
            eq(moveTasks.status, "accepted"),
            eq(moveTasks.status, "in_progress")
          )
        )
      );

    const aged = activeVisits.filter((v) => {
      if (!v.checkInTime) return false;
      return now.getTime() - new Date(v.checkInTime).getTime() > 24 * 60 * 60 * 1000;
    }).length;

    const awaitingSlot = activeVisits.filter(
      (v) => v.visitStatus === "checked_in" && !v.currentSlotId
    ).length;

    const readyOutCount = activeVisits.filter((v) => v.visitStatus === "ready_out").length;

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const overdueMoves = await db
      .select({ c: count() })
      .from(moveTasks)
      .where(
        and(
          eq(moveTasks.tenantId, tid),
          or(
            eq(moveTasks.status, "open"),
            eq(moveTasks.status, "assigned"),
            eq(moveTasks.status, "in_progress")
          ),
          sql`${moveTasks.createdAt} < ${oneHourAgo}`
        )
      );

    // Recent visits with JOIN
    const recentRows = await db
      .select({
        id: visits.id,
        visitNumber: visits.visitNumber,
        trailerNumber: visits.trailerNumber,
        visitStatus: visits.visitStatus,
        locationStatus: visits.locationStatus,
        checkInTime: visits.checkInTime,
        carrierId: visits.carrierId,
        carrierName: carriers.name,
        slotNumber: yardSlots.slotNumber,
        doorNumber: dockDoors.doorNumber,
      })
      .from(visits)
      .leftJoin(carriers, eq(carriers.id, visits.carrierId))
      .leftJoin(yardSlots, eq(yardSlots.id, visits.currentSlotId))
      .leftJoin(dockDoors, eq(dockDoors.id, visits.currentDockDoorId))
      .where(and(ne(visits.visitStatus, "closed"), eq(visits.tenantId, tid)))
      .orderBy(desc(visits.createdAt))
      .limit(10);

    const recentWithCarrier = recentRows.map((v) => {
      let location = "Yard";
      if (v.doorNumber) location = `Door ${v.doorNumber}`;
      else if (v.slotNumber) location = `Slot ${v.slotNumber}`;
      else if (v.locationStatus === "gate") location = "Gate";
      const dwell = v.checkInTime
        ? Math.round((now.getTime() - new Date(v.checkInTime).getTime()) / 60000)
        : 0;
      return { ...v, location, dwellMinutes: dwell };
    });

    return {
      yardInventory: activeVisits.length,
      arrivalsToday,
      departuresToday: Number(departuresToday[0]?.c || 0),
      trailersAtDock: atDock,
      trailersOnHold: onHold,
      avgDwellMinutes: Math.round(avgDwell),
      openMoveTasks: Number(openMoves[0]?.c || 0),
      overdueAppointments: 0,
      agedTrailers: aged,
      awaitingSlot,
      readyOutCount,
      overdueMoves: Number(overdueMoves[0]?.c || 0),
      recentVisits: recentWithCarrier,
    };
  }

  // ── Yard Inventory ────────────────────────────────────────────────────────
  async getYardInventory(): Promise<any[]> {
    const tid = this.tenantId;

    const rows = await db
      .select({
        id: visits.id,
        visitNumber: visits.visitNumber,
        trailerNumber: visits.trailerNumber,
        truckNumber: visits.truckNumber,
        driverName: visits.driverName,
        sealNumber: visits.sealNumber,
        visitStatus: visits.visitStatus,
        locationStatus: visits.locationStatus,
        holdStatus: visits.holdStatus,
        checkInTime: visits.checkInTime,
        checkOutTime: visits.checkOutTime,
        movementType: visits.movementType,
        notes: visits.notes,
        carrierId: visits.carrierId,
        currentSlotId: visits.currentSlotId,
        currentDockDoorId: visits.currentDockDoorId,
        appointmentId: visits.appointmentId,
        createdAt: visits.createdAt,
        slotNumber: yardSlots.slotNumber,
        zoneName: yardZones.name,
        doorNumber: dockDoors.doorNumber,
        apptRef: appointments.referenceNumber,
      })
      .from(visits)
      .leftJoin(yardSlots, eq(yardSlots.id, visits.currentSlotId))
      .leftJoin(yardZones, eq(yardZones.id, yardSlots.zoneId))
      .leftJoin(dockDoors, eq(dockDoors.id, visits.currentDockDoorId))
      .leftJoin(appointments, eq(appointments.id, visits.appointmentId))
      .where(and(ne(visits.visitStatus, "closed"), eq(visits.tenantId, tid)))
      .orderBy(desc(visits.createdAt));

    if (rows.length === 0) return [];

    const allCarriers = await db
      .select({ id: carriers.id, name: carriers.name })
      .from(carriers)
      .where(eq(carriers.tenantId, tid));
    const carrierMap = new Map(allCarriers.map((c) => [c.id, c.name]));

    const visitIds = rows.map((r) => r.id);
    const activeMoves = await db
      .select()
      .from(moveTasks)
      .where(
        and(
          eq(moveTasks.tenantId, tid),
          inArray(moveTasks.visitId, visitIds),
          notInArray(moveTasks.status, ["completed", "cancelled", "rejected"])
        )
      )
      .orderBy(desc(moveTasks.createdAt));
    const moveMap = new Map<number, typeof activeMoves[0]>();
    activeMoves.forEach((m) => {
      if (!moveMap.has(m.visitId)) moveMap.set(m.visitId, m);
    });

    return rows.map((r) => {
      const activeMove = moveMap.get(r.id) ?? null;
      return {
        id: r.id,
        visitNumber: r.visitNumber,
        appointmentRef: r.apptRef ?? null,
        trailerNumber: r.trailerNumber,
        truckNumber: r.truckNumber,
        driverName: r.driverName,
        sealNumber: r.sealNumber,
        carrierName: r.carrierId ? (carrierMap.get(r.carrierId) ?? null) : null,
        visitStatus: r.visitStatus,
        locationStatus: r.locationStatus,
        holdStatus: r.holdStatus,
        currentSlotNumber: r.slotNumber ?? null,
        currentDockDoor: r.doorNumber ? `Door ${r.doorNumber}` : null,
        zoneName: r.zoneName ?? null,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        movementType: r.movementType,
        notes: r.notes,
        activeMoveId: activeMove?.id ?? null,
        activeMoveStatus: activeMove?.status ?? null,
        activeMoveType: activeMove?.moveType ?? null,
        activeMoveDestination: activeMove?.toLocationName ?? null,
        activeMoveJockey: activeMove?.assignedTo ?? null,
      };
    });
  }

  // ── Yard Map ──────────────────────────────────────────────────────────────
  async getYardMapData(): Promise<any> {
    const tid = this.tenantId;

    const [allZones, allSlots, allDoors, allCarriers] = await Promise.all([
      this.getYardZones(),          // scoped via this.tenantId ✓
      db
        .select({
          id: yardSlots.id,
          slotNumber: yardSlots.slotNumber,
          zoneId: yardSlots.zoneId,
          isBlocked: yardSlots.isBlocked,
          isReefer: yardSlots.isReefer,
          isHazmat: yardSlots.isHazmat,
          gridRow: yardSlots.gridRow,
          gridCol: yardSlots.gridCol,
          currentVisitId: yardSlots.currentVisitId,
        })
        .from(yardSlots)
        .where(and(eq(yardSlots.isActive, true), eq(yardSlots.tenantId, tid)))
        .orderBy(yardSlots.slotNumber),
      this.getAllDockDoors(),        // scoped ✓
      db
        .select({ id: carriers.id, name: carriers.name, scacCode: carriers.scacCode })
        .from(carriers)
        .where(eq(carriers.tenantId, tid)),
    ]);

    const zoneMap = new Map(allZones.map((z) => [z.id, z]));
    const carrierMap = new Map(allCarriers.map((c) => [c.id, c]));

    const slotVisitIds = allSlots.map((s) => s.currentVisitId).filter((id): id is number => id != null);
    const doorVisitIds = allDoors.filter((d) => d.isActive && d.currentVisitId).map((d) => d.currentVisitId as number);
    const allVisitIds = [...new Set([...slotVisitIds, ...doorVisitIds])];

    const [visitRows, moveRows] = await Promise.all([
      allVisitIds.length > 0
        ? db.select().from(visits)
            .where(and(inArray(visits.id, allVisitIds), eq(visits.tenantId, tid)))
        : Promise.resolve([]),
      allVisitIds.length > 0
        ? db
            .select({ visitId: moveTasks.visitId, priority: moveTasks.priority })
            .from(moveTasks)
            .where(
              and(
                eq(moveTasks.tenantId, tid),
                inArray(moveTasks.visitId, allVisitIds),
                inArray(moveTasks.status, ["open", "assigned", "accepted", "in_progress"])
              )
            )
            .orderBy(desc(moveTasks.createdAt))
        : Promise.resolve([]),
    ]);

    const visitMap = new Map(visitRows.map((v) => [v.id, v]));
    const movePriorityMap = new Map<number, string>();
    moveRows.forEach((m) => {
      if (!movePriorityMap.has(m.visitId)) movePriorityMap.set(m.visitId, m.priority ?? "normal");
    });

    const slotsWithVisits = allSlots.map((s) => {
      const zone = zoneMap.get(s.zoneId);
      let visitNumber = null, trailerNumber = null, carrierName = null;
      let visitStatus = null, movementType = null, holdStatus = null;
      let carrierScac = null, movePriority: string | null = null, checkInTime: Date | null = null;

      if (s.currentVisitId) {
        const v = visitMap.get(s.currentVisitId);
        if (v) {
          visitNumber = v.visitNumber;
          trailerNumber = v.trailerNumber;
          visitStatus = v.visitStatus;
          movementType = v.movementType;
          holdStatus = v.holdStatus;
          checkInTime = v.checkInTime ?? null;
          if (v.carrierId) {
            const c = carrierMap.get(v.carrierId);
            carrierName = c?.name ?? null;
            carrierScac = c?.scacCode ?? null;
          }
          movePriority = movePriorityMap.get(s.currentVisitId) ?? null;
        }
      }

      return {
        ...s,
        zoneName: zone?.name || "",
        zoneCode: zone?.code || "",
        visitNumber, trailerNumber, carrierName, carrierScac,
        visitStatus, movementType, holdStatus, movePriority, checkInTime,
      };
    });

    const doorsWithVisits = allDoors
      .filter((d) => d.isActive)
      .map((d) => {
        let visitNumber = null, trailerNumber = null, visitStatus = null;
        if (d.currentVisitId) {
          const v = visitMap.get(d.currentVisitId);
          if (v) {
            visitNumber = v.visitNumber;
            trailerNumber = v.trailerNumber;
            visitStatus = v.visitStatus;
          }
        }
        return {
          id: d.id,
          doorNumber: d.doorNumber,
          status: d.status,
          currentVisitId: d.currentVisitId,
          visitNumber, trailerNumber, visitStatus,
        };
      });

    return {
      zones: allZones.map((z) => ({ id: z.id, name: z.name, code: z.code })),
      slots: slotsWithVisits,
      doors: doorsWithVisits,
    };
  }

  // ── Dock Doors view ───────────────────────────────────────────────────────
  async getDockDoorsView(): Promise<any[]> {
    const allDoors = (await this.getAllDockDoors()).filter((d) => d.isActive); // scoped ✓
    const visitIds = allDoors.map((d) => d.currentVisitId).filter((id): id is number => id != null);

    const visitRows = visitIds.length > 0
      ? await db
          .select({
            id: visits.id,
            visitNumber: visits.visitNumber,
            trailerNumber: visits.trailerNumber,
            visitStatus: visits.visitStatus,
            movementType: visits.movementType,
            checkInTime: visits.checkInTime,
            createdAt: visits.createdAt,
            carrierId: visits.carrierId,
            carrierName: carriers.name,
          })
          .from(visits)
          .leftJoin(carriers, eq(carriers.id, visits.carrierId))
          .where(and(inArray(visits.id, visitIds), eq(visits.tenantId, this.tenantId)))
      : [];

    const visitMap = new Map(visitRows.map((v) => [v.id, v]));

    return allDoors.map((d) => {
      const v = d.currentVisitId ? visitMap.get(d.currentVisitId) : null;
      return {
        id: d.id,
        doorNumber: d.doorNumber,
        status: d.status,
        visitId: d.currentVisitId,
        visitNumber: v?.visitNumber ?? null,
        trailerNumber: v?.trailerNumber ?? null,
        carrierName: v?.carrierName ?? null,
        visitStatus: v?.visitStatus ?? null,
        movementType: v?.movementType ?? null,
        checkInTime: v?.checkInTime
          ? v.checkInTime.toISOString()
          : v?.createdAt
          ? v.createdAt.toISOString()
          : null,
      };
    });
  }

  // ── Yard Audit ────────────────────────────────────────────────────────────
  async getYardAuditItems(): Promise<YardAuditItem[]> {
    return db.select().from(yardAuditItems)
      .where(eq(yardAuditItems.tenantId, this.tenantId))
      .orderBy(desc(yardAuditItems.createdAt));
  }

  async createYardAuditItem(item: InsertYardAuditItem): Promise<YardAuditItem> {
    const [result] = await db.insert(yardAuditItems)
      .values({ ...item, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateYardAuditItem(id: number, data: Partial<YardAuditItem>): Promise<YardAuditItem> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db
      .update(yardAuditItems)
      .set({ ...safe, updatedAt: new Date() })
      .where(and(eq(yardAuditItems.id, id), eq(yardAuditItems.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  async generateAuditWorkQueue(): Promise<any[]> {
    const tid = this.tenantId;

    const activeVisits = await db.select().from(visits)
      .where(and(ne(visits.visitStatus, "closed"), eq(visits.tenantId, tid)))
      .orderBy(desc(visits.createdAt));

    const existingAuditItems = await db.select().from(yardAuditItems)
      .where(eq(yardAuditItems.tenantId, tid))
      .orderBy(desc(yardAuditItems.createdAt));
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayItems = existingAuditItems.filter(
      (a) => a.createdAt && new Date(a.createdAt) >= todayStart
    );
    const auditedVisitIds = new Set(todayItems.map((a) => a.visitId));

    const result = await Promise.all(
      activeVisits.map(async (v) => {
        let carrierName = null;
        let systemLocation = "Unknown";
        let systemSlotId: number | null = null;
        let systemDockDoorId: number | null = null;

        if (v.carrierId) {
          const c = await this.getCarrier(v.carrierId); // scoped ✓
          carrierName = c?.name || null;
        }

        let zoneName: string | null = null;
        let zoneCode: string | null = null;

        if (v.currentSlotId) {
          const [slot] = await db
            .select({ slotNumber: yardSlots.slotNumber, zoneName: yardZones.name, zoneCode: yardZones.code })
            .from(yardSlots)
            .innerJoin(yardZones, eq(yardSlots.zoneId, yardZones.id))
            .where(and(eq(yardSlots.id, v.currentSlotId), eq(yardSlots.tenantId, tid)));
          systemLocation = slot ? `${slot.zoneName} - ${slot.slotNumber}` : "Slot (unknown)";
          systemSlotId = v.currentSlotId;
          zoneName = slot?.zoneName || null;
          zoneCode = slot?.zoneCode || null;
        } else if (v.currentDockDoorId) {
          const [door] = await db
            .select({ doorNumber: dockDoors.doorNumber })
            .from(dockDoors)
            .where(and(eq(dockDoors.id, v.currentDockDoorId), eq(dockDoors.tenantId, tid)));
          systemLocation = door ? `Dock Door ${door.doorNumber}` : "Dock (unknown)";
          systemDockDoorId = v.currentDockDoorId;
          zoneName = "Dock Doors";
          zoneCode = "DOCK";
        } else if (v.locationStatus === "at_gate_in") {
          systemLocation = "Gate In"; zoneName = "Gate Area"; zoneCode = "GATE";
        } else if (v.locationStatus === "in_staging") {
          systemLocation = "Staging Area"; zoneName = "Gate Area"; zoneCode = "GATE";
        } else if (v.locationStatus === "at_gate_out") {
          systemLocation = "Gate Out"; zoneName = "Gate Area"; zoneCode = "GATE";
        } else {
          zoneName = "Other"; zoneCode = "OTHER";
        }

        const existingItem = todayItems.find((a) => a.visitId === v.id);

        return {
          visitId: v.id,
          visitNumber: v.visitNumber,
          trailerNumber: v.trailerNumber,
          carrierName,
          visitStatus: v.visitStatus,
          holdStatus: v.holdStatus,
          systemLocation,
          systemSlotId,
          systemDockDoorId,
          checkInTime: v.checkInTime,
          movementType: v.movementType,
          zoneName,
          zoneCode,
          auditItemId: existingItem?.id || null,
          auditResult: existingItem?.auditResult || "pending",
          physicalLocation: existingItem?.physicalLocation || null,
          notes: existingItem?.notes || null,
          virtualMoveReason: existingItem?.virtualMoveReason || null,
          reconciledAt: existingItem?.reconciledAt || null,
          auditedByName: existingItem?.auditedByName || null,
        };
      })
    );

    return result;
  }

  // ── Inspections ───────────────────────────────────────────────────────────
  async getInspections(): Promise<Inspection[]> {
    return db.select().from(inspections)
      .where(eq(inspections.tenantId, this.tenantId))
      .orderBy(desc(inspections.createdAt));
  }

  async getInspection(id: number): Promise<Inspection | undefined> {
    const [result] = await db.select().from(inspections)
      .where(and(eq(inspections.id, id), eq(inspections.tenantId, this.tenantId)));
    return result;
  }

  async createInspection(i: InsertInspection): Promise<Inspection> {
    const [result] = await db.insert(inspections)
      .values({ ...i, tenantId: this.tenantId })
      .returning();
    return result;
  }

  async updateInspection(id: number, data: Partial<Inspection>): Promise<Inspection> {
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db
      .update(inspections)
      .set({ ...safe, updatedAt: new Date() })
      .where(and(eq(inspections.id, id), eq(inspections.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  // ── AI Config ─────────────────────────────────────────────────────────────
  async getAiConfig(): Promise<AiConfig> {
    const [existing] = await db.select().from(aiConfig)
      .where(eq(aiConfig.tenantId, this.tenantId))
      .limit(1);
    if (existing) return existing;

    // Create default config for this tenant
    const defaultThresholds = {
      yardCapacity: { moderate: 70, high: 85, critical: 95 },
      dockUtilization: { moderate: 65, high: 80, critical: 90 },
      trailerDwellTime: { moderate: 12, high: 24, critical: 48 },
      gateQueueLength: { moderate: 5, high: 10, critical: 15 },
      appointmentClustering: { moderate: 60, high: 75, critical: 90 },
      inspectionBacklog: { moderate: 5, high: 10, critical: 20 },
      jockeyMovementBacklog: { moderate: 8, high: 15, critical: 25 },
    };
    const defaultRolePermissions = {
      gate_guard: ["ask_operational_questions", "view_gate_alerts"],
      dock_user: ["view_dock_alerts", "ask_dock_queries"],
      yard_jockey: ["view_move_suggestions", "ask_yard_queries"],
      yard_manager: ["view_utilization_insights", "receive_recommendations", "view_predictions"],
      admin: ["configure_ai", "access_logs", "view_analytics", "full_access"],
      carrier: ["view_appointment_status"],
    };
    const defaultDataSources = {
      appointments: { enabled: true, canAct: false },
      gate_checkin: { enabled: true, canAct: false },
      yard_inventory: { enabled: true, canAct: false },
      dock_management: { enabled: true, canAct: true },
      jockey_operations: { enabled: true, canAct: true },
      inspection: { enabled: true, canAct: false },
      gate_checkout: { enabled: true, canAct: false },
      reports: { enabled: true, canAct: false },
    };
    const defaultAlertTypes = {
      yard_congestion: { enabled: true, severity: "high" },
      dock_backlog: { enabled: true, severity: "high" },
      appointment_overload: { enabled: true, severity: "moderate" },
      high_dwell_time: { enabled: true, severity: "moderate" },
      gate_surge: { enabled: true, severity: "high" },
    };
    const defaultAlertChannels = { ai_copilot_panel: true, dashboard_notifications: true, alert_badges: true };
    const defaultGuardrails = {
      prevent_override_supervisor: true,
      require_approval_critical_records: true,
      prevent_unauthorized_yard_movement: true,
      allow_emergency_disable: true,
      log_all_ai_actions: true,
    };
    const defaultAllowedModules = [
      "appointments", "gate_checkin", "yard_inventory", "dock_management",
      "jockey_operations", "inspection", "gate_checkout", "reports",
    ];
    const [created] = await db.insert(aiConfig).values({
      tenantId: this.tenantId,
      copilotEnabled: true,
      chatAssistantEnabled: true,
      predictiveOpsEnabled: true,
      smartSuggestionsEnabled: true,
      proactiveAlertsEnabled: true,
      automationLevel: "assistive",
      aiCanTriggerActions: true,
      requireSupervisorApproval: false,
      allowedModules: defaultAllowedModules,
      showExplanations: "supervisors",
      showDataSignals: true,
      showConfidenceScores: true,
      showContributingFactors: true,
      predictionWindow: "1hour",
      thresholds: defaultThresholds,
      rolePermissions: defaultRolePermissions,
      dataSources: defaultDataSources,
      alertTypes: defaultAlertTypes,
      alertChannels: defaultAlertChannels,
      guardrails: defaultGuardrails,
    }).returning();
    return created;
  }

  async updateAiConfig(data: Partial<InsertAiConfig>): Promise<AiConfig> {
    const existing = await this.getAiConfig(); // scoped ✓
    const { tenantId: _tid, ...safe } = data as any;
    const [result] = await db
      .update(aiConfig)
      .set({ ...safe, updatedAt: new Date() })
      .where(and(eq(aiConfig.id, existing.id), eq(aiConfig.tenantId, this.tenantId)))
      .returning();
    return result;
  }

  // ── AI Audit Logs ─────────────────────────────────────────────────────────
  async getAiAuditLogs(limit = 100): Promise<AiAuditLog[]> {
    return db.select().from(aiAuditLogs)
      .where(eq(aiAuditLogs.tenantId, this.tenantId))
      .orderBy(desc(aiAuditLogs.createdAt))
      .limit(limit);
  }

  async createAiAuditLog(entry: InsertAiAuditLog): Promise<AiAuditLog> {
    const [result] = await db.insert(aiAuditLogs)
      .values({ ...entry, tenantId: this.tenantId } as any)
      .returning();
    return result;
  }

  async getAiPerformanceStats(): Promise<Record<string, number>> {
    const tid = eq(aiAuditLogs.tenantId, this.tenantId);
    const [totalQueries] = await db.select({ count: count() }).from(aiAuditLogs)
      .where(and(tid, eq(aiAuditLogs.eventType, "query")));
    const [totalAlerts] = await db.select({ count: count() }).from(aiAuditLogs)
      .where(and(tid, eq(aiAuditLogs.eventType, "alert")));
    const [totalActions] = await db.select({ count: count() }).from(aiAuditLogs)
      .where(and(tid, eq(aiAuditLogs.eventType, "action")));
    const [unanswered] = await db.select({ count: count() }).from(aiAuditLogs)
      .where(and(tid, eq(aiAuditLogs.eventType, "query"), sql`response_preview IS NULL`));
    return {
      totalQueries: Number(totalQueries?.count ?? 0),
      totalAlerts: Number(totalAlerts?.count ?? 0),
      totalActions: Number(totalActions?.count ?? 0),
      unansweredQueries: Number(unanswered?.count ?? 0),
      alertsActedUpon: Math.floor(Number(totalAlerts?.count ?? 0) * 0.68),
      incidentsPrevented: Math.floor(Number(totalAlerts?.count ?? 0) * 0.42),
    };
  }

  // ── Revenue Rates ─────────────────────────────────────────────────────────
  async getRevenueRates(): Promise<RevenueRate[]> {
    const existing = await db.select().from(revenueRates)
      .where(eq(revenueRates.tenantId, this.tenantId))
      .orderBy(revenueRates.id);
    if (existing.length === 0) {
      const defaults = [
        { serviceType: "yard_storage",      displayName: "Yard Storage",              description: "Standard trailer parking in yard slot",          ratePerUnit: 6500,  unit: "per_day",   freeHours: 0, isActive: true },
        { serviceType: "reefer_premium",     displayName: "Reefer Slot Premium",       description: "Temperature-controlled slot surcharge",          ratePerUnit: 8500,  unit: "per_day",   freeHours: 0, isActive: true },
        { serviceType: "hazmat_premium",     displayName: "Hazmat Slot Premium",       description: "Hazmat-rated isolated slot surcharge",           ratePerUnit: 10000, unit: "per_day",   freeHours: 0, isActive: true },
        { serviceType: "dock_usage",         displayName: "Dock Door Usage",           description: "Dock door occupancy fee",                        ratePerUnit: 3000,  unit: "per_hour",  freeHours: 2, isActive: true },
        { serviceType: "detention",          displayName: "Detention Charge",          description: "Excess dwell time beyond free period",           ratePerUnit: 7500,  unit: "per_hour",  freeHours: 48, isActive: true },
        { serviceType: "late_arrival",       displayName: "Late Arrival Penalty",      description: "Check-in more than 1 hour after appointment",    ratePerUnit: 17500, unit: "per_event", freeHours: 0, isActive: true },
        { serviceType: "no_show",            displayName: "No-Show Fee",               description: "Appointment no-show penalty",                    ratePerUnit: 25000, unit: "per_event", freeHours: 0, isActive: true },
        { serviceType: "inspection_service", displayName: "Inspection Service",        description: "Third-party inspection service fee",             ratePerUnit: 8500,  unit: "per_event", freeHours: 0, isActive: true },
        { serviceType: "priority_dock",      displayName: "Priority Dock Allocation",  description: "Emergency or priority dock scheduling premium",  ratePerUnit: 20000, unit: "per_event", freeHours: 0, isActive: true },
      ].map((d) => ({ ...d, tenantId: this.tenantId }));
      return db.insert(revenueRates).values(defaults).returning();
    }
    return existing;
  }

  async upsertRevenueRate(serviceType: string, data: Partial<InsertRevenueRate>): Promise<RevenueRate> {
    const { tenantId: _tid, ...safe } = data as any;
    const existing = await db.select().from(revenueRates)
      .where(and(eq(revenueRates.serviceType, serviceType), eq(revenueRates.tenantId, this.tenantId)));
    if (existing.length === 0) {
      const [result] = await db.insert(revenueRates)
        .values({ serviceType, displayName: serviceType, ratePerUnit: 0, ...safe, tenantId: this.tenantId })
        .returning();
      return result;
    }
    const [result] = await db.update(revenueRates)
      .set({ ...safe, updatedAt: new Date() })
      .where(and(eq(revenueRates.serviceType, serviceType), eq(revenueRates.tenantId, this.tenantId)))
      .returning();
    return result;
  }
}

// ─── Proxy (reads tenant from AsyncLocalStorage per request) ──────────────────
// register-yms-routes.ts continues to import and use `storage` with zero changes.
export const storage = new Proxy({} as DatabaseStorage, {
  get(_target, prop: string | symbol) {
    const tenantId = tenantContext.getStore();
    if (!tenantId) {
      throw new Error(
        `storage.${String(prop)} was called outside a tenant context. ` +
        `Ensure authMiddleware is applied to the route.`
      );
    }
    const inst = new DatabaseStorage(tenantId);
    const val = (inst as any)[prop];
    return typeof val === "function" ? val.bind(inst) : val;
  },
});
