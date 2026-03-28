import { useState, useMemo } from "react";
import { SearchAutocomplete } from "@/components/enterprise/search-autocomplete";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, StatusChip, EmptyState } from "@/components/enterprise";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, PackagePlus, RefreshCcw,
  ArrowRightLeft, MapPin, ChevronRight, ExternalLink,
  FileSearch, ClipboardList, SortAsc, CheckCheck,
} from "lucide-react";
import { useLocation } from "wouter";

interface AuditSummary {
  totalAssets: number;
  matched: number;
  mismatched: number;
  missing: number;
  extra: number;
  reconciled: number;
}

interface AuditQueueItem {
  visitId: number;
  visitNumber: string;
  trailerNumber: string | null;
  carrierName: string | null;
  visitStatus: string;
  holdStatus: string;
  systemLocation: string;
  systemSlotId: number | null;
  systemDockDoorId: number | null;
  checkInTime: string | null;
  movementType: string;
  zoneName: string | null;
  zoneCode: string | null;
  auditItemId: number | null;
  auditResult: string;
  physicalLocation: string | null;
  notes: string | null;
  virtualMoveReason: string | null;
  reconciledAt: string | null;
  auditedByName: string | null;
}

interface AvailableSlot {
  id: number;
  slotNumber: string;
  zoneName: string;
}

type FilterTab = "all" | "pending" | "matched" | "mismatched" | "missing" | "extra" | "reconciled";
type SortKey = "location" | "hold" | "carrier" | "checkin" | "movement";

const VIRTUAL_MOVE_REASONS = [
  { value: "audit_mismatch", label: "Audit Mismatch" },
  { value: "missed_jockey_update", label: "Missed Jockey Update" },
  { value: "incorrect_system_slot", label: "Incorrect System Slot" },
  { value: "wrong_dock_status", label: "Wrong Dock Status" },
  { value: "manual_reconciliation", label: "Manual Reconciliation" },
];

const MISMATCH_REASONS = [
  { value: "incorrect_location", label: "Incorrect Location" },
  { value: "duplicate_asset", label: "Duplicate Asset" },
  { value: "wrong_trailer_number", label: "Wrong Trailer Number" },
  { value: "seal_mismatch", label: "Seal Mismatch" },
  { value: "other", label: "Other (see notes)" },
];

