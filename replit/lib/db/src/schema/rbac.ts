import { pgTable, text, varchar, integer, boolean, timestamp, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, tenants } from "./auth";

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  roleName: text("role_name").notNull().unique(),
  roleDescription: text("role_description"),
  roleLevel: integer("role_level").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  tenantId: text("tenant_id").references(() => tenants.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  roleId: integer("role_id").notNull().references(() => roles.id),
  assignedBy: varchar("assigned_by"),
  assignedAt: timestamp("assigned_at").defaultNow(),
  isPrimary: boolean("is_primary").notNull().default(true),
}, (t) => [unique("user_roles_user_role_unique").on(t.userId, t.roleId)]);

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  moduleName: text("module_name").notNull(),
  actionName: text("action_name").notNull(),
  description: text("description"),
}, (t) => [unique("permissions_module_action_unique").on(t.moduleName, t.actionName)]);

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => roles.id),
  permissionId: integer("permission_id").notNull().references(() => permissions.id),
  canView: boolean("can_view").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canModify: boolean("can_modify").notNull().default(false),
  canExecute: boolean("can_execute").notNull().default(false),
  canApprove: boolean("can_approve").notNull().default(false),
}, (t) => [unique("role_permissions_role_perm_unique").on(t.roleId, t.permissionId)]);

export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, assignedAt: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({ id: true });

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UserRoleAssignment = typeof userRoles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
