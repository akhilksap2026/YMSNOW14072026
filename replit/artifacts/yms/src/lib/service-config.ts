export const SERVICE_COLORS: Record<string, string> = {
  yard_storage: "#3b82f6",
  reefer_premium: "#8b5cf6",
  hazmat_premium: "#ef4444",
  dock_usage: "#f59e0b",
  detention: "#f97316",
  late_arrival: "#ec4899",
  no_show: "#6b7280",
  inspection_service: "#10b981",
  priority_dock: "#06b6d4",
};

export const BILLING_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Pending" },
  billed: { color: "bg-green-100 text-green-700 border-green-200", label: "Billed" },
  waived: { color: "bg-slate-100 text-slate-600 border-slate-200", label: "Waived" },
};

export const UNIT_LABELS: Record<string, string> = {
  per_day: "/ day",
  per_hour: "/ hr",
  per_event: "/ event",
};