function auditResultColor(result: string): string {
  switch (result) {
    case "matched": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "mismatched": return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "missing": return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "extra": return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "reconciled": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    default: return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

function auditResultLabel(result: string): string {
  switch (result) {
    case "matched": return "Matched";
    case "mismatched": return "Mismatched";
    case "missing": return "Missing";
    case "extra": return "Extra Asset";
    case "reconciled": return "Reconciled";
    default: return "Pending";
  }
}

function auditResultIcon(result: string) {
  switch (result) {
    case "matched": return CheckCircle2;
    case "mismatched": return XCircle;
    case "missing": return AlertTriangle;
    case "extra": return PackagePlus;
    case "reconciled": return RefreshCcw;
    default: return ClipboardList;
  }
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function movementLabel(type: string): string {
  const map: Record<string, string> = {
    inbound: "Inbound", outbound: "Outbound", live_load: "Live Load",
    live_unload: "Live Unload", drop: "Drop", pick: "Pick",
  };
  return map[type] || type;
}

function holdLabel(hold: string): string {
  if (!hold || hold === "none") return "";
  return hold.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ZoneInfo {
  code: string;
  name: string;
  total: number;
  pending: number;
  completed: number;
  hasIssues: boolean;
}

function useZones(workQueue: AuditQueueItem[]): ZoneInfo[] {
  return useMemo<ZoneInfo[]>(() => {
    const map = new Map<string, ZoneInfo>();
    for (const item of workQueue) {
      const code = item.zoneCode || "OTHER";
      const name = item.zoneName || "Other";
      if (!map.has(code)) map.set(code, { code, name, total: 0, pending: 0, completed: 0, hasIssues: false });
      const z = map.get(code)!;
      z.total++;
      if (item.auditResult === "pending") z.pending++;
      else z.completed++;
      if (item.auditResult === "mismatched" || item.auditResult === "missing") z.hasIssues = true;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [workQueue]);
}

function SummaryStrip({ summary, isLoading }: { summary?: AuditSummary; isLoading: boolean }) {
  const items = [
    { label: "Total", value: summary?.totalAssets ?? 0, icon: ClipboardCheck, color: "text-foreground", testId: "total-assets" },
    { label: "Matched", value: summary?.matched ?? 0, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", testId: "matched" },
    { label: "Mismatched", value: summary?.mismatched ?? 0, icon: XCircle, color: "text-red-600 dark:text-red-400", testId: "mismatched" },
    { label: "Missing", value: summary?.missing ?? 0, icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", testId: "missing-in-yard" },
    { label: "Extra", value: summary?.extra ?? 0, icon: PackagePlus, color: "text-blue-600 dark:text-blue-400", testId: "extra-assets" },
    { label: "Reconciled", value: summary?.reconciled ?? 0, icon: RefreshCcw, color: "text-emerald-600 dark:text-emerald-400", testId: "reconciled-today" },
  ];
  return (
    <div className="flex items-center gap-1 flex-wrap shrink-0">
      {isLoading
        ? [...Array(6)].map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-md" />)
        : items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-card">
            <item.icon className={`h-3.5 w-3.5 shrink-0 ${item.color}`} />
            <span className="text-sm font-bold tabular-nums" data-testid={`text-audit-${item.testId}`}>{item.value}</span>
            <span className="text-[11px] text-muted-foreground">{item.label}</span>
          </div>
        ))
      }
    </div>
  );
}

function DetailPanel({
  item,
  markMutation,
  markNotes,
  setMarkNotes,
  mismatchReason,
  setMismatchReason,
  handleMarkResult,
  handleOpenVirtualMove,
  setLocation,
}: {
  item: AuditQueueItem | null;
  markMutation: any;
  markNotes: string;
  setMarkNotes: (v: string) => void;
  mismatchReason: string;
  setMismatchReason: (v: string) => void;
  handleMarkResult: (item: AuditQueueItem, result: string) => void;
  handleOpenVirtualMove: (item: AuditQueueItem) => void;
  setLocation: (path: string) => void;
}) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12 gap-4 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20" data-testid="detail-empty-state">
        <ClipboardCheck className="h-12 w-12 text-muted-foreground/20" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">No item selected</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Select a trailer from the inventory list to view its details and perform audit actions.</p>
        </div>
      </div>
    );
  }

  const hasHold = item.holdStatus && item.holdStatus !== "none";
  const isPending = item.auditResult === "pending";
  const isMismatched = item.auditResult === "mismatched";
  const isActioned = !isPending && !isMismatched;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto" data-testid="detail-panel">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold font-mono" data-testid="text-detail-trailer">
              {item.trailerNumber || "No Trailer"}
            </h2>
            <StatusChip
              status={item.auditResult}
              colorFn={auditResultColor}
              label={auditResultLabel(item.auditResult)}
            />
            {hasHold && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                HOLD — {holdLabel(item.holdStatus)}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{item.visitNumber}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => setLocation("/yard/inventory")}
            data-testid="button-view-inventory"
          >
            <ExternalLink className="h-3 w-3 mr-1" /> Inventory
          </Button>
          <Button
            variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => setLocation(`/inspections?visitId=${item.visitId}&trailer=${encodeURIComponent(item.trailerNumber || "")}&carrier=${encodeURIComponent(item.carrierName || "")}&type=yard_spot_check`)}
            data-testid="button-start-inspection"
          >
            <FileSearch className="h-3 w-3 mr-1" /> Inspect
          </Button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border bg-card p-3 space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Asset Details</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">Carrier</p>
              <p className="font-medium text-xs mt-0.5" data-testid="text-detail-carrier">{item.carrierName || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Movement</p>
              <p className="font-medium text-xs mt-0.5">{movementLabel(item.movementType)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Visit Status</p>
              <p className="font-medium text-xs mt-0.5 capitalize">{item.visitStatus.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Check-In</p>
              <p className="font-medium text-xs mt-0.5" data-testid="text-detail-checkin">{formatTimeAgo(item.checkInTime)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-card p-3 space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Location</p>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground">System Location</p>
              <p className="font-medium text-xs mt-0.5 flex items-center gap-1" data-testid="text-detail-system-location">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                {item.systemLocation}
              </p>
            </div>
            {item.zoneName && (
              <div>
                <p className="text-[10px] text-muted-foreground">Zone</p>
                <p className="font-medium text-xs mt-0.5" data-testid="text-detail-zone">{item.zoneName}</p>
              </div>
            )}
            {item.physicalLocation && (
              <div>
                <p className="text-[10px] text-muted-foreground">Physical Location</p>
                <p className="font-medium text-xs mt-0.5 text-amber-700 dark:text-amber-400">{item.physicalLocation}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Previous Audit Info */}
      {item.auditItemId && (
        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Audit Record</p>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {item.auditedByName && (
              <div>
                <p className="text-[10px] text-muted-foreground">Audited By</p>
                <p className="font-medium mt-0.5">{item.auditedByName}</p>
              </div>
            )}
            {item.reconciledAt && (
              <div>
                <p className="text-[10px] text-muted-foreground">Reconciled</p>
                <p className="font-medium mt-0.5">{new Date(item.reconciledAt).toLocaleString()}</p>
              </div>
            )}
            {item.virtualMoveReason && (
              <div>
                <p className="text-[10px] text-muted-foreground">Virtual Move</p>
                <p className="font-medium mt-0.5">{VIRTUAL_MOVE_REASONS.find((r) => r.value === item.virtualMoveReason)?.label || item.virtualMoveReason}</p>
              </div>
            )}
          </div>
          {item.notes && (
            <div className="mt-1.5 pt-1.5 border-t">
              <p className="text-[10px] text-muted-foreground">Notes</p>
              <p className="mt-0.5 text-muted-foreground italic">{item.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ===== ACTION ZONE ===== */}
      {isPending && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-3" data-testid="action-zone">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Audit Actions</p>

          {/* Quick Actions Row */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3"
              onClick={() => handleMarkResult(item, "matched")}
              disabled={markMutation.isPending}
              data-testid="button-detail-match"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Mark Matched
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-8 px-3 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-700 dark:hover:bg-amber-900/30"
              onClick={() => handleMarkResult(item, "missing")}
              disabled={markMutation.isPending}
              data-testid="button-detail-missing"
            >
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
              Mark Missing
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-8 px-3 text-blue-700 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/30"
              onClick={() => handleMarkResult(item, "extra")}
              disabled={markMutation.isPending}
              data-testid="button-detail-extra"
            >
              <PackagePlus className="h-3.5 w-3.5 mr-1.5" />
              Mark Extra
            </Button>
          </div>

          {/* Mismatch Section */}
          <div className="space-y-2 border-t pt-2.5">
            <p className="text-[10px] font-medium text-muted-foreground">Report Mismatch</p>
            <div className="flex gap-2 flex-wrap">
              <Select value={mismatchReason} onValueChange={setMismatchReason}>
                <SelectTrigger className="h-8 flex-1 min-w-[180px] text-xs border-red-200 dark:border-red-900" data-testid="select-mismatch-reason">
                  <SelectValue placeholder="Select mismatch reason…" />
                </SelectTrigger>
                <SelectContent>
                  {MISMATCH_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm" variant="destructive" className="h-8 px-3 shrink-0"
                onClick={() => handleMarkResult(item, "mismatched")}
                disabled={markMutation.isPending}
                data-testid="button-detail-mismatch"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Mark Mismatched
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 border-t pt-2.5">
            <label className="text-[10px] font-medium text-muted-foreground">Notes (optional)</label>
            <Textarea
              placeholder="Describe the discrepancy or observation…"
              value={markNotes}
              onChange={(e) => setMarkNotes(e.target.value)}
              className="h-16 text-xs resize-none"
              data-testid="input-audit-notes"
            />
          </div>
        </div>
      )}

      {/* Mismatched — Virtual Move CTA */}
      {isMismatched && (
        <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-900/10 p-3 space-y-2.5" data-testid="action-zone-mismatch">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Location Mismatch Detected</p>
          </div>
          <p className="text-xs text-muted-foreground">
            The system shows this trailer at <strong>{item.systemLocation}</strong>, but a discrepancy was recorded during audit. Create a virtual move to reconcile the system with the physical yard.
          </p>
          <Button
            size="sm"
            className="w-full h-8"
            onClick={() => handleOpenVirtualMove(item)}
            data-testid="button-detail-virtual-move"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
            Create Virtual Move to Reconcile
          </Button>
          {item.notes && (
            <div className="text-xs border-t pt-2.5 text-muted-foreground">
              <span className="font-medium">Mismatch note:</span> {item.notes}
            </div>
          )}
        </div>
      )}

      {/* Completed state */}
      {isActioned && (
        <div className={`rounded-md border p-3 space-y-1 ${
          item.auditResult === "reconciled"
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/10"
            : "bg-muted/20"
        }`}>
          <div className="flex items-center gap-2">
            {item.auditResult === "matched" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            {item.auditResult === "reconciled" && <RefreshCcw className="h-4 w-4 text-emerald-600" />}
            {item.auditResult === "missing" && <AlertTriangle className="h-4 w-4 text-amber-600" />}
            {item.auditResult === "extra" && <PackagePlus className="h-4 w-4 text-blue-600" />}
            <p className="text-sm font-semibold">{auditResultLabel(item.auditResult)}</p>
          </div>
          {item.reconciledAt && (
            <p className="text-xs text-muted-foreground">Recorded {new Date(item.reconciledAt).toLocaleString()}</p>
          )}
          {item.auditedByName && (
            <p className="text-xs text-muted-foreground">By {item.auditedByName}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function YardAuditPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedItem, setSelectedItem] = useState<AuditQueueItem | null>(null);
  const [virtualMoveOpen, setVirtualMoveOpen] = useState(false);
  const [vmReason, setVmReason] = useState("");
  const [vmNotes, setVmNotes] = useState("");
  const [vmPhysicalSlotId, setVmPhysicalSlotId] = useState("");
  const [vmPhysicalLocation, setVmPhysicalLocation] = useState("");
  const [markNotes, setMarkNotes] = useState("");
  const [mismatchReason, setMismatchReason] = useState("");
  const [selectedZones, setSelectedZones] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("location");
  const [bulkMatchOpen, setBulkMatchOpen] = useState(false);
  const [selectedVisitIds, setSelectedVisitIds] = useState<Set<number>>(new Set());

  const { data: summary, isLoading: summaryLoading } = useQuery<AuditSummary>({ queryKey: ["/api/yard-audit/summary"] });
  const { data: workQueue = [], isLoading: queueLoading } = useQuery<AuditQueueItem[]>({ queryKey: ["/api/yard-audit/work-queue"] });
  const { data: availableSlots } = useQuery<AvailableSlot[]>({ queryKey: ["/api/yard/available-slots-all"] });

  const zones = useZones(workQueue);

  const markMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/yard-audit/mark", data); },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Audit recorded", description: "Asset audit result has been saved." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkMarkMutation = useMutation({
    mutationFn: async (items: AuditQueueItem[]) => {
      await Promise.all(items.map((item) => apiRequest("POST", "/api/yard-audit/mark", {
        visitId: item.visitId, auditResult: "matched",
        systemLocation: item.systemLocation, systemSlotId: item.systemSlotId,
        systemDockDoorId: item.systemDockDoorId, trailerNumber: item.trailerNumber,
        notes: "Bulk marked as matched during zone audit",
      })));
    },
    onSuccess: () => {
      invalidateAll();
      setBulkMatchOpen(false);
      toast({ title: "Bulk match complete", description: "All pending items in scope marked as matched." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkMatchSelectedMutation = useMutation({
    mutationFn: async (items: AuditQueueItem[]) => {
      await Promise.all(items.map((item) => apiRequest("POST", "/api/yard-audit/mark", {
        visitId: item.visitId, auditResult: "matched",
        systemLocation: item.systemLocation, systemSlotId: item.systemSlotId,
        systemDockDoorId: item.systemDockDoorId, trailerNumber: item.trailerNumber,
        notes: "Bulk marked as matched via multi-select",
      })));
    },
    onSuccess: (_data, items) => {
      invalidateAll();
      setSelectedVisitIds(new Set());
      toast({ title: "Bulk match complete", description: `${items.length} item${items.length !== 1 ? "s" : ""} marked as matched.` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const virtualMoveMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/yard-audit/virtual-move", data); },
    onSuccess: () => {
      invalidateAll();
      setVirtualMoveOpen(false);
      setVmReason(""); setVmNotes(""); setVmPhysicalSlotId(""); setVmPhysicalLocation("");
      toast({ title: "Virtual Move completed", description: "System location updated. Logged as audit reconciliation." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleZone = (code: string) => {
    setSelectedZones((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };
  const clearZones = () => setSelectedZones(new Set());

  const toggleSelectItem = (visitId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedVisitIds((prev) => {
      const next = new Set(prev);
      next.has(visitId) ? next.delete(visitId) : next.add(visitId);
      return next;
    });
  };

  const handleBulkMatchSelected = () => {
    const toMatch = workQueue.filter((i) => selectedVisitIds.has(i.visitId) && i.auditResult === "pending");
    if (toMatch.length === 0) return;
    bulkMatchSelectedMutation.mutate(toMatch);
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "matched", label: "Matched" },
    { key: "mismatched", label: "Mismatch" },
    { key: "missing", label: "Missing" },
    { key: "extra", label: "Extra" },
    { key: "reconciled", label: "Reconciled" },
  ];

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    workQueue.forEach((i) => {
      if (i.trailerNumber) set.add(i.trailerNumber);
      if (i.visitNumber) set.add(i.visitNumber);
      if (i.carrierName) set.add(i.carrierName);
      if (i.systemLocation) set.add(i.systemLocation);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [workQueue]);

  const filteredQueue = useMemo(() => {
    let items = [...workQueue];
    if (selectedZones.size > 0) items = items.filter((i) => selectedZones.has(i.zoneCode || "OTHER"));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter((i) =>
        (i.trailerNumber || "").toLowerCase().includes(q) ||
        (i.visitNumber || "").toLowerCase().includes(q) ||
        (i.carrierName || "").toLowerCase().includes(q) ||
        (i.systemLocation || "").toLowerCase().includes(q)
      );
    }
    if (activeFilter !== "all") items = items.filter((i) => i.auditResult === activeFilter);
    items.sort((a, b) => {
      switch (sortBy) {
        case "location": return (a.systemLocation || "").localeCompare(b.systemLocation || "");
        case "hold": return (a.holdStatus === "none" ? 1 : 0) - (b.holdStatus === "none" ? 1 : 0);
        case "carrier": return (a.carrierName || "").localeCompare(b.carrierName || "");
        case "checkin": return (b.checkInTime || "").localeCompare(a.checkInTime || "");
        case "movement": return (a.movementType || "").localeCompare(b.movementType || "");
        default: return 0;
      }
    });
    return items;
  }, [workQueue, selectedZones, searchQuery, activeFilter, sortBy]);

  const pendingInScope = useMemo(() => {
    const scope = selectedZones.size > 0 ? workQueue.filter((i) => selectedZones.has(i.zoneCode || "OTHER")) : workQueue;
    return scope.filter((i) => i.auditResult === "pending");
  }, [workQueue, selectedZones]);

  const pendingVisibleItems = useMemo(
    () => filteredQueue.filter((i) => i.auditResult === "pending"),
    [filteredQueue]
  );
  const allPendingSelected = pendingVisibleItems.length > 0 && pendingVisibleItems.every((i) => selectedVisitIds.has(i.visitId));
  const somePendingSelected = pendingVisibleItems.some((i) => selectedVisitIds.has(i.visitId)) && !allPendingSelected;

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedVisitIds(new Set());
    } else {
      setSelectedVisitIds(new Set(pendingVisibleItems.map((i) => i.visitId)));
    }
  };

  const selectedPendingCount = workQueue.filter((i) => selectedVisitIds.has(i.visitId) && i.auditResult === "pending").length;

  const scopeItems = selectedZones.size > 0 ? workQueue.filter((i) => selectedZones.has(i.zoneCode || "OTHER")) : workQueue;

  const handleMarkResult = (item: AuditQueueItem, result: string) => {
    if (result === "mismatched" && !mismatchReason) {
      toast({ title: "Reason required", description: "Please select a reason for the mismatch.", variant: "destructive" });
      return;
    }
    markMutation.mutate({
      visitId: item.visitId, auditResult: result,
      systemLocation: item.systemLocation, systemSlotId: item.systemSlotId,
      systemDockDoorId: item.systemDockDoorId, trailerNumber: item.trailerNumber,
      notes: result === "mismatched" ? `${MISMATCH_REASONS.find((r) => r.value === mismatchReason)?.label}. ${markNotes}` : markNotes || undefined,
    });
    setMarkNotes(""); setMismatchReason("");
  };

  const handleOpenVirtualMove = (item: AuditQueueItem) => {
    setSelectedItem(item);
    setVmReason(""); setVmNotes(""); setVmPhysicalSlotId("");
    setVmPhysicalLocation(item.systemLocation || "");
    setVirtualMoveOpen(true);
  };

  const handleConfirmVirtualMove = () => {
    if (!selectedItem || !vmReason) {
      toast({ title: "Missing information", description: "Please select a reason for the virtual move.", variant: "destructive" });
      return;
    }
    const slot = availableSlots?.find((s) => s.id === Number(vmPhysicalSlotId));
    virtualMoveMutation.mutate({
      visitId: selectedItem.visitId, systemLocation: selectedItem.systemLocation,
      systemSlotId: selectedItem.systemSlotId,
      physicalLocation: slot ? `${slot.zoneName} - ${slot.slotNumber}` : vmPhysicalLocation,
      physicalSlotId: vmPhysicalSlotId ? Number(vmPhysicalSlotId) : null,
      reason: vmReason, notes: vmNotes || null,
    });
  };

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      {/* Page Header */}
      <PageHeader
        title="Yard Check"
        subtitle="Reconcile system records with physical yard positions"
        icon={<ClipboardList className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            {pendingInScope.length > 0 && (
              <Button
                variant="outline" size="sm"
                onClick={() => setBulkMatchOpen(true)}
                data-testid="button-bulk-match"
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-900/30"
              >
                <CheckCheck className="h-4 w-4 mr-1.5" />
                Mark All Matched ({pendingInScope.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => invalidateAll()} data-testid="button-refresh-audit">
              <RefreshCcw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Summary strip */}
      <SummaryStrip summary={summary} isLoading={summaryLoading} />

      {/* Zone Scope Chips */}
      {zones.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap" data-testid="zone-scope-chips">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-0.5">Scope:</span>
          <button
            onClick={clearZones}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
              selectedZones.size === 0
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60"
            }`}
            data-testid="button-zone-all"
          >
            All Zones ({workQueue.length})
          </button>
          {zones.map((zone) => (
            <button
              key={zone.code}
              onClick={() => toggleZone(zone.code)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                selectedZones.has(zone.code)
                  ? "bg-primary text-primary-foreground border-primary"
                  : zone.hasIssues
                    ? "bg-transparent border-red-300 text-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
                    : "bg-transparent border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60"
              }`}
              data-testid={`button-zone-${zone.code}`}
            >
              {zone.name}
              <span className="ml-1 opacity-70">{zone.pending > 0 ? `${zone.pending}p` : `✓`}</span>
            </button>
          ))}
        </div>
      )}

      {/* Two-Column Body */}
      <div className="flex gap-3 flex-1 min-h-0" style={{ minHeight: "500px" }}>

        {/* LEFT PANEL — Inventory List */}
        <div className="flex flex-col w-[42%] min-w-0 shrink-0 gap-2">
          {/* Search + Sort */}
          <div className="flex gap-1.5">
            <div className="flex-1">
              <SearchAutocomplete
                value={searchQuery}
                onChange={setSearchQuery}
                suggestions={suggestions}
                placeholder="Trailer #, carrier, location…"
                className="w-full"
                inputClassName="h-8 text-xs"
                data-testid="input-audit-search"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="h-8 w-32 text-[11px] shrink-0" data-testid="select-audit-sort">
                <SortAsc className="h-2.5 w-2.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="hold">Holds First</SelectItem>
                <SelectItem value="carrier">Carrier</SelectItem>
                <SelectItem value="checkin">Check-In</SelectItem>
                <SelectItem value="movement">Movement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 flex-wrap">
            {filterTabs.map((tab) => {
              const Icon = auditResultIcon(tab.key);
              const count = tab.key === "all" ? scopeItems.length : scopeItems.filter((i) => i.auditResult === tab.key).length;
              return (
                <button
                  key={tab.key}
                  className={`flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium border transition-all ${
                    activeFilter === tab.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-transparent border-muted-foreground/25 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                  }`}
                  onClick={() => setActiveFilter(tab.key)}
                  data-testid={`segment-${tab.key}`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {tab.label}
                  <span className={`ml-0.5 px-1 rounded-full text-[9px] ${activeFilter === tab.key ? "bg-primary-foreground/20" : "bg-muted"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto rounded-lg border bg-card" data-testid="audit-list">
            <div className="px-3 py-1.5 border-b bg-muted/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {pendingVisibleItems.length > 0 && (
                  <Checkbox
                    checked={allPendingSelected ? true : somePendingSelected ? "indeterminate" : false}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                    className="h-3.5 w-3.5"
                  />
                )}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inventory</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedPendingCount > 0 && (
                  <Button
                    size="sm"
                    className="h-6 text-[10px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handleBulkMatchSelected}
                    disabled={bulkMatchSelectedMutation.isPending}
                    data-testid="button-bulk-match-selected"
                  >
                    <CheckCheck className="h-3 w-3 mr-1" />
                    {bulkMatchSelectedMutation.isPending ? "Saving…" : `Mark ${selectedPendingCount} as Matched`}
                  </Button>
                )}
                <span className="text-[10px] text-muted-foreground tabular-nums">{filteredQueue.length} items</span>
              </div>
            </div>

            {queueLoading ? (
              <div className="p-2 space-y-1">
                {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filteredQueue.length === 0 ? (
              <EmptyState
                icon={<ClipboardCheck className="h-5 w-5" />}
                heading="No assets found"
                description={searchQuery ? "No assets match your search term." : "No assets match the current filter."}
                compact
              />
            ) : (
              <div className="divide-y">
                {filteredQueue.map((item) => {
                  const isSelected = selectedItem?.visitId === item.visitId;
                  const hasHold = item.holdStatus && item.holdStatus !== "none";
                  const ResultIcon = auditResultIcon(item.auditResult);

                  return (
                    <div
                      key={item.visitId}
                      className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/8 dark:bg-primary/12 border-l-2 border-l-primary"
                          : "hover:bg-muted/40 border-l-2 border-l-transparent"
                      }`}
                      onClick={() => { setSelectedItem(item); setMarkNotes(""); setMismatchReason(""); }}
                      data-testid={`row-audit-${item.visitId}`}
                    >
                      {item.auditResult === "pending" && (
                        <Checkbox
                          checked={selectedVisitIds.has(item.visitId)}
                          onClick={(e: React.MouseEvent) => toggleSelectItem(item.visitId, e)}
                          onCheckedChange={() => {}}
                          className="h-3.5 w-3.5 shrink-0"
                          data-testid={`checkbox-audit-${item.visitId}`}
                        />
                      )}
                      {item.auditResult !== "pending" && (
                        <ResultIcon className={`h-4 w-4 shrink-0 ${
                          item.auditResult === "matched" || item.auditResult === "reconciled" ? "text-emerald-500" :
                          item.auditResult === "mismatched" ? "text-red-500" :
                          item.auditResult === "missing" ? "text-amber-500" :
                          item.auditResult === "extra" ? "text-blue-500" :
                          "text-muted-foreground/40"
                        }`} />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold" data-testid={`text-trailer-${item.visitId}`}>
                            {item.trailerNumber || "No Trailer"}
                          </span>
                          {hasHold && (
                            <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3.5">HOLD</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            {item.systemLocation}
                          </span>
                          {item.carrierName && (
                            <span className="truncate hidden sm:block">{item.carrierName}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusChip
                          status={item.auditResult}
                          colorFn={auditResultColor}
                          label={auditResultLabel(item.auditResult)}
                          size="sm"
                        />
                        {item.auditResult === "pending" && (
                          <div className="flex gap-1">
                            <button
                              className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleMarkResult(item, "matched"); }}
                              data-testid={`button-match-${item.visitId}`}
                            >
                              ✓ Match
                            </button>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 self-center" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Detail View */}
        <div className="flex-1 min-w-0 overflow-y-auto rounded-lg border bg-card p-4" data-testid="right-panel">
          <DetailPanel
            item={selectedItem}
            markMutation={markMutation}
            markNotes={markNotes}
            setMarkNotes={setMarkNotes}
            mismatchReason={mismatchReason}
            setMismatchReason={setMismatchReason}
            handleMarkResult={handleMarkResult}
            handleOpenVirtualMove={handleOpenVirtualMove}
            setLocation={setLocation}
          />
        </div>
      </div>

      {/* Virtual Move Dialog */}
      <Dialog open={virtualMoveOpen} onOpenChange={setVirtualMoveOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-virtual-move">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Create Virtual Move
            </DialogTitle>
            <DialogDescription>
              Update the system location to match the physical yard position for <strong>{selectedItem?.trailerNumber}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Reason for Virtual Move</label>
              <Select value={vmReason} onValueChange={setVmReason}>
                <SelectTrigger className="mt-1" data-testid="select-vm-reason"><SelectValue placeholder="Select reason…" /></SelectTrigger>
                <SelectContent>
                  {VIRTUAL_MOVE_REASONS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Move to Slot (optional)</label>
              <Select value={vmPhysicalSlotId} onValueChange={setVmPhysicalSlotId}>
                <SelectTrigger className="mt-1" data-testid="select-vm-slot"><SelectValue placeholder="Select slot…" /></SelectTrigger>
                <SelectContent>
                  {(availableSlots || []).map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.zoneName} — {s.slotNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!vmPhysicalSlotId && (
              <div>
                <label className="text-xs font-medium">Or Enter Physical Location</label>
                <Input className="mt-1 text-sm" placeholder="e.g., STG-A Row 3" value={vmPhysicalLocation} onChange={(e) => setVmPhysicalLocation(e.target.value)} data-testid="input-vm-physical-location" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Notes</label>
              <Textarea className="mt-1 text-sm h-16" placeholder="Any additional notes…" value={vmNotes} onChange={(e) => setVmNotes(e.target.value)} data-testid="input-vm-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVirtualMoveOpen(false)} data-testid="button-vm-cancel">Cancel</Button>
            <Button onClick={handleConfirmVirtualMove} disabled={virtualMoveMutation.isPending || !vmReason} data-testid="button-vm-confirm">
              {virtualMoveMutation.isPending ? "Processing…" : "Confirm Virtual Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Match Confirmation Dialog */}
      <Dialog open={bulkMatchOpen} onOpenChange={setBulkMatchOpen}>
        <DialogContent data-testid="dialog-bulk-match">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCheck className="h-5 w-5 text-emerald-600" />Bulk Mark as Matched</DialogTitle>
            <DialogDescription>
              This will mark all <strong>{pendingInScope.length}</strong> pending items in {selectedZones.size > 0 ? "the selected zones" : "the entire yard"} as matched. This action cannot be easily undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMatchOpen(false)} data-testid="button-bulk-cancel">Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => bulkMarkMutation.mutate(pendingInScope)}
              disabled={bulkMarkMutation.isPending}
              data-testid="button-bulk-confirm"
            >
              {bulkMarkMutation.isPending ? "Processing…" : `Confirm — Match ${pendingInScope.length} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
