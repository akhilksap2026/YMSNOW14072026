export * from "./auth";
export * from "./rbac";
export * from "./billing";

import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  serial,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, tenants } from "./auth";

export const userRoleEnum = [
  "admin",
  "yard_manager",
  "gate_guard",
  "yard_jockey",
  "dock_user",
  "carrier",
] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role").notNull().default("gate_guard"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  carrierId: integer("carrier_id"),
});

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
  carrier: one(carriers, {
    fields: [userProfiles.carrierId],
    references: [carriers.id],
  }),
}));

export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  scacCode: varchar("scac_code", { length: 10 }),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  brandColour: varchar("brand_colour", { length: 7 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const carriersRelations = relations(carriers, ({ many }) => ({
  appointments: many(appointments),
}));

export const yardZones = pgTable("yard_zones", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  code: varchar("code", { length: 10 }).notNull(),
  type: text("type").notNull().default("staging"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
});

export const yardZonesRelations = relations(yardZones, ({ many }) => ({
  slots: many(yardSlots),
}));

export const yardSlots = pgTable("yard_slots", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  zoneId: integer("zone_id")
    .notNull()
    .references(() => yardZones.id),
  slotNumber: varchar("slot_number", { length: 20 }).notNull(),
  slotType: text("slot_type").notNull().default("standard"),
  slotSize: text("slot_size").notNull().default("standard"),
  tier: text("tier").notNull().default("standard"),
  isReefer: boolean("is_reefer").notNull().default(false),
  isHazmat: boolean("is_hazmat").notNull().default(false),
  isBlocked: boolean("is_blocked").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  gridRow: integer("grid_row"),
  gridCol: integer("grid_col"),
  currentVisitId: integer("current_visit_id"),
});

export const yardSlotsRelations = relations(yardSlots, ({ one }) => ({
  zone: one(yardZones, {
    fields: [yardSlots.zoneId],
    references: [yardZones.id],
  }),
}));

export const dockDoors = pgTable("dock_doors", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  doorNumber: varchar("door_number", { length: 10 }).notNull(),
  status: text("status").notNull().default("available"),
  compatibleType: text("compatible_type").notNull().default("all"),
  tier: text("tier").notNull().default("standard"),
  isActive: boolean("is_active").notNull().default(true),
  currentVisitId: integer("current_visit_id"),
});

export const gates = pgTable("gates", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("both"),
  isActive: boolean("is_active").notNull().default(true),
});

export const appointmentStatusEnum = [
  "booked",
  "confirmed",
  "rescheduled",
  "cancelled",
  "no_show",
  "completed",
] as const;

export const visitStatusEnum = [
  "expected",
  "arrived",
  "checked_in",
  "in_yard",
  "at_dock",
  "loading",
  "unloading",
  "ready_out",
  "checked_out",
  "closed",
] as const;

export const locationStatusEnum = [
  "at_gate_in",
  "in_staging",
  "in_yard_slot",
  "at_dock_door",
  "at_gate_out",
  "exited",
] as const;

export const holdStatusEnum = [
  "none",
  "documentation_hold",
  "security_hold",
  "damage_hold",
  "seal_mismatch",
  "yard_block",
  "driver_issue",
  "customs_hold",
  "overweight",
] as const;

export const moveTaskStatusEnum = [
  "open",
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
  "rejected",
  "escalated",
] as const;

export const movementTypeEnum = [
  "inbound",
  "outbound",
  "empty_drop",
  "loaded_arrival",
  "live_load",
  "live_unload",
] as const;

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  referenceNumber: varchar("reference_number", { length: 20 }).notNull(),
  carrierId: integer("carrier_id").references(() => carriers.id),
  scheduledDate: timestamp("scheduled_date").notNull(),
  timeWindowStart: text("time_window_start").notNull(),
  timeWindowEnd: text("time_window_end").notNull(),
  movementType: text("movement_type").notNull().default("inbound"),
  loadType: text("load_type"),
  trailerNumber: text("trailer_number"),
  truckNumber: text("truck_number"),
  driverName: text("driver_name"),
  driverPhone: text("driver_phone"),
  poNumber: text("po_number"),
  bolNumber: text("bol_number"),
  sealNumber: text("seal_number"),
  status: text("status").notNull().default("booked"),
  notes: text("notes"),
  carrierEta: text("carrier_eta"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  carrier: one(carriers, {
    fields: [appointments.carrierId],
    references: [carriers.id],
  }),
}));

