/**
 * Billing / entitlement schema.
 *
 * Tables: modules, plans, plan_modules, subscriptions, tenant_module_overrides
 *
 * Scope note: no Stripe fields. No resolver/middleware yet.
 * These tables are the catalog + tenant subscription record only.
 */
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  serial,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { tenants } from "./auth";

// ── Feature module catalog ────────────────────────────────────────────────────
export const modules = pgTable("modules", {
  id:          serial("id").primaryKey(),
  code:        text("code").notNull().unique(),
  name:        text("name").notNull(),
  category:    text("category").notNull(),
  description: text("description"),
});

// ── Plan catalog ──────────────────────────────────────────────────────────────
export const plans = pgTable("plans", {
  id:          serial("id").primaryKey(),
  code:        text("code").notNull().unique(),
  name:        text("name").notNull(),
  description: text("description"),
});

// ── Plan → module mapping ─────────────────────────────────────────────────────
export const planModules = pgTable("plan_modules", {
  id:       serial("id").primaryKey(),
  planId:   integer("plan_id").notNull().references(() => plans.id),
  moduleId: integer("module_id").notNull().references(() => modules.id),
  // Optional usage limits per module (e.g. { seats: 5, apiCallsPerDay: 1000 })
  limits:   jsonb("limits"),
}, (t) => [
  unique("plan_modules_plan_module_unique").on(t.planId, t.moduleId),
]);

// ── Tenant subscription record ────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id:               serial("id").primaryKey(),
  tenantId:         text("tenant_id").notNull().references(() => tenants.id),
  planId:           integer("plan_id").notNull().references(() => plans.id),
  /** active | trialing | suspended | expired */
  status:           text("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialEnd:         timestamp("trial_end"),
  seats:            integer("seats"),
  createdAt:        timestamp("created_at").defaultNow(),
  updatedAt:        timestamp("updated_at").defaultNow(),
});

// ── Per-tenant module overrides (enable/disable individual modules) ────────────
export const tenantModuleOverrides = pgTable("tenant_module_overrides", {
  id:        serial("id").primaryKey(),
  tenantId:  text("tenant_id").notNull().references(() => tenants.id),
  moduleId:  integer("module_id").notNull().references(() => modules.id),
  enabled:   boolean("enabled").notNull(),
  reason:    text("reason"),
  expiresAt: timestamp("expires_at"),
}, (t) => [
  unique("tmo_tenant_module_unique").on(t.tenantId, t.moduleId),
]);

// ── TypeScript types ──────────────────────────────────────────────────────────
export type Module               = typeof modules.$inferSelect;
export type Plan                 = typeof plans.$inferSelect;
export type PlanModule           = typeof planModules.$inferSelect;
export type Subscription         = typeof subscriptions.$inferSelect;
export type TenantModuleOverride = typeof tenantModuleOverrides.$inferSelect;
