export function visitStatusColor(status: string): string {
  switch (status) {
    case "checked_in":
    case "arrived":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "in_yard":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "at_dock":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "loading":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "unloading":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "ready_out":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "checked_out":
    case "closed":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

export function holdStatusColor(hold: string): string {
  if (hold && hold !== "none") {
    return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
  }
  return "";
}

export function appointmentStatusColor(status: string): string {
  switch (status) {
    case "confirmed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "booked":
    case "scheduled":
    case "rescheduled":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "cancelled":
    case "no_show":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "checked_in":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

export function movePriorityColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "high":
    case "dock_waiting":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "normal":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "low":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

export function moveStatusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "accepted":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "assigned":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200";
    case "open":
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "cancelled":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "escalated":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

export function dockStatusColor(status: string): string {
  switch (status) {
    case "available":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "occupied":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200";
    case "maintenance":
      return "bg-gray-200 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300";
    case "loading":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "unloading":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

export function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "high":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "medium":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "low":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

export function exceptionStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "investigating":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "resolved":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

export function activeStatusColor(active: boolean): string {
  return active
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
    : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
}

export function roleColor(role: string): string {
  switch (role) {
    case "admin":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "yard_manager":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200";
    case "gate_guard":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "yard_jockey":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "dock_user":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200";
    case "carrier":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

export function auditEntityColor(entityType: string): string {
  switch (entityType) {
    case "visit":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "appointment":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-200";
    case "carrier":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200";
    case "dock_door":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "move_task":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200";
    case "exception":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "user":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "yard_slot":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "gate":
      return "bg-gray-200 text-gray-700 dark:bg-gray-700/60 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}