export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  visitNumber: varchar("visit_number", { length: 20 }).notNull(),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  carrierId: integer("carrier_id").references(() => carriers.id),
  driverName: text("driver_name"),
  driverLicense: text("driver_license"),
  truckNumber: text("truck_number"),
  trailerNumber: text("trailer_number"),
  sealNumber: text("seal_number"),
  movementType: text("movement_type").notNull().default("inbound"),
  visitStatus: text("visit_status").notNull().default("arrived"),
  locationStatus: text("location_status").notNull().default("at_gate_in"),
  holdStatus: text("hold_status").notNull().default("none"),
  currentSlotId: integer("current_slot_id").references(() => yardSlots.id),
  currentDockDoorId: integer("current_dock_door_id").references(() => dockDoors.id),
  gateInId: integer("gate_in_id"),
  gateOutId: integer("gate_out_id"),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  checkInBy: varchar("check_in_by"),
  checkOutBy: varchar("check_out_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const visitsRelations = relations(visits, ({ one, many }) => ({
  appointment: one(appointments, {
    fields: [visits.appointmentId],
    references: [appointments.id],
  }),
  carrier: one(carriers, {
    fields: [visits.carrierId],
    references: [carriers.id],
  }),
  currentSlot: one(yardSlots, {
    fields: [visits.currentSlotId],
    references: [yardSlots.id],
  }),
  currentDockDoor: one(dockDoors, {
    fields: [visits.currentDockDoorId],
    references: [dockDoors.id],
  }),
  moveTasks: many(moveTasks),
  exceptions: many(exceptions),
  photos: many(photos),
}));

export const gateTransactions = pgTable("gate_transactions", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  visitId: integer("visit_id").notNull().references(() => visits.id),
  type: text("type").notNull(),
  gateId: integer("gate_id").references(() => gates.id),
  userId: varchar("user_id"),
  timestamp: timestamp("timestamp").defaultNow(),
  notes: text("notes"),
});

export const moveTasks = pgTable("move_tasks", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  visitId: integer("visit_id").notNull().references(() => visits.id),
  moveType: text("move_type").notNull().default("reposition"),
  fromLocationType: text("from_location_type").notNull(),
  fromLocationId: integer("from_location_id"),
  fromLocationName: text("from_location_name"),
  toLocationType: text("to_location_type").notNull(),
  toLocationId: integer("to_location_id"),
  toLocationName: text("to_location_name"),
  loadStatus: text("load_status"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  assignedTo: varchar("assigned_to"),
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  source: text("source").notNull().default("manual"),
  createdBy: varchar("created_by"),
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const moveTasksRelations = relations(moveTasks, ({ one }) => ({
  visit: one(visits, {
    fields: [moveTasks.visitId],
    references: [visits.id],
  }),
}));

export const exceptions = pgTable("exceptions", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  visitId: integer("visit_id").notNull().references(() => visits.id),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("medium"),
  description: text("description"),
  status: text("status").notNull().default("open"),
  assignedTo: varchar("assigned_to"),
  resolvedBy: varchar("resolved_by"),
  resolutionNotes: text("resolution_notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const exceptionsRelations = relations(exceptions, ({ one }) => ({
  visit: one(visits, {
    fields: [exceptions.visitId],
    references: [visits.id],
  }),
}));

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  visitId: integer("visit_id").references(() => visits.id),
  exceptionId: integer("exception_id").references(() => exceptions.id),
  type: text("type").notNull().default("general"),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name"),
  uploadedBy: varchar("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const photosRelations = relations(photos, ({ one }) => ({
  visit: one(visits, { fields: [photos.visitId], references: [visits.id] }),
  exception: one(exceptions, {
    fields: [photos.exceptionId],
    references: [exceptions.id],
  }),
}));

