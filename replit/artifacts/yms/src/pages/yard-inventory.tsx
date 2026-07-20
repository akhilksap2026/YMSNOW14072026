import { useState, useMemo, useEffect } from "react";
import { useTabletView } from "@/lib/tablet-view";
import { SearchAutocomplete } from "@/components/enterprise/search-autocomplete";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { visitStatusColor } from "@/lib/status-colors";
import { formatTitle as formatStatus } from "@/lib/format";
import {
  PageHeader,
  FilterToolbar,
  StatusChip as EnterpriseStatusChip,
  KPICard,
  DetailDrawer,
  DrawerSection,
  DrawerField,
  EmptyState,
} from "@/components/enterprise";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Truck,
  MapPin,
  DoorOpen,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LogOut,
  ShieldAlert,
  CheckCircle2,
  Clock,
  User,
  Hash,
  Timer,
  Shield,
  CircleDot,
  FileSearch,
  ChevronRight,
  Zap,
  ArrowRightLeft,
  Layers,
  List,
  Lock,
  Loader2,
  Users,
  History,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useLocation, useSearch } from "wouter";

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px] text-center">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface VisitWithDetails {
  id: number;
  visitNumber: string;
  appointmentRef: string | null;
  trailerNumber: string | null;
  truckNumber: string | null;
  driverName: string | null;
  sealNumber: string | null;
  carrierName: string | null;
  visitStatus: string;
  locationStatus: string;
  holdStatus: string;
  currentSlotNumber: string | null;
  currentDockDoor: string | null;
  zoneName: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  movementType: string;
  notes: string | null;
  activeMoveId: number | null;
  activeMoveStatus: string | null;
  activeMoveType: string | null;
  activeMoveDestination: string | null;
  activeMoveJockey: string | null;
}

interface JockeyOption {
  id: string;
  firstName: string;
  lastName: string;
  activeMoveCount: number;
  jockeyStatus: "available" | "busy";
}

interface SlotOption {
  id: number;
  slotNumber: string;
  zoneName: string;
}


