import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProductMode, showAIRecommendations } from "@/lib/product-mode";
import { useTabletView } from "@/lib/tablet-view";
import { MovesAssistPanel } from "@/components/assist/moves-assist-panel";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { playMoveComplete } from "@/lib/audio-feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, FilterToolbar, StatusChip, KPICard, DetailDrawer, DrawerSection, DrawerField, EmptyState } from "@/components/enterprise";
import { movePriorityColor, moveStatusColor, visitStatusColor } from "@/lib/status-colors";
import { formatTitle as formatStatus } from "@/lib/format";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRightLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Play,
  X,
  Search,
  Plus,
  Clock,
  AlertTriangle,
  Truck,
  MapPin,
  DoorOpen,
  User,
  RefreshCcw,
  ChevronDown,
  RotateCcw,
  Ban,
  ShieldAlert,
  Zap,
  Timer,
  CircleDot,
  Users,
  UserCheck,
  LayoutGrid,
  LayoutList,
} from "lucide-react";
import { JockeyBoardView } from "@/components/enterprise/jockey-board";

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[220px] text-center">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MoveTaskView {
  id: number;
  visitId: number;
  visitNumber: string;
  trailerNumber: string | null;
  carrierName: string | null;
  moveType: string;
  fromLocationType: string;
  fromLocationId: number | null;
  fromLocationName: string | null;
  toLocationType: string;
  toLocationId: number | null;
  toLocationName: string | null;
  loadStatus: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  notes: string | null;
  rejectionReason: string | null;
  source: string;
  createdBy: string | null;
  createdByName: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface MoveSummary {
  available: number;
  assigned: number;
  inProgress: number;
  highPriority: number;
  overdue: number;
  completedToday: number;
  rejected: number;
}

interface Jockey {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  activeMoveCount?: number;
  jockeyStatus?: "available" | "busy";
}

interface YardAsset {
  id: number;
  visitNumber: string;
  trailerNumber: string | null;
  carrierName: string | null;
  currentSlotNumber: string | null;
  currentDockDoor: string | null;
  zoneName: string | null;
  visitStatus: string;
  locationStatus: string;
  movementType: string;
}

interface SlotOption {
  id: number;
  slotNumber: string;
  zoneName: string;
}

interface DoorOption {
  id: number;
  doorNumber: string;
}

const MOVE_TYPES = [
  { value: "gate_to_slot", label: "Gate to Slot" },
  { value: "slot_to_dock", label: "Slot to Dock" },
  { value: "dock_to_yard", label: "Dock to Yard" },
  { value: "slot_to_ready_out", label: "Slot to Ready Out" },
  { value: "ready_out_to_gate", label: "Ready Out to Gate" },
  { value: "reposition", label: "Reposition" },
  { value: "audit_reconciliation", label: "Audit Reconciliation" },
  { value: "exception_emergency", label: "Exception / Emergency" },
  { value: "maintenance", label: "Maintenance Move" },
  { value: "manual_supervisor", label: "Manual Supervisor Move" },
];

const LOAD_STATUSES = [
  { value: "loaded", label: "Loaded" },
  { value: "empty", label: "Empty" },
  { value: "partial", label: "Partial" },
  { value: "unknown", label: "Unknown" },
];

type QueueTab = "unassigned" | "assigned" | "in_progress" | "completed";

const LIFECYCLE_STEPS = [
  { key: "open", label: "Created" },
  { key: "assigned", label: "Assigned" },
  { key: "accepted", label: "Accepted" },
  { key: "in_progress", label: "Started" },
  { key: "completed", label: "Completed" },
];


function formatMoveType(t: string): string {
  return MOVE_TYPES.find((m) => m.value === t)?.label || formatStatus(t);
}

function calcAge(dateStr: string | null): string {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
}

function calcAgeMinutes(dateStr: string | null): number {
  if (!dateStr) return 0;
  return (Date.now() - new Date(dateStr).getTime()) / 60000;
}

function isOverdue(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > 2 * 60 * 60 * 1000;
}

function getLifecycleIndex(status: string): number {
  switch (status) {
    case "open": return 0;
    case "assigned": return 1;
    case "accepted": return 2;
    case "in_progress": return 3;
    case "completed": return 4;
    case "rejected": return -1;
    case "cancelled": return -1;
    case "escalated": return 1;
    default: return -1;
  }
}

function getRowHighlight(task: MoveTaskView): string {
  if (task.status === "rejected") return "bg-red-50/50 dark:bg-red-950/20";
  if (task.status === "escalated") return "bg-orange-50/50 dark:bg-orange-950/20";
  if (task.priority === "urgent") return "bg-red-50/40 dark:bg-red-950/15";
  if (task.priority === "high") return "bg-amber-50/40 dark:bg-amber-950/15";
  if (isOverdue(task.createdAt) && !["completed", "cancelled"].includes(task.status)) return "bg-amber-50/40 dark:bg-amber-950/15";
  return "";
}

function sourceLabel(source: string): string {
  switch (source) {
    case "manual": return "Manual";
    case "dock_request": return "Dock Request";
    case "system": return "System";
    case "audit": return "Audit";
    case "gate": return "Gate";
    default: return formatStatus(source);
  }
}

function isSupervisor(role?: string): boolean {
  return role === "admin" || role === "yard_manager";
}

function isJockey(role?: string): boolean {
  return role === "yard_jockey";
}

function priorityCardBorder(priority: string, overdue: boolean): string {
  if (priority === "urgent") return "border-l-4 border-l-red-500";
  if (priority === "high") return "border-l-4 border-l-amber-500";
  if (overdue) return "border-l-4 border-l-orange-400";
  return "border-l-4 border-l-transparent";
}

function priorityBg(priority: string, overdue: boolean): string {
  if (priority === "urgent") return "bg-red-50/60 dark:bg-red-950/25";
  if (priority === "high") return "bg-amber-50/60 dark:bg-amber-950/20";
  if (overdue) return "bg-orange-50/40 dark:bg-orange-950/15";
  return "";
}

const ZONE_COLORS: Record<string, string> = {
  gate: "#6366f1",
  staging: "#8b5cf6",
  dock: "#f59e0b",
  yard: "#22c55e",
  parking: "#06b6d4",
  overflow: "#ec4899",
  hazmat: "#ef4444",
  reefer: "#3b82f6",
  maintenance: "#a855f7",
  ready: "#f97316",
};

function getZoneColor(locationName: string | null, locationType: string): string {
  if (!locationName && !locationType) return "#94a3b8";
  const typeLower = locationType.toLowerCase();
  if (typeLower === "gate") return ZONE_COLORS.gate;
  if (typeLower === "dock") return ZONE_COLORS.dock;
  const nameLower = (locationName || "").toLowerCase();
  for (const [key, color] of Object.entries(ZONE_COLORS)) {
    if (nameLower.includes(key)) return color;
  }
  const hash = (nameLower || typeLower).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const palette = ["#6366f1", "#8b5cf6", "#22c55e", "#06b6d4", "#f59e0b", "#ec4899", "#3b82f6"];
  return palette[hash % palette.length];
}

