import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { dockStatusColor } from "@/lib/status-colors";
import {
  DetailDrawer,
  DrawerSection,
  DrawerField,
  PageHeader,
  KPICard,
  StatusChip,
} from "@/components/enterprise";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DoorOpen,
  Truck,
  Play,
  CheckCircle2,
  ArrowLeft,
  Clock,
  MoreHorizontal,
  ChevronDown,
  Loader2,
  AlertTriangle,
  FileSearch,
  MoveUpRight,
  ShieldAlert,
  FileText,
  RotateCcw,
  Wrench,
  PackageOpen,
  PackageCheck,
  ArrowRight,
  CircleDot,
  Zap,
  CalendarDays,
  Kanban,
  Search,
  GripVertical,
  Bell,
  User,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  useDroppable,
  useDraggable,
  closestCenter,
  DragOverlay,
  pointerWithin,
} from "@dnd-kit/core";

interface DockDoorView {
  id: number;
  doorNumber: string;
  status: string;
  visitId: number | null;
  visitNumber: string | null;
  trailerNumber: string | null;
  carrierName: string | null;
  visitStatus: string | null;
  movementType: string | null;
  checkInTime: string | null;
  activityStartTime: string | null;
  activityEndTime: string | null;
  nextTrailerNumber: string | null;
}

type DockGroup = "active" | "occupied" | "available" | "completed" | "maintenance";

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getElapsedTime(checkInTime: string | null): { text: string; hours: number; minutes: number } {
  if (!checkInTime) return { text: "—", hours: 0, minutes: 0 };
  const diff = Date.now() - new Date(checkInTime).getTime();
  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return { text: `${hours}h ${minutes}m`, hours, minutes };
  return { text: `${minutes}m`, hours: 0, minutes };
}

function getSlaIndicator(hours: number): { color: string; bgColor: string; label: string; level: "ok" | "warning" | "over" } {
  if (hours >= 4) return { color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300", label: "Over SLA", level: "over" };
  if (hours >= 2) return { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300", label: "At Risk", level: "warning" };
  return { color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300", label: "On Time", level: "ok" };
}

function SlaRing({ elapsedHours, slaHours = 4, text, size = 52 }: { elapsedHours: number; slaHours?: number; text: string; size?: number }) {
  const sla = getSlaIndicator(elapsedHours);
  const pct = Math.min(elapsedHours / slaHours, 1);
  const r = (size - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - pct);
  const trackColor = "rgba(100,100,100,0.12)";
  const ringColor = sla.level === "over" ? "#ef4444" : sla.level === "warning" ? "#f59e0b" : "#22c55e";
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }} data-testid="sla-ring">
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={trackColor} strokeWidth={5} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={ringColor} strokeWidth={5}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center justify-center z-10">
        <span className={`text-[10px] font-bold leading-none tabular-nums ${sla.color}`}>{text}</span>
        <span className="text-[8px] text-muted-foreground leading-none mt-0.5">{sla.label}</span>
      </div>
    </div>
  );
}

function getDockGroup(door: DockDoorView): DockGroup {
  if (door.status === "maintenance") return "maintenance";
  if (door.visitStatus === "loading" || door.visitStatus === "unloading") return "active";
  if (door.visitStatus === "ready_out") return "completed";
  if (door.visitId) return "occupied";
  return "available";
}


function MovementIcon({ type }: { type: string | null }) {
  if (!type) return null;
  if (type === "inbound" || type === "live_unload") return <PackageOpen className="h-3 w-3 text-blue-500" />;
  if (type === "outbound" || type === "live_load") return <PackageCheck className="h-3 w-3 text-emerald-500" />;
  return <ArrowRight className="h-3 w-3 text-muted-foreground" />;
}

const MOVEMENT_BADGE_COLOR: Record<string, string> = {
  inbound:     "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  outbound:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
  live_load:   "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700",
  live_unload: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-700",
  drop_hook:   "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-600",
};

function MovementBadge({ type }: { type: string }) {
  const color = MOVEMENT_BADGE_COLOR[type] ?? "bg-secondary text-secondary-foreground border-border";
  const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${color}`}
      data-testid={`badge-movement-${type}`}
    >
      <MovementIcon type={type} />
      {label}
    </span>
  );
}

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const DAY_SPAN_MINS = (DAY_END_HOUR - DAY_START_HOUR) * 60;

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function timeLabel(h: number) {
  const suffix = h < 12 ? "AM" : "PM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}${suffix}`;
}

