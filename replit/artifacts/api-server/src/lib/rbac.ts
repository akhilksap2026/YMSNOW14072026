import { db } from "../db";
import { roles, userRoles, permissions, rolePermissions, userProfiles } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const ROLE_LEVEL_MAP: Record<string, number> = {
  admin: 100,
  yard_manager: 80,
  gate_guard: 60,
  dock_user: 60,
  yard_jockey: 50,
  carrier: 20,
};

export function isSupervisor(role: string): boolean {
  return role === "admin" || role === "yard_manager";
}

export function hasRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_LEVEL_MAP[userRole] ?? 0;
  const reqLevel = ROLE_LEVEL_MAP[requiredRole] ?? 999;
  return userLevel >= reqLevel;
}

type PermType = "canView" | "canCreate" | "canModify" | "canExecute" | "canApprove";

const STATIC_MATRIX: Record<string, Record<string, Record<PermType, boolean>>> = {
  admin: {
    appointments:  { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    gate:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    dock:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    yard_slot:     { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    move:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    hold:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    ready_to_go:   { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    reports:       { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    user_mgmt:     { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    role_mgmt:     { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
  },
  yard_manager: {
    appointments:  { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    gate:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    dock:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    yard_slot:     { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    move:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    hold:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    ready_to_go:   { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: true },
    reports:       { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    user_mgmt:     { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    role_mgmt:     { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
  },
  gate_guard: {
    appointments:  { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    gate:          { canView: true,  canCreate: true,  canModify: false, canExecute: true,  canApprove: false },
    dock:          { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    yard_slot:     { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    move:          { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    hold:          { canView: true,  canCreate: true,  canModify: false, canExecute: false, canApprove: false },
    ready_to_go:   { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    reports:       { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    user_mgmt:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    role_mgmt:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
  },
  dock_user: {
    appointments:  { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    gate:          { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    dock:          { canView: true,  canCreate: true,  canModify: true,  canExecute: true,  canApprove: false },
    yard_slot:     { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    move:          { canView: true,  canCreate: true,  canModify: false, canExecute: false, canApprove: false },
    hold:          { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    ready_to_go:   { canView: true,  canCreate: false, canModify: false, canExecute: true,  canApprove: false },
    reports:       { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    user_mgmt:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    role_mgmt:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
  },
  yard_jockey: {
    appointments:  { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    gate:          { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    dock:          { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    yard_slot:     { canView: true,  canCreate: false, canModify: true,  canExecute: true,  canApprove: false },
    move:          { canView: true,  canCreate: false, canModify: true,  canExecute: true,  canApprove: false },
    hold:          { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    ready_to_go:   { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    reports:       { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    user_mgmt:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    role_mgmt:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
  },
  carrier: {
    appointments:  { canView: true,  canCreate: false, canModify: false, canExecute: false, canApprove: false },
    gate:          { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    dock:          { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    yard_slot:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    move:          { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    hold:          { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    ready_to_go:   { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    reports:       { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    user_mgmt:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
    role_mgmt:     { canView: false, canCreate: false, canModify: false, canExecute: false, canApprove: false },
  },
};

export async function getPermissionsForRole(
  roleKey: string,
): Promise<Record<string, Record<string, boolean>>> {
  const matrix = STATIC_MATRIX[roleKey];
  if (matrix) {
    const flat: Record<string, Record<string, boolean>> = {};
    for (const [mod, perms] of Object.entries(matrix)) {
      flat[mod] = {};
      for (const [k, v] of Object.entries(perms)) {
        flat[mod][k] = v as boolean;
      }
    }
    return flat;
  }
  return {};
}

export function checkPermission(
  role: string,
  module: string,
  permType: PermType,
): boolean {
  return STATIC_MATRIX[role]?.[module]?.[permType] ?? false;
}

export function requirePermission(module: string, permType: PermType) {
  return (req: any, res: any, next: any) => {
    const role: string = (req.headers["x-user-role"] as string) || "viewer";
    if (!checkPermission(role, module, permType)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action. Please contact the Yard Supervisor.",
        module,
        required: permType,
        role,
      });
    }
    next();
  };
}

export async function getRolesFromDb() {
  return db.select().from(roles).orderBy(roles.roleLevel);
}

export async function getPermissionsFromDb() {
  return db.select().from(permissions).orderBy(permissions.moduleName, permissions.actionName);
}

export async function getRolePermissionsFromDb(roleId: number) {
  return db
    .select({
      id: rolePermissions.id,
      roleId: rolePermissions.roleId,
      permissionId: rolePermissions.permissionId,
      moduleName: permissions.moduleName,
      actionName: permissions.actionName,
      canView: rolePermissions.canView,
      canCreate: rolePermissions.canCreate,
      canModify: rolePermissions.canModify,
      canExecute: rolePermissions.canExecute,
      canApprove: rolePermissions.canApprove,
    })
    .from(rolePermissions)
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));
}

export async function getUserRolesFromDb(userId: string) {
  return db
    .select({ role: roles })
    .from(userRoles)
    .leftJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
}

export function getWorkflowOwner(visitStatus: string): string {
  switch (visitStatus) {
    case "expected":   return "Carrier";
    case "arrived":
    case "checked_in": return "Gate Operator";
    case "in_yard":    return "Yard Marshal";
    case "at_dock":
    case "loading":
    case "unloading":  return "Dock Operator";
    case "ready_out":  return "Yard Supervisor";
    case "checked_out":
    case "closed":     return "Gate Operator";
    default:           return "Yard Admin";
  }
}
