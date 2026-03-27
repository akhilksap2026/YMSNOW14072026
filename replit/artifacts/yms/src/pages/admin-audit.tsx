import { useState, useMemo } from "react";
import { SearchAutocomplete } from "@/components/enterprise/search-autocomplete";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatusChip } from "@/components/enterprise";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { auditEntityColor } from "@/lib/status-colors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList, ChevronDown, ChevronUp, Truck, Building2,
  Package, User, AlertTriangle, Calendar, CheckCircle, Clipboard,
  Activity, Shield, Info, Clock, Hash, Wifi, ArrowDown, ArrowUp,
  ShieldCheck, Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AuditLog } from "@shared/schema";

type SortDir = "asc" | "desc";

function formatAction(a: string): string {
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeAction(action: string, details: any): string {
  const d = details ?? {};
  const trailer = d.trailerNumber ? `trailer ${d.trailerNumber}` : null;
  const visit = d.visitNumber ? `visit ${d.visitNumber}` : null;
  const carrier = d.carrierName || d.name || null;
  const slot = d.slotNumber ? `slot ${d.slotNumber}` : null;
  const subject = trailer || visit || carrier || slot;
  const suffix = subject ? ` — ${subject}` : "";

  const map: Record<string, string> = {
    gate_check_in: `Gate check-in${suffix}`,
    visit_checked_in: `Gate check-in${suffix}`,
    gate_check_out: `Gate check-out${suffix}`,
    visit_checked_out: `Gate check-out${suffix}`,
    visit_created: `Visit created${suffix}`,
    visit_updated: `Visit updated${suffix}`,
    visit_status_changed: `Visit status changed${suffix}`,
    visit_hold_added: `Hold placed${trailer ? ` on ${trailer}` : ""}`,
    visit_hold_removed: `Hold lifted${trailer ? ` on ${trailer}` : ""}`,
    move_task_created: `Move task created${suffix}`,
    move_task_assigned: `Move task assigned${suffix}`,
    move_task_updated: `Move task updated${suffix}`,
    move_task_accepted: `Move task accepted${suffix}`,
    move_task_completed: `Move task completed${suffix}`,
    move_task_rejected: `Move task rejected`,
    slot_assigned: `Slot assigned${slot ? ` — ${slot}` : ""}`,
    dock_assigned: `Dock door assigned${suffix}`,
    dock_start_unloading: `Unloading started${suffix}`,
    dock_start_loading: `Loading started${suffix}`,
    exception_raised: `Exception reported${suffix}`,
    exception_resolved: `Exception resolved${suffix}`,
    carrier_created: `Carrier added${carrier ? ` — ${carrier}` : ""}`,
    carrier_updated: `Carrier updated${carrier ? ` — ${carrier}` : ""}`,
    carrier_deactivated: `Carrier deactivated${carrier ? ` — ${carrier}` : ""}`,
    carrier_activated: `Carrier activated${carrier ? ` — ${carrier}` : ""}`,
    appointment_created: `Appointment scheduled${suffix}`,
    appointment_updated: `Appointment updated${suffix}`,
    appointment_cancelled: `Appointment cancelled${suffix}`,
    inspection_created: `Inspection recorded${suffix}`,
    audit_matched: `Audit matched${suffix}`,
    audit_mismatched: `Audit mismatch${suffix}`,
    user_login: `User signed in`,
    user_logout: `User signed out`,
    reset_to_seed: `Database reset to seed`,
  };

  return map[action] ?? formatAction(action) + suffix;
}

function entityIcon(entityType: string): React.ReactNode {
  const cls = "h-3.5 w-3.5";
  switch (entityType.toLowerCase()) {
    case "visit": return <Truck className={cls} />;
    case "carrier": return <Building2 className={cls} />;
    case "move_task": return <Activity className={cls} />;
    case "exception": return <AlertTriangle className={cls} />;
    case "appointment": return <Calendar className={cls} />;
    case "inspection": return <CheckCircle className={cls} />;
    case "yard_slot": return <Package className={cls} />;
    case "dock_door": return <Clipboard className={cls} />;
    case "user": return <User className={cls} />;
    case "config": return <Shield className={cls} />;
    default: return <Info className={cls} />;
  }
}

const ENTITY_COLORS: Record<string, string> = {
  visit: "#3b82f6",
  carrier: "#8b5cf6",
  move_task: "#f59e0b",
  exception: "#ef4444",
  appointment: "#10b981",
  inspection: "#06b6d4",
  yard_slot: "#f97316",
  dock_door: "#84cc16",
  user: "#ec4899",
  config: "#6b7280",
};

function dotColor(entityType: string): string {
  return ENTITY_COLORS[entityType.toLowerCase()] ?? "#94a3b8";
}

function relativeTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

function isToday(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  return new Date(date).toDateString() === new Date().toDateString();
}

function groupByDate(logs: AuditLog[]): { label: string; items: AuditLog[] }[] {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: Record<string, AuditLog[]> = {};
  for (const log of logs) {
    const ds = log.createdAt ? new Date(log.createdAt).toDateString() : "Unknown";
    const label = ds === today ? "Today" : ds === yesterday ? "Yesterday"
      : new Date(log.createdAt!).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(log);
  }
  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Yard Admin",
  yard_manager: "Yard Supervisor",
  gate_guard: "Gate Operator",
  dock_user: "Dock Operator",
  yard_jockey: "Yard Marshal",
  carrier: "Carrier User",
};

const RBAC_CONTEXT_KEYS = new Set(["role", "module", "workflowOwner", "previousValue", "newValue"]);

function ExpandedDetail({ log }: { log: AuditLog }) {
  const details = log.details && typeof log.details === "object" ? log.details as Record<string, any> : null;
  const rbacRole = details?.role as string | null | undefined;
  const rbacModule = details?.module as string | null | undefined;
  const workflowOwner = details?.workflowOwner as string | null | undefined;
  const prevValue = details?.previousValue as string | null | undefined;
  const newValue = details?.newValue as string | null | undefined;
  const hasRbacContext = rbacRole || rbacModule || workflowOwner;
  const hasTransition = prevValue !== undefined || newValue !== undefined;
  const remainingDetails = details
    ? Object.fromEntries(Object.entries(details).filter(([k]) => !RBAC_CONTEXT_KEYS.has(k)))
    : null;

  return (
    <div className="mx-3 mb-2 rounded-md border bg-muted/30 p-3 text-xs space-y-3" data-testid={`detail-${log.id}`}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="shrink-0">Time</span>
          <span className="font-medium text-foreground ml-auto">
            {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Hash className="h-3 w-3 shrink-0" />
          <span className="shrink-0">Entity ID</span>
          <span className="font-medium text-foreground ml-auto">{log.entityId ?? "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <User className="h-3 w-3 shrink-0" />
          <span className="shrink-0">User</span>
          <span className="font-medium text-foreground ml-auto">{log.userName || "System"}</span>
        </div>
        {log.ipAddress && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Wifi className="h-3 w-3 shrink-0" />
            <span className="shrink-0">IP</span>
            <span className="font-mono font-medium text-foreground ml-auto">{log.ipAddress}</span>
          </div>
        )}
      </div>
      {hasRbacContext && (
        <div className="border-t pt-2.5 space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Access Context
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {rbacRole && (
              <Badge variant="outline" className="gap-1 text-[10px] h-5 border-primary/30 text-primary bg-primary/5">
                <ShieldCheck className="h-2.5 w-2.5" />
                {ROLE_LABELS[rbacRole] ?? rbacRole}
              </Badge>
            )}
            {rbacModule && (
              <Badge variant="outline" className="gap-1 text-[10px] h-5">
                <Layers className="h-2.5 w-2.5" />
                {rbacModule.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </Badge>
            )}
            {workflowOwner && (
              <span className="text-muted-foreground">
                Owner: <span className="font-medium text-foreground">{workflowOwner}</span>
              </span>
            )}
          </div>
          {hasTransition && (
            <div className="flex items-center gap-2 text-[11px]">
              {prevValue ? (
                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900">
                  {prevValue}
                </span>
              ) : (
                <span className="text-muted-foreground italic">—</span>
              )}
              <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg] shrink-0" />
              {newValue ? (
                <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900">
                  {newValue}
                </span>
              ) : (
                <span className="text-muted-foreground italic">—</span>
              )}
            </div>
          )}
        </div>
      )}
      {remainingDetails && Object.keys(remainingDetails).length > 0 && (
        <div className="border-t pt-2.5 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Changed Fields</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {Object.entries(remainingDetails).map(([key, val]) => (
              <div key={key} className="contents">
                <span className="text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}
                </span>
                <span className="font-medium text-foreground break-all" data-testid={`detail-field-${key}`}>
                  {val === null || val === undefined
                    ? <span className="italic text-muted-foreground/50">—</span>
                    : typeof val === "boolean"
                      ? (val ? "Yes" : "No")
                      : typeof val === "object"
                        ? <code className="text-[10px] bg-background px-1 py-0.5 rounded border">{JSON.stringify(val)}</code>
                        : String(val)
                  }
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminAuditPage() {
  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);
  const uniqueEntityTypes = useMemo(() => Array.from(new Set(logs.map((l) => l.entityType))).sort(), [logs]);

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.action) set.add(formatAction(l.action));
      if (l.entityType) set.add(l.entityType);
      if (l.userName) set.add(l.userName);
    });
    return Array.from(set).sort();
  }, [logs]);

  const kpis = useMemo(() => {
    const todayCount = logs.filter((l) => isToday(l.createdAt)).length;
    const uniqueUsers = new Set(logs.filter((l) => l.userId).map((l) => l.userId)).size;
    const entityCounts = logs.reduce((acc, l) => { acc[l.entityType] = (acc[l.entityType] ?? 0) + 1; return acc; }, {} as Record<string, number>);
    const topModule = Object.entries(entityCounts).sort((a, b) => b[1] - a[1])[0];
    return { total: logs.length, today: todayCount, uniqueUsers, topModule };
  }, [logs]);

  const filtered = useMemo(() => {
    let result = [...logs];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        (l.userName || "").toLowerCase().includes(q) ||
        String(l.entityId ?? "").includes(q) ||
        (l.details ? JSON.stringify(l.details).toLowerCase().includes(q) : false)
      );
    }
    if (actionFilter !== "all") result = result.filter((l) => l.action === actionFilter);
    if (entityTypeFilter !== "all") result = result.filter((l) => l.entityType === entityTypeFilter);
    if (dateFrom) { const from = new Date(dateFrom); result = result.filter((l) => l.createdAt && new Date(l.createdAt) >= from); }
    if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); result = result.filter((l) => l.createdAt && new Date(l.createdAt) <= to); }
    return result.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortDir === "desc" ? db - da : da - db;
    });
  }, [logs, search, actionFilter, entityTypeFilter, dateFrom, dateTo, sortDir]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const hasFilter = search || actionFilter !== "all" || entityTypeFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Audit Log"
        subtitle="Complete history of system actions"
        icon={<ClipboardList className="h-5 w-5" />}
      />

      {/* Compact KPI row */}
      <div className="flex items-center gap-4 flex-wrap rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-bold tabular-nums" data-testid="kpi-total">{isLoading ? "—" : kpis.total.toLocaleString()}</span>
          <span className="text-muted-foreground text-xs">total events</span>
        </div>
        <div className="h-4 border-l" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400" data-testid="kpi-today">{isLoading ? "—" : kpis.today}</span>
          <span className="text-muted-foreground text-xs">today</span>
        </div>
        <div className="h-4 border-l" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-bold tabular-nums" data-testid="kpi-users">{isLoading ? "—" : kpis.uniqueUsers}</span>
          <span className="text-muted-foreground text-xs">active users</span>
        </div>
        {kpis.topModule && (
          <>
            <div className="h-4 border-l" />
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground text-xs">most active:</span>
              <span className="font-medium text-xs" data-testid="kpi-top-module">{formatAction(kpis.topModule[0])}</span>
              <span className="text-muted-foreground text-xs">({kpis.topModule[1]})</span>
            </div>
          </>
        )}
        <button
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setSortDir((d) => d === "desc" ? "asc" : "desc")}
          data-testid="sort-toggle"
        >
          {sortDir === "desc" ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
          {sortDir === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <SearchAutocomplete
          value={search}
          onChange={setSearch}
          suggestions={suggestions}
          placeholder="Search logs…"
          className="max-w-[200px]"
          data-testid="input-search"
        />
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[160px]" data-testid="filter-action">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((a) => <SelectItem key={a} value={a}>{formatAction(a)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
          <SelectTrigger className="w-[150px]" data-testid="filter-entity-type">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modules</SelectItem>
            {uniqueEntityTypes.map((t) => <SelectItem key={t} value={t}>{formatAction(t)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[145px]" data-testid="filter-date-from" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[145px]" data-testid="filter-date-to" />
        {hasFilter && (
          <button
            className="text-xs text-muted-foreground hover:text-destructive underline"
            onClick={() => { setSearch(""); setActionFilter("all"); setEntityTypeFilter("all"); setDateFrom(""); setDateTo(""); }}
            data-testid="button-clear-filters"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Timeline feed */}
      <div className="flex-1 min-h-0 rounded-lg border bg-card overflow-y-auto" data-testid="table-audit-logs">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <ClipboardList className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground" data-testid="text-empty-state">No audit entries found</p>
            {hasFilter && (
              <button className="text-xs text-muted-foreground underline" onClick={() => { setSearch(""); setActionFilter("all"); setEntityTypeFilter("all"); setDateFrom(""); setDateTo(""); }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {grouped.map(({ label, items }) => (
              <div key={label}>
                {/* Date group header */}
                <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm px-4 py-1.5 border-b flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                  <span className="text-[10px] text-muted-foreground/60">{items.length} events</span>
                </div>

                {/* Rows */}
                <div className="divide-y">
                  {items.map((log) => {
                    const isExpanded = expandedId === log.id;
                    return (
                      <div key={log.id} data-testid={`row-audit-${log.id}`}>
                        <div
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isExpanded ? "bg-muted/40" : "hover:bg-muted/20"}`}
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          {/* Colored dot */}
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: dotColor(log.entityType) }}
                          />

                          {/* Icon */}
                          <div className="text-muted-foreground shrink-0">
                            {entityIcon(log.entityType)}
                          </div>

                          {/* Description */}
                          <span className="flex-1 text-sm truncate" data-testid={`text-action-${log.id}`}>
                            {humanizeAction(log.action, log.details)}
                          </span>

                          {/* Entity badge */}
                          <StatusChip
                            status={log.entityType}
                            colorFn={auditEntityColor}
                            size="sm"
                            data-testid={`badge-entity-${log.id}`}
                          />

                          {/* User */}
                          <span className="text-xs text-muted-foreground w-28 truncate text-right hidden md:block" data-testid={`text-user-${log.id}`}>
                            {log.userName || "System"}
                          </span>

                          {/* Timestamp */}
                          <span className="text-xs text-muted-foreground w-16 text-right shrink-0 tabular-nums" data-testid={`text-timestamp-${log.id}`}>
                            {relativeTime(log.createdAt)}
                          </span>

                          {/* Expand toggle */}
                          <div className="text-muted-foreground/50 shrink-0">
                            {isExpanded
                              ? <ChevronUp className="h-3.5 w-3.5" />
                              : <ChevronDown className="h-3.5 w-3.5" />
                            }
                          </div>
                        </div>

                        {/* Inline expanded detail */}
                        {isExpanded && <ExpandedDetail log={log} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Footer */}
            <div className="px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
              {filtered.length} events{hasFilter ? " (filtered)" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