function calcDwell(checkIn: string | null): string {
  if (!checkIn) return "-";
  const diff = Date.now() - new Date(checkIn).getTime();
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function calcDwellMinutes(checkIn: string | null): number {
  if (!checkIn) return 0;
  return (Date.now() - new Date(checkIn).getTime()) / 60000;
}

function isAged(checkIn: string | null): boolean {
  if (!checkIn) return false;
  return Date.now() - new Date(checkIn).getTime() > 24 * 60 * 60 * 1000;
}

function isUnassigned(v: VisitWithDetails): boolean {
  return v.visitStatus === "checked_in" && !v.currentSlotNumber && !v.currentDockDoor;
}

function getDwellSeverity(mins: number): "critical" | "warning" | "normal" {
  if (mins > 1440) return "critical";
  if (mins > 480) return "warning";
  return "normal";
}

function getRowHighlight(v: VisitWithDetails, isSelected: boolean): string {
  if (isSelected) return "bg-primary/5 dark:bg-primary/10 shadow-inner";
  
  const dwellMins = calcDwellMinutes(v.checkInTime);
  const isUrgent = v.holdStatus !== "none" || dwellMins > 1440 || (isUnassigned(v) && dwellMins > 60);
  
  if (isUrgent) {
    if (v.holdStatus !== "none") return "bg-red-50/80 dark:bg-red-950/30 border-l-4 border-l-red-500 shadow-sm";
    if (dwellMins > 1440) return "bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-l-amber-500 shadow-sm";
    return "bg-blue-50/80 dark:bg-blue-950/30 border-l-4 border-l-blue-500 shadow-sm";
  }

  return "hover:bg-accent/60 transition-colors";
}

interface PrimaryAction {
  label: string;
  icon: typeof MapPin;
  action: string;
  variant: "default" | "secondary" | "destructive" | "outline";
}

function hasActiveMove(v: VisitWithDetails): boolean {
  return !!(v.activeMoveId && v.activeMoveStatus && !["completed", "cancelled", "rejected"].includes(v.activeMoveStatus));
}

function getMovementStatusTag(v: VisitWithDetails): { label: string; color: string } | null {
  if (v.activeMoveStatus === "in_progress") {
    return { label: "Move In Progress", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300" };
  }
  if (v.activeMoveStatus === "assigned" || v.activeMoveStatus === "accepted") {
    return { label: "Move Assigned", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300" };
  }
  if (v.activeMoveStatus === "open") {
    return { label: "Move Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300" };
  }
  switch (v.visitStatus) {
    case "checked_in": return v.currentSlotNumber
      ? { label: "Parked in Slot", color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" }
      : { label: "Awaiting Slot", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" };
    case "in_yard": return { label: "Awaiting Dock Move", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" };
    case "at_dock": return { label: "Docked", color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" };
    default: return null;
  }
}

function getPrimaryAction(v: VisitWithDetails): PrimaryAction {
  if (v.holdStatus !== "none") {
    return { label: "Resolve Hold", icon: ShieldAlert, action: "resolve_hold", variant: "destructive" };
  }
  if (hasActiveMove(v)) {
    return { label: "Move In Process", icon: Lock, action: "move_locked", variant: "outline" };
  }
  switch (v.visitStatus) {
    case "checked_in":
      return { label: "Assign Slot", icon: MapPin, action: "assign_slot", variant: "default" };
    case "in_yard":
      return { label: "Move to Dock", icon: DoorOpen, action: "assign_dock", variant: "default" };
    case "at_dock":
    case "loading":
    case "unloading":
      return { label: "Ready Out", icon: CheckCircle2, action: "ready_out", variant: "secondary" };
    case "ready_out":
      return { label: "Send to Gate", icon: LogOut, action: "send_gate", variant: "default" };
    default:
      return { label: "Assign Slot", icon: MapPin, action: "assign_slot", variant: "secondary" };
  }
}

function getWorkflowNavigation(v: VisitWithDetails): { href: string; label: string; description: string; color: string } | null {
  if (v.holdStatus !== "none") return null;
  if (hasActiveMove(v)) return null;
  switch (v.visitStatus) {
    case "checked_in":
      if (v.currentSlotNumber) {
        return { href: "/moves", label: "Create Move to Dock", description: `Trailer is parked in ${v.currentSlotNumber} — dispatch a jockey to bring it to a dock door.`, color: "border-primary/25 bg-primary/5" };
      }
      return null;
    case "in_yard":
      return { href: "/moves", label: "Create Move to Dock", description: "Trailer is in yard — dispatch a jockey to a dock door to begin loading or unloading.", color: "border-primary/25 bg-primary/5" };
    case "at_dock":
    case "loading":
    case "unloading":
      return { href: "/dock", label: "Go to Dock Management", description: "Trailer is at the dock. Monitor loading/unloading operations and mark ready-out when complete.", color: "border-violet-200 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20" };
    case "ready_out":
      return { href: `/gate/check-out?q=${encodeURIComponent(v.trailerNumber || "")}`, label: "Process Gate Exit", description: "Trailer is ready to depart. Open gate check-out to process the exit.", color: "border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20" };
    default:
      return null;
  }
}

function getNextRecommendedAction(v: VisitWithDetails): string {
  if (v.holdStatus !== "none") return "Resolve hold before proceeding";
  switch (v.visitStatus) {
    case "checked_in":
      return v.currentSlotNumber ? "Move to dock when ready" : "Assign yard slot";
    case "in_yard":
      return v.currentDockDoor ? "Begin loading/unloading" : "Assign dock door";
    case "at_dock":
      return "Begin loading/unloading operation";
    case "loading":
    case "unloading":
      return "Mark ready for departure when complete";
    case "ready_out":
      return "Send to gate for checkout";
    default:
      return "Awaiting next step";
  }
}

function getNextStepHref(v: VisitWithDetails): string | null {
  if (v.holdStatus !== "none") return "/exceptions";
  switch (v.visitStatus) {
    case "checked_in": return v.currentSlotNumber ? "/moves" : null;
    case "in_yard": return "/dock";
    case "at_dock": return "/dock";
    case "loading":
    case "unloading": return "/dock";
    case "ready_out": return "/gate/check-out";
    default: return null;
  }
}

function getNextStepStyle(v: VisitWithDetails): string {
  if (v.holdStatus !== "none") return "border-red-200 text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50";
  if (v.visitStatus === "ready_out") return "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50";
  return "border-primary/20 text-primary bg-primary/5 hover:bg-primary/10";
}

const HOVER_LIFECYCLE_STEPS = [
  { key: "checked_in", label: "Checked In" },
  { key: "in_yard", label: "In Yard" },
  { key: "at_dock", label: "At Dock" },
  { key: "loading_unloading", label: "Load / Unload" },
  { key: "ready_out", label: "Ready Out" },
  { key: "departed", label: "Departed" },
];

function getHoverLifecycleIndex(v: VisitWithDetails): number {
  if (v.visitStatus === "checked_out" || v.visitStatus === "closed") return 5;
  if (v.visitStatus === "ready_out") return 4;
  if (v.visitStatus === "loading" || v.visitStatus === "unloading") return 3;
  if (v.visitStatus === "at_dock") return 2;
  if (v.visitStatus === "in_yard") return 1;
  if (v.visitStatus === "checked_in") return 0;
  return 0;
}

function getHoldDescription(holdStatus: string): { title: string; description: string; suggestedAction: string; severity: "critical" | "high" | "medium" } {
  switch (holdStatus) {
    case "documentation_hold":
      return { title: "Documentation Hold", description: "Required documents are missing or incomplete (BOL, customs forms, shipping manifest).", suggestedAction: "Contact carrier/driver to obtain missing paperwork, then clear hold.", severity: "high" };
    case "security_hold":
      return { title: "Security Hold", description: "Flagged for security inspection — random check or suspicious activity reported.", suggestedAction: "Dispatch security team for inspection. Clear hold after verification.", severity: "critical" };
    case "damage_hold":
      return { title: "Damage Hold", description: "Physical damage reported on trailer body, doors, undercarriage, or reefer unit.", suggestedAction: "File damage report with photos. Notify carrier claims dept. Assess if safe to unload.", severity: "high" };
    case "seal_mismatch":
      return { title: "Seal Mismatch", description: "Seal number on trailer does not match shipping documentation or has been tampered with.", suggestedAction: "Verify seal with shipper. Do not open trailer until cleared. Escalate if tampering suspected.", severity: "critical" };
    case "yard_block":
      return { title: "Yard Block", description: "Trailer is operationally blocked — cannot be moved due to yard congestion, equipment issue, or scheduling conflict.", suggestedAction: "Coordinate with yard manager to resolve blocking condition.", severity: "medium" };
    case "driver_issue":
      return { title: "Driver Issue", description: "Driver-related problem — missing credentials, HOS violation, or refusal to cooperate.", suggestedAction: "Verify driver credentials. Contact carrier dispatch if driver is unresponsive.", severity: "high" };
    case "customs_hold":
      return { title: "Customs Hold", description: "Freight requires customs clearance before any dock or unload operations. Bonded cargo.", suggestedAction: "Await customs broker clearance. Do not break seal or open trailer until released.", severity: "critical" };
    case "overweight":
      return { title: "Overweight Hold", description: "Trailer exceeds weight limits for safe docking or road transport.", suggestedAction: "Arrange partial unload or weight redistribution. Re-weigh before clearing.", severity: "high" };
    default:
      return { title: "Hold Active", description: "This trailer has an active hold preventing further operations.", suggestedAction: "Investigate and resolve the hold condition.", severity: "medium" };
  }
}

function getSlaRisk(v: VisitWithDetails): { level: "none" | "low" | "medium" | "high"; label: string } {
  const dwellMins = calcDwellMinutes(v.checkInTime);
  if (v.holdStatus !== "none") return { level: "high", label: "Hold active — SLA at risk" };
  if (dwellMins > 1440) return { level: "high", label: "Exceeded 24h — aging alert" };
  if (dwellMins > 720) return { level: "medium", label: "Over 12h — monitor closely" };
  if (dwellMins > 480) return { level: "low", label: "Over 8h — nearing SLA" };
  return { level: "none", label: "Within SLA" };
}

const LIFECYCLE_STEPS = [
  { key: "checked_in", label: "Checked In" },
  { key: "in_yard", label: "Slotted" },
  { key: "at_dock", label: "At Dock" },
  { key: "loading_unloading", label: "Loading / Unloading" },
  { key: "ready_out", label: "Ready Out" },
  { key: "checked_out", label: "Checked Out" },
];

function getLifecycleIndex(status: string): number {
  switch (status) {
    case "checked_in": case "arrived": return 0;
    case "in_yard": return 1;
    case "at_dock": return 2;
    case "loading": case "unloading": return 3;
    case "ready_out": return 4;
    case "checked_out": case "closed": return 5;
    default: return -1;
  }
}

type SegmentFilter = "all" | "checked_in" | "in_yard" | "at_dock" | "ready_out" | "on_hold" | "aged" | "ready_for_dock" | "waiting_for_move" | "over_sla";
type SortKey = "trailerNumber" | "carrierName" | "dwellTime" | "visitStatus";
type SortDir = "asc" | "desc";

const SEGMENTS: { key: SegmentFilter; label: string; icon?: any; color?: string }[] = [
  { key: "all", label: "All" },
  { key: "ready_for_dock", label: "Ready for Dock", icon: DoorOpen },
  { key: "waiting_for_move", label: "Waiting for Move", icon: ArrowRightLeft },
  { key: "on_hold", label: "Held", icon: ShieldAlert, color: "text-red-600" },
  { key: "over_sla", label: "Over SLA", icon: AlertTriangle, color: "text-amber-600" },
  { key: "checked_in", label: "Checked In" },
  { key: "in_yard", label: "In Yard" },
  { key: "at_dock", label: "At Dock" },
  { key: "ready_out", label: "Ready Out" },
];

function getLastKnownAction(v: VisitWithDetails): { action: string; timestamp: string | null } {
  if (v.visitStatus === "checked_out" || v.visitStatus === "closed") {
    return { action: "Checked Out", timestamp: v.checkOutTime };
  }
  if (v.visitStatus === "ready_out") {
    return { action: "Marked Ready Out", timestamp: v.checkInTime };
  }
  if (v.visitStatus === "loading") {
    return { action: "Loading Started", timestamp: v.checkInTime };
  }
  if (v.visitStatus === "unloading") {
    return { action: "Unloading Started", timestamp: v.checkInTime };
  }
  if (v.visitStatus === "at_dock" && v.currentDockDoor) {
    return { action: `Moved to ${v.currentDockDoor}`, timestamp: v.checkInTime };
  }
  if (v.visitStatus === "in_yard" && v.currentSlotNumber) {
    return { action: `Assigned ${v.currentSlotNumber}`, timestamp: v.checkInTime };
  }
  if (v.holdStatus !== "none") {
    return { action: `Hold: ${formatStatus(v.holdStatus)}`, timestamp: v.checkInTime };
  }
  if (v.visitStatus === "checked_in") {
    return { action: "Checked In", timestamp: v.checkInTime };
  }
  return { action: formatStatus(v.visitStatus), timestamp: v.checkInTime };
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function LiveDwellTimer({ checkInTime }: { checkInTime: string | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!checkInTime) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [checkInTime]);

  if (!checkInTime) return <span className="text-muted-foreground">-</span>;
  const dwellMins = calcDwellMinutes(checkInTime);
  const severity = getDwellSeverity(dwellMins);

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${
      severity === "critical" ? "text-red-600" : severity === "warning" ? "text-amber-600" : "text-muted-foreground"
    }`}>
      {severity === "critical" && <Clock className="h-3 w-3 animate-pulse" />}
      {severity === "warning" && <Clock className="h-3 w-3" />}
      {calcDwell(checkInTime)}
    </span>
  );
}

function TrailerHoverCard({ visit }: { visit: VisitWithDetails }) {
  const lifecycleIdx = getHoverLifecycleIndex(visit);
  const slaRisk = getSlaRisk(visit);
  const dwellMins = calcDwellMinutes(visit.checkInTime);
  const nextAction = getNextRecommendedAction(visit);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button className="text-left hover:text-primary transition-colors" data-testid={`hover-trailer-${visit.id}`}>
          <span className="border-b border-dashed border-muted-foreground/40 hover:border-primary pb-0.5 font-semibold text-sm">
            {visit.trailerNumber || "-"}
          </span>
          {visit.truckNumber && <span className="text-[10px] text-muted-foreground ml-1 font-normal">/ {visit.truckNumber}</span>}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        className="w-[380px] p-0 shadow-xl border-border/80"
        data-testid={`hovercard-trailer-${visit.id}`}
      >
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">{visit.trailerNumber}</p>
              <p className="text-[10px] text-muted-foreground">{visit.carrierName} • {visit.visitNumber}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge className={`${visitStatusColor(visit.visitStatus)} border-transparent text-[10px]`}>
                {formatStatus(visit.visitStatus)}
              </Badge>
              {visit.holdStatus !== "none" && (
                <Badge className="bg-red-100 text-red-800 border-transparent text-[10px] animate-pulse">
                  Hold
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
            <div>
              <span className="text-muted-foreground">Location </span>
              <span className="font-medium">{visit.currentDockDoor || visit.currentSlotNumber || formatStatus(visit.locationStatus)}</span>
            </div>
            {visit.zoneName && (
              <div>
                <span className="text-muted-foreground">Zone </span>
                <span className="font-medium">{visit.zoneName}</span>
              </div>
            )}
            {visit.currentDockDoor && (
              <div>
                <span className="text-muted-foreground">Dock </span>
                <span className="font-medium">{visit.currentDockDoor}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Time on Yard </span>
              <span className={`font-medium ${dwellMins > 1440 ? "text-red-600" : dwellMins > 480 ? "text-amber-600" : ""}`}>
                {calcDwell(visit.checkInTime)}
              </span>
            </div>
          </div>

          {slaRisk.level !== "none" && (
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium ${
              slaRisk.level === "high" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" :
              slaRisk.level === "medium" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
              "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
            }`}>
              <AlertTriangle className="h-3 w-3" />
              {slaRisk.label}
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Lifecycle Progress</p>
            <div className="relative">
              <div className="flex items-center justify-between relative">
                <div className="absolute top-[9px] left-[9px] right-[9px] h-[2px] bg-border" />
                <div
                  className="absolute top-[9px] left-[9px] h-[2px] bg-primary transition-all duration-500"
                  style={{ width: `${Math.min((lifecycleIdx / (HOVER_LIFECYCLE_STEPS.length - 1)) * 100, 100)}%` }}
                />
                {HOVER_LIFECYCLE_STEPS.map((step, i) => {
                  const isCompleted = i < lifecycleIdx;
                  const isCurrent = i === lifecycleIdx;
                  return (
                    <div key={step.key} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / HOVER_LIFECYCLE_STEPS.length}%` }}>
                      <div className={`h-[20px] w-[20px] rounded-full flex items-center justify-center text-[9px] border-2 transition-all ${
                        isCompleted
                          ? "bg-primary border-primary text-primary-foreground"
                          : isCurrent
                            ? "bg-background border-primary ring-2 ring-primary/30 shadow-sm"
                            : "bg-muted border-border"
                      }`}>
                        {isCompleted ? "✓" : isCurrent ? (
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <p className={`text-[8px] mt-1 text-center leading-tight whitespace-nowrap ${
                        isCurrent ? "text-primary font-bold" : isCompleted ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}>
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-muted/50 border border-dashed">
            <Zap className="h-3 w-3 text-primary shrink-0" />
            <p className="text-[10px] text-foreground"><span className="font-semibold">Next:</span> {nextAction}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function HoldHoverCard({ holdStatus, visitNotes }: { holdStatus: string; visitNotes: string | null }) {
  const holdInfo = getHoldDescription(holdStatus);
  return (
    <HoverCard openDelay={150} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-transparent text-[10px] animate-pulse hover:bg-red-200 dark:hover:bg-red-800 transition-colors">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            {formatStatus(holdStatus).replace(" Hold", "")}
          </Badge>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="left"
        align="start"
        className="w-[300px] p-0 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-3 py-2 border-b ${
          holdInfo.severity === "critical" ? "bg-red-50 dark:bg-red-950/40" :
          holdInfo.severity === "high" ? "bg-amber-50 dark:bg-amber-950/40" :
          "bg-orange-50 dark:bg-orange-950/40"
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 shrink-0 ${
              holdInfo.severity === "critical" ? "text-red-600" : holdInfo.severity === "high" ? "text-amber-600" : "text-orange-600"
            }`} />
            <div>
              <p className="text-xs font-bold">{holdInfo.title}</p>
              <Badge className={`text-[9px] px-1 h-4 border-transparent mt-0.5 ${
                holdInfo.severity === "critical" ? "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100" :
                holdInfo.severity === "high" ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100" :
                "bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100"
              }`}>
                {holdInfo.severity}
              </Badge>
            </div>
          </div>
        </div>
        <div className="p-3 space-y-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Issue</p>
            <p className="text-xs text-foreground leading-relaxed">{holdInfo.description}</p>
          </div>
          {visitNotes && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">Notes</p>
              <p className="text-xs text-muted-foreground leading-relaxed italic">{visitNotes}</p>
            </div>
          )}
          <div className="rounded bg-primary/5 border border-primary/20 px-2 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-primary font-semibold mb-0.5 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Suggested Action
            </p>
            <p className="text-xs text-foreground leading-relaxed">{holdInfo.suggestedAction}</p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function StatusChip({ status, holdStatus, visitNotes }: { status: string; holdStatus: string; visitNotes: string | null }) {
  const isActive = ["loading", "unloading", "at_dock", "in_yard"].includes(status);
  const isReady = ["ready_out"].includes(status);
  const isPending = ["checked_in", "arrived"].includes(status);
  const ringClass = isActive ? "ring-1 ring-blue-400/40" : isReady ? "ring-1 ring-emerald-400/40" : isPending ? "ring-1 ring-amber-400/40" : "";
  return (
    <div className="flex items-center gap-1.5">
      <Tip text={
        status === "checked_in" ? "Trailer checked in — awaiting slot assignment" :
        status === "in_yard" ? "Trailer is slotted in the yard — awaiting dock move" :
        status === "at_dock" ? "Trailer is actively docked" :
        status === "loading" ? "Load operation in progress" :
        status === "unloading" ? "Unload operation in progress" :
        status === "ready_out" ? "Trailer is cleared and ready to depart" :
        status === "checked_out" ? "Trailer has left the facility" :
        formatStatus(status)
      }>
        <Badge className={`${visitStatusColor(status)} border-transparent text-xs font-medium ${ringClass}`}>
          {isActive && <span className="relative flex h-1.5 w-1.5 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-600" /></span>}
          {formatStatus(status)}
        </Badge>
      </Tip>
      {holdStatus !== "none" && (
        <HoldHoverCard holdStatus={holdStatus} visitNotes={visitNotes} />
      )}
    </div>
  );
}

function getDefaultAccordionSection(v: VisitWithDetails): string {
  if (v.holdStatus !== "none") return "inspection";
  switch (v.visitStatus) {
    case "checked_in": return "gate";
    case "in_yard": return "yard";
    case "at_dock": case "loading": case "unloading": return "dock";
    case "ready_out": return "checkout";
    default: return "gate";
  }
}

function isActionEnabled(v: VisitWithDetails, action: string): { enabled: boolean; reason?: string } {
  const s = v.visitStatus;
  const hasHold = v.holdStatus !== "none";
  switch (action) {
    case "assign_slot":
      if (s === "checked_out" || s === "closed") return { enabled: false, reason: "Visit is closed" };
      if (v.currentSlotNumber) return { enabled: true, reason: "Reassign to different slot" };
      return { enabled: true };
    case "assign_dock":
      if (s === "checked_out" || s === "closed") return { enabled: false, reason: "Visit is closed" };
      if (hasHold) return { enabled: false, reason: "Resolve hold first" };
      return { enabled: true };
    case "create_move":
      if (s === "checked_out" || s === "closed") return { enabled: false, reason: "Visit is closed" };
      if (s === "checked_in") return { enabled: false, reason: "Must be in yard" };
      return { enabled: true };
    case "ready_out":
      if (s === "ready_out") return { enabled: false, reason: "Already ready" };
      if (s === "checked_out" || s === "closed") return { enabled: false, reason: "Visit is closed" };
      if (!["at_dock", "loading", "unloading", "in_yard"].includes(s)) return { enabled: false, reason: "Not at dock or in yard" };
      if (hasHold) return { enabled: false, reason: "Resolve hold first" };
      return { enabled: true };
    case "send_gate":
      if (s !== "ready_out") return { enabled: false, reason: "Must be ready out" };
      if (hasHold) return { enabled: false, reason: "Resolve hold first" };
      return { enabled: true };
    case "inspect":
      if (s === "checked_out" || s === "closed") return { enabled: false, reason: "Visit is closed" };
      return { enabled: true };
    case "place_hold":
      return { enabled: v.holdStatus === "none" };
    case "clear_hold":
      return { enabled: v.holdStatus !== "none" };
    default:
      return { enabled: true };
  }
}

function ActionButton({ visit, action, label, icon: Icon, variant = "outline", onClick, testId }: {
  visit: VisitWithDetails;
  action: string;
  label: string;
  icon: typeof MapPin;
  variant?: "default" | "outline" | "destructive" | "secondary";
  onClick: () => void;
  testId: string;
}) {
  const { enabled, reason } = isActionEnabled(visit, action);
  if (enabled) {
    return (
      <Button variant={variant} size="sm" className="text-xs justify-start" onClick={onClick} data-testid={testId}>
        <Icon className="h-3 w-3 mr-1.5 shrink-0" /> {label}
      </Button>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs justify-start opacity-40 cursor-not-allowed" disabled data-testid={testId}>
            <Icon className="h-3 w-3 mr-1.5 shrink-0" /> {label}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const STATUS_GROUPS = [
  { key: "on_hold", label: "On Hold", icon: ShieldAlert, headerClass: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300", match: (v: VisitWithDetails) => v.holdStatus !== "none" },
  { key: "checked_in", label: "Checked In", icon: Truck, headerClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300", match: (v: VisitWithDetails) => v.holdStatus === "none" && v.visitStatus === "checked_in" },
  { key: "in_yard", label: "In Yard", icon: MapPin, headerClass: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300", match: (v: VisitWithDetails) => v.holdStatus === "none" && v.visitStatus === "in_yard" },
  { key: "at_dock", label: "At Dock", icon: DoorOpen, headerClass: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300", match: (v: VisitWithDetails) => v.holdStatus === "none" && ["at_dock", "loading", "unloading"].includes(v.visitStatus) },
  { key: "ready_out", label: "Ready Out", icon: CheckCircle2, headerClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300", match: (v: VisitWithDetails) => v.holdStatus === "none" && v.visitStatus === "ready_out" },
];

function InventoryGroupedView({
  visits,
  selectedVisit,
  onRowClick,
  onPrimaryAction,
  sortIcon,
  handleSort,
  colVis,
}: {
  visits: VisitWithDetails[];
  selectedVisit: VisitWithDetails | null;
  onRowClick: (v: VisitWithDetails) => void;
  onPrimaryAction: (v: VisitWithDetails) => void;
  sortIcon: (key: SortKey) => any;
  handleSort: (key: SortKey) => void;
  colVis: { visit: boolean; trailer: boolean; carrier: boolean; location: boolean; status: boolean; dwell: boolean; lastUpdate: boolean; nextStep: boolean };
}) {
  const groups = STATUS_GROUPS.map((g) => ({
    ...g,
    items: visits.filter(g.match),
  })).filter((g) => g.items.length > 0);

  const defaultValues = groups.map((g) => g.key);

  const tableHeader = (
    <TableHeader>
      <TableRow className="bg-muted/30">
        {colVis.visit && (
          <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
            <Tip text="Unique visit reference number for this trailer check-in">
              <span className="cursor-help border-b border-dashed border-muted-foreground/40">Visit</span>
            </Tip>
          </TableHead>
        )}
        {colVis.trailer && (
          <TableHead>
            <Tip text="Trailer ID — hover for full details including lifecycle and SLA status">
              <button className="flex items-center cursor-pointer select-none font-semibold text-[11px] uppercase tracking-wide" onClick={() => handleSort("trailerNumber")}>
                Trailer {sortIcon("trailerNumber")}
              </button>
            </Tip>
          </TableHead>
        )}
        {colVis.carrier && (
          <TableHead>
            <Tip text="Carrier company operating this trailer">
              <button className="flex items-center cursor-pointer select-none font-semibold text-[11px] uppercase tracking-wide" onClick={() => handleSort("carrierName")}>
                Carrier {sortIcon("carrierName")}
              </button>
            </Tip>
          </TableHead>
        )}
        {colVis.location && (
          <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
            <Tip text="Current yard slot or dock door assigned to this trailer">
              <span className="cursor-help border-b border-dashed border-muted-foreground/40">Location</span>
            </Tip>
          </TableHead>
        )}
        {colVis.status && (
          <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
            <Tip text="Yellow=Waiting · Blue=In Progress · Green=Ready · Red=Hold">
              <span className="cursor-help border-b border-dashed border-muted-foreground/40">Status</span>
            </Tip>
          </TableHead>
        )}
        {colVis.dwell && (
          <TableHead>
            <Tip text="Time elapsed since check-in. Amber = over 8h, Red = over 24h (aging alert)">
              <button className="flex items-center cursor-pointer select-none font-semibold text-[11px] uppercase tracking-wide" onClick={() => handleSort("dwellTime")}>
                Time on Yard {sortIcon("dwellTime")}
              </button>
            </Tip>
          </TableHead>
        )}
        {colVis.lastUpdate && (
          <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
            <Tip text="Most recent action taken on this trailer visit">
              <span className="cursor-help border-b border-dashed border-muted-foreground/40">Last Update</span>
            </Tip>
          </TableHead>
        )}
        {colVis.nextStep && (
          <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
            <Tip text="Recommended next operational step — click to navigate">
              <span className="cursor-help border-b border-dashed border-muted-foreground/40">Next Step</span>
            </Tip>
          </TableHead>
        )}
        <TableHead className="text-right font-semibold text-[11px] uppercase tracking-wide">
          <Tip text="Primary action based on trailer's current workflow stage">
            <span className="cursor-help border-b border-dashed border-muted-foreground/40">Action</span>
          </Tip>
        </TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <Accordion type="multiple" defaultValue={defaultValues} className="space-y-2">
      {groups.map((group) => (
        <AccordionItem
          key={group.key}
          value={group.key}
          className="border rounded-lg overflow-hidden bg-card shadow-sm"
          data-testid={`group-section-${group.key}`}
        >
          <AccordionTrigger className={`px-4 py-3 hover:no-underline border-b ${group.headerClass}`}>
            <div className="flex items-center gap-3">
              <group.icon className="h-4 w-4 shrink-0" />
              <span className="font-semibold text-sm">{group.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-white/70 dark:bg-black/20`}>
                {group.items.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-0 overflow-x-auto">
            <Table>
              {tableHeader}
              <TableBody>
                {group.items.map((v) => {
                  const primary = getPrimaryAction(v);
                  const isSelected = selectedVisit?.id === v.id;
                  const nextAction = getNextRecommendedAction(v);
                  return (
                    <TableRow
                      key={v.id}
                      className={`group cursor-pointer transition-all duration-200 hover:bg-accent/40 ${getRowHighlight(v, isSelected)}`}
                      onClick={() => onRowClick(v)}
                      data-testid={`row-visit-${v.id}`}
                    >
                      {colVis.visit && (
                        <TableCell className="font-medium text-xs" data-testid={`text-visit-number-${v.id}`}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{v.visitNumber.slice(-8)}</span>
                            {!v.appointmentRef && (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[9px] px-1 h-4">Walk-In</Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {colVis.trailer && (
                        <TableCell data-testid={`text-trailer-${v.id}`} onClick={(e) => e.stopPropagation()}>
                          <TrailerHoverCard visit={v} />
                        </TableCell>
                      )}
                      {colVis.carrier && <TableCell className="text-muted-foreground text-xs">{v.carrierName || "-"}</TableCell>}
                      {colVis.location && (
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="font-medium">{v.currentSlotNumber || v.currentDockDoor || formatStatus(v.locationStatus)}</span>
                            {v.zoneName && <span className="text-[10px] text-muted-foreground hidden xl:inline">({v.zoneName})</span>}
                          </span>
                        </TableCell>
                      )}
                      {colVis.status && (
                        <TableCell>
                          <StatusChip status={v.visitStatus} holdStatus={v.holdStatus} visitNotes={v.notes} />
                        </TableCell>
                      )}
                      {colVis.dwell && (
                        <TableCell>
                          <LiveDwellTimer checkInTime={v.checkInTime} />
                        </TableCell>
                      )}
                      {colVis.lastUpdate && (
                        <TableCell data-testid={`text-last-action-${v.id}`}>
                          {(() => {
                            const lastAction = getLastKnownAction(v);
                            return (
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{lastAction.action}</span>
                                <span className="text-[10px] text-muted-foreground">{formatDate(lastAction.timestamp)}</span>
                              </div>
                            );
                          })()}
                        </TableCell>
                      )}
                      {colVis.nextStep && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const href = getNextStepHref(v);
                            const style = getNextStepStyle(v);
                            if (href) {
                              return (
                                <a href={href} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border transition-colors ${style}`} data-testid={`button-next-step-${v.id}`}>
                                  <ChevronRight className="h-3 w-3 shrink-0" />
                                  {nextAction}
                                </a>
                              );
                            }
                            return (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <ChevronRight className="h-3 w-3 shrink-0 text-primary/50" />
                                {nextAction}
                              </span>
                            );
                          })()}
                        </TableCell>
                      )}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant={primary.variant}
                          onClick={() => onPrimaryAction(v)}
                          className={`h-7 text-xs px-2.5 transition-opacity ${isSelected ? "opacity-100" : "opacity-60 hover:opacity-100 group-hover:opacity-100"}`}
                          data-testid={`button-primary-action-${v.id}`}
                        >
                          <primary.icon className="h-3 w-3 mr-1" />
                          {primary.label}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export default function YardInventoryPage({ userRole }: { userRole?: string } = {}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const urlSearch = useSearch();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<SegmentFilter>(() => {
    const params = new URLSearchParams(urlSearch);
    const filter = params.get("filter");
    if (filter === "awaiting-slot") return "checked_in";
    if (filter === "aged") return "aged";
    if (filter === "on_hold") return "on_hold";
    return "all";
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [actionDialog, setActionDialog] = useState<{ type: string; visit: VisitWithDetails } | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<VisitWithDetails | null>(null);
  const [movePriority, setMovePriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [moveDestType, setMoveDestType] = useState<"slot" | "dock">("slot");
  const [moveJockeyId, setMoveJockeyId] = useState<string>("");
  const [moveNotes, setMoveNotes] = useState("");
  const [, setTick] = useState(0);
  const [showGroupedView, setShowGroupedView] = useState(false);
  const [showAllCols, setShowAllCols] = useState(false);
  const isRestrictedRole = userRole === "gate_guard" || userRole === "yard_jockey";
  const { tabletMode } = useTabletView();
  const colVis = useMemo(() => {
    if (!isRestrictedRole || showAllCols) {
      return {
        visit: true, trailer: true, carrier: true, location: true, status: true, dwell: true,
        lastUpdate: !tabletMode,
        nextStep: !tabletMode,
      };
    }
    if (userRole === "gate_guard") {
      return { visit: true, trailer: false, carrier: true, location: true, status: true, dwell: false, lastUpdate: false, nextStep: false };
    }
    return { visit: false, trailer: true, carrier: false, location: true, status: true, dwell: false, lastUpdate: false, nextStep: true };
  }, [userRole, isRestrictedRole, showAllCols, tabletMode]);
  const [holdResolutionDialog, setHoldResolutionDialog] = useState<{ visit: VisitWithDetails } | null>(null);
  const [holdResolutionReason, setHoldResolutionReason] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: visits = [], isLoading, dataUpdatedAt } = useQuery<VisitWithDetails[]>({
    queryKey: ["/api/yard/inventory"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: slots = [] } = useQuery<SlotOption[]>({
    queryKey: ["/api/yard/available-slots"],
  });

  const { data: doors = [] } = useQuery<Array<{ id: number; doorNumber: string }>>({
    queryKey: ["/api/dock/available-doors"],
  });

  const { data: jockeys = [] } = useQuery<JockeyOption[]>({
    queryKey: ["/api/yard/jockeys"],
  });


  const createMoveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/moves", data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidateAll();
      setActionDialog(null);
      setMovePriority("normal");
      setMoveJockeyId("");
      setMoveNotes("");
      const jockeyAssigned = !!variables.assignedTo;
      toast({
        title: jockeyAssigned ? "Move task created — assigned to jockey" : "Move task created — awaiting jockey",
        description: variables.toLocationName ? `Destination: ${variables.toLocationName}` : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: { visitId: number; visitStatus: string; holdStatus?: string; holdResolutionReason?: string }) => {
      const res = await apiRequest("PATCH", `/api/visits/${data.visitId}/status`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setActionDialog(null);
      setHoldResolutionDialog(null);
      setHoldResolutionReason("");
      if (selectedVisit) {
        setSelectedVisit(null);
      }
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleClearHold = (visit: VisitWithDetails) => {
    setHoldResolutionDialog({ visit });
    setHoldResolutionReason("");
  };

  const handleHoldResolutionSubmit = () => {
    if (!holdResolutionDialog) return;
    if (!holdResolutionReason.trim()) {
      toast({ title: "Reason required", description: "Please provide a resolution reason before clearing the hold.", variant: "destructive" });
      return;
    }
    updateStatusMutation.mutate({
      visitId: holdResolutionDialog.visit.id,
      visitStatus: holdResolutionDialog.visit.visitStatus,
      holdStatus: "none",
      holdResolutionReason: holdResolutionReason.trim(),
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const handlePrimaryAction = (v: VisitWithDetails) => {
    const action = getPrimaryAction(v);
    switch (action.action) {
      case "assign_slot":
        setMoveJockeyId("");
        setMoveNotes("");
        setMovePriority("normal");
        setActionDialog({ type: "assign_slot", visit: v });
        break;
      case "assign_dock":
        setMoveJockeyId("");
        setMoveNotes("");
        setMovePriority("normal");
        setActionDialog({ type: "assign_dock", visit: v });
        break;
      case "move_locked":
        toast({
          title: "Move In Process",
          description: `This trailer has an active move (${v.activeMoveStatus}). Complete the current move before creating a new one.`,
        });
        break;
      case "ready_out":
        updateStatusMutation.mutate({ visitId: v.id, visitStatus: "ready_out" });
        break;
      case "send_gate":
        updateStatusMutation.mutate({ visitId: v.id, visitStatus: "checked_out" });
        break;
      case "resolve_hold":
        handleClearHold(v);
        break;
    }
  };

  const handleRowClick = (v: VisitWithDetails) => {
    setSelectedVisit(selectedVisit?.id === v.id ? null : v);
  };

  const segmentCounts = useMemo(() => {
    return {
      all: visits.length,
      checked_in: visits.filter((v) => v.visitStatus === "checked_in").length,
      in_yard: visits.filter((v) => v.visitStatus === "in_yard").length,
      at_dock: visits.filter((v) => ["at_dock", "loading", "unloading"].includes(v.visitStatus)).length,
      ready_out: visits.filter((v) => v.visitStatus === "ready_out").length,
      on_hold: visits.filter((v) => v.holdStatus !== "none").length,
      aged: visits.filter((v) => isAged(v.checkInTime)).length,
      ready_for_dock: visits.filter((v) => v.visitStatus === "in_yard" && v.holdStatus === "none").length,
      waiting_for_move: visits.filter((v) => isUnassigned(v) && v.holdStatus === "none").length,
      over_sla: visits.filter((v) => calcDwellMinutes(v.checkInTime) > 480).length,
    };
  }, [visits]);

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    visits.forEach((v) => {
      if (v.trailerNumber) set.add(v.trailerNumber);
      if (v.visitNumber) set.add(v.visitNumber);
      if (v.carrierName) set.add(v.carrierName);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [visits]);

  const filtered = useMemo(() => {
    let result = visits.filter((v) => {
      const matchSearch =
        !search ||
        v.visitNumber.toLowerCase().includes(search.toLowerCase()) ||
        v.trailerNumber?.toLowerCase().includes(search.toLowerCase()) ||
        v.truckNumber?.toLowerCase().includes(search.toLowerCase()) ||
        v.carrierName?.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "all" || v.movementType === typeFilter;

      let matchSegment = true;
      switch (segment) {
        case "checked_in": matchSegment = v.visitStatus === "checked_in"; break;
        case "in_yard": matchSegment = v.visitStatus === "in_yard"; break;
        case "at_dock": matchSegment = ["at_dock", "loading", "unloading"].includes(v.visitStatus); break;
        case "ready_out": matchSegment = v.visitStatus === "ready_out"; break;
        case "on_hold": matchSegment = v.holdStatus !== "none"; break;
        case "aged": matchSegment = isAged(v.checkInTime); break;
        case "ready_for_dock": matchSegment = v.visitStatus === "in_yard" && v.holdStatus === "none"; break;
        case "waiting_for_move": matchSegment = isUnassigned(v) && v.holdStatus === "none"; break;
        case "over_sla": matchSegment = calcDwellMinutes(v.checkInTime) > 480; break;
      }

      return matchSearch && matchType && matchSegment;
    });

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "trailerNumber": cmp = (a.trailerNumber || "").localeCompare(b.trailerNumber || ""); break;
          case "carrierName": cmp = (a.carrierName || "").localeCompare(b.carrierName || ""); break;
          case "dwellTime": cmp = calcDwellMinutes(a.checkInTime) - calcDwellMinutes(b.checkInTime); break;
          case "visitStatus": cmp = a.visitStatus.localeCompare(b.visitStatus); break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [visits, search, segment, typeFilter, sortKey, sortDir]);

  const lifecycleIdx = selectedVisit ? getLifecycleIndex(selectedVisit.visitStatus) : -1;

  const holdCount = segmentCounts.on_hold;
  const agedCount = segmentCounts.aged;
  const unassignedCount = visits.filter(isUnassigned).length;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "-";

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <PageHeader
        title={`Yard Inventory (${visits.length})`}
        subtitle="Live trailer positions and yard operations console"
        icon={<Truck className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" /></span>
              Live
            </span>
            <span>Updated {lastUpdated}</span>
          </div>
        }
        kpiStrip={
          <>
            <KPICard label="In Yard" value={segmentCounts.in_yard} accent="border-l-emerald-500" data-testid="kpi-in-yard" />
            <KPICard label="At Dock" value={segmentCounts.at_dock} accent="border-l-violet-500" data-testid="kpi-at-dock" />
            <KPICard label="Ready Out" value={segmentCounts.ready_out} accent="border-l-amber-500" data-testid="kpi-ready-out" />
            <KPICard label="On Hold" value={holdCount} accent={holdCount > 0 ? "border-l-red-500" : "border-l-gray-300"} data-testid="kpi-on-hold" />
            <KPICard label="Aged (24h+)" value={agedCount} accent={agedCount > 0 ? "border-l-amber-500" : "border-l-gray-300"} data-testid="kpi-aged" />
          </>
        }
      />

      {(holdCount > 0 || agedCount > 0 || unassignedCount > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          {holdCount > 0 && (
            <button onClick={() => setSegment("on_hold")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-medium hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors" data-testid="alert-holds">
              <ShieldAlert className="h-3 w-3" /> {holdCount} Hold{holdCount > 1 ? "s" : ""} Active
            </button>
          )}
          {agedCount > 0 && (
            <button onClick={() => setSegment("aged")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-[11px] font-medium hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors" data-testid="alert-aged">
              <Clock className="h-3 w-3" /> {agedCount} Aged (24h+)
            </button>
          )}
          {unassignedCount > 0 && (
            <button onClick={() => setSegment("checked_in")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-medium hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors" data-testid="alert-unassigned">
              <MapPin className="h-3 w-3" /> {unassignedCount} Awaiting Slot
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap border border-border/60 rounded-lg bg-muted/20 px-3 py-2 shadow-sm">
        <Tip text="Filter trailers by workflow stage">
          <Select value={segment} onValueChange={(v) => setSegment(v as SegmentFilter)}>
            <SelectTrigger className="w-44 h-8 text-xs bg-background" aria-label="Filter by workflow stage" data-testid="select-segment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEGMENTS.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  <span className="flex items-center gap-2">
                    {s.icon && <s.icon className={`h-3 w-3 ${s.color || "text-muted-foreground"}`} />}
                    {s.label}
                    {segmentCounts[s.key] > 0 && (
                      <span className="ml-1 text-muted-foreground">({segmentCounts[s.key]})</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Tip>

        <div className="w-px h-6 bg-border hidden sm:block" />

        <SearchAutocomplete
          value={search}
          onChange={setSearch}
          suggestions={suggestions}
          placeholder="Search trailer, carrier..."
          className="flex-1 min-w-[160px] max-w-xs"
          data-testid="input-search-inventory"
        />

        <Tip text="Filter by movement type (inbound, outbound, live load, etc.)">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-background" aria-label="Filter by movement type" data-testid="select-type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
              <SelectItem value="empty_drop">Empty Drop</SelectItem>
              <SelectItem value="loaded_arrival">Loaded Arrival</SelectItem>
              <SelectItem value="live_load">Live Load</SelectItem>
              <SelectItem value="live_unload">Live Unload</SelectItem>
            </SelectContent>
          </Select>
        </Tip>

        <div className="ml-auto flex items-center gap-2">
          <Tip text={showGroupedView ? "Switch to flat table view" : "Group trailers by status (On Hold, In Yard, At Dock…)"}>
            <Button
              variant={showGroupedView ? "default" : "outline"}
              size="sm"
              onClick={() => setShowGroupedView(!showGroupedView)}
              className="gap-1.5 text-xs h-8"
              data-testid="button-toggle-grouped-view"
            >
              {showGroupedView ? <List className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
              {showGroupedView ? "Flat View" : "Group by Status"}
            </Button>
          </Tip>
          {isRestrictedRole && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllCols(!showAllCols)}
              className="text-xs h-8"
              data-testid="button-toggle-cols"
            >
              {showAllCols ? "Default View" : "All Columns"}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-5 w-5" />}
          heading="No units found"
          description="No trailers or units match your current filters. Try adjusting the status, zone, or search term."
        />
      ) : showGroupedView ? (
        <InventoryGroupedView
          visits={filtered}
          selectedVisit={selectedVisit}
          onRowClick={handleRowClick}
          onPrimaryAction={handlePrimaryAction}
          sortIcon={sortIcon}
          handleSort={handleSort}
          colVis={colVis}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                {colVis.visit && (
                  <TableHead data-testid="header-visit" className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Unique visit reference number for this trailer check-in">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">Visit</span>
                    </Tip>
                  </TableHead>
                )}
                {colVis.trailer && (
                  <TableHead>
                    <Tip text="Trailer ID — hover for full details including lifecycle progress and SLA status">
                      <button className="flex items-center cursor-pointer select-none font-semibold text-[11px] uppercase tracking-wide" onClick={() => handleSort("trailerNumber")} data-testid="header-sort-trailer">
                        Trailer {sortIcon("trailerNumber")}
                      </button>
                    </Tip>
                  </TableHead>
                )}
                {colVis.carrier && (
                  <TableHead>
                    <Tip text="Carrier company operating this trailer">
                      <button className="flex items-center cursor-pointer select-none font-semibold text-[11px] uppercase tracking-wide" onClick={() => handleSort("carrierName")} data-testid="header-sort-carrier">
                        Carrier {sortIcon("carrierName")}
                      </button>
                    </Tip>
                  </TableHead>
                )}
                {colVis.location && (
                  <TableHead data-testid="header-location" className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Current yard slot or dock door assigned to this trailer">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">Location</span>
                    </Tip>
                  </TableHead>
                )}
                {colVis.status && (
                  <TableHead>
                    <Tip text="Yellow=Waiting · Blue=In Progress · Green=Ready · Red=Hold">
                      <button className="flex items-center cursor-pointer select-none font-semibold text-[11px] uppercase tracking-wide" onClick={() => handleSort("visitStatus")} data-testid="header-sort-status">
                        Status {sortIcon("visitStatus")}
                      </button>
                    </Tip>
                  </TableHead>
                )}
                {colVis.dwell && (
                  <TableHead>
                    <Tip text="Time elapsed since check-in. Amber = over 8h, Red = over 24h (aging alert)">
                      <button className="flex items-center cursor-pointer select-none font-semibold text-[11px] uppercase tracking-wide" onClick={() => handleSort("dwellTime")} data-testid="header-sort-dwell">
                        Time on Yard {sortIcon("dwellTime")}
                      </button>
                    </Tip>
                  </TableHead>
                )}
                {colVis.lastUpdate && (
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide" data-testid="header-last-action">
                    <Tip text="Most recent action taken on this trailer visit">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">Last Update</span>
                    </Tip>
                  </TableHead>
                )}
                {colVis.nextStep && (
                  <TableHead className="font-semibold text-[11px] uppercase tracking-wide">
                    <Tip text="Recommended next operational step — click to navigate">
                      <span className="cursor-help border-b border-dashed border-muted-foreground/40">Next Step</span>
                    </Tip>
                  </TableHead>
                )}
                <TableHead data-testid="header-action" className="text-right font-semibold text-[11px] uppercase tracking-wide">
                  <Tip text="Primary action based on trailer's current workflow stage">
                    <span className="cursor-help border-b border-dashed border-muted-foreground/40">Action</span>
                  </Tip>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((v) => {
                const primary = getPrimaryAction(v);
                const isSelected = selectedVisit?.id === v.id;
                const nextAction = getNextRecommendedAction(v);
                return (
                  <TableRow
                    key={v.id}
                    className={`group cursor-pointer transition-all duration-200 hover:bg-accent/40 ${getRowHighlight(v, isSelected)}`}
                    onClick={() => handleRowClick(v)}
                    data-testid={`row-visit-${v.id}`}
                  >
                    {colVis.visit && (
                      <TableCell className="font-medium text-xs" data-testid={`text-visit-number-${v.id}`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{v.visitNumber.slice(-8)}</span>
                          {!v.appointmentRef && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[9px] px-1 h-4">
                              Walk-In
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {colVis.trailer && (
                      <TableCell data-testid={`text-trailer-${v.id}`} onClick={(e) => e.stopPropagation()}>
                        <TrailerHoverCard visit={v} />
                      </TableCell>
                    )}
                    {colVis.carrier && (
                      <TableCell className="text-muted-foreground text-xs" data-testid={`text-carrier-${v.id}`}>
                        {v.carrierName || "-"}
                      </TableCell>
                    )}
                    {colVis.location && (
                      <TableCell data-testid={`text-location-${v.id}`}>
                        <span className="flex items-center gap-1.5 text-xs">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium">{v.currentSlotNumber || v.currentDockDoor || formatStatus(v.locationStatus)}</span>
                          {v.zoneName && <span className="text-[10px] text-muted-foreground hidden xl:inline">({v.zoneName})</span>}
                        </span>
                      </TableCell>
                    )}
                    {colVis.status && (
                      <TableCell data-testid={`badge-status-${v.id}`}>
                        <div className="flex flex-col gap-1">
                          <StatusChip status={v.visitStatus} holdStatus={v.holdStatus} visitNotes={v.notes} />
                          {(() => {
                            const tag = getMovementStatusTag(v);
                            return tag ? (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${tag.color}`}>
                                {hasActiveMove(v) && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                                {tag.label}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>
                    )}
                    {colVis.dwell && (
                      <TableCell data-testid={`text-dwell-${v.id}`}>
                        <LiveDwellTimer checkInTime={v.checkInTime} />
                      </TableCell>
                    )}
                    {colVis.lastUpdate && (
                      <TableCell data-testid={`text-last-action-${v.id}`}>
                        {(() => {
                          const lastAction = getLastKnownAction(v);
                          return (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{lastAction.action}</span>
                              <span className="text-[10px] text-muted-foreground">{formatDate(lastAction.timestamp)}</span>
                            </div>
                          );
                        })()}
                      </TableCell>
                    )}
                    {colVis.nextStep && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          if (hasActiveMove(v)) {
                            return (
                              <a href="/moves" className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border transition-colors border-primary/20 text-primary bg-primary/5 hover:bg-primary/10" data-testid={`button-next-step-${v.id}`}>
                                <ChevronRight className="h-3 w-3 shrink-0" />
                                Move to: {v.activeMoveDestination || "Destination TBD"}
                              </a>
                            );
                          }
                          const href = getNextStepHref(v);
                          const style = getNextStepStyle(v);
                          if (href) {
                            return (
                              <a href={href} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border transition-colors ${style}`} data-testid={`button-next-step-${v.id}`}>
                                <ChevronRight className="h-3 w-3 shrink-0" />
                                {nextAction}
                              </a>
                            );
                          }
                          return (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <ChevronRight className="h-3 w-3 shrink-0 text-primary/50" />
                              {nextAction}
                            </span>
                          );
                        })()}
                      </TableCell>
                    )}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm"
                          variant={primary.variant}
                          onClick={() => handlePrimaryAction(v)}
                          className={`h-7 text-xs px-2.5 transition-opacity ${hasActiveMove(v) ? "opacity-60 cursor-not-allowed" : isSelected ? "opacity-100" : "opacity-60 hover:opacity-100 group-hover:opacity-100"}`}
                          data-testid={`button-primary-action-${v.id}`}
                        >
                          <primary.icon className={`h-3 w-3 mr-1 ${hasActiveMove(v) ? "animate-pulse" : ""}`} />
                          {primary.label}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </Card>
      )}

      <Sheet open={!!selectedVisit} onOpenChange={(open) => !open && setSelectedVisit(null)}>
        <SheetContent className="w-[400px] sm:w-[440px] p-0 overflow-y-auto" data-testid="drawer-visit-details">
          {selectedVisit && (
            <>
              <SheetHeader className="p-4 pb-3 border-b">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-base font-bold">{selectedVisit.visitNumber}</SheetTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge className={`${visitStatusColor(selectedVisit.visitStatus)} border-transparent text-[10px]`}>
                      {formatStatus(selectedVisit.visitStatus)}
                    </Badge>
                    {selectedVisit.holdStatus !== "none" && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-transparent text-[10px]">
                        Hold
                      </Badge>
                    )}
                    {!selectedVisit.appointmentRef && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">
                        Walk-In
                      </Badge>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold flex items-center gap-2">
                    <Timer className="h-3 w-3" /> Visit Timeline
                  </h3>
                  <div className="relative pl-4 space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[1px] before:bg-border">
                    <div className="relative">
                      <div className="absolute -left-[13px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                      <p className="text-xs font-semibold">Check-In</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(selectedVisit.checkInTime)}</p>
                    </div>
                    {selectedVisit.currentSlotNumber && (
                      <div className="relative">
                        <div className="absolute -left-[13px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-background" />
                        <p className="text-xs font-semibold">Assigned Slot: {selectedVisit.currentSlotNumber}</p>
                      </div>
                    )}
                    {selectedVisit.currentDockDoor && (
                      <div className="relative">
                        <div className="absolute -left-[13px] top-1.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                        <p className="text-xs font-semibold">At Dock: {selectedVisit.currentDockDoor}</p>
                      </div>
                    )}
                    <div className="relative">
                      <div className="absolute -left-[13px] top-1.5 h-2.5 w-2.5 rounded-full bg-muted-foreground border-2 border-background" />
                      <p className="text-xs font-semibold">Current Status: {formatStatus(selectedVisit.visitStatus)}</p>
                    </div>
                  </div>
                </div>

                {selectedVisit.holdStatus !== "none" && (() => {
                  const holdInfo = getHoldDescription(selectedVisit.holdStatus);
                  return (
                    <div className={`rounded-md border p-3 space-y-2 ${
                      holdInfo.severity === "critical" ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800" :
                      holdInfo.severity === "high" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800" :
                      "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800"
                    }`}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 animate-pulse ${
                          holdInfo.severity === "critical" ? "text-red-600" : holdInfo.severity === "high" ? "text-amber-600" : "text-orange-600"
                        }`} />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{holdInfo.title}</p>
                            <Badge className={`text-[9px] px-1 h-4 border-transparent ${
                              holdInfo.severity === "critical" ? "bg-red-200 text-red-900" :
                              holdInfo.severity === "high" ? "bg-amber-200 text-amber-900" :
                              "bg-orange-200 text-orange-900"
                            }`}>{holdInfo.severity}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{holdInfo.description}</p>
                          {selectedVisit.notes && (
                            <p className="text-xs italic text-muted-foreground/80">"{selectedVisit.notes}"</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded bg-primary/5 border border-primary/20 px-2 py-1.5 ml-6">
                        <p className="text-[10px] font-semibold text-primary flex items-center gap-1 mb-0.5">
                          <Zap className="h-3 w-3" /> Suggested Action
                        </p>
                        <p className="text-xs text-foreground">{holdInfo.suggestedAction}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Details</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedVisit.appointmentRef && (
                      <DetailCell icon={Hash} label="Appointment" value={selectedVisit.appointmentRef} />
                    )}
                    <DetailCell icon={Truck} label="Trailer" value={selectedVisit.trailerNumber || "-"} />
                    <DetailCell icon={Truck} label="Truck" value={selectedVisit.truckNumber || "-"} />
                    <DetailCell label="Carrier" value={selectedVisit.carrierName || "-"} />
                    <DetailCell icon={User} label="Driver" value={selectedVisit.driverName || "-"} />
                    <DetailCell label="Visit Type" value={formatStatus(selectedVisit.movementType)} />
                    {selectedVisit.sealNumber && (
                      <DetailCell icon={Shield} label="Seal #" value={selectedVisit.sealNumber} />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Location & Timing</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <DetailCell icon={MapPin} label="Location" value={
                      selectedVisit.currentDockDoor || selectedVisit.currentSlotNumber ||
                      formatStatus(selectedVisit.locationStatus)
                    } />
                    {selectedVisit.zoneName && (
                      <DetailCell label="Zone" value={selectedVisit.zoneName} />
                    )}
                    <DetailCell icon={Clock} label="Checked In" value={formatDate(selectedVisit.checkInTime)} />
                    <DetailCell icon={Timer} label="Time on Yard" value={calcDwell(selectedVisit.checkInTime)} highlight={
                      calcDwellMinutes(selectedVisit.checkInTime) > 1440 ? "red" :
                      calcDwellMinutes(selectedVisit.checkInTime) > 480 ? "amber" : undefined
                    } />
                  </div>
                </div>

                {selectedVisit.notes && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Notes</h3>
                    <div className="rounded-md bg-muted/40 p-2.5">
                      <p className="text-xs text-muted-foreground">{selectedVisit.notes}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Lifecycle</h3>
                  <div className="space-y-0">
                    {LIFECYCLE_STEPS.map((step, i) => {
                      const isCompleted = i < lifecycleIdx;
                      const isCurrent = i === lifecycleIdx;
                      return (
                        <div key={step.key} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                              isCompleted
                                ? "bg-green-100 dark:bg-green-900/50"
                                : isCurrent
                                  ? "bg-primary/15 ring-2 ring-primary/40"
                                  : "bg-muted/60"
                            }`}>
                              {isCompleted ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                              ) : isCurrent ? (
                                <CircleDot className="h-3 w-3 text-primary" />
                              ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                              )}
                            </div>
                            {i < LIFECYCLE_STEPS.length - 1 && (
                              <div className={`w-px h-5 ${isCompleted ? "bg-green-300 dark:bg-green-700" : "bg-border"}`} />
                            )}
                          </div>
                          <p className={`text-xs pt-0.5 ${
                            isCompleted ? "text-green-700 dark:text-green-300 font-medium" :
                            isCurrent ? "text-foreground font-semibold" :
                            "text-muted-foreground"
                          }`}>
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Actions</h3>

                  <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 mb-3 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-[11px]"><span className="font-semibold text-primary">Recommended:</span> {getNextRecommendedAction(selectedVisit)}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {(() => {
                      const primary = getPrimaryAction(selectedVisit);
                      return (
                        <div className="space-y-1.5">
                          <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold px-1">Primary Action</h4>
                          <Button
                            className="w-full h-11 text-sm font-bold shadow-sm"
                            variant={primary.variant}
                            onClick={() => handlePrimaryAction(selectedVisit)}
                            data-testid="drawer-button-primary"
                          >
                            <primary.icon className="h-5 w-5 mr-2" />
                            {primary.label}
                          </Button>
                        </div>
                      );
                    })()}

                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold px-1">Operational Actions</h4>
                      <Accordion
                        type="single"
                        collapsible
                        defaultValue={getDefaultAccordionSection(selectedVisit)}
                        className="w-full space-y-1.5"
                      >
                        <AccordionItem value="yard" className="border rounded-md px-1 overflow-hidden bg-background shadow-sm">
                          <AccordionTrigger className="py-2.5 px-2 text-xs font-semibold hover:no-underline hover:bg-muted/30 transition-colors">
                            <span className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                                <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-600" />
                              </div>
                              Yard Actions
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-2 pt-1 px-2">
                            <div className="grid grid-cols-1 gap-1.5">
                              <ActionButton
                                visit={selectedVisit}
                                action="assign_slot"
                                label={selectedVisit.currentSlotNumber ? "Reassign Slot" : "Assign Yard Slot"}
                                icon={MapPin}
                                onClick={() => setActionDialog({ type: "assign_slot", visit: selectedVisit })}
                                testId="drawer-button-slot"
                              />
                              <ActionButton
                                visit={selectedVisit}
                                action="create_move"
                                label="Create Move Task"
                                icon={ArrowRightLeft}
                                onClick={() => {
                                  setMoveDestType("slot");
                                  setMovePriority("normal");
                                  setActionDialog({ type: "create_move", visit: selectedVisit });
                                }}
                                testId="drawer-button-move"
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="dock" className="border rounded-md px-1 overflow-hidden bg-background shadow-sm">
                          <AccordionTrigger className="py-2.5 px-2 text-xs font-semibold hover:no-underline hover:bg-muted/30 transition-colors">
                            <span className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center">
                                <DoorOpen className="h-3.5 w-3.5 text-violet-600" />
                              </div>
                              Dock Actions
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-2 pt-1 px-2">
                            <div className="grid grid-cols-1 gap-1.5">
                              <ActionButton
                                visit={selectedVisit}
                                action="assign_dock"
                                label="Assign Dock Door"
                                icon={DoorOpen}
                                onClick={() => setActionDialog({ type: "assign_dock", visit: selectedVisit })}
                                testId="drawer-button-dock"
                              />
                              <ActionButton
                                visit={selectedVisit}
                                action="ready_out"
                                label="Mark Ready Out"
                                icon={CheckCircle2}
                                onClick={() => updateStatusMutation.mutate({ visitId: selectedVisit.id, visitStatus: "ready_out" })}
                                testId="drawer-button-ready"
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="inspection" className="border rounded-md px-1 overflow-hidden bg-background shadow-sm">
                          <AccordionTrigger className="py-2.5 px-2 text-xs font-semibold hover:no-underline hover:bg-muted/30 transition-colors">
                            <span className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
                                <FileSearch className="h-3.5 w-3.5 text-amber-600" />
                              </div>
                              Hold & Inspection
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-2 pt-1 px-2">
                            <div className="grid grid-cols-1 gap-1.5">
                              <ActionButton
                                visit={selectedVisit}
                                action="inspect"
                                label="Start Inspection"
                                icon={FileSearch}
                                onClick={() => setLocation(`/inspections?visitId=${selectedVisit.id}&trailer=${encodeURIComponent(selectedVisit.trailerNumber || "")}&carrier=${encodeURIComponent(selectedVisit.carrierName || "")}`)}
                                testId="drawer-button-inspect"
                              />
                              {selectedVisit.holdStatus === "none" ? (
                                <ActionButton
                                  visit={selectedVisit}
                                  action="place_hold"
                                  label="Place Hold"
                                  icon={AlertTriangle}
                                  variant="destructive"
                                  onClick={() => updateStatusMutation.mutate({ visitId: selectedVisit.id, visitStatus: selectedVisit.visitStatus, holdStatus: "yard_block" })}
                                  testId="drawer-button-hold"
                                />
                              ) : (
                                <ActionButton
                                  visit={selectedVisit}
                                  action="clear_hold"
                                  label="Clear Hold"
                                  icon={ShieldAlert}
                                  onClick={() => handleClearHold(selectedVisit)}
                                  testId="drawer-button-clear-hold"
                                />
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="gate" className="border rounded-md px-1 overflow-hidden bg-background shadow-sm">
                          <AccordionTrigger className="py-2.5 px-2 text-xs font-semibold hover:no-underline hover:bg-muted/30 transition-colors">
                            <span className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded bg-gray-50 dark:bg-gray-950/30 flex items-center justify-center">
                                <LogOut className="h-3.5 w-3.5 text-gray-600" />
                              </div>
                              Gate & Checkout
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="pb-2 pt-1 px-2">
                            <div className="grid grid-cols-1 gap-1.5">
                              <ActionButton
                                visit={selectedVisit}
                                action="ready_out"
                                label="Mark Ready for Departure"
                                icon={CheckCircle2}
                                onClick={() => updateStatusMutation.mutate({ visitId: selectedVisit.id, visitStatus: "ready_out" })}
                                testId="drawer-button-checkout-ready"
                              />
                              <ActionButton
                                visit={selectedVisit}
                                action="send_gate"
                                label="Send to Exit Gate"
                                icon={LogOut}
                                onClick={() => updateStatusMutation.mutate({ visitId: selectedVisit.id, visitStatus: "checked_out" })}
                                testId="drawer-button-gate"
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>

                    {/* Continue Processing — workflow navigation CTA */}
                    {(() => {
                      const nav = getWorkflowNavigation(selectedVisit);
                      if (!nav) return null;
                      return (
                        <div className={`rounded-lg border-2 ${nav.color} p-3 mt-2`} data-testid="workflow-continue-cta">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wide">Continue Processing</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{nav.description}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-2.5 h-9 text-xs font-semibold"
                            onClick={() => {
                              setSelectedVisit(null);
                              setLocation(nav.href);
                            }}
                            data-testid="button-workflow-continue"
                          >
                            {nav.label} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={actionDialog?.type === "assign_slot"} onOpenChange={(o) => {
        if (!o) { setActionDialog(null); setMovePriority("normal"); setMoveJockeyId(""); setMoveNotes(""); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Create Move — Assign Yard Slot
            </DialogTitle>
            <DialogDescription>
              Create a move task to assign this trailer to a yard slot. Optionally assign a jockey immediately.
            </DialogDescription>
          </DialogHeader>
          {actionDialog?.visit && (
            <div className="space-y-4 mt-1">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold">{actionDialog.visit.trailerNumber || actionDialog.visit.visitNumber}</span>
                  <span className="text-muted-foreground">{actionDialog.visit.carrierName}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>From: <span className="font-medium text-foreground">{actionDialog.visit.currentSlotNumber ? `Slot ${actionDialog.visit.currentSlotNumber}` : actionDialog.visit.currentDockDoor ?? "Gate / Staging"}</span></span>
                  <span>→</span>
                  <span>Select slot below</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1"><Users className="h-3 w-3" /> Assign Jockey</Label>
                  <Select value={moveJockeyId} onValueChange={setMoveJockeyId}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-jockey-slot">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned (Queue)</SelectItem>
                      {jockeys.map((j) => (
                        <SelectItem key={j.id} value={j.id} disabled={j.jockeyStatus === "busy"}>
                          <span className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${j.jockeyStatus === "available" ? "bg-green-500" : "bg-amber-500"}`} />
                            {j.firstName} {j.lastName}
                            {j.activeMoveCount > 0 && <span className="text-muted-foreground ml-1">({j.activeMoveCount} active)</span>}
                            {j.jockeyStatus === "busy" && <span className="text-xs text-amber-600 ml-1">Busy</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Priority</Label>
                  <Select value={movePriority} onValueChange={(v) => setMovePriority(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
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
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Remarks (optional)</Label>
                <Textarea
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  placeholder="Any notes for the jockey..."
                  className="h-16 text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1"><MapPin className="h-3 w-3" /> Select Destination Slot</Label>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No available slots</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {slots.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 p-2.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors text-sm"
                        onClick={() => {
                          if (!actionDialog) return;
                          const v = actionDialog.visit;
                          const fromLocationType = v.currentSlotNumber ? "slot" : v.currentDockDoor ? "dock" : "gate";
                          const fromLocationName = v.currentSlotNumber ?? (v.currentDockDoor ? v.currentDockDoor : "Gate");
                          const moveType = fromLocationType === "slot" ? "reposition" : "gate_to_slot";
                          createMoveMutation.mutate({
                            visitId: v.id,
                            moveType,
                            fromLocationType,
                            fromLocationName,
                            toLocationType: "slot",
                            toLocationId: s.id,
                            toLocationName: s.slotNumber,
                            priority: movePriority,
                            assignedTo: moveJockeyId && moveJockeyId !== "unassigned" ? moveJockeyId : null,
                            notes: moveNotes || null,
                            source: "inventory_assignment",
                          });
                        }}
                        data-testid={`slot-option-${s.id}`}
                      >
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium">{s.slotNumber}</span>
                        <span className="text-xs text-muted-foreground">{s.zoneName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog?.type === "assign_dock"} onOpenChange={(o) => {
        if (!o) { setActionDialog(null); setMovePriority("normal"); setMoveJockeyId(""); setMoveNotes(""); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Create Move — Move to Dock
            </DialogTitle>
            <DialogDescription>
              Create a move task to send this trailer to a dock door for loading/unloading. Optionally assign a jockey immediately.
            </DialogDescription>
          </DialogHeader>
          {actionDialog?.visit && (
            <div className="space-y-4 mt-1">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold">{actionDialog.visit.trailerNumber || actionDialog.visit.visitNumber}</span>
                  <span className="text-muted-foreground">{actionDialog.visit.carrierName}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>From: <span className="font-medium text-foreground">{actionDialog.visit.currentSlotNumber ? `Slot ${actionDialog.visit.currentSlotNumber}` : actionDialog.visit.currentDockDoor ?? "Yard"}</span></span>
                  <span>→</span>
                  <span>Select dock door below</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1"><Users className="h-3 w-3" /> Assign Jockey</Label>
                  <Select value={moveJockeyId} onValueChange={setMoveJockeyId}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-jockey-dock">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned (Queue)</SelectItem>
                      {jockeys.map((j) => (
                        <SelectItem key={j.id} value={j.id} disabled={j.jockeyStatus === "busy"}>
                          <span className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${j.jockeyStatus === "available" ? "bg-green-500" : "bg-amber-500"}`} />
                            {j.firstName} {j.lastName}
                            {j.activeMoveCount > 0 && <span className="text-muted-foreground ml-1">({j.activeMoveCount} active)</span>}
                            {j.jockeyStatus === "busy" && <span className="text-xs text-amber-600 ml-1">Busy</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Priority</Label>
                  <Select value={movePriority} onValueChange={(v) => setMovePriority(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
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
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Remarks (optional)</Label>
                <Textarea
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  placeholder="Any notes for the jockey..."
                  className="h-16 text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1"><DoorOpen className="h-3 w-3" /> Select Destination Dock</Label>
                {doors.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No available dock doors</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {doors.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 p-2.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors text-sm"
                        onClick={() => {
                          if (!actionDialog) return;
                          const v = actionDialog.visit;
                          const fromLocationType = v.currentSlotNumber ? "slot" : v.currentDockDoor ? "dock" : "gate";
                          const fromLocationName = v.currentSlotNumber
                            ? `Slot ${v.currentSlotNumber}`
                            : v.currentDockDoor ?? "Gate / Staging";
                          const moveType = fromLocationType === "slot"
                            ? "slot_to_dock"
                            : fromLocationType === "dock"
                            ? "reposition"
                            : "gate_to_dock";
                          createMoveMutation.mutate({
                            visitId: v.id,
                            moveType,
                            fromLocationType,
                            fromLocationName,
                            toLocationType: "dock",
                            toLocationId: d.id,
                            toLocationName: `Door ${d.doorNumber}`,
                            priority: movePriority,
                            assignedTo: moveJockeyId && moveJockeyId !== "unassigned" ? moveJockeyId : null,
                            notes: moveNotes || null,
                            source: "inventory_assignment",
                          });
                        }}
                        data-testid={`door-option-${d.id}`}
                      >
                        <DoorOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-medium">Door {d.doorNumber}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog?.type === "create_move"} onOpenChange={(o) => {
        if (!o) { setActionDialog(null); setMovePriority("normal"); setMoveDestType("slot"); setMoveJockeyId(""); setMoveNotes(""); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              Create Move Task
            </DialogTitle>
            <DialogDescription>
              Manually create a move task for this trailer. Select destination type, assign a jockey, and set priority.
            </DialogDescription>
          </DialogHeader>
          {actionDialog?.visit && (
            <div className="space-y-4 mt-1">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-semibold">{actionDialog.visit.trailerNumber || actionDialog.visit.visitNumber}</span>
                  <span className="text-muted-foreground">{actionDialog.visit.carrierName}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>From: <span className="font-medium text-foreground">{actionDialog.visit.currentSlotNumber ? `Slot ${actionDialog.visit.currentSlotNumber}` : actionDialog.visit.currentDockDoor ? `Door ${actionDialog.visit.currentDockDoor}` : "Gate / Staging"}</span></span>
                  <span>→</span>
                  <span>Select destination below</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold">Destination Type</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={moveDestType === "slot" ? "default" : "outline"}
                    className="flex-1 h-8 text-xs"
                    onClick={() => setMoveDestType("slot")}
                  >
                    <MapPin className="h-3.5 w-3.5 mr-1" /> Yard Slot
                  </Button>
                  <Button
                    size="sm"
                    variant={moveDestType === "dock" ? "default" : "outline"}
                    className="flex-1 h-8 text-xs"
                    onClick={() => setMoveDestType("dock")}
                  >
                    <DoorOpen className="h-3.5 w-3.5 mr-1" /> Dock Door
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1"><Users className="h-3 w-3" /> Assign Jockey</Label>
                  <Select value={moveJockeyId} onValueChange={setMoveJockeyId}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-jockey-move">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned (Queue)</SelectItem>
                      {jockeys.map((j) => (
                        <SelectItem key={j.id} value={j.id} disabled={j.jockeyStatus === "busy"}>
                          <span className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${j.jockeyStatus === "available" ? "bg-green-500" : "bg-amber-500"}`} />
                            {j.firstName} {j.lastName}
                            {j.activeMoveCount > 0 && <span className="text-muted-foreground ml-1">({j.activeMoveCount} active)</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Priority</Label>
                  <Select value={movePriority} onValueChange={(v) => setMovePriority(v as any)}>
                    <SelectTrigger className="h-8 text-xs">
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
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Remarks (optional)</Label>
                <Textarea
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  placeholder="Any notes for the jockey..."
                  className="h-14 text-xs resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  {moveDestType === "slot" ? <MapPin className="h-3 w-3" /> : <DoorOpen className="h-3 w-3" />}
                  {moveDestType === "slot" ? "Select Destination Slot" : "Select Destination Dock"}
                </Label>
                {moveDestType === "slot" ? (
                  slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No available slots</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {slots.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-2 p-2.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors text-sm"
                          onClick={() => {
                            if (!actionDialog) return;
                            const v = actionDialog.visit;
                            const fromLocationType = v.currentSlotNumber ? "slot" : v.currentDockDoor ? "dock" : "gate";
                            const fromLocationName = v.currentSlotNumber ?? (v.currentDockDoor ? `Door ${v.currentDockDoor}` : undefined);
                            const moveType = fromLocationType === "slot" ? "reposition" : fromLocationType === "dock" ? "dock_to_slot" : "gate_to_slot";
                            createMoveMutation.mutate({
                              visitId: v.id,
                              moveType,
                              fromLocationType,
                              fromLocationName,
                              toLocationType: "slot",
                              toLocationId: s.id,
                              toLocationName: s.slotNumber,
                              priority: movePriority,
                              assignedTo: moveJockeyId && moveJockeyId !== "unassigned" ? moveJockeyId : null,
                              notes: moveNotes || null,
                              source: "inventory_manual",
                            });
                          }}
                          data-testid={`move-slot-option-${s.id}`}
                        >
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-medium">{s.slotNumber}</span>
                          <span className="text-xs text-muted-foreground">{s.zoneName}</span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  doors.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No available doors</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {doors.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center gap-2 p-2.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors text-sm"
                          onClick={() => {
                            if (!actionDialog) return;
                            const v = actionDialog.visit;
                            const fromLocationType = v.currentSlotNumber ? "slot" : v.currentDockDoor ? "dock" : "gate";
                            const fromLocationName = v.currentSlotNumber ?? (v.currentDockDoor ? `Door ${v.currentDockDoor}` : undefined);
                            const moveType = fromLocationType === "slot" ? "slot_to_dock" : "gate_to_dock";
                            createMoveMutation.mutate({
                              visitId: v.id,
                              moveType,
                              fromLocationType,
                              fromLocationName,
                              toLocationType: "dock",
                              toLocationId: d.id,
                              toLocationName: `Door ${d.doorNumber}`,
                              priority: movePriority,
                              assignedTo: moveJockeyId && moveJockeyId !== "unassigned" ? moveJockeyId : null,
                              notes: moveNotes || null,
                              source: "inventory_manual",
                            });
                          }}
                          data-testid={`move-door-option-${d.id}`}
                        >
                          <DoorOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-medium">Door {d.doorNumber}</span>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!holdResolutionDialog} onOpenChange={(o) => {
        if (!o) { setHoldResolutionDialog(null); setHoldResolutionReason(""); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Resolve Hold
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {holdResolutionDialog && (
              <div className="rounded-md bg-muted/40 p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Visit</p>
                <p className="text-sm font-bold">{holdResolutionDialog.visit.visitNumber}</p>
                <p className="text-xs text-muted-foreground">{holdResolutionDialog.visit.trailerNumber} · {holdResolutionDialog.visit.carrierName}</p>
                <div className="mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Current Hold</p>
                  <p className="text-sm text-red-600 font-medium">{formatStatus(holdResolutionDialog.visit.holdStatus)}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                Resolution Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={holdResolutionReason}
                onChange={(e) => setHoldResolutionReason(e.target.value)}
                placeholder="Describe why the hold is being cleared..."
                className="resize-none h-24"
                data-testid="input-hold-resolution-reason"
              />
              <p className="text-[10px] text-muted-foreground">This reason will be recorded in the audit log for traceability.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setHoldResolutionDialog(null); setHoldResolutionReason(""); }}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleHoldResolutionSubmit}
                disabled={updateStatusMutation.isPending || !holdResolutionReason.trim()}
                data-testid="button-confirm-hold-resolution"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {updateStatusMutation.isPending ? "Clearing..." : "Clear Hold"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailCell({ icon: Icon, label, value, highlight }: {
  icon?: typeof MapPin;
  label: string;
  value: string;
  highlight?: "red" | "amber";
}) {
  const highlightClass = highlight === "red" ? "text-red-600 font-medium" : highlight === "amber" ? "text-amber-600 font-medium" : "";
  return (
    <div className="rounded-md bg-muted/40 p-2.5" data-testid={`detail-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className={`text-sm font-semibold mt-0.5 truncate ${highlightClass}`}>{value}</p>
    </div>
  );
}