export const auditResultEnum = [
  "pending",
  "matched",
  "mismatched",
  "missing",
  "extra",
  "reconciled",
] as const;

export const virtualMoveReasonEnum = [
  "audit_mismatch",
  "missed_jockey_update",
  "incorrect_system_slot",
  "wrong_dock_status",
  "manual_reconciliation",
] as const;

export const yardAuditItems = pgTable("yard_audit_items", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  visitId: integer("visit_id").references(() => visits.id),
  trailerNumber: text("trailer_number"),
  systemLocation: text("system_location"),
  systemSlotId: integer("system_slot_id"),
  systemDockDoorId: integer("system_dock_door_id"),
  physicalLocation: text("physical_location"),
  physicalSlotId: integer("physical_slot_id"),
  auditResult: text("audit_result").notNull().default("pending"),
  notes: text("notes"),
  virtualMoveReason: text("virtual_move_reason"),
  virtualMoveNotes: text("virtual_move_notes"),
  reconciledAt: timestamp("reconciled_at"),
  auditedBy: varchar("audited_by"),
  auditedByName: text("audited_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertYardAuditItemSchema = createInsertSchema(yardAuditItems).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertYardAuditItem = z.infer<typeof insertYardAuditItemSchema>;
export type YardAuditItem = typeof yardAuditItems.$inferSelect;

export const inspectionResultEnum = [
  "draft",
  "passed",
  "passed_with_notes",
  "failed",
  "exception_raised",
] as const;

export const inspectionTypeEnum = [
  "gate_inbound",
  "gate_outbound",
  "yard_spot_check",
  "dock_pre_load",
  "reefer_check",
  "hazmat_check",
  "damage_assessment",
] as const;

export const inspections = pgTable("inspections", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  visitId: integer("visit_id").references(() => visits.id),
  inspectionType: text("inspection_type").notNull().default("gate_inbound"),
  trailerNumber: text("trailer_number"),
  containerNumber: text("container_number"),
  carrierName: text("carrier_name"),
  currentLocation: text("current_location"),
  equipmentType: text("equipment_type"),
  shipmentType: text("shipment_type"),
  weather: text("weather"),
  sealNumber: text("seal_number"),
  result: text("result").notNull().default("draft"),
  inspectionStatus: text("inspection_status").notNull().default("pending"),
  checklist: jsonb("checklist"),
  photoUrls: text("photo_urls").array(),
  signatureUrl: text("signature_url"),
  remarks: text("remarks"),
  issueSeverity: text("issue_severity"),
  exceptionId: integer("exception_id"),
  inspectorId: varchar("inspector_id"),
  inspectorName: text("inspector_name"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInspectionSchema = createInsertSchema(inspections).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type Inspection = typeof inspections.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  userId: varchar("user_id"),
  userName: text("user_name"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiConfig = pgTable("ai_config", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  copilotEnabled: boolean("copilot_enabled").default(true).notNull(),
  chatAssistantEnabled: boolean("chat_assistant_enabled").default(true).notNull(),
  predictiveOpsEnabled: boolean("predictive_ops_enabled").default(true).notNull(),
  smartSuggestionsEnabled: boolean("smart_suggestions_enabled").default(true).notNull(),
  proactiveAlertsEnabled: boolean("proactive_alerts_enabled").default(true).notNull(),
  automationLevel: text("automation_level").default("assistive").notNull(),
  aiCanTriggerActions: boolean("ai_can_trigger_actions").default(true).notNull(),
  requireSupervisorApproval: boolean("require_supervisor_approval").default(false).notNull(),
  allowedModules: text("allowed_modules").array(),
  showExplanations: text("show_explanations").default("supervisors").notNull(),
  showDataSignals: boolean("show_data_signals").default(true).notNull(),
  showConfidenceScores: boolean("show_confidence_scores").default(true).notNull(),
  showContributingFactors: boolean("show_contributing_factors").default(true).notNull(),
  predictionWindow: text("prediction_window").default("1hour").notNull(),
  thresholds: jsonb("thresholds"),
  rolePermissions: jsonb("role_permissions"),
  dataSources: jsonb("data_sources"),
  alertTypes: jsonb("alert_types"),
  alertChannels: jsonb("alert_channels"),
  guardrails: jsonb("guardrails"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: text("updated_by"),
});

export const aiAuditLogs = pgTable("ai_audit_logs", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow(),
  userId: text("user_id"),
  userRole: text("user_role"),
  moduleContext: text("module_context"),
  eventType: text("event_type").notNull(),
  query: text("query"),
  responsePreview: text("response_preview"),
  actionTaken: text("action_taken"),
  riskLevel: text("risk_level"),
});

export const insertAiConfigSchema = createInsertSchema(aiConfig).omit({ id: true, tenantId: true });
export const insertAiAuditLogSchema = createInsertSchema(aiAuditLogs).omit({ id: true, tenantId: true, createdAt: true });
export type AiConfig = typeof aiConfig.$inferSelect;
export type InsertAiConfig = z.infer<typeof insertAiConfigSchema>;
export type AiAuditLog = typeof aiAuditLogs.$inferSelect;
export type InsertAiAuditLog = z.infer<typeof insertAiAuditLogSchema>;

export const revenueRates = pgTable("revenue_rates", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  serviceType: text("service_type").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  ratePerUnit: integer("rate_per_unit").notNull(),
  unit: text("unit").notNull().default("per_day"),
  freeHours: integer("free_hours").default(0),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRevenueRateSchema = createInsertSchema(revenueRates).omit({ id: true, tenantId: true });
export type RevenueRate = typeof revenueRates.$inferSelect;
export type InsertRevenueRate = z.infer<typeof insertRevenueRateSchema>;

export const insertCarrierSchema = createInsertSchema(carriers).omit({ id: true, tenantId: true, createdAt: true });
export const insertYardZoneSchema = createInsertSchema(yardZones).omit({ id: true, tenantId: true });
export const insertYardSlotSchema = createInsertSchema(yardSlots).omit({ id: true, tenantId: true });
export const insertDockDoorSchema = createInsertSchema(dockDoors).omit({ id: true, tenantId: true });
export const insertGateSchema = createInsertSchema(gates).omit({ id: true, tenantId: true });
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, tenantId: true, createdAt: true, updatedAt: true });
export const insertVisitSchema = createInsertSchema(visits).omit({ id: true, tenantId: true, createdAt: true, updatedAt: true });
export const insertMoveTaskSchema = createInsertSchema(moveTasks).omit({ id: true, tenantId: true, createdAt: true });
export const insertExceptionSchema = createInsertSchema(exceptions).omit({ id: true, tenantId: true, createdAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true, tenantId: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, tenantId: true, createdAt: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true });
export const insertGateTransactionSchema = createInsertSchema(gateTransactions).omit({ id: true });

export type Carrier = typeof carriers.$inferSelect;
export type InsertCarrier = z.infer<typeof insertCarrierSchema>;
export type YardZone = typeof yardZones.$inferSelect;
export type InsertYardZone = z.infer<typeof insertYardZoneSchema>;
export type YardSlot = typeof yardSlots.$inferSelect;
export type InsertYardSlot = z.infer<typeof insertYardSlotSchema>;
export type DockDoor = typeof dockDoors.$inferSelect;
export type InsertDockDoor = z.infer<typeof insertDockDoorSchema>;
export type Gate = typeof gates.$inferSelect;
export type InsertGate = z.infer<typeof insertGateSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Visit = typeof visits.$inferSelect;
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type MoveTask = typeof moveTasks.$inferSelect;
export type InsertMoveTask = z.infer<typeof insertMoveTaskSchema>;
export type Exception = typeof exceptions.$inferSelect;
export type InsertException = z.infer<typeof insertExceptionSchema>;
export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type GateTransaction = typeof gateTransactions.$inferSelect;
export type InsertGateTransaction = z.infer<typeof insertGateTransactionSchema>;

// ── Email Intelligence ────────────────────────────────────────────────────────

export const carrierContacts = pgTable("carrier_contacts", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  carrierName: text("carrier_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  allowedForEmailIntelligence: boolean("allowed_for_email_intelligence").default(true).notNull(),
});

export const inboundEmailLog = pgTable("inbound_email_log", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  senderEmail: text("sender_email").notNull(),
  subject: text("subject").notNull(),
  emailBody: text("email_body").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  matchedShipmentRef: text("matched_shipment_ref"),
  matchedShipmentId: integer("matched_shipment_id"),
  matchStatus: text("match_status").default("unmatched").notNull(),
  aiSummary: text("ai_summary"),
  aiActionable: text("ai_actionable"),
  aiIntent: text("ai_intent"),
  conflictFlag: boolean("conflict_flag").default(false).notNull(),
  conflictReason: text("conflict_reason"),
  routedSupervisorEmail: text("routed_supervisor_email"),
  status: text("status").default("new").notNull(),
});

export const emailAiAlerts = pgTable("email_ai_alerts", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  inboundEmailId: integer("inbound_email_id").notNull(),
  shipmentId: integer("shipment_id"),
  shipmentRefNo: text("shipment_ref_no"),
  alertTitle: text("alert_title").notNull(),
  alertMessage: text("alert_message").notNull(),
  priority: text("priority").default("medium").notNull(),
  suggestedAction: text("suggested_action"),
  conflictFlag: boolean("conflict_flag").default(false).notNull(),
  conflictReason: text("conflict_reason"),
  supervisorEmailTarget: text("supervisor_email_target"),
  alertStatus: text("alert_status").default("new").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailIntelligenceConfig = pgTable("email_intelligence_config", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  testModeEnabled: boolean("test_mode_enabled").default(true).notNull(),
  fixedTestSupervisorEmail: text("fixed_test_supervisor_email").default("akhil@ksaptech.com").notNull(),
  allowedSenderValidation: boolean("allowed_sender_validation").default(true).notNull(),
  aiConfidenceThreshold: text("ai_confidence_threshold").default("0.70").notNull(),
});

export const insertCarrierContactSchema = createInsertSchema(carrierContacts).omit({ id: true });
export const insertInboundEmailLogSchema = createInsertSchema(inboundEmailLog).omit({ id: true, receivedAt: true });
export const insertEmailAiAlertSchema = createInsertSchema(emailAiAlerts).omit({ id: true, createdAt: true });
export const insertEmailIntelligenceConfigSchema = createInsertSchema(emailIntelligenceConfig).omit({ id: true });

export type CarrierContact = typeof carrierContacts.$inferSelect;
export type InsertCarrierContact = z.infer<typeof insertCarrierContactSchema>;
export type InboundEmailLog = typeof inboundEmailLog.$inferSelect;
export type InsertInboundEmailLog = z.infer<typeof insertInboundEmailLogSchema>;
export type EmailAiAlert = typeof emailAiAlerts.$inferSelect;
export type InsertEmailAiAlert = z.infer<typeof insertEmailAiAlertSchema>;
export type EmailIntelligenceConfig = typeof emailIntelligenceConfig.$inferSelect;
export type InsertEmailIntelligenceConfig = z.infer<typeof insertEmailIntelligenceConfigSchema>;