function DockScheduleView({ doors }: { doors: DockDoorView[] }) {
  const now = new Date();
  const nowMin = minuteOfDay(now);
  const startMin = DAY_START_HOUR * 60;
  const endMin = DAY_END_HOUR * 60;

  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);
  const nowPct = Math.min(100, Math.max(0, ((nowMin - startMin) / DAY_SPAN_MINS) * 100));

  const SLA_COLORS: Record<string, string> = {
    "loading":    "bg-amber-400 dark:bg-amber-600",
    "unloading":  "bg-blue-400 dark:bg-blue-600",
    "at_dock":    "bg-violet-400 dark:bg-violet-600",
    "ready_out":  "bg-emerald-400 dark:bg-emerald-600",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {[
          { color: "bg-amber-400", label: "Loading" },
          { color: "bg-blue-400", label: "Unloading" },
          { color: "bg-violet-400", label: "At Dock" },
          { color: "bg-emerald-400", label: "Ready Out" },
          { color: "bg-muted", label: "Available" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />{label}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="inline-block h-4 w-px bg-red-500" />Current Time
        </span>
      </div>

      <div className="border rounded-xl overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 700 }}>
            <div className="grid border-b" style={{ gridTemplateColumns: "7rem 1fr" }}>
              <div className="p-2 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/40 border-r">Door</div>
              <div className="relative">
                <div className="flex border-b" style={{ height: 24 }}>
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="border-r text-[9px] text-muted-foreground flex items-center justify-start pl-1"
                      style={{ width: `${100 / (hours.length - 1)}%`, flexShrink: 0 }}
                    >
                      {timeLabel(h)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {doors.map((door, idx) => {
              const hasVisit = !!door.visitId;
              const checkIn = door.checkInTime ? new Date(door.checkInTime) : null;
              const actEnd = door.activityEndTime ? new Date(door.activityEndTime) : null;

              let blockLeft = 0, blockWidth = 0;
              if (checkIn) {
                const blockStart = Math.max(minuteOfDay(checkIn), startMin);
                const blockEnd = Math.min(actEnd ? minuteOfDay(actEnd) : nowMin, endMin);
                blockLeft = ((blockStart - startMin) / DAY_SPAN_MINS) * 100;
                blockWidth = Math.max(0, ((blockEnd - blockStart) / DAY_SPAN_MINS) * 100);
              }

              const blockColor = SLA_COLORS[door.visitStatus || ""] || "bg-violet-400 dark:bg-violet-600";
              const isEven = idx % 2 === 0;

              return (
                <div
                  key={door.id}
                  className={`grid border-b last:border-b-0 ${isEven ? "bg-background" : "bg-muted/20"}`}
                  style={{ gridTemplateColumns: "7rem 1fr", height: 38 }}
                >
                  <div className="border-r flex items-center px-2 gap-1.5 shrink-0">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${
                      door.status === "maintenance" ? "bg-orange-400" :
                      hasVisit ? "bg-emerald-400 animate-pulse" : "bg-muted"
                    }`} />
                    <span className="text-xs font-mono font-semibold truncate">{door.doorNumber}</span>
                  </div>
                  <div className="relative overflow-hidden">
                    {hours.map((h, i) => i < hours.length - 1 && (
                      <div
                        key={h}
                        className="absolute top-0 bottom-0 border-r border-muted/40"
                        style={{ left: `${(i / (hours.length - 1)) * 100}%` }}
                      />
                    ))}

                    {hasVisit && blockWidth > 0 && (
                      <div
                        className={`absolute top-2 bottom-2 rounded ${blockColor} flex items-center px-1.5 overflow-hidden group cursor-pointer`}
                        style={{ left: `${blockLeft}%`, width: `${blockWidth}%`, minWidth: 24 }}
                      >
                        <span className="text-[9px] font-bold text-white truncate">
                          {door.trailerNumber || door.visitNumber || ""}
                        </span>
                      </div>
                    )}

                    {door.status === "maintenance" && (
                      <div
                        className="absolute top-2 bottom-2 rounded bg-orange-300/70 dark:bg-orange-800/60 flex items-center px-1.5"
                        style={{ left: "0%", width: "100%" }}
                      >
                        <span className="text-[9px] font-bold text-orange-900 dark:text-orange-200 truncate">MAINTENANCE</span>
                      </div>
                    )}

                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500 z-10 opacity-70"
                      style={{ left: `${nowPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-right">
        Timeline shows {timeLabel(DAY_START_HOUR)} – {timeLabel(DAY_END_HOUR)} · Blocks show vehicle dwell time · Red line = current time
      </p>
    </div>
  );
}

// ── KANBAN COMPONENTS ──────────────────────────────────────────────────────

type KanbanColumnId = "available" | "at_dock" | "loading" | "unloading" | "ready_out" | "maintenance";

const KANBAN_COLS: {
  id: KanbanColumnId;
  label: string;
  description: string;
  topBorder: string;
  headerBg: string;
  headerText: string;
  countBg: string;
  icon: typeof DoorOpen;
  dropHint: string;
}[] = [
  { id: "available",    label: "Available",        description: "Open & ready for assignment", topBorder: "border-t-sky-400",     headerBg: "bg-sky-50 dark:bg-sky-950/30",       headerText: "text-sky-800 dark:text-sky-200",     countBg: "bg-sky-400 text-white",     icon: DoorOpen,     dropHint: "Drop to mark available" },
  { id: "at_dock",      label: "At Dock",           description: "Trailer waiting to be worked", topBorder: "border-t-violet-500", headerBg: "bg-violet-50 dark:bg-violet-950/30", headerText: "text-violet-800 dark:text-violet-200", countBg: "bg-violet-500 text-white", icon: Truck,        dropHint: "Drop to assign to dock" },
  { id: "loading",      label: "Loading",           description: "Active outbound load in progress", topBorder: "border-t-amber-500", headerBg: "bg-amber-50 dark:bg-amber-950/30",   headerText: "text-amber-800 dark:text-amber-200",   countBg: "bg-amber-500 text-white",  icon: PackageCheck, dropHint: "Drop to start loading" },
  { id: "unloading",    label: "Unloading",         description: "Active inbound unload in progress", topBorder: "border-t-blue-500",  headerBg: "bg-blue-50 dark:bg-blue-950/30",     headerText: "text-blue-800 dark:text-blue-200",     countBg: "bg-blue-500 text-white",   icon: PackageOpen,  dropHint: "Drop to start unloading" },
  { id: "ready_out",    label: "Ready to Move",     description: "Activity done, awaiting jockey", topBorder: "border-t-emerald-500", headerBg: "bg-emerald-50 dark:bg-emerald-950/30", headerText: "text-emerald-800 dark:text-emerald-200", countBg: "bg-emerald-500 text-white", icon: CheckCircle2, dropHint: "Drop to mark complete" },
  { id: "maintenance",  label: "Maintenance",       description: "Door unavailable for operations", topBorder: "border-t-slate-400", headerBg: "bg-slate-100 dark:bg-slate-800/40",  headerText: "text-slate-700 dark:text-slate-300",  countBg: "bg-slate-500 text-white",  icon: Wrench,       dropHint: "Drop to put in maintenance" },
];

function getKanbanColumnId(door: DockDoorView): KanbanColumnId {
  if (door.status === "maintenance") return "maintenance";
  if (!door.visitId) return "available";
  if (door.visitStatus === "loading") return "loading";
  if (door.visitStatus === "unloading") return "unloading";
  if (door.visitStatus === "ready_out") return "ready_out";
  return "at_dock";
}

function getPriority(door: DockDoorView): { label: string; color: string; level: number } {
  if (!door.visitId) return { label: "None", color: "text-muted-foreground", level: 0 };
  const elapsed = getElapsedTime(door.checkInTime);
  if (elapsed.hours >= 4) return { label: "Critical", color: "text-red-600 dark:text-red-400", level: 3 };
  if (elapsed.hours >= 2) return { label: "High", color: "text-amber-600 dark:text-amber-400", level: 2 };
  if (elapsed.hours >= 1) return { label: "Medium", color: "text-blue-600 dark:text-blue-400", level: 1 };
  return { label: "Normal", color: "text-emerald-600 dark:text-emerald-400", level: 0 };
}

function KanbanDockCard({
  door,
  onSelect,
  isDragging = false,
}: {
  door: DockDoorView;
  onSelect: (door: DockDoorView) => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging: localDragging } = useDraggable({ id: door.id });
  const elapsed = getElapsedTime(door.checkInTime);
  const sla = getSlaIndicator(elapsed.hours);
  const priority = getPriority(door);
  const colId = getKanbanColumnId(door);
  const col = KANBAN_COLS.find(c => c.id === colId)!;
  const isActive = door.visitStatus === "loading" || door.visitStatus === "unloading";

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border rounded-lg overflow-hidden shadow-sm transition-all cursor-grab active:cursor-grabbing select-none
        ${localDragging ? "opacity-40 shadow-lg scale-95" : "hover:shadow-md"}
        ${sla.level === "over" ? "ring-1 ring-red-400/50" : sla.level === "warning" ? "ring-1 ring-amber-400/30" : ""}
      `}
      data-testid={`kanban-card-${door.id}`}
    >
      {/* Drag handle header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${col.headerBg}`} {...attributes} {...listeners}>
        <GripVertical className={`h-3.5 w-3.5 ${col.headerText} opacity-40 shrink-0`} />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={`text-xs font-mono font-bold ${col.headerText}`}>{door.doorNumber}</span>
          {priority.level >= 2 && (
            <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${
              priority.level === 3 ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
              "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}>
              {priority.label}
            </span>
          )}
        </div>
        {isActive && (
          <CircleDot className="h-3 w-3 text-amber-500 animate-pulse shrink-0" />
        )}
      </div>

      {/* Card body — clickable for detail drawer */}
      <div className="p-3 space-y-2 cursor-pointer" onClick={() => onSelect(door)}>
        {door.status === "maintenance" ? (
          <div className="flex flex-col items-center py-3 text-center">
            <Wrench className="h-5 w-5 text-slate-400 mb-1" />
            <p className="text-xs text-muted-foreground">Under Maintenance</p>
          </div>
        ) : door.visitId ? (
          <>
            {/* Trailer + carrier */}
            <div>
              <p className="text-sm font-bold truncate" data-testid={`kanban-trailer-${door.id}`}>
                {door.trailerNumber || "—"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate" data-testid={`kanban-carrier-${door.id}`}>
                {door.carrierName || "Unknown carrier"}
              </p>
            </div>

            {/* Movement badge */}
            {door.movementType && (
              <MovementBadge type={door.movementType} />
            )}

            {/* SLA + elapsed time */}
            <div className={`flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-medium border ${sla.bgColor}`}>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="font-semibold tabular-nums">{elapsed.text}</span>
              </div>
              <div className="flex items-center gap-1">
                {sla.level !== "ok" && <AlertTriangle className="h-3 w-3" />}
                <span className="text-[10px]">{sla.label}</span>
              </div>
            </div>

            {/* SLA progress bar */}
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  sla.level === "over" ? "bg-red-500" : sla.level === "warning" ? "bg-amber-400" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min((elapsed.hours / 4) * 100, 100)}%` }}
              />
            </div>

            {/* Next queued */}
            {door.nextTrailerNumber && (
              <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
                <ArrowRight className="h-2.5 w-2.5" />
                <span>Next: {door.nextTrailerNumber}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-3 text-center">
            <DoorOpen className="h-5 w-5 text-sky-400 mb-1" />
            <p className="text-xs text-muted-foreground">Open &amp; Ready</p>
            {door.nextTrailerNumber && (
              <p className="text-[10px] text-blue-500 mt-1">Next: {door.nextTrailerNumber}</p>
            )}
          </div>
        )}
      </div>

      {/* SLA alert banner for over-SLA cards */}
      {sla.level === "over" && door.visitId && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-800">
          <p className="text-[10px] text-red-700 dark:text-red-300 font-semibold flex items-center gap-1">
            <Bell className="h-2.5 w-2.5" /> SLA Breach — Escalation Required
          </p>
        </div>
      )}
    </div>
  );
}

function DroppableColumn({
  col,
  doors,
  isDragOver,
  onSelect,
  searchQuery,
}: {
  col: typeof KANBAN_COLS[number];
  doors: DockDoorView[];
  isDragOver: boolean;
  onSelect: (door: DockDoorView) => void;
  searchQuery: string;
}) {
  const { setNodeRef } = useDroppable({ id: col.id });
  const ColIcon = col.icon;

  const filteredDoors = useMemo(() => {
    if (!searchQuery) return doors;
    const q = searchQuery.toLowerCase();
    return doors.filter(
      (d) =>
        d.doorNumber.toLowerCase().includes(q) ||
        (d.trailerNumber || "").toLowerCase().includes(q) ||
        (d.carrierName || "").toLowerCase().includes(q)
    );
  }, [doors, searchQuery]);

  return (
    <div className="flex flex-col min-w-[230px] max-w-[260px] flex-1" data-testid={`kanban-col-${col.id}`}>
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-t-lg border border-b-0 ${col.headerBg} border-border`}>
        <ColIcon className={`h-3.5 w-3.5 ${col.headerText} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${col.headerText} truncate`}>{col.label}</p>
          <p className="text-[9px] text-muted-foreground truncate">{col.description}</p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${col.countBg}`}>
          {filteredDoors.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-b-lg border border-t-0 border-dashed p-2 space-y-2 transition-colors
          ${isDragOver
            ? "border-primary bg-primary/5 border-solid"
            : "border-border bg-muted/20"
          }`}
      >
        {filteredDoors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <ColIcon className={`h-5 w-5 ${col.headerText} opacity-30 mb-1`} />
            <p className="text-[10px] text-muted-foreground/60">
              {isDragOver ? col.dropHint : "No doors here"}
            </p>
          </div>
        ) : (
          filteredDoors.map((door) => (
            <KanbanDockCard key={door.id} door={door} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}

function DockKanbanBoard({
  doors,
  onSelect,
  onAction,
  onComplete,
  onMarkMaintenance,
  onClearMaintenance,
  searchQuery,
}: {
  doors: DockDoorView[];
  onSelect: (door: DockDoorView) => void;
  onAction: (visitId: number, action: string) => void;
  onComplete: (door: DockDoorView) => void;
  onMarkMaintenance: (doorId: number) => void;
  onClearMaintenance: (doorId: number) => void;
  searchQuery: string;
}) {
  const { toast } = useToast();
  const [activeDoorId, setActiveDoorId] = useState<number | null>(null);
  const [overColumnId, setOverColumnId] = useState<KanbanColumnId | null>(null);

  const grouped = useMemo(() => {
    const map: Record<KanbanColumnId, DockDoorView[]> = {
      available: [], at_dock: [], loading: [], unloading: [], ready_out: [], maintenance: [],
    };
    for (const door of doors) {
      map[getKanbanColumnId(door)].push(door);
    }
    for (const key of Object.keys(map) as KanbanColumnId[]) {
      map[key].sort((a, b) => a.doorNumber.localeCompare(b.doorNumber, undefined, { numeric: true }));
    }
    return map;
  }, [doors]);

  const activeDoor = activeDoorId ? doors.find(d => d.id === activeDoorId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveDoorId(Number(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id as KanbanColumnId | undefined;
    setOverColumnId(overId ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDoorId(null);
    setOverColumnId(null);
    if (!over) return;

    const doorId = Number(active.id);
    const targetCol = over.id as KanbanColumnId;
    const door = doors.find(d => d.id === doorId);
    if (!door) return;

    const sourceCol = getKanbanColumnId(door);
    if (sourceCol === targetCol) return;

    // Determine which action to take based on target column
    if (targetCol === "loading" && door.visitId) {
      onAction(door.visitId, "start_loading");
    } else if (targetCol === "unloading" && door.visitId) {
      onAction(door.visitId, "start_unloading");
    } else if (targetCol === "ready_out" && door.visitId) {
      // Open completion dialog — let parent handle the checklist flow
      onComplete(door);
    } else if (targetCol === "available" && door.visitId) {
      onAction(door.visitId, "release");
    } else if (targetCol === "maintenance") {
      onMarkMaintenance(door.id);
    } else if (targetCol === "available" && door.status === "maintenance") {
      onClearMaintenance(door.id);
    } else {
      toast({ title: "Invalid transition", description: `Cannot move from ${sourceCol} to ${targetCol}`, variant: "destructive" });
    }
  }

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[420px]" data-testid="kanban-board">
        {KANBAN_COLS.map((col) => (
          <DroppableColumn
            key={col.id}
            col={col}
            doors={grouped[col.id]}
            isDragOver={overColumnId === col.id}
            onSelect={onSelect}
            searchQuery={searchQuery}
          />
        ))}
      </div>

      {/* Drag overlay — ghost card while dragging */}
      <DragOverlay>
        {activeDoor ? (
          <div className="bg-card border rounded-lg shadow-xl opacity-95 p-3 w-[220px] rotate-1 scale-105">
            <p className="text-xs font-mono font-bold text-primary">{activeDoor.doorNumber}</p>
            {activeDoor.trailerNumber && (
              <p className="text-sm font-semibold mt-1 truncate">{activeDoor.trailerNumber}</p>
            )}
            {activeDoor.carrierName && (
              <p className="text-[11px] text-muted-foreground truncate">{activeDoor.carrierName}</p>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── KANBAN LEGEND ──────────────────────────────────────────────────────────
function KanbanLegend() {
  return (
    <div className="flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground px-1">
      <span className="flex items-center gap-1.5 font-medium">
        <GripVertical className="h-3 w-3" /> Drag cards between columns to update status
      </span>
      <span className="w-px h-3 bg-border" />
      {[
        { color: "bg-emerald-500", label: "On Time" },
        { color: "bg-amber-400", label: "At Risk (2h+)" },
        { color: "bg-red-500", label: "Over SLA (4h+)" },
      ].map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1">
          <span className={`inline-block h-1.5 w-4 rounded-full ${color}`} />{label}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <Bell className="h-3 w-3 text-red-500" /> Alert banner = SLA breach
      </span>
    </div>
  );
}

type ViewMode = "kanban" | "schedule";

export default function DockManagementPage({ userRole, currentPersona }: { userRole?: string; currentPersona?: any } = {}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoor, setSelectedDoor] = useState<DockDoorView | null>(null);
  const [exceptionDoor, setExceptionDoor] = useState<DockDoorView | null>(null);
  const [completionDoor, setCompletionDoor] = useState<DockDoorView | null>(null);
  const [completionChecks, setCompletionChecks] = useState({ activityDone: false, paperwork: false, sealApplied: false });
  const [completionOutcome, setCompletionOutcome] = useState<string>("ready_out");
  const [exceptionData, setExceptionData] = useState({ type: "damage", severity: "medium", description: "" });

  const { data: doors = [], isLoading } = useQuery<DockDoorView[]>({
    queryKey: ["/api/dock/doors"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { visitId: number; action: string }) => {
      if (data.action === "hold_paperwork") {
        await apiRequest("POST", "/api/dock/action", { visitId: data.visitId, action: "complete" });
        return apiRequest("PATCH", `/api/visits/${data.visitId}/status`, { holdStatus: "documentation_hold" });
      }
      const res = await apiRequest("POST", "/api/dock/action", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Dock status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const maintenanceMutation = useMutation({
    mutationFn: async ({ doorId, status }: { doorId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/dock/doors/${doorId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Door status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async (door: DockDoorView) => {
      return apiRequest("POST", "/api/moves", {
        visitId: door.visitId,
        moveType: "dock_to_yard",
        fromLocationType: "dock",
        fromLocationId: door.id,
        fromLocationName: `Door ${door.doorNumber}`,
        toLocationType: "staging",
        priority: "normal",
        source: "dock_request",
      });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Move requested", description: "Jockey has been notified" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const exceptionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/exceptions", data);
    },
    onSuccess: () => {
      setExceptionDoor(null);
      setExceptionData({ type: "damage", severity: "medium", description: "" });
      invalidateAll();
      toast({ title: "Exception raised", description: "The exception has been logged" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const groupCounts = useMemo(() => {
    const counts: Record<DockGroup, number> = { active: 0, occupied: 0, completed: 0, available: 0, maintenance: 0 };
    for (const d of doors) counts[getDockGroup(d)]++;
    return counts;
  }, [doors]);

  const occupied = doors.filter((d) => d.visitId).length;
  const total = doors.length;
  const utilization = total > 0 ? Math.round((occupied / total) * 100) : 0;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-64 rounded-md" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Dock Management"
        subtitle="Monitor and control real-time dock door operations and trailer activities"
        icon={<DoorOpen className="h-5 w-5" />}
        kpiStrip={
          <>
            <KPICard
              label="Utilization"
              value={`${utilization}%`}
              icon={<DoorOpen className="h-5 w-5" />}
              accent="border-l-blue-500"
              data-testid="kpi-utilization"
            />
            <KPICard
              label="Active Doors"
              value={groupCounts.active}
              icon={<Zap className="h-5 w-5" />}
              accent="border-l-amber-500"
              data-testid="kpi-active"
            />
            <KPICard
              label="Occupied"
              value={groupCounts.occupied + groupCounts.completed}
              icon={<Truck className="h-5 w-5" />}
              accent="border-l-violet-500"
              data-testid="kpi-occupied"
            />
            <KPICard
              label="Available"
              value={groupCounts.available}
              icon={<CheckCircle2 className="h-5 w-5" />}
              accent="border-l-emerald-500"
              data-testid="kpi-available"
            />
          </>
        }
      />

      {/* Search + view toggle */}
      <div className="flex items-center gap-2 flex-wrap" data-testid="filter-tabs">
        {viewMode === "kanban" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search door, trailer, carrier…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-8 text-xs w-56 rounded-full"
              data-testid="kanban-search"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 border rounded-full p-0.5 bg-muted/40">
          <Button
            size="sm"
            variant={viewMode === "kanban" ? "default" : "ghost"}
            className="rounded-full h-6 text-[11px] px-2.5 gap-1"
            onClick={() => setViewMode("kanban")}
            data-testid="button-view-kanban"
          >
            <Kanban className="h-3 w-3" /> Kanban
          </Button>
          <Button
            size="sm"
            variant={viewMode === "schedule" ? "default" : "ghost"}
            className="rounded-full h-6 text-[11px] px-2.5 gap-1"
            onClick={() => setViewMode("schedule")}
            data-testid="button-view-schedule"
          >
            <CalendarDays className="h-3 w-3" /> Schedule
          </Button>
        </div>
      </div>

      {viewMode === "schedule" && (
        <DockScheduleView doors={doors} />
      )}

      {viewMode === "kanban" && (
        <div className="space-y-3">
          <KanbanLegend />
          <DockKanbanBoard
            doors={doors}
            onSelect={(d) => setSelectedDoor(d)}
            onAction={(visitId, action) => updateMutation.mutate({ visitId, action })}
            onComplete={(d) => setCompletionDoor(d)}
            onMarkMaintenance={(doorId) => maintenanceMutation.mutate({ doorId, status: "maintenance" })}
            onClearMaintenance={(doorId) => maintenanceMutation.mutate({ doorId, status: "available" })}
            searchQuery={searchQuery}
          />
        </div>
      )}

      {/* Completion Dialog */}
      <Dialog open={!!completionDoor} onOpenChange={(open) => { if (!open) { setCompletionDoor(null); setCompletionChecks({ activityDone: false, paperwork: false, sealApplied: false }); setCompletionOutcome("ready_out"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Complete Dock Activity — Door {completionDoor?.doorNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Confirmation Checklist</p>
              <label className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer" data-testid="check-activity-done">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" checked={completionChecks.activityDone} onChange={(e) => setCompletionChecks({ ...completionChecks, activityDone: e.target.checked })} />
                <div>
                  <p className="text-sm font-medium">{completionDoor?.visitStatus === "loading" ? "Loading" : "Unloading"} Completed</p>
                  <p className="text-xs text-muted-foreground">All cargo has been {completionDoor?.visitStatus === "loading" ? "loaded onto" : "removed from"} the trailer</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer" data-testid="check-paperwork">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" checked={completionChecks.paperwork} onChange={(e) => setCompletionChecks({ ...completionChecks, paperwork: e.target.checked })} />
                <div>
                  <p className="text-sm font-medium">Paperwork Verified</p>
                  <p className="text-xs text-muted-foreground">BOL, delivery receipt, or pick ticket has been signed and collected</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30 cursor-pointer" data-testid="check-seal">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" checked={completionChecks.sealApplied} onChange={(e) => setCompletionChecks({ ...completionChecks, sealApplied: e.target.checked })} />
                <div>
                  <p className="text-sm font-medium">Seal Applied (if required)</p>
                  <p className="text-xs text-muted-foreground">New outbound seal has been placed and number recorded</p>
                </div>
              </label>
            </div>
            <div className="space-y-2">
              <Label>Next Step</Label>
              <Select value={completionOutcome} onValueChange={setCompletionOutcome}>
                <SelectTrigger data-testid="select-completion-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ready_out">
                    <span className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Ready Out — Trailer cleared for gate departure</span>
                  </SelectItem>
                  <SelectItem value="return_yard">
                    <span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5 text-amber-500" /> Return to Yard — Move back to staging area</span>
                  </SelectItem>
                  <SelectItem value="hold_paperwork">
                    <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-blue-500" /> Hold for Paperwork — Block departure until docs ready</span>
                  </SelectItem>
                  <SelectItem value="needs_inspection">
                    <span className="flex items-center gap-2"><FileSearch className="h-3.5 w-3.5 text-orange-500" /> Needs Inspection — Route to inspection before release</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletionDoor(null)} data-testid="button-cancel-completion">Cancel</Button>
            <Button
              disabled={!completionChecks.activityDone || updateMutation.isPending}
              onClick={() => {
                if (!completionDoor?.visitId) return;
                const actionMap: Record<string, string> = { ready_out: "complete", return_yard: "release", hold_paperwork: "hold_paperwork", needs_inspection: "complete" };
                updateMutation.mutate({ visitId: completionDoor.visitId, action: actionMap[completionOutcome] || "complete" });
                if (completionOutcome === "needs_inspection") {
                  setLocation(`/inspections?visitId=${completionDoor.visitId}&type=dock_pre_load&trailer=${encodeURIComponent(completionDoor.trailerNumber || "")}`);
                }
                setCompletionDoor(null);
                setCompletionChecks({ activityDone: false, paperwork: false, sealApplied: false });
                setCompletionOutcome("ready_out");
              }}
              data-testid="button-confirm-completion"
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Completion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exception Dialog */}
      <Dialog open={!!exceptionDoor} onOpenChange={(open) => !open && setExceptionDoor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Exception — Door {exceptionDoor?.doorNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="exception-type">Exception Type</Label>
              <Select value={exceptionData.type} onValueChange={(v) => setExceptionData({ ...exceptionData, type: v })}>
                <SelectTrigger id="exception-type" data-testid="select-exception-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="damage">Damage</SelectItem>
                  <SelectItem value="documentation">Documentation</SelectItem>
                  <SelectItem value="seal_mismatch">Seal Mismatch</SelectItem>
                  <SelectItem value="overweight">Overweight</SelectItem>
                  <SelectItem value="dock_delay">Dock Delay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exception-severity">Severity</Label>
              <Select value={exceptionData.severity} onValueChange={(v) => setExceptionData({ ...exceptionData, severity: v })}>
                <SelectTrigger id="exception-severity" data-testid="select-exception-severity">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exception-description">Description</Label>
              <Textarea
                id="exception-description"
                placeholder="Provide more details..."
                value={exceptionData.description}
                onChange={(e) => setExceptionData({ ...exceptionData, description: e.target.value })}
                data-testid="textarea-exception-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExceptionDoor(null)} data-testid="button-cancel-exception">Cancel</Button>
            <Button
              onClick={() => exceptionMutation.mutate({
                visitId: exceptionDoor?.visitId,
                type: exceptionData.type,
                severity: exceptionData.severity,
                description: exceptionData.description,
                status: "open",
              })}
              disabled={exceptionMutation.isPending}
              data-testid="button-submit-exception"
            >
              {exceptionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Raise Exception
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedDoor}
        onOpenChange={(open) => !open && setSelectedDoor(null)}
        title={`Dock Door ${selectedDoor?.doorNumber}`}
        subtitle={selectedDoor?.status === "maintenance" ? "Under Maintenance" : "Dock Operations"}
      >
        {selectedDoor && (
          <div className="space-y-6">
            <DrawerSection title="Current Status">
              <div className="grid grid-cols-2 gap-4">
                <DrawerField label="Door Status" value={formatStatus(selectedDoor.status)} />
                <DrawerField label="Visit Status" value={selectedDoor.visitStatus ? formatStatus(selectedDoor.visitStatus) : "Empty"} />
              </div>
            </DrawerSection>

            {selectedDoor.visitId ? (
              <>
                <DrawerSection title="Trailer Information">
                  <div className="grid grid-cols-2 gap-4">
                    <DrawerField label="Trailer #" value={selectedDoor.trailerNumber || "N/A"} />
                    <DrawerField label="Carrier" value={selectedDoor.carrierName || "N/A"} />
                    <DrawerField label="Visit #" value={selectedDoor.visitNumber || "N/A"} />
                    <DrawerField label="Movement" value={selectedDoor.movementType ? formatStatus(selectedDoor.movementType) : "N/A"} />
                  </div>
                </DrawerSection>

                <DrawerSection title="Activity Timestamps">
                  <div className="grid grid-cols-2 gap-4">
                    <DrawerField label="Arrived at Dock" value={selectedDoor.checkInTime ? new Date(selectedDoor.checkInTime).toLocaleString() : "N/A"} />
                    <DrawerField label="Activity Start" value={selectedDoor.activityStartTime ? new Date(selectedDoor.activityStartTime).toLocaleString() : "N/A"} />
                    <DrawerField label="Activity End" value={selectedDoor.activityEndTime ? new Date(selectedDoor.activityEndTime).toLocaleString() : "N/A"} />
                    <DrawerField label="Time at Dock" value={getElapsedTime(selectedDoor.checkInTime).text} />
                  </div>
                </DrawerSection>

                <DrawerSection title="Actions">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedDoor(null);
                        setLocation(`/inspections?visitId=${selectedDoor.visitId}&type=dock_pre_load&trailer=${encodeURIComponent(selectedDoor.trailerNumber || "")}&carrier=${encodeURIComponent(selectedDoor.carrierName || "")}`);
                      }}
                      data-testid="drawer-button-inspect"
                    >
                      <FileSearch className="h-4 w-4 mr-2" /> Inspect Trailer
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => { setSelectedDoor(null); moveMutation.mutate(selectedDoor); }}
                      data-testid="drawer-button-move"
                    >
                      <MoveUpRight className="h-4 w-4 mr-2" /> Request Move
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={() => { setSelectedDoor(null); setExceptionDoor(selectedDoor); }}
                      data-testid="drawer-button-exception"
                    >
                      <ShieldAlert className="h-4 w-4 mr-2" /> Raise Exception
                    </Button>
                  </div>
                </DrawerSection>
              </>
            ) : (
              <DrawerSection title="Next Scheduled">
                <div className="flex flex-col items-center py-8 text-center bg-muted/30 rounded-md border border-dashed">
                  {selectedDoor.nextTrailerNumber ? (
                    <>
                      <Truck className="h-8 w-8 text-blue-500 mb-2" />
                      <p className="font-semibold text-foreground">Next Trailer: {selectedDoor.nextTrailerNumber}</p>
                      <p className="text-xs text-muted-foreground mt-1">Awaiting move request to this door</p>
                    </>
                  ) : (
                    <>
                      <DoorOpen className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No trailers currently queued for this door.</p>
                    </>
                  )}
                </div>
              </DrawerSection>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
