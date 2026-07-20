import { useState, useMemo } from "react";
import { useProductMode, showAIRecommendations } from "@/lib/product-mode";
import { useTabletView } from "@/lib/tablet-view";
import { ExceptionAIInsight } from "@/components/assist/exception-ai-insight";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { severityColor, exceptionStatusColor } from "@/lib/status-colors";
import { HoldTypeBadge } from "@/components/hold-type-badge";
import { PageHeader, StatusChip, DetailDrawer, DrawerSection, DrawerField, EmptyState, FilterToolbar } from "@/components/enterprise";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle2, FileSearch,
  UserCircle, Truck, Clock, ShieldAlert, ShieldCheck, ShieldOff,
} from "lucide-react";
import { useLocation, useSearch } from "wouter";

interface ExceptionView {
  id: number;
  visitId: number;
  visitNumber: string;
  trailerNumber: string | null;
  type: string;
  severity: string;
  description: string | null;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

function formatLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function severityBorder(s: string): string {
  switch (s) {
    case "critical": return "border-l-red-500";
    case "high":     return "border-l-orange-500";
    case "medium":   return "border-l-amber-400";
    case "low":      return "border-l-slate-400";
    default:         return "border-l-border";
  }
}

function exceptionTypeColor(type: string): string {
  switch (type) {
    case "manual_modification": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    case "damage_hold":         return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "seal_mismatch":       return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    case "security_hold":       return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "customs_hold":        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "documentation_hold":  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "driver":              return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
    default:                    return "bg-secondary text-secondary-foreground";
  }
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) { const m = Math.floor(diff / 60000); return `${m}m ago`; }
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isToday(date: string): boolean {
  return new Date(date).toDateString() === new Date().toDateString();
}

export default function ExceptionsPage() {
  const { toast } = useToast();
  const { mode } = useProductMode();
  const { tabletMode } = useTabletView();
  const aiEnabled = showAIRecommendations(mode);
  const [, setLocation] = useLocation();
  const urlSearch = useSearch();
  const [statusFilter, setStatusFilter] = useState("open");
  const [severityFilter, setSeverityFilter] = useState(() => {
    const params = new URLSearchParams(urlSearch);
    return params.get("severity") || "all";
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [selectedException, setSelectedException] = useState<ExceptionView | null>(null);

  const { data: exceptions = [], isLoading } = useQuery<ExceptionView[]>({
    queryKey: ["/api/exceptions/all"],
    refetchInterval: 90000,
    refetchIntervalInBackground: false,
  });

  const resolveMutation = useMutation({
    mutationFn: async (data: { exceptionId: number; resolutionNotes: string }) => {
      const res = await apiRequest("PATCH", `/api/exceptions/${data.exceptionId}/resolve`, {
        resolutionNotes: data.resolutionNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setResolveId(null);
      toast({ title: "Exception resolved", description: "The hold has been lifted." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const uniqueTypes = useMemo(() => Array.from(new Set(exceptions.map((e) => e.type))).sort(), [exceptions]);

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    exceptions.forEach((e) => {
      if (e.visitNumber) set.add(e.visitNumber);
      if (e.trailerNumber) set.add(e.trailerNumber);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [exceptions]);

  const kpis = useMemo(() => {
    const open = exceptions.filter((e) => e.status === "open" || e.status === "investigating");
    const critical = open.filter((e) => e.severity === "critical");
    const unassigned = open.filter((e) => !e.assignedTo);
    const resolvedToday = exceptions.filter((e) => e.status === "resolved" && e.resolvedAt && isToday(e.resolvedAt));
    return { open: open.length, critical: critical.length, unassigned: unassigned.length, resolvedToday: resolvedToday.length };
  }, [exceptions]);

  const filtered = useMemo(() => {
    let result = [...exceptions];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.visitNumber.toLowerCase().includes(q) ||
        e.trailerNumber?.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        String(e.id).includes(q)
      );
    }
    if (statusFilter !== "all") {
      if (statusFilter === "open") result = result.filter((e) => e.status === "open" || e.status === "investigating");
      else result = result.filter((e) => e.status === statusFilter);
    }
    if (severityFilter !== "all") result = result.filter((e) => e.severity === severityFilter);
    if (typeFilter !== "all") result = result.filter((e) => e.type === typeFilter);
    return result.sort((a, b) => {
      const sev = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
      if (sev !== 0) return sev;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [exceptions, statusFilter, severityFilter, typeFilter, search]);

  const handleResolve = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resolveId) return;
    const fd = new FormData(e.currentTarget);
    resolveMutation.mutate({ exceptionId: resolveId, resolutionNotes: fd.get("resolutionNotes") as string });
  };

  const hasFilter = search || statusFilter !== "open" || severityFilter !== "all" || typeFilter !== "all";

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Holds & Exceptions"
        subtitle="Active holds block trailers from leaving or moving. Resolve each one to restore operations."
        icon={<AlertTriangle className="h-5 w-5" />}
      />

      {/* Compact KPI row */}
      <div className="flex items-center gap-4 flex-wrap rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
          <span className="font-bold tabular-nums" data-testid="kpi-open">{isLoading ? "—" : kpis.open}</span>
          <span className="text-xs text-muted-foreground">open</span>
        </div>
        <div className="h-4 border-l" />
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
          <span className="font-bold tabular-nums text-red-600 dark:text-red-400" data-testid="kpi-critical">{isLoading ? "—" : kpis.critical}</span>
          <span className="text-xs text-muted-foreground">critical</span>
        </div>
        <div className="h-4 border-l" />
        <div className="flex items-center gap-1.5">
          <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-bold tabular-nums" data-testid="kpi-unassigned">{isLoading ? "—" : kpis.unassigned}</span>
          <span className="text-xs text-muted-foreground">unassigned</span>
        </div>
        <div className="h-4 border-l" />
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400" data-testid="kpi-resolved-today">{isLoading ? "—" : kpis.resolvedToday}</span>
          <span className="text-xs text-muted-foreground">resolved today</span>
        </div>
        {kpis.open === 0 && !isLoading && (
          <>
            <div className="h-4 border-l" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> All clear — no active holds
            </span>
          </>
        )}
      </div>

      {/* Filters */}
      <FilterToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search exceptions…"
        suggestions={suggestions}
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" aria-label="Filter by status" data-testid="select-exception-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open / Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[130px]" aria-label="Filter by severity" data-testid="select-severity-filter">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]" aria-label="Filter by hold type" data-testid="select-type-filter">
                <SelectValue placeholder="Hold type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueTypes.map((t) => <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        actions={
          <span className="text-xs text-muted-foreground tabular-nums">{filtered.length} exception{filtered.length !== 1 ? "s" : ""}</span>
        }
        filterChips={hasFilter ? [
          ...(search ? [{ label: `Search: "${search}"`, value: "search", onRemove: () => setSearch("") }] : []),
          ...(statusFilter !== "open" ? [{ label: statusFilter === "all" ? "All Statuses" : `Status: ${formatLabel(statusFilter)}`, value: "status", onRemove: () => setStatusFilter("open") }] : []),
          ...(severityFilter !== "all" ? [{ label: `Severity: ${formatLabel(severityFilter)}`, value: "severity", onRemove: () => setSeverityFilter("all") }] : []),
          ...(typeFilter !== "all" ? [{ label: `Type: ${formatLabel(typeFilter)}`, value: "type", onRemove: () => setTypeFilter("all") }] : []),
        ] : []}
        onClearAll={hasFilter ? () => { setSearch(""); setStatusFilter("open"); setSeverityFilter("all"); setTypeFilter("all"); } : undefined}
      />

      {/* Exception cards */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2" data-testid="exceptions-list">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={statusFilter === "open" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <ShieldAlert className="h-5 w-5" />}
            heading={statusFilter === "open" ? "No active holds — all clear" : "No exceptions found"}
            description={
              hasFilter
                ? "No exceptions match your current filters. Try adjusting or clearing them."
                : statusFilter === "open"
                  ? "There are no open or investigating holds at this time."
                  : "No resolved exceptions found for this period."
            }
            action={hasFilter ? {
              label: "Clear filters",
              onClick: () => { setSearch(""); setStatusFilter("open"); setSeverityFilter("all"); setTypeFilter("all"); },
            } : undefined}
            data-testid="text-no-exceptions"
          />
        ) : (
          filtered.map((exc) => (
            <div
              key={exc.id}
              className={`rounded-lg border-l-4 border border-border bg-card px-4 py-3 ${severityBorder(exc.severity)} ${exc.status === "resolved" ? "opacity-60" : ""}`}
              data-testid={`row-exception-${exc.id}`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusChip status={exc.severity} colorFn={severityColor} size="sm" data-testid={`text-severity-${exc.id}`} />
                  <HoldTypeBadge type={exc.type} size="sm" data-testid={`text-type-${exc.id}`} />
                  {statusFilter !== "open" && (
                    <StatusChip status={exc.status} colorFn={exceptionStatusColor} size="sm" data-testid={`text-status-${exc.id}`} />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0" data-testid={`text-created-${exc.id}`}>
                  {relativeTime(exc.createdAt)}
                </span>
              </div>

              {/* Trailer + description */}
              <div className="mt-2 flex items-start gap-2">
                <Truck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" data-testid={`text-trailer-${exc.id}`}>
                      {exc.trailerNumber || "No Trailer"}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono" data-testid={`text-visit-${exc.id}`}>
                      {exc.visitNumber}
                    </span>
                  </div>
                  {exc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" data-testid={`text-description-${exc.id}`}>
                      {exc.description}
                    </p>
                  )}
                </div>
              </div>

              {/* AI Insight (Assist/Optimize mode only) */}
              {aiEnabled && exc.status !== "resolved" && (
                <ExceptionAIInsight exception={exc} />
              )}

              {/* Bottom row */}
              <div className="flex items-center justify-between mt-3 gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-owner-${exc.id}`}>
                  <UserCircle className="h-3.5 w-3.5 shrink-0" />
                  {exc.assignedToName
                    ? <span>{exc.assignedToName}</span>
                    : <span className="italic">Unassigned</span>
                  }
                </div>
                <div className="flex items-center gap-1.5">
                  {exc.status !== "resolved" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setResolveId(exc.id)}
                      data-testid={`button-resolve-${exc.id}`}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                  )}
                  {exc.status === "resolved" && exc.resolvedAt && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Resolved {relativeTime(exc.resolvedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resolve Dialog */}
      <Dialog open={resolveId !== null} onOpenChange={(o) => !o && setResolveId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Resolve Exception #{resolveId}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResolve} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Resolution Notes</Label>
              <Textarea name="resolutionNotes" required className="resize-none" rows={3} placeholder="Describe what was done to resolve this hold…" data-testid="input-resolution" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setResolveId(null)}>Cancel</Button>
              <Button type="submit" disabled={resolveMutation.isPending} data-testid="button-submit-resolve">
                {resolveMutation.isPending ? "Resolving…" : "Mark Resolved"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <DetailDrawer
        open={selectedException !== null}
        onOpenChange={(o) => !o && setSelectedException(null)}
        title={`Exception #${selectedException?.id}`}
        subtitle={`${formatLabel(selectedException?.type || "")} — ${selectedException?.visitNumber}`}
      >
        <div className="space-y-6">
          <DrawerSection title="Details">
            <div className="grid grid-cols-2 gap-4">
              <DrawerField label="Status" value={<StatusChip status={selectedException?.status || ""} colorFn={exceptionStatusColor} />} />
              <DrawerField label="Severity" value={<StatusChip status={selectedException?.severity || ""} colorFn={severityColor} />} />
              <DrawerField label="Trailer" value={selectedException?.trailerNumber || "N/A"} />
              <DrawerField label="Reported" value={selectedException ? new Date(selectedException.createdAt).toLocaleString() : ""} />
            </div>
            <div className="mt-4">
              <DrawerField label="Description" value={selectedException?.description || "No description provided"} />
            </div>
          </DrawerSection>

          <DrawerSection title="Assignment">
            <DrawerField label="Assigned To" value={selectedException?.assignedToName || "Unassigned"} />
          </DrawerSection>

          {selectedException?.status !== "resolved" && (
            <DrawerSection title="Operations Blocked">
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <div className="flex items-start gap-2">
                  <ShieldOff className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-destructive">Hold Active</p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 space-y-0.5">
                      <li>Gate check-out blocked</li>
                      <li>Move task creation blocked</li>
                      <li>Dock assignment blocked</li>
                    </ul>
                  </div>
                </div>
              </div>
            </DrawerSection>
          )}

          {selectedException?.status === "resolved" && (
            <DrawerSection title="Resolution">
              <div className="space-y-3">
                <DrawerField label="Resolved At" value={new Date(selectedException.resolvedAt!).toLocaleString()} />
                <DrawerField label="Notes" value={selectedException.resolutionNotes || "No notes provided"} />
              </div>
            </DrawerSection>
          )}

          <div className="flex gap-2">
            {selectedException?.trailerNumber && (
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setLocation(`/inspections?trailer=${encodeURIComponent(selectedException.trailerNumber || "")}&type=damage_assessment`)}
                data-testid="button-drawer-inspect"
              >
                <FileSearch className="h-4 w-4 mr-2" /> New Inspection
              </Button>
            )}
            {selectedException?.status !== "resolved" && (
              <Button
                className="flex-1"
                onClick={() => { setResolveId(selectedException!.id); setSelectedException(null); }}
                data-testid="button-drawer-resolve"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" /> Resolve
              </Button>
            )}
          </div>
        </div>
      </DetailDrawer>
    </div>
  );
}