function RouteVisual({ task }: { task: MoveTaskView }) {
  const fromColor = getZoneColor(task.fromLocationName, task.fromLocationType);
  const toColor = getZoneColor(task.toLocationName, task.toLocationType);
  return (
    <span className="inline-flex items-center gap-1.5" data-testid={`route-visual-${task.id}`}>
      <span
        className="inline-block h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/20"
        style={{ backgroundColor: fromColor }}
        title={task.fromLocationName || task.fromLocationType}
      />
      <span className="text-muted-foreground text-[10px]">&rarr;</span>
      <span
        className="inline-block h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/20"
        style={{ backgroundColor: toColor }}
        title={task.toLocationName || task.toLocationType}
      />
    </span>
  );
}

function movementDirectionLabel(moveType: string): { label: string; color: string } {
  if (["gate_to_slot", "slot_to_dock"].includes(moveType)) return { label: "Inbound", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" };
  if (["dock_to_yard", "slot_to_ready_out", "ready_out_to_gate"].includes(moveType)) return { label: "Outbound", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30" };
  return { label: "Internal", color: "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800" };
}

function JockeyTaskCard({
  task,
  onAction,
  onReject,
  onSelfAssign,
  isPending,
}: {
  task: MoveTaskView;
  onAction: (taskId: number, status: string) => void;
  onReject: (task: MoveTaskView) => void;
  onSelfAssign?: () => void;
  isPending: boolean;
}) {
  const { tabletMode } = useTabletView();
  const overdue = isOverdue(task.createdAt);
  const ageMins = calcAgeMinutes(task.createdAt);
  const direction = movementDirectionLabel(task.moveType);
  const isUrgent = task.priority === "urgent";

  return (
    <div
      className={`rounded-lg border ${priorityCardBorder(task.priority, overdue)} ${priorityBg(task.priority, overdue)} bg-card p-3 space-y-2.5 transition-all hover:shadow-sm ${isUrgent ? "animate-pulse-once" : ""}`}
      data-testid={`card-task-${task.id}`}
    >
      {/* Top row: trailer + priority + direction */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-sm font-bold" data-testid={`card-trailer-${task.id}`}>
              {task.trailerNumber || "No Trailer"}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${direction.color}`}>
              {direction.label}
            </span>
            {overdue && (
              <span className="flex items-center gap-0.5 text-[10px] text-orange-600 font-medium">
                <AlertTriangle className="h-3 w-3" /> SLA
              </span>
            )}
            {task.source === "dock_request" && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium">
                <DoorOpen className="h-3 w-3" /> Dock
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{task.visitNumber}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusChip status={task.priority} colorFn={movePriorityColor} size="sm" />
          <StatusChip status={task.status} colorFn={moveStatusColor} size="sm" />
        </div>
      </div>

      {/* Route */}
      <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded px-2 py-1.5">
        <RouteVisual task={task} />
        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="truncate font-medium">{task.fromLocationName || "—"}</span>
        <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
        <MapPin className="h-3 w-3 text-primary shrink-0" />
        <span className="truncate font-medium text-primary">{task.toLocationName || "—"}</span>
      </div>

      {/* Age + carrier */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{task.carrierName || "Unknown Carrier"}</span>
        <span className={`flex items-center gap-0.5 ${ageMins > 120 ? "text-red-600 font-semibold" : ageMins > 60 ? "text-amber-600 font-medium" : ""}`}>
          <Clock className="h-3 w-3" />
          {calcAge(task.createdAt)}
          {ageMins > 120 && " — OVERDUE"}
        </span>
      </div>

      {/* Notes if present */}
      {task.notes && (
        <p className="text-[10px] text-muted-foreground italic truncate">{task.notes}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 pt-0.5 border-t" onClick={(e) => e.stopPropagation()}>
        {task.status === "assigned" && (
          <>
            <Button
              size="sm"
              className={`flex-1 bg-primary hover:bg-primary/90 ${tabletMode ? "h-10 text-sm" : "h-8 text-xs"}`}
              onClick={() => onAction(task.id, "accepted")}
              disabled={isPending}
              data-testid={`card-accept-${task.id}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept
            </Button>
            <Button
              size="sm" variant="outline"
              className={`text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900/30 ${tabletMode ? "h-10 text-sm" : "h-8 text-xs"}`}
              onClick={() => onReject(task)}
              disabled={isPending}
              data-testid={`card-reject-${task.id}`}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Return
            </Button>
          </>
        )}
        {task.status === "accepted" && (
          <Button
            size="sm"
            className={`flex-1 ${tabletMode ? "h-10 text-sm" : "h-8 text-xs"}`}
            onClick={() => onAction(task.id, "in_progress")}
            disabled={isPending}
            data-testid={`card-start-${task.id}`}
          >
            <Play className="h-3.5 w-3.5 mr-1" /> Start Move
          </Button>
        )}
        {task.status === "in_progress" && (
          <Button
            size="sm"
            className={`flex-1 bg-emerald-600 hover:bg-emerald-700 text-white ${tabletMode ? "h-10 text-sm" : "h-8 text-xs"}`}
            onClick={() => onAction(task.id, "completed")}
            disabled={isPending}
            data-testid={`card-complete-${task.id}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Complete Move
          </Button>
        )}
        {task.status === "open" && (
          onSelfAssign ? (
            <Button
              size="sm"
              className={`flex-1 bg-primary hover:bg-primary/90 ${tabletMode ? "h-10 text-sm" : "h-8 text-xs"}`}
              onClick={onSelfAssign}
              disabled={isPending}
              data-testid={`card-claim-${task.id}`}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1" /> Claim Task
            </Button>
          ) : (
            <p className="flex-1 text-center text-[10px] text-muted-foreground self-center py-1.5">
              Awaiting assignment from supervisor
            </p>
          )
        )}
        {task.status === "completed" && (
          <p className="flex-1 text-center text-[10px] text-emerald-600 dark:text-emerald-400 self-center py-1.5 font-medium">
            ✓ Completed
          </p>
        )}
      </div>
    </div>
  );
}

export default function MoveTasksPage({ userRole, currentPersonaId }: { userRole?: string; currentPersonaId?: string }) {
  const { toast } = useToast();
  const { mode } = useProductMode();
  const aiEnabled = showAIRecommendations(mode);
  const [activeQueue, setActiveQueue] = useState<QueueTab>("unassigned");
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedTask, setSelectedTask] = useState<MoveTaskView | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<MoveTaskView | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [assignDialog, setAssignDialog] = useState<MoveTaskView | null>(null);
  const [assignTaskIds, setAssignTaskIds] = useState<number[]>([]);
  const [assignJockeyId, setAssignJockeyId] = useState("");
  const [priorityDialog, setPriorityDialog] = useState<MoveTaskView | null>(null);
  const [newPriority, setNewPriority] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "board">("table");

  const { data: summary, isLoading: summaryLoading } = useQuery<MoveSummary>({
    queryKey: ["/api/moves/summary"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<MoveTaskView[]>({
    queryKey: ["/api/moves", "all"],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const { data: jockeys = [] } = useQuery<Jockey[]>({
    queryKey: ["/api/yard/jockeys"],
  });

  const { data: yardAssets = [] } = useQuery<YardAsset[]>({
    queryKey: ["/api/yard/inventory"],
  });

  const { data: availableSlots = [] } = useQuery<SlotOption[]>({
    queryKey: ["/api/yard/available-slots-all"],
  });

  const { data: availableDoors = [] } = useQuery<DoorOption[]>({
    queryKey: ["/api/dock/available-doors"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { taskId?: number; taskIds?: number[]; status?: string; priority?: string; assignedTo?: string | null; rejectionReason?: string; notes?: string }) => {
      const { taskId, taskIds, ...body } = data;
      if (taskIds) {
        const results = await Promise.all(taskIds.map(id => apiRequest("PATCH", `/api/moves/${id}`, body)));
        return results;
      }
      const res = await apiRequest("PATCH", `/api/moves/${taskId}`, body);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidateAll();
      if (variables.status === "completed") playMoveComplete();
      toast({ title: "Move(s) updated" });
      setSelectedTaskIds([]);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/moves", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setCreateOpen(false);
      toast({ title: "Move created", description: "New move request added to queue." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const queuedTasks = useMemo(() => {
    let filtered = allTasks;
    switch (activeQueue) {
      case "unassigned":
        filtered = allTasks.filter((t) => t.status === "open");
        break;
      case "assigned":
        if (isJockey(userRole) && currentPersonaId) {
          filtered = allTasks.filter((t) => ["assigned", "accepted"].includes(t.status) && t.assignedTo === currentPersonaId);
        } else {
          filtered = allTasks.filter((t) => ["assigned", "accepted"].includes(t.status));
        }
        break;
      case "in_progress":
        if (isJockey(userRole) && currentPersonaId) {
          filtered = allTasks.filter((t) => ["in_progress", "escalated"].includes(t.status) && t.assignedTo === currentPersonaId);
        } else {
          filtered = allTasks.filter((t) => ["in_progress", "escalated"].includes(t.status));
        }
        break;
      case "completed": {
        filtered = allTasks.filter((t) => ["completed", "rejected", "cancelled"].includes(t.status));
        break;
      }
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t) =>
        t.trailerNumber?.toLowerCase().includes(q) ||
        t.visitNumber?.toLowerCase().includes(q) ||
        t.carrierName?.toLowerCase().includes(q) ||
        t.assignedToName?.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    }

    switch (quickFilter) {
      case "high_priority":
        filtered = filtered.filter((t) => t.priority === "high" || t.priority === "urgent");
        break;
      case "unassigned":
        filtered = filtered.filter((t) => !t.assignedTo);
        break;
      case "aging":
        filtered = filtered.filter((t) => isOverdue(t.createdAt) && !["completed", "cancelled"].includes(t.status));
        break;
      case "dock_moves":
        filtered = filtered.filter((t) => t.moveType === "slot_to_dock" || t.toLocationType === "dock");
        break;
      case "ready_out":
        filtered = filtered.filter((t) => t.moveType === "slot_to_ready_out" || t.moveType === "ready_out_to_gate");
        break;
      case "audit":
        filtered = filtered.filter((t) => t.moveType === "audit_reconciliation" || t.source === "audit");
        break;
    }

  const priorityOrder: Record<string, number> = { urgent: 0, dock_waiting: 1, high: 2, normal: 3, low: 4 };
    const statusOrder: Record<string, number> = { open: 0, assigned: 1, accepted: 2, in_progress: 3, completed: 4, cancelled: 5, rejected: 6 };

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "priority":
          cmp = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
          break;
        case "status":
          cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "trailerNumber":
          cmp = (a.trailerNumber || "").localeCompare(b.trailerNumber || "");
          break;
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allTasks, activeQueue, search, quickFilter, sortField, sortDir]);

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    allTasks.forEach((t) => {
      if (t.trailerNumber) set.add(t.trailerNumber);
      if (t.visitNumber) set.add(t.visitNumber);
      if (t.carrierName) set.add(t.carrierName);
      if (t.assignedToName) set.add(t.assignedToName);
    });
    jockeys.forEach((j) => {
      const name = `${j.firstName || ""} ${j.lastName || ""}`.trim();
      if (name) set.add(name);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [allTasks, jockeys]);

  const jockeyWorkload = useMemo(() => {
    const map = new Map<string, { name: string; active: number; total: number; overdue: number }>();
    allTasks.forEach((t) => {
      if (!t.assignedTo || !t.assignedToName) return;
      if (!map.has(t.assignedTo)) {
        map.set(t.assignedTo, { name: t.assignedToName, active: 0, total: 0, overdue: 0 });
      }
      const entry = map.get(t.assignedTo)!;
      if (!["completed", "cancelled", "rejected"].includes(t.status)) {
        entry.active++;
        if (isOverdue(t.createdAt)) entry.overdue++;
      }
      entry.total++;
    });
    return Array.from(map.values());
  }, [allTasks]);

  function toggleSort(field: string) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  function sortIcon(field: string) {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground/50" />;
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  }

  function openDrawer(task: MoveTaskView) {
    setSelectedTask(task);
    setDrawerOpen(true);
  }

  function handleReject() {
    if (!rejectDialog || !rejectReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a rejection reason.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ taskId: rejectDialog.id, status: "rejected", rejectionReason: rejectReason });
    setRejectDialog(null);
    setRejectReason("");
  }

  function handleAssign() {
    if (assignTaskIds.length > 0) {
      if (!assignJockeyId) return;
      updateMutation.mutate({ taskIds: assignTaskIds, assignedTo: assignJockeyId, status: "assigned" });
    } else if (assignDialog) {
      if (!assignJockeyId) return;
      updateMutation.mutate({ taskId: assignDialog.id, assignedTo: assignJockeyId, status: "assigned" });
    }
    setAssignDialog(null);
    setAssignTaskIds([]);
    setAssignJockeyId("");
    setSelectedTaskIds([]);
  }

  function handleChangePriority() {
    if (!priorityDialog || !newPriority) return;
    updateMutation.mutate({ taskId: priorityDialog.id, priority: newPriority });
    setPriorityDialog(null);
    setNewPriority("");
  }

  const summaryCards = [
    { key: "unassigned" as QueueTab, label: "Unassigned", value: summary?.available ?? 0, icon: CircleDot, accent: "blue" },
    { key: "assigned" as QueueTab, label: "Assigned", value: summary?.assigned ?? 0, icon: User, accent: "violet" },
    { key: "in_progress" as QueueTab, label: "In Progress", value: summary?.inProgress ?? 0, icon: Play, accent: "blue" },
    { key: "in_progress" as QueueTab, label: "High Priority", value: summary?.highPriority ?? 0, icon: Zap, accent: "amber", filter: "high_priority" },
    { key: "in_progress" as QueueTab, label: "Overdue", value: summary?.overdue ?? 0, icon: Timer, accent: (summary?.overdue ?? 0) > 0 ? "red" : "green", filter: "aging" },
    { key: "completed" as QueueTab, label: "Completed Today", value: summary?.completedToday ?? 0, icon: CheckCircle2, accent: "green" },
  ];

  const accentBorders: Record<string, string> = {
    blue: "border-l-blue-500",
    green: "border-l-emerald-500",
    red: "border-l-red-500",
    amber: "border-l-amber-500",
    violet: "border-l-violet-500",
  };

  const myAssignedCount = currentPersonaId
    ? allTasks.filter((t) => ["assigned", "accepted"].includes(t.status) && t.assignedTo === currentPersonaId).length
    : 0;
  const myInProgressCount = currentPersonaId
    ? allTasks.filter((t) => t.status === "in_progress" && t.assignedTo === currentPersonaId).length
    : 0;
  const myCompletedTodayCount = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return currentPersonaId
      ? allTasks.filter((t) => t.status === "completed" && t.assignedTo === currentPersonaId && t.completedAt && new Date(t.completedAt) >= today).length
      : 0;
  }, [allTasks, currentPersonaId]);

  const completedCount = (summary?.completedToday ?? 0) + (summary?.rejected ?? 0);

  const queueTabs: { key: QueueTab; label: string; count: number; badgeColor?: string }[] = [
    { key: "unassigned", label: "Unassigned", count: summary?.available ?? 0, badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { key: "assigned", label: "Assigned", count: (summary?.assigned ?? 0), badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
    { key: "in_progress", label: "In Progress", count: summary?.inProgress ?? 0, badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    { key: "completed", label: "Completed", count: completedCount, badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  ];

  const quickFilters = [
    { key: "high_priority", label: "High Priority" },
    { key: "aging", label: "Aging" },
    { key: "dock_moves", label: "Dock Moves" },
    { key: "ready_out", label: "Ready-Out" },
    { key: "audit", label: "Audit Moves" },
  ];

  const lifecycleIdx = selectedTask ? getLifecycleIndex(selectedTask.status) : -1;

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <PageHeader
        title="Yard Moves"
        subtitle="Yard move orchestration and jockey task management"
        icon={<ArrowRightLeft className="h-5 w-5" />}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { invalidateAll(); }}
              data-testid="button-refresh-moves"
              title="Refresh"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
            {isSupervisor(userRole) && (
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                data-testid="button-create-move"
                className="h-9 px-4 font-semibold bg-primary hover:bg-primary/90 shadow-sm gap-1.5"
              >
                <Plus className="h-4 w-4" /> Create Move
              </Button>
            )}
          </>
        }
        kpiStrip={
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
            {summaryCards.map((card, i) => (
              <KPICard
                key={i}
                label={card.label}
                value={summaryLoading ? "..." : card.value}
                icon={<card.icon className="h-4 w-4" />}
                onClick={() => {
                  setActiveQueue(card.key);
                  if ((card as any).filter) setQuickFilter((card as any).filter);
                  else setQuickFilter("all");
                }}
                accent={accentBorders[card.accent]}
                data-testid={`card-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
              />
            ))}
          </div>
        }
      />

      {/* Jockey Workload (Supervisor only) */}
      {isSupervisor(userRole) && jockeyWorkload.length > 0 && (
        <Collapsible>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">Jockey Workload</CardTitle>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {jockeyWorkload.map((jw) => (
                    <div key={jw.name} className="flex items-center gap-2 p-2 rounded-md border">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {jw.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{jw.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{jw.active} active</span>
                          {jw.overdue > 0 && (
                            <span className="text-red-600 font-medium">{jw.overdue} overdue</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {jockeys.filter((j) => !jockeyWorkload.find((jw) => jw.name === `${j.firstName} ${j.lastName}`.trim())).map((j) => (
                    <div key={j.id} className="flex items-center gap-2 p-2 rounded-md border border-dashed">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {(j.firstName?.[0] || "") + (j.lastName?.[0] || "")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{j.firstName} {j.lastName}</p>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Idle</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* AI Move Suggestions (Assist/Optimize mode only) */}
      {aiEnabled && activeQueue === "unassigned" && (
        <MovesAssistPanel
          allTasks={allTasks}
          onAssignTask={(taskId) => setAssignDialog(allTasks.find((t) => t.id === taskId) ?? null)}
        />
      )}

      {/* Unified Filter Bar */}
      <FilterToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search trailer, visit, carrier, jockey..."
        suggestions={suggestions}
        filters={
          <div className="flex items-center gap-1.5 flex-wrap">
            {queueTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveQueue(tab.key); setQuickFilter("all"); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  activeQueue === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                data-testid={`queue-${tab.key}`}
              >
                {tab.label}
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded text-[10px] font-bold ${
                  activeQueue === tab.key
                    ? "bg-white/20 text-primary-foreground"
                    : tab.badgeColor ?? "bg-muted text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
            <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
            <Tip text="Filter by specific move type or urgency">
              <Select value={quickFilter} onValueChange={setQuickFilter}>
                <SelectTrigger className="h-8 w-36 text-xs bg-background" data-testid="select-quick-filter">
                  <SelectValue placeholder="Quick Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Moves</SelectItem>
                  {quickFilters.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Tip>
          </div>
        }
        actions={
          <div className="flex items-center gap-1">
            {isSupervisor(userRole) && (
              <div className="flex items-center rounded-md border border-input overflow-hidden mr-2" data-testid="view-toggle">
                <Button
                  size="sm"
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  className="h-7 rounded-none px-2.5 border-0"
                  onClick={() => setViewMode("table")}
                  title="Table view"
                  data-testid="button-view-table"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "board" ? "secondary" : "ghost"}
                  className="h-7 rounded-none px-2.5 border-0 border-l border-input"
                  onClick={() => setViewMode("board")}
                  title="Jockey board view"
                  data-testid="button-view-board"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {isSupervisor(userRole) && selectedTaskIds.length > 0 && (
              <Button
                size="sm"
                variant="default"
                className="h-8 text-xs px-2.5 bg-violet-600 hover:bg-violet-700 mr-2"
                onClick={() => {
                  setAssignTaskIds(selectedTaskIds);
                  setAssignJockeyId("");
                }}
                data-testid="button-bulk-assign"
              >
                <Users className="h-3.5 w-3.5 mr-1" /> Bulk Assign ({selectedTaskIds.length})
              </Button>
            )}
          </div>
        }
      />

      {/* Jockey Card View — shown for jockeys on unassigned / assigned / in-progress tabs */}
      {isJockey(userRole) && ["unassigned", "assigned", "in_progress"].includes(activeQueue) && (
        <>
          {tasksLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
            </div>
          ) : queuedTasks.length === 0 ? (
            <EmptyState
              icon={<ArrowRightLeft className="h-5 w-5" />}
              heading={activeQueue === "assigned" ? "No tasks assigned to you" : "Queue is empty"}
              description={
                activeQueue === "assigned"
                  ? "You have no assigned move tasks. Check the unassigned queue or wait for a supervisor to assign work."
                  : activeQueue === "unassigned"
                    ? "No open move tasks waiting for assignment. New tasks will appear here when created."
                    : activeQueue === "in_progress"
                      ? "No moves are currently in progress."
                      : "No completed moves found for the current filter."
              }
              data-testid="text-no-tasks"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="jockey-card-grid">
              {queuedTasks.map((task) => (
                <JockeyTaskCard
                  key={task.id}
                  task={task}
                  onAction={(taskId, status) => updateMutation.mutate({ taskId, status })}
                  onReject={(t) => { setRejectDialog(t); setRejectReason(""); }}
                  onSelfAssign={currentPersonaId ? () => updateMutation.mutate({ taskId: task.id, status: "assigned", assignedTo: currentPersonaId }) : undefined}
                  isPending={updateMutation.isPending}
                />
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground text-right">{queuedTasks.length} task{queuedTasks.length !== 1 ? "s" : ""}</div>
        </>
      )}

      {/* Jockey Board View — shown for supervisors when board mode is active */}
      {isSupervisor(userRole) && viewMode === "board" && (
        <JockeyBoardView
          tasks={allTasks as any}
          jockeys={jockeys as any}
          onReassign={(taskId, jockeyId) => {
            updateMutation.mutate({
              taskId,
              assignedTo: jockeyId ?? undefined,
              status: jockeyId ? "assigned" : "open",
            });
          }}
        />
      )}

      {/* Move Table — shown for supervisors / admins, or jockeys on completed tab */}
      {(!isJockey(userRole) || activeQueue === "completed") && viewMode === "table" && (
      <>
      {tasksLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      ) : queuedTasks.length === 0 ? (
        <EmptyState
          icon={<ArrowRightLeft className="h-5 w-5" />}
          heading="Queue is empty"
          description={
            activeQueue === "unassigned"
              ? "No open move tasks waiting for assignment. Create a new task or check other queues."
              : activeQueue === "assigned"
                ? "No tasks currently assigned. Use the unassigned queue to dispatch work to jockeys."
                : activeQueue === "in_progress"
                  ? "No moves are currently in progress."
                  : "No completed moves found for the current filter."
          }
          data-testid="text-no-tasks"
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  {isSupervisor(userRole) && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedTaskIds.length === queuedTasks.length && queuedTasks.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedTaskIds(queuedTasks.map(t => t.id));
                          else setSelectedTaskIds([]);
                        }}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-16 font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Unique move task identifier">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">Move#</span>
                    </Tip>
                  </TableHead>
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Trailer being moved — click row for full details">
                      <button className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("trailerNumber")} data-testid="sort-trailer">
                        Trailer / Asset {sortIcon("trailerNumber")}
                      </button>
                    </Tip>
                  </TableHead>
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Carrier company operating this trailer">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">Carrier</span>
                    </Tip>
                  </TableHead>
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="The type of yard movement being performed">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">Move Type</span>
                    </Tip>
                  </TableHead>
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Origin — where the trailer is being picked up from">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">From</span>
                    </Tip>
                  </TableHead>
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Destination — where the trailer is being delivered to">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">To</span>
                    </Tip>
                  </TableHead>
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Urgent=Red, High=Amber, Normal=Blue, Low=Gray">
                      <button className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("priority")} data-testid="sort-priority">
                        Priority {sortIcon("priority")}
                      </button>
                    </Tip>
                  </TableHead>
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Yellow=Pending, Violet=Assigned, Blue=In Progress, Green=Completed, Red=Rejected">
                      <button className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("status")} data-testid="sort-status">
                        Status {sortIcon("status")}
                      </button>
                    </Tip>
                  </TableHead>
                  <TableHead className="sticky right-[120px] z-20 bg-card shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.04)] font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Yard jockey assigned to execute this move">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">Jockey</span>
                    </Tip>
                  </TableHead>
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Time since this move was created. Amber = over 1h, Red = over 2h (overdue)">
                      <button className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("createdAt")} data-testid="sort-age">
                        Age {sortIcon("createdAt")}
                      </button>
                    </Tip>
                  </TableHead>
                  <TableHead className="text-right sticky right-0 z-20 bg-card shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.04)] font-semibold text-[11px] uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queuedTasks.map((task) => {
                  const ageMins = calcAgeMinutes(task.createdAt);
                  return (
                    <TableRow
                      key={task.id}
                      className={`cursor-pointer transition-colors hover:bg-accent/60 ${getRowHighlight(task)} ${selectedTask?.id === task.id ? "ring-1 ring-primary bg-primary/5" : ""} ${priorityCardBorder(task.priority, calcAgeMinutes(task.createdAt) > 120 && task.status !== "completed")}`}
                      onClick={() => openDrawer(task)}
                      data-testid={`row-task-${task.id}`}
                    >
                      {isSupervisor(userRole) && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTaskIds.includes(task.id)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedTaskIds(prev => [...prev, task.id]);
                              else setSelectedTaskIds(prev => prev.filter(id => id !== task.id));
                            }}
                            data-testid={`checkbox-select-${task.id}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs font-medium" data-testid={`text-move-id-${task.id}`}>
                        M-{String(task.id).padStart(4, "0")}
                      </TableCell>
                      <TableCell data-testid={`text-trailer-${task.id}`}>
                        <div>
                          <span className="font-semibold text-sm">{task.trailerNumber || "—"}</span>
                          <p className="text-[10px] text-muted-foreground font-mono">{task.visitNumber}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[110px] truncate" data-testid={`text-carrier-${task.id}`}>
                        {task.carrierName || "—"}
                      </TableCell>
                      <TableCell className="text-xs" data-testid={`text-type-${task.id}`}>
                        {formatMoveType(task.moveType)}
                      </TableCell>
                      <TableCell className="text-xs" data-testid={`text-from-${task.id}`}>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                          <span className="text-muted-foreground">{task.fromLocationName || "—"}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs" data-testid={`text-to-${task.id}`}>
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          <span className="font-medium">{task.toLocationName || "—"}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          status={task.priority}
                          colorFn={movePriorityColor}
                          size="sm"
                          data-testid={`badge-priority-${task.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          status={task.status}
                          colorFn={moveStatusColor}
                          size="sm"
                          data-testid={`badge-status-${task.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground sticky right-[120px] z-10 bg-card" data-testid={`text-jockey-${task.id}`}>
                        {task.assignedToName || "—"}
                      </TableCell>
                      <TableCell data-testid={`text-age-${task.id}`}>
                        <span className={`flex items-center gap-1 text-xs ${
                          ageMins > 120 ? "text-red-600 font-medium" : ageMins > 60 ? "text-amber-600" : "text-muted-foreground"
                        }`}>
                          {ageMins > 120 && <Clock className="h-3 w-3" />}
                          {calcAge(task.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right sticky right-0 z-10 bg-card" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {/* Jockey-only operational actions */}
                          {isJockey(userRole) && task.status === "open" && currentPersonaId && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-primary hover:bg-primary/90 text-white"
                              onClick={() => updateMutation.mutate({ taskId: task.id, status: "assigned", assignedTo: currentPersonaId })}
                              data-testid={`button-claim-${task.id}`}
                            >
                              <UserCheck className="h-3 w-3 mr-0.5" /> Claim
                            </Button>
                          )}
                          {isJockey(userRole) && task.status === "assigned" && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs"
                                onClick={() => updateMutation.mutate({ taskId: task.id, status: "accepted" })}
                                data-testid={`button-accept-${task.id}`}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                onClick={() => { setRejectDialog(task); setRejectReason(""); }}
                                data-testid={`button-reject-${task.id}`}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {isJockey(userRole) && task.status === "accepted" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => updateMutation.mutate({ taskId: task.id, status: "in_progress" })}
                              data-testid={`button-start-${task.id}`}
                            >
                              <Play className="h-3 w-3 mr-0.5" /> Start
                            </Button>
                          )}
                          {isJockey(userRole) && task.status === "in_progress" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => updateMutation.mutate({ taskId: task.id, status: "completed" })}
                              data-testid={`button-complete-${task.id}`}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Complete
                            </Button>
                          )}
                          {isSupervisor(userRole) && !["completed", "cancelled"].includes(task.status) && (
                            <>
                              <Tip text={task.assignedTo ? "Reassign jockey" : "Assign jockey to this move"}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
                                  onClick={() => { setAssignDialog(task); setAssignJockeyId(task.assignedTo || ""); }}
                                  data-testid={`button-assign-${task.id}`}
                                >
                                  <User className="h-3.5 w-3.5" />
                                </Button>
                              </Tip>
                              <Tip text="Change move priority level">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 opacity-60 hover:opacity-100"
                                  onClick={() => { setPriorityDialog(task); setNewPriority(task.priority); }}
                                  data-testid={`button-priority-${task.id}`}
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                </Button>
                              </Tip>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-2 border-t text-xs text-muted-foreground">
            {queuedTasks.length} move{queuedTasks.length !== 1 ? "s" : ""} shown
          </div>
        </Card>
      )}
      </>
      )}

      {/* Floating batch assign toolbar */}
      {isSupervisor(userRole) && selectedTaskIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-card rounded-xl shadow-2xl border border-primary/20 ring-1 ring-primary/10 animate-in slide-in-from-bottom-4 duration-200" data-testid="batch-toolbar">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? "s" : ""} selected
          </div>
          <div className="w-px h-5 bg-border" />
          <Button
            size="sm"
            className="h-8 text-xs bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => { setAssignTaskIds(selectedTaskIds); setAssignJockeyId(""); }}
            data-testid="button-batch-assign"
          >
            <User className="h-3.5 w-3.5 mr-1.5" /> Assign Jockey
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setSelectedTaskIds([])}
            data-testid="button-batch-clear"
          >
            <X className="h-3.5 w-3.5 mr-1.5" /> Clear
          </Button>
        </div>
      )}

      {/* Move Details Drawer */}
      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={`Move M-${String(selectedTask?.id).padStart(4, "0")}`}
      >
        {selectedTask && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <Truck className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-base font-bold" data-testid="text-drawer-trailer">
                  {selectedTask.trailerNumber || "No Trailer"}
                </p>
                <p className="text-sm text-muted-foreground">{selectedTask.visitNumber} {selectedTask.carrierName ? `• ${selectedTask.carrierName}` : ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusChip status={selectedTask.status} colorFn={moveStatusColor} />
                <StatusChip status={selectedTask.priority} colorFn={movePriorityColor} size="sm" />
              </div>
            </div>

            {/* Lifecycle Timeline */}
            <DrawerSection title="Lifecycle Status">
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  {LIFECYCLE_STEPS.map((step, i) => {
                    const isActive = lifecycleIdx >= i;
                    const isCurrent = lifecycleIdx === i;
                    return (
                      <div key={step.key} className="flex items-center gap-1 flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div className={`h-1.5 w-full rounded-full transition-colors ${isActive ? "bg-primary" : "bg-muted"}`} />
                          <span className={`text-[10px] mt-1.5 whitespace-nowrap ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                            {step.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedTask.status === "rejected" && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400">
                    <Ban className="h-4 w-4" />
                    <div>
                      <span className="font-semibold">Move Rejected</span>
                      {selectedTask.rejectionReason && <p className="mt-0.5 opacity-90">{selectedTask.rejectionReason}</p>}
                    </div>
                  </div>
                )}
                {selectedTask.status === "escalated" && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-orange-50 dark:bg-orange-900/20 text-xs text-orange-600 dark:text-orange-400">
                    <ShieldAlert className="h-4 w-4" />
                    <span className="font-semibold">Move Escalated</span>
                  </div>
                )}
              </div>
            </DrawerSection>

            {/* Detail Fields */}
            <DrawerSection title="Move Information">
              <div className="grid grid-cols-1 gap-y-1">
                <DrawerField label="Move Type" value={formatMoveType(selectedTask.moveType)} />
                <DrawerField label="Source" value={sourceLabel(selectedTask.source)} />
                <DrawerField label="From Location" value={selectedTask.fromLocationName || "—"} />
                <DrawerField label="To Location" value={selectedTask.toLocationName || "—"} />
                <DrawerField label="Load Status" value={selectedTask.loadStatus ? formatStatus(selectedTask.loadStatus) : "—"} />
                <DrawerField label="Assigned Jockey" value={selectedTask.assignedToName || "Unassigned"} />
              </div>
            </DrawerSection>

            <DrawerSection title="Timestamps & Audit">
              <div className="grid grid-cols-1 gap-y-1 text-xs">
                <DrawerField label="Requested By" value={selectedTask.createdByName || "System"} />
                <DrawerField label="Requested At" value={new Date(selectedTask.createdAt).toLocaleString()} />
                {selectedTask.acceptedAt && <DrawerField label="Accepted At" value={new Date(selectedTask.acceptedAt).toLocaleString()} />}
                {selectedTask.startedAt && <DrawerField label="Started At" value={new Date(selectedTask.startedAt).toLocaleString()} />}
                {selectedTask.completedAt && <DrawerField label="Completed At" value={new Date(selectedTask.completedAt).toLocaleString()} />}
              </div>
              {selectedTask.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Notes</p>
                  <p className="text-sm text-foreground bg-muted/30 p-2.5 rounded-md italic">"{selectedTask.notes}"</p>
                </div>
              )}
            </DrawerSection>

            {/* Drawer Actions */}
            <div className="pt-4 border-t">
              {isJockey(userRole) ? (
                <>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Your Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.status === "assigned" && (
                      <>
                        <Button
                          className="flex-1"
                          onClick={() => { updateMutation.mutate({ taskId: selectedTask.id, status: "accepted" }); setDrawerOpen(false); }}
                          data-testid="drawer-accept"
                        >
                          Accept Move
                        </Button>
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
                          onClick={() => { setRejectDialog(selectedTask); setRejectReason(""); setDrawerOpen(false); }}
                          data-testid="drawer-reject"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1.5" /> Reject
                        </Button>
                      </>
                    )}
                    {selectedTask.status === "accepted" && (
                      <Button
                        className="flex-1"
                        onClick={() => { updateMutation.mutate({ taskId: selectedTask.id, status: "in_progress" }); setDrawerOpen(false); }}
                        data-testid="drawer-start"
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" /> Start Move
                      </Button>
                    )}
                    {selectedTask.status === "in_progress" && (
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { updateMutation.mutate({ taskId: selectedTask.id, status: "completed" }); setDrawerOpen(false); }}
                        data-testid="drawer-complete"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Complete Move
                      </Button>
                    )}
                    {selectedTask.status === "open" && currentPersonaId && (
                      <Button
                        className="flex-1"
                        onClick={() => { updateMutation.mutate({ taskId: selectedTask.id, status: "assigned", assignedTo: currentPersonaId }); setDrawerOpen(false); }}
                        data-testid="drawer-claim"
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Claim Task
                      </Button>
                    )}
                    {selectedTask.status === "open" && !currentPersonaId && (
                      <p className="text-xs text-muted-foreground py-2">Awaiting supervisor assignment.</p>
                    )}
                    {["completed", "rejected", "cancelled"].includes(selectedTask.status) && (
                      <p className="text-xs text-muted-foreground py-2">{`Move is ${selectedTask.status}.`}</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-2 italic">
                  Task execution actions (Accept, Start, Complete) are performed by the assigned jockey.
                </p>
              )}

              {isSupervisor(userRole) && !["completed", "cancelled"].includes(selectedTask.status) && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Supervisor Controls</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAssignDialog(selectedTask); setAssignJockeyId(selectedTask.assignedTo || ""); setDrawerOpen(false); }}
                      data-testid="drawer-assign"
                    >
                      <User className="h-3.5 w-3.5 mr-1.5" /> {selectedTask.assignedTo ? "Reassign" : "Assign"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setPriorityDialog(selectedTask); setNewPriority(selectedTask.priority); setDrawerOpen(false); }}
                      data-testid="drawer-priority"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5" /> Set Priority
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-900/30 dark:hover:bg-orange-900/20"
                      onClick={() => { updateMutation.mutate({ taskId: selectedTask.id, status: "escalated" }); setDrawerOpen(false); }}
                      data-testid="drawer-escalate"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Escalate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20"
                      onClick={() => { updateMutation.mutate({ taskId: selectedTask.id, status: "cancelled" }); setDrawerOpen(false); }}
                      data-testid="drawer-cancel"
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" /> Cancel Move
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => !o && setRejectDialog(null)}>
        <DialogContent className="max-w-sm" data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Return to Queue
            </DialogTitle>
            <DialogDescription>
              This move will be unassigned and returned to the open queue for reassignment. A reason is required for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {rejectDialog && (
              <div className="rounded-md border p-2.5 text-sm">
                <p className="font-mono font-medium">{rejectDialog.trailerNumber || "No Trailer"}</p>
                <p className="text-xs text-muted-foreground">{rejectDialog.fromLocationName} → {rejectDialog.toLocationName}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Reason <span className="text-red-500">*</span></label>
              <Textarea
                className="mt-1"
                placeholder="Why are you returning this move to the queue?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                data-testid="input-reject-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleReject}
              disabled={!rejectReason.trim() || updateMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {updateMutation.isPending ? "Returning..." : "Return to Queue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={!!assignDialog || assignTaskIds.length > 0} onOpenChange={(o) => { if (!o) { setAssignDialog(null); setAssignTaskIds([]); } }}>
        <DialogContent className="max-w-sm" data-testid="dialog-assign">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {assignTaskIds.length > 0 ? `Bulk Assign ${assignTaskIds.length} Moves` : (assignDialog?.assignedTo ? "Reassign Move" : "Assign Move")}
            </DialogTitle>
            <DialogDescription>
              {assignTaskIds.length > 0
                ? `Assign ${assignTaskIds.length} selected move tasks to a jockey.`
                : "Assign this move task to an available yard jockey."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {assignTaskIds.length > 0 ? (
              <div className="rounded-md border p-2.5 text-xs bg-muted/30">
                Assigning {assignTaskIds.length} selected tasks to a single jockey.
              </div>
            ) : assignDialog && (
              <div className="rounded-md border p-2.5 text-sm">
                <p className="font-mono font-medium">{assignDialog.trailerNumber || "No Trailer"}</p>
                <p className="text-xs text-muted-foreground">{assignDialog.fromLocationName} → {assignDialog.toLocationName}</p>
                {assignDialog.assignedToName && (
                  <p className="text-xs text-muted-foreground mt-1">Currently: {assignDialog.assignedToName}</p>
                )}
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Select Jockey</label>
              <Select value={assignJockeyId} onValueChange={setAssignJockeyId}>
                <SelectTrigger className="mt-1" data-testid="select-assign-jockey">
                  <SelectValue placeholder="Choose a jockey..." />
                </SelectTrigger>
                <SelectContent>
                  {jockeys.map((j) => {
                    const isBusy = j.jockeyStatus === "busy" || (j.activeMoveCount ?? 0) > 0;
                    return (
                      <SelectItem key={j.id} value={j.id}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${isBusy ? "bg-amber-400" : "bg-emerald-500"}`} />
                          {j.firstName} {j.lastName}
                          {isBusy
                            ? <span className="text-[10px] text-amber-600">({j.activeMoveCount ?? "?"} active)</span>
                            : <span className="text-[10px] text-emerald-600">idle</span>
                          }
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assignJockeyId || updateMutation.isPending} data-testid="button-confirm-assign">
              {updateMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Priority Dialog */}
      <Dialog open={!!priorityDialog} onOpenChange={(o) => !o && setPriorityDialog(null)}>
        <DialogContent className="max-w-sm" data-testid="dialog-priority">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Change Priority
            </DialogTitle>
            <DialogDescription>
              Update the dispatch priority for this move task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger data-testid="select-new-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriorityDialog(null)}>Cancel</Button>
            <Button onClick={handleChangePriority} disabled={updateMutation.isPending} data-testid="button-confirm-priority">
              Update Priority
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Move Dialog */}
      <CreateMoveDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        yardAssets={yardAssets}
        availableSlots={availableSlots}
        availableDoors={availableDoors}
        jockeys={jockeys}
        jockeyWorkload={jockeyWorkload}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

function CreateMoveDialog({
  open,
  onOpenChange,
  yardAssets,
  availableSlots,
  availableDoors,
  jockeys,
  jockeyWorkload,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yardAssets: YardAsset[];
  availableSlots: SlotOption[];
  availableDoors: DoorOption[];
  jockeys: Jockey[];
  jockeyWorkload: { name: string; active: number; total: number; overdue: number }[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const [moveType, setMoveType] = useState("reposition");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [fromLocationType, setFromLocationType] = useState("slot");
  const [fromLocationId, setFromLocationId] = useState("");
  const [fromLocationName, setFromLocationName] = useState("");
  const [toLocationType, setToLocationType] = useState("slot");
  const [toLocationId, setToLocationId] = useState("");
  const [toLocationName, setToLocationName] = useState("");
  const [loadStatus, setLoadStatus] = useState("");
  const [priority, setPriority] = useState("normal");
  const [assignTo, setAssignTo] = useState("");
  const [notes, setNotes] = useState("");

  const selectedAsset = yardAssets.find((a) => String(a.id) === selectedAssetId);

  function handleAssetSelect(assetId: string) {
    setSelectedAssetId(assetId);
    const asset = yardAssets.find((a) => String(a.id) === assetId);
    if (asset) {
      if (asset.currentSlotNumber && asset.zoneName) {
        setFromLocationType("slot");
        setFromLocationName(`${asset.zoneName} - ${asset.currentSlotNumber}`);
      } else if (asset.currentDockDoor) {
        setFromLocationType("dock");
        setFromLocationName(asset.currentDockDoor);
      } else {
        setFromLocationType("yard");
        setFromLocationName(asset.locationStatus);
      }
    }
  }

  function handleToLocationSelect(type: string, id: string) {
    setToLocationType(type);
    setToLocationId(id);
    if (type === "slot") {
      const slot = availableSlots.find((s) => String(s.id) === id);
      if (slot) setToLocationName(`${slot.zoneName} - ${slot.slotNumber}`);
    } else if (type === "dock") {
      const door = availableDoors.find((d) => String(d.id) === id);
      if (door) setToLocationName(`Dock ${door.doorNumber}`);
    }
  }

  function handleCreate() {
    if (!selectedAssetId) return;
    onSubmit({
      visitId: Number(selectedAssetId),
      moveType,
      fromLocationType,
      fromLocationId: fromLocationId ? Number(fromLocationId) : null,
      fromLocationName: fromLocationName || null,
      toLocationType,
      toLocationId: toLocationId ? Number(toLocationId) : null,
      toLocationName: toLocationName || null,
      loadStatus: loadStatus || null,
      priority,
      assignedTo: assignTo && assignTo !== "__none__" ? assignTo : null,
      notes: notes || null,
      source: "manual",
    });
  }

  function handleReset() {
    setMoveType("reposition");
    setSelectedAssetId("");
    setFromLocationType("slot");
    setFromLocationId("");
    setFromLocationName("");
    setToLocationType("slot");
    setToLocationId("");
    setToLocationName("");
    setLoadStatus("");
    setPriority("normal");
    setAssignTo("");
    setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-move">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Move Request
          </DialogTitle>
          <DialogDescription>
            Create a new yard move. Select an asset and destination.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Move Type</label>
            <Select value={moveType} onValueChange={setMoveType}>
              <SelectTrigger className="mt-1" data-testid="select-create-move-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVE_TYPES.map((mt) => (
                  <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium">Trailer / Asset</label>
            <Select value={selectedAssetId} onValueChange={handleAssetSelect}>
              <SelectTrigger className="mt-1" data-testid="select-create-asset">
                <SelectValue placeholder="Select asset..." />
              </SelectTrigger>
              <SelectContent>
                {yardAssets.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.trailerNumber || a.visitNumber} — {a.carrierName || "Unknown"} ({a.currentSlotNumber || a.currentDockDoor || a.locationStatus})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAsset && (
            <div className="md:col-span-2 rounded-md border p-2.5 text-sm bg-muted/30">
              <div className="flex items-center gap-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono font-medium">{selectedAsset.trailerNumber || selectedAsset.visitNumber}</span>
                <span className="text-xs text-muted-foreground">{selectedAsset.carrierName}</span>
                <Badge className="text-[10px] ml-auto" variant="secondary">
                  {selectedAsset.currentSlotNumber || selectedAsset.currentDockDoor || selectedAsset.locationStatus}
                </Badge>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium">From Location</label>
            <Input
              className="mt-1"
              value={fromLocationName}
              onChange={(e) => setFromLocationName(e.target.value)}
              placeholder="Auto-filled from asset"
              data-testid="input-from-location"
            />
          </div>

          <div>
            <label className="text-xs font-medium">To Location</label>
            <div className="flex gap-1 mt-1">
              <Select value={toLocationType} onValueChange={(v) => { setToLocationType(v); setToLocationId(""); setToLocationName(""); }}>
                <SelectTrigger className="w-24" data-testid="select-to-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slot">Slot</SelectItem>
                  <SelectItem value="dock">Dock</SelectItem>
                  <SelectItem value="gate">Gate</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                </SelectContent>
              </Select>
              {toLocationType === "slot" ? (
                <Select value={toLocationId} onValueChange={(id) => handleToLocationSelect("slot", id)}>
                  <SelectTrigger className="flex-1" data-testid="select-to-slot">
                    <SelectValue placeholder="Select slot..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.zoneName} - {s.slotNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : toLocationType === "dock" ? (
                <Select value={toLocationId} onValueChange={(id) => handleToLocationSelect("dock", id)}>
                  <SelectTrigger className="flex-1" data-testid="select-to-dock">
                    <SelectValue placeholder="Select dock..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDoors.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>Dock {d.doorNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="flex-1"
                  value={toLocationName}
                  onChange={(e) => setToLocationName(e.target.value)}
                  placeholder="Location name..."
                  data-testid="input-to-location"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium">Load Status</label>
            <Select value={loadStatus} onValueChange={setLoadStatus}>
              <SelectTrigger className="mt-1" data-testid="select-load-status">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {LOAD_STATUSES.map((ls) => (
                  <SelectItem key={ls.value} value={ls.value}>{ls.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium">Priority</label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="mt-1" data-testid="select-create-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium">Assign to Jockey (optional)</label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger className="mt-1" data-testid="select-create-jockey">
                <SelectValue placeholder="Leave unassigned..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned Queue</SelectItem>
                {jockeys.map((j) => {
                  const statusDot = j.jockeyStatus === "busy" ? "🔴" : j.jockeyStatus === "available" ? "🟢" : "⚪";
                  const workLabel = (j.activeMoveCount ?? 0) > 0 ? `${j.activeMoveCount} active` : "idle";
                  return (
                    <SelectItem key={j.id} value={j.id}>
                      {statusDot} {j.firstName} {j.lastName} ({workLabel})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium">Notes / Instructions (optional)</label>
            <Textarea
              className="mt-1 h-16"
              placeholder="Special instructions for the jockey..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-create-notes"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-reset-form">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={isPending || !selectedAssetId || !toLocationName}
            data-testid="button-submit-move"
          >
            {isPending ? "Creating..." : (assignTo && assignTo !== "__none__") ? "Assign Directly" : "Create Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
