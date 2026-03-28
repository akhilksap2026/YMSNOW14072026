import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { formatCurrency, formatDwell, formatTitle } from "@/lib/format";
import { getDwellColour } from "@/lib/dwell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { visitStatusColor, roleColor } from "@/lib/status-colors";
import { PageHeader, KPICard, StatusChip } from "@/components/enterprise";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Truck,
  LogIn,
  LogOut,
  DoorOpen,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  CalendarX,
  Timer,
  ChevronRight,
  ChevronDown,
  Map,
  PlusCircle,
  CheckCircle2,
  Users,
  Package,
  Gauge,
  ClipboardCheck,
  ShieldCheck,
  Settings,
  Activity,
  UserCircle,
  BarChart3,
  BadgeDollarSign,
  TrendingUp,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { useProductMode, isOptimizeMode, isAssistMode } from "@/lib/product-mode";
import { useTabletView } from "@/lib/tablet-view";
import {
  OptimizeDashboardPanel,
  AssistSummaryBanner,
} from "@/components/optimize/optimize-dashboard-panel";
import {
  buildOperationalBrief,
  buildAssistSummary,
} from "@/lib/recommendation-service";
import { DemoHelper } from "@/components/demo-helper";
import { ROIPanel } from "@/components/optimize/roi-panel";

interface DashboardStats {
  yardInventory: number;
  arrivalsToday: number;
  departuresToday: number;
  trailersAtDock: number;
  trailersOnHold: number;
  avgDwellMinutes: number;
  openMoveTasks: number;
  overdueAppointments: number;
  agedTrailers: number;
  awaitingSlot: number;
  readyOutCount: number;
  overdueMoves: number;
  recentVisits: Array<{
    id: number;
    visitNumber: string;
    trailerNumber: string | null;
    carrierName: string | null;
    visitStatus: string;
    locationStatus: string;
    checkInTime: string | null;
    location: string;
    dwellMinutes: number;
  }>;
}

interface GateStats {
  expectedToday: number;
  checkedInToday: number;
  walkInsToday: number;
  exceptionsToday: number;
  completedExitsToday: number;
  readyOut: number;
  blockedExits: number;
  onHold: number;
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

interface DockDoor {
  id: number;
  doorNumber: string;
  status: string;
  visitId: number | null;
  trailerNumber: string | null;
  visitStatus: string | null;
  carrierName: string | null;
  checkInTime: string | null;
}

interface ZoneCapacity {
  zoneId: number;
  totalSlots: number;
  activeSlots: number;
  availableSlots: number;
}

interface MoveTask {
  id: number;
  visitId: number;
  moveType: string;
  fromLocationName: string;
  toLocationName: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  assignedToName: string | null;
  trailerNumber: string | null;
  carrierName: string | null;
  visitNumber: string;
  createdAt: string;
}

interface OpenException {
  id: number;
  visitId: number;
  type: string;
  severity: string;
  description: string;
  status: string;
  trailerNumber: string | null;
  visitNumber: string;
  createdAt: string;
}

interface RevenueDashboard {
  summary: {
    totalRevenue: number;
    todayRevenue: number;
    pendingEvents: number;
    billedEvents: number;
    avgRevenuePerVisit: number;
  };
  savings: {
    total: number;
    breakdown: {
      dockGainValue: number;
      dwellSavingValue: number;
      exceptionValue: number;
      moveValue: number;
    };
  };
  byType: Array<{ serviceType: string; total: number; count: number; label: string }>;
  dockUtilization: number;
}

type AccentColor = "blue" | "green" | "amber" | "red" | "gray" | "violet";

const accentStyles: Record<AccentColor, string> = {
  blue: "border-l-[#2B5DAD] dark:border-l-[#5B8FE0]",
  green: "border-l-emerald-500 dark:border-l-emerald-400",
  amber: "border-l-amber-500 dark:border-l-amber-400",
  red: "border-l-[#CC2229] dark:border-l-[#E85A60]",
  gray: "border-l-gray-400 dark:border-l-gray-500",
  violet: "border-l-violet-500 dark:border-l-violet-400",
};

const accentIconStyles: Record<AccentColor, string> = {
  blue: "text-[#2B5DAD] dark:text-[#5B8FE0]",
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-[#CC2229] dark:text-[#E85A60]",
  gray: "text-muted-foreground",
  violet: "text-violet-600 dark:text-violet-400",
};

const accentValueStyles: Record<AccentColor, string> = {
  blue: "text-[#1A3A6B] dark:text-[#7EB0F5]",
  green: "text-emerald-700 dark:text-emerald-300",
  amber: "text-amber-700 dark:text-amber-300",
  red: "text-[#A31B21] dark:text-[#F28A8E]",
  gray: "text-foreground",
  violet: "text-violet-700 dark:text-violet-300",
};

function StatCard({
  title,
  value,
  icon: Icon,
  accent = "gray",
  href,
}: {
  title: string;
  value: number | string;
  icon: LucideIcon;
  accent?: AccentColor;
  href?: string;
}) {
  const content = (
    <Card className={`border-l-[3px] ${accentStyles[accent]} overflow-hidden ${href ? "hover:bg-accent/50 cursor-pointer transition-colors" : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide leading-tight truncate">
              {title}
            </p>
            <p
              className={`text-xl font-bold tracking-tight leading-tight mt-1 truncate ${accentValueStyles[accent]}`}
              data-testid={`text-stat-${title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {value}
            </p>
          </div>
          <div className="h-8 w-8 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
            <Icon className={`h-4 w-4 ${accentIconStyles[accent]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function getStatusBadgeClasses(status: string): string {
  return visitStatusColor(status) + " border-transparent";
}

function RevenueKpiSection() {
  const { data: rd, isLoading } = useQuery<RevenueDashboard>({
    queryKey: ["/api/revenue/dashboard"],
  });

  const storageTotal = rd?.byType?.find((t) => t.serviceType === "yard_storage")?.total ?? 0;
  const dockRevTotal = rd?.byType?.find((t) => t.serviceType === "dock_usage")?.total ?? 0;
  const detentionTotal =
    (rd?.byType?.find((t) => t.serviceType === "detention")?.total ?? 0) +
    (rd?.byType?.find((t) => t.serviceType === "late_arrival")?.total ?? 0) +
    (rd?.byType?.find((t) => t.serviceType === "no_show")?.total ?? 0);
  const savingsTotal = rd?.savings?.total ?? 0;
  const dockUtil = rd?.dockUtilization ?? 0;
  const totalRevenue = rd?.summary?.totalRevenue ?? 0;

  const hasActivity = !isLoading && (totalRevenue > 0 || storageTotal > 0 || detentionTotal > 0 || savingsTotal > 0 || dockRevTotal > 0);
  const [expanded, setExpanded] = useState(hasActivity);

  const dash = isLoading ? "—" : undefined;

  return (
    <section>
      <button
        className="flex items-center justify-between w-full mb-2 px-1 group"
        onClick={() => setExpanded((v) => !v)}
      >
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "" : "-rotate-90"}`} />
          Revenue Intelligence
          {!hasActivity && !isLoading && (
            <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/60 ml-1">(no data yet)</span>
          )}
        </h2>
        <Link
          href="/revenue"
          className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          Full Report <ChevronRight className="h-3 w-3" />
        </Link>
      </button>
      {expanded && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard title="Total Yard Revenue" value={dash ?? formatCurrency(totalRevenue)} icon={BadgeDollarSign} accent="green" href="/revenue" />
          <StatCard title="Yard Space Utilization" value={dash ?? formatCurrency(storageTotal)} icon={Warehouse} accent="blue" href="/revenue" />
          <StatCard title="Detention & Demurrage" value={dash ?? formatCurrency(detentionTotal)} icon={Clock} accent={detentionTotal > 0 ? "amber" : "green"} href="/revenue" />
          <StatCard title="Cost Savings" value={dash ?? formatCurrency(savingsTotal)} icon={TrendingUp} accent="violet" href="/revenue" />
          <StatCard title="Dock Revenue" value={dash ?? formatCurrency(dockRevTotal)} icon={DoorOpen} accent="blue" href="/revenue" />
          <StatCard title="Dock Utilization" value={dash ?? `${dockUtil}%`} icon={Gauge} accent={dockUtil > 90 ? "red" : dockUtil > 60 ? "amber" : "green"} />
        </div>
      )}
    </section>
  );
}

function computeYardUtilization(zones?: ZoneCapacity[]): number {
  if (!zones || zones.length === 0) return 0;
  const totalSlots = zones.reduce((acc, z) => acc + z.totalSlots, 0);
  const occupied = zones.reduce((acc, z) => acc + (z.totalSlots - z.availableSlots), 0);
  if (totalSlots === 0) return 0;
  return Math.round((occupied / totalSlots) * 100);
}

function UnifiedKpiStrip6({ s, ms, zc }: { s: DashboardStats; ms?: MoveSummary; zc?: ZoneCapacity[] }) {
  const utilization = computeYardUtilization(zc);
  const totalSlots = zc?.reduce((acc, z) => acc + z.totalSlots, 0) || 40;
  const invPct = totalSlots > 0 ? Math.round((s.yardInventory / totalSlots) * 100) : 0;
  const invBarColor = invPct >= 90 ? "bg-red-500" : invPct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <>
      <KPICard
        label="Yard Inventory"
        value={s.yardInventory}
        icon={<Truck className="h-4 w-4" />}
        accent="border-l-emerald-500"
        href="/yard/inventory"
        data-testid="kpi-yard-inventory"
        footer={
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{s.yardInventory} / {totalSlots} slots</span>
              <span className={invPct >= 90 ? "text-red-500" : invPct >= 70 ? "text-amber-500" : "text-emerald-600"}>{invPct}% full</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className={`h-1 rounded-full transition-all ${invBarColor}`} style={{ width: `${invPct}%` }} />
            </div>
          </div>
        }
      />
      <KPICard
        label="Utilization"
        value={`${utilization}%`}
        icon={<BarChart3 className="h-4 w-4" />}
        accent={utilization > 90 ? "border-l-[#CC2229]" : utilization > 70 ? "border-l-amber-500" : "border-l-emerald-500"}
        href="/yard/inventory"
        data-testid="kpi-yard-utilization"
      />
      <KPICard
        label="On Hold"
        value={s.trailersOnHold}
        icon={<AlertTriangle className="h-4 w-4" />}
        accent={s.trailersOnHold > 0 ? "border-l-[#CC2229]" : "border-l-emerald-500"}
        href="/exceptions"
        data-testid="kpi-on-hold"
      />
      <KPICard
        label="Aged Trailers"
        value={s.agedTrailers}
        icon={<Clock className="h-4 w-4" />}
        accent={s.agedTrailers > 0 ? "border-l-amber-500" : "border-l-emerald-500"}
        href="/yard/inventory?filter=aged"
        data-testid="kpi-aged-trailers"
      />
      <KPICard
        label="Overdue Moves"
        value={ms?.overdue ?? 0}
        icon={<ArrowRightLeft className="h-4 w-4" />}
        accent={(ms?.overdue ?? 0) > 0 ? "border-l-[#CC2229]" : "border-l-emerald-500"}
        href="/moves"
        data-testid="kpi-overdue-moves"
      />
      <KPICard
        label="Ready Out"
        value={s.readyOutCount}
        icon={<CheckCircle2 className="h-4 w-4" />}
        accent={s.readyOutCount > 0 ? "border-l-amber-500" : "border-l-emerald-500"}
        href="/gate/check-out"
        data-testid="kpi-ready-out"
      />
    </>
  );
}

function GateKpiStrip({ gs }: { gs: GateStats }) {
  return (
    <>
      <KPICard
        label="Expected Today"
        value={gs.expectedToday}
        icon={<CalendarX className="h-4 w-4" />}
        accent="border-l-[#2B5DAD]"
        data-testid="kpi-expected"
      />
      <KPICard
        label="Checked In"
        value={gs.checkedInToday}
        icon={<LogIn className="h-4 w-4" />}
        accent="border-l-emerald-500"
        data-testid="kpi-checked-in"
      />
      <KPICard
        label="Exits Completed"
        value={gs.completedExitsToday}
        icon={<LogOut className="h-4 w-4" />}
        accent="border-l-gray-400"
        data-testid="kpi-exits"
      />
      <KPICard
        label="Ready to Exit"
        value={gs.readyOut}
        icon={<CheckCircle2 className="h-4 w-4" />}
        accent={gs.readyOut > 0 ? "border-l-amber-500" : "border-l-emerald-500"}
        data-testid="kpi-ready-out"
      />
    </>
  );
}

function MoveKpiStrip({ ms }: { ms: MoveSummary }) {
  const pendingMoves = ms.available + ms.assigned;
  return (
    <>
      <KPICard
        label="Pending Moves"
        value={pendingMoves}
        icon={<Package className="h-4 w-4" />}
        accent={pendingMoves > 0 ? "border-l-amber-500" : "border-l-emerald-500"}
        data-testid="kpi-pending-moves"
      />
      <KPICard
        label="In Progress"
        value={ms.inProgress}
        icon={<ArrowRightLeft className="h-4 w-4" />}
        accent={ms.inProgress > 0 ? "border-l-[#2B5DAD]" : "border-l-gray-400"}
        data-testid="kpi-in-progress"
      />
      <KPICard
        label="Completed Today"
        value={ms.completedToday}
        icon={<CheckCircle2 className="h-4 w-4" />}
        accent="border-l-emerald-500"
        data-testid="kpi-completed-today"
      />
      <KPICard
        label="Overdue Moves"
        value={ms.overdue}
        icon={<Clock className="h-4 w-4" />}
        accent={ms.overdue > 0 ? "border-l-[#CC2229]" : "border-l-emerald-500"}
        data-testid="kpi-overdue-moves"
      />
    </>
  );
}


function ActionItem({
  label,
  count,
  href,
  color,
  actionLabel,
  ageText,
}: {
  label: string;
  count: number;
  href: string;
  color: "red" | "amber" | "green";
  actionLabel?: string;
  ageText?: string;
}) {
  if (count === 0) return null;

  const colorStyles = {
    red: "bg-red-50 text-red-700 border-red-100 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50",
    amber: "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
    green: "bg-green-50 text-green-700 border-green-100 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50",
  };

  return (
    <Link href={href}>
      <div className={`flex items-start justify-between p-2.5 rounded-lg border cursor-pointer transition-all group ${colorStyles[color]}`} data-testid={`action-item-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        <div className="flex items-start gap-3 min-w-0">
          <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${color === "red" ? "bg-red-500" : color === "amber" ? "bg-amber-500" : "bg-green-500"}`} />
          <div className="min-w-0">
            <span className="text-sm font-medium">{count} {label}</span>
            {ageText && <p className="text-[10px] opacity-70 mt-0.5 font-normal">{ageText}</p>}
          </div>
        </div>
        <span className="text-xs font-semibold flex items-center gap-0.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {actionLabel || "View"} <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function ShortcutButton({
  icon: Icon,
  label,
  href,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Button variant="outline" className="h-auto py-3 px-4 flex flex-col gap-2 w-full" data-testid={`shortcut-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        <Icon className="h-5 w-5" />
        <span className="text-xs font-semibold">{label}</span>
      </Button>
    </Link>
  );
}

function ActionRequiredPanel({ s, exceptions = [], moves = [] }: { s: DashboardStats; exceptions?: OpenException[]; moves?: MoveTask[] }) {
  const totalActions = s.trailersOnHold + s.overdueMoves + s.awaitingSlot + s.agedTrailers + s.readyOutCount;

  const oldestException = exceptions.filter(e => e.status === "open").reduce<string | null>((oldest, e) => {
    if (!oldest) return e.createdAt;
    return new Date(e.createdAt) < new Date(oldest) ? e.createdAt : oldest;
  }, null);

  const overdueMoves = moves.filter(m => m.status === "escalated");
  const oldestOverdue = overdueMoves.reduce<string | null>((oldest, m) => {
    if (!oldest) return m.createdAt;
    return new Date(m.createdAt) < new Date(oldest) ? m.createdAt : oldest;
  }, null);

  return (
    <Card className="h-full border-2 border-primary/10">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Action Required
          </CardTitle>
          {totalActions > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 min-w-[20px] justify-center">
              {totalActions}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        <ActionItem
          label="active holds requiring attention"
          count={s.trailersOnHold}
          href="/exceptions"
          color="red"
          actionLabel="View Holds →"
          ageText={oldestException ? `oldest: ${timeAgo(oldestException)}` : undefined}
        />
        <ActionItem
          label="overdue move tasks"
          count={s.overdueMoves}
          href="/moves"
          color="red"
          actionLabel="View Moves →"
          ageText={oldestOverdue ? `oldest: ${timeAgo(oldestOverdue)}` : undefined}
        />
        <ActionItem
          label="new arrivals awaiting slot assignment"
          count={s.awaitingSlot}
          href="/yard/inventory?filter=awaiting-slot"
          color="amber"
          actionLabel="Assign Slots →"
        />
        <ActionItem
          label="trailers ready for exit"
          count={s.readyOutCount}
          href="/gate/check-out"
          color="green"
          actionLabel="Process Exit →"
        />
        <ActionItem
          label="trailers aged > 24h"
          count={s.agedTrailers}
          href="/yard/inventory?filter=aged"
          color="amber"
          actionLabel="View Aged →"
        />
        {totalActions === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </div>
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs text-muted-foreground">No urgent actions pending</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityFeedTable({ visits, limit }: { visits: DashboardStats["recentVisits"]; limit?: number }) {
  const rows = limit ? visits.slice(0, limit) : visits;
  return (
    <Card>
      <CardHeader className="p-4 pb-2 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold">Recent Activity Feed</CardTitle>
          <Link href="/yard/inventory" className="text-xs text-primary hover:underline font-medium">View all</Link>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm" data-testid="text-no-activity">
            No active visits. Waiting for arrivals.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="h-9 text-xs font-bold px-4">Visit#</TableHead>
                  <TableHead className="h-9 text-xs font-bold px-4">Trailer#</TableHead>
                  <TableHead className="h-9 text-xs font-bold px-4 hidden sm:table-cell">Carrier</TableHead>
                  <TableHead className="h-9 text-xs font-bold px-4">Location</TableHead>
                  <TableHead className="h-9 text-xs font-bold px-4">Status</TableHead>
                  <TableHead className="h-9 text-xs font-bold px-4 text-right">Dwell Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((v) => (
                  <TableRow key={v.id} data-testid={`row-visit-${v.id}`} className="hover:bg-muted/20">
                    <TableCell className="py-2.5 px-4 font-mono text-xs font-semibold" data-testid={`text-visit-number-${v.id}`}>
                      {v.visitNumber}
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-sm font-medium" data-testid={`text-trailer-number-${v.id}`}>
                      {v.trailerNumber || "N/A"}
                    </TableCell>
                    <TableCell className="py-2.5 px-4 hidden sm:table-cell text-xs text-muted-foreground" data-testid={`text-carrier-${v.id}`}>
                      {v.carrierName || "-"}
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-xs font-medium" data-testid={`text-location-${v.id}`}>
                      <div className="flex items-center gap-1.5">
                        <Map className="h-3 w-3 text-muted-foreground" />
                        {v.location}
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-4">
                      <Badge
                        className={`text-[10px] px-1.5 py-0 h-5 leading-none font-bold uppercase tracking-tight ${getStatusBadgeClasses(v.visitStatus)}`}
                        data-testid={`badge-status-${v.id}`}
                      >
                        {formatTitle(v.visitStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-right text-xs font-medium tabular-nums text-muted-foreground" data-testid={`text-time-${v.id}`}>
                      {formatDwell(v.dwellMinutes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GateGuardDashboard({ s, gs }: { s: DashboardStats; gs?: GateStats }) {
  const stats = gs || { expectedToday: 0, checkedInToday: 0, walkInsToday: 0, exceptionsToday: 0, completedExitsToday: 0, readyOut: 0, blockedExits: 0, onHold: 0 };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Gate Operations"
        subtitle="Manage arrivals, departures, and security checks"
        icon={<ShieldCheck className="h-5 w-5" />}
        kpiStrip={<GateKpiStrip gs={stats} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-4">
          <RoleQuickActions role="gate_guard" />

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Gate Monitoring</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard title="On Hold" value={s.trailersOnHold} icon={AlertTriangle} accent={s.trailersOnHold > 0 ? "red" : "green"} href="/exceptions" />
              <StatCard title="Overdue Appts" value={s.overdueAppointments} icon={CalendarX} accent={s.overdueAppointments > 0 ? "red" : "green"} href="/appointments" />
              <StatCard title="Awaiting Slot" value={s.awaitingSlot} icon={Package} accent={s.awaitingSlot > 0 ? "amber" : "green"} />
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 self-start">
          <OperationalAlertsPanel s={s} />
        </div>
      </div>

      <ActivityFeedTable visits={s.recentVisits.filter(v => v.visitStatus === "checked_in" || v.locationStatus === "at_gate_in" || v.visitStatus === "ready_out")} limit={8} />
    </div>
  );
}

function YardJockeyDashboard({ s, ms }: { s: DashboardStats; ms?: MoveSummary }) {
  const stats = ms || { available: 0, assigned: 0, inProgress: 0, highPriority: 0, overdue: 0, completedToday: 0, rejected: 0 };
  return (
    <div className="space-y-4">
      <PageHeader
        title="Jockey Workspace"
        subtitle="Manage moves and maintain yard order"
        icon={<Truck className="h-5 w-5" />}
        kpiStrip={<MoveKpiStrip ms={stats} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-4">
          <RoleQuickActions role="yard_jockey" />

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Yard Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard title="Yard Inventory" value={s.yardInventory} icon={Truck} accent="green" href="/yard/inventory" />
              <StatCard title="At Dock" value={s.trailersAtDock} icon={DoorOpen} accent="violet" />
              <StatCard title="Awaiting Slot" value={s.awaitingSlot} icon={Package} accent={s.awaitingSlot > 0 ? "amber" : "green"} />
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 self-start">
          <OperationalAlertsPanel s={s} ms={stats} />
        </div>
      </div>
    </div>
  );
}

function DockUserDashboard({ s, ds }: { s: DashboardStats; ds?: DockDoor[] }) {
  const doors = ds || [];
  const occupiedDoors = doors.filter(d => d.visitId !== null);
  const availableDoors = doors.filter(d => d.visitId === null && d.status !== "out_of_service");
  const loadingDoors = doors.filter(d => d.visitStatus === "loading");
  const unloadingDoors = doors.filter(d => d.visitStatus === "unloading");

  const dockKpiStrip = (
    <>
      <KPICard
        label="Doors Occupied"
        value={occupiedDoors.length}
        icon={<DoorOpen className="h-4 w-4" />}
        accent="border-l-violet-500"
        data-testid="kpi-occupied-doors"
      />
      <KPICard
        label="Doors Available"
        value={availableDoors.length}
        icon={<DoorOpen className="h-4 w-4" />}
        accent="border-l-emerald-500"
        data-testid="kpi-available-doors"
      />
      <KPICard
        label="Loading"
        value={loadingDoors.length}
        icon={<Package className="h-4 w-4" />}
        accent="border-l-[#2B5DAD]"
        data-testid="kpi-loading-doors"
      />
      <KPICard
        label="Unloading"
        value={unloadingDoors.length}
        icon={<LogIn className="h-4 w-4" />}
        accent="border-l-amber-500"
        data-testid="kpi-unloading-doors"
      />
    </>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dock Operations"
        subtitle="Monitor loading and unloading activity"
        icon={<DoorOpen className="h-5 w-5" />}
        kpiStrip={dockKpiStrip}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-4">
          <RoleQuickActions role="dock_user" />

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Yard Context</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard title="Yard Inventory" value={s.yardInventory} icon={Truck} accent="green" href="/yard/inventory" />
              <StatCard title="Avg Turn Time" value={formatDwell(s.avgDwellMinutes)} icon={Timer} accent={s.avgDwellMinutes > 180 ? "red" : s.avgDwellMinutes > 60 ? "amber" : "green"} />
              <StatCard title="On Hold" value={s.trailersOnHold} icon={AlertTriangle} accent={s.trailersOnHold > 0 ? "red" : "green"} href="/exceptions" />
            </div>
          </section>
        </div>

        <div className="lg:col-span-4 self-start">
          <OperationalAlertsPanel s={s} />
        </div>
      </div>

      {occupiedDoors.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold">Active Dock Doors</CardTitle>
              <Link href="/dock" className="text-xs text-primary hover:underline font-medium">Manage</Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="h-9 text-xs font-bold px-4">Door</TableHead>
                    <TableHead className="h-9 text-xs font-bold px-4">Trailer</TableHead>
                    <TableHead className="h-9 text-xs font-bold px-4">Carrier</TableHead>
                    <TableHead className="h-9 text-xs font-bold px-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occupiedDoors.map((d) => (
                    <TableRow key={d.id} className="hover:bg-muted/20">
                      <TableCell className="py-2.5 px-4 font-mono text-xs font-semibold">{d.doorNumber}</TableCell>
                      <TableCell className="py-2.5 px-4 text-sm font-medium">{d.trailerNumber || "-"}</TableCell>
                      <TableCell className="py-2.5 px-4 text-xs text-muted-foreground">{d.carrierName || "-"}</TableCell>
                      <TableCell className="py-2.5 px-4">
                        {d.visitStatus && (
                          <Badge className={`text-[10px] px-1.5 py-0 h-5 leading-none font-bold uppercase tracking-tight ${getStatusBadgeClasses(d.visitStatus)}`}>
                            {formatTitle(d.visitStatus)}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


function OperationalAlertsPanel({ s, ms }: { s: DashboardStats; ms?: MoveSummary }) {
  const alerts = [
    {
      label: "Trailers Over Dwell SLA",
      count: s.agedTrailers,
      href: "/yard/inventory",
      color: "red" as const,
      description: "Trailers in yard for more than 24 hours"
    },
    {
      label: "Trailers on Hold",
      count: s.trailersOnHold,
      href: "/exceptions",
      color: "red" as const,
      description: "Trailers blocked due to active exceptions"
    },
    {
      label: "Trailers Waiting for Move",
      count: ms?.available || 0,
      href: "/moves",
      color: "amber" as const,
      description: "Open move tasks awaiting assignment"
    },
    {
      label: "Docks Waiting for Trailer",
      count: s.awaitingSlot,
      href: "/yard/inventory",
      color: "amber" as const,
      description: "Inbound trailers requiring dock assignment"
    }
  ];

  const totalAlerts = alerts.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Card className="h-full border-2 border-primary/10">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Operational Alerts
          </CardTitle>
          {totalAlerts > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 min-w-[20px] justify-center">
              {totalAlerts}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {alerts.map((alert, i) => (
          <div key={i}>
            <ActionItem 
              label={alert.label} 
              count={alert.count} 
              href={alert.href} 
              color={alert.color} 
            />
            {alert.count > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1 ml-5 px-1 uppercase tracking-tight font-medium leading-none">
                {alert.description}
              </p>
            )}
          </div>
        ))}
        {totalAlerts === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-medium">All clear</p>
            <p className="text-xs text-muted-foreground">No urgent operational alerts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoleQuickActions({ role }: { role: string }) {
  const getActions = () => {
    switch (role) {
      case "admin":
      case "yard_manager":
        return [
          { icon: Gauge, label: "Dashboard", href: "/" },
          { icon: Users, label: "User Mgmt", href: "/admin/users" },
          { icon: Settings, label: "Yard Setup", href: "/admin/yard-setup" },
          { icon: ShieldCheck, label: "Audit Trail", href: "/admin/audit" },
        ];
      case "gate_guard":
        return [
          { icon: PlusCircle, label: "New Check-In", href: "/gate/check-in" },
          { icon: LogOut, label: "Check-Out", href: "/gate/check-out" },
          { icon: ClipboardCheck, label: "Inspections", href: "/inspections" },
          { icon: AlertTriangle, label: "Exceptions", href: "/exceptions" },
        ];
      case "yard_jockey":
        return [
          { icon: ArrowRightLeft, label: "My Moves", href: "/moves" },
          { icon: Map, label: "Yard Map", href: "/yard/map" },
          { icon: Truck, label: "Yard Inventory", href: "/yard/inventory" },
          { icon: ClipboardCheck, label: "Audit", href: "/yard/audit" },
        ];
      case "dock_user":
        return [
          { icon: DoorOpen, label: "Dock Mgmt", href: "/dock" },
          { icon: ClipboardCheck, label: "Inspections", href: "/inspections" },
          { icon: Truck, label: "Yard Inventory", href: "/yard/inventory" },
          { icon: AlertTriangle, label: "Exceptions", href: "/exceptions" },
        ];
      default:
        return [];
    }
  };

  const actions = getActions();
  if (actions.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action, i) => (
          <ShortcutButton key={i} icon={action.icon} label={action.label} href={action.href} />
        ))}
      </div>
    </section>
  );
}

// ─── Activity Grid helpers ────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diffMins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const hrs = Math.floor(diffMins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function visitDirectionBadge(v: DashboardStats["recentVisits"][0]) {
  const { visitStatus, locationStatus } = v;
  if (locationStatus === "at_gate_in" || (visitStatus === "checked_in" && locationStatus === "in_yard" && (v.dwellMinutes ?? 0) < 15))
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">IN</span>;
  if (locationStatus === "at_dock" || visitStatus === "loading" || visitStatus === "unloading")
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800">DOCK</span>;
  if (locationStatus === "at_gate_out" || visitStatus === "ready_out")
    return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800">OUT</span>;
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">YARD</span>;
}

function priorityDot(priority: string) {
  const c: Record<string, string> = { urgent: "bg-red-500", high: "bg-orange-500", normal: "bg-blue-400", low: "bg-gray-300" };
  return <div className={`h-2 w-2 rounded-full shrink-0 ${c[priority] ?? "bg-gray-300"}`} />;
}

function severityDot(severity: string) {
  const c: Record<string, string> = { critical: "bg-red-500", high: "bg-red-500", medium: "bg-amber-500", low: "bg-blue-400" };
  return <div className={`h-2 w-2 rounded-full shrink-0 mt-1.5 ${c[severity] ?? "bg-gray-400"}`} />;
}

function initials(name: string | null): string {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

function exTypeLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function exTypeBadge(t: string) {
  const map: Record<string, { label: string; className: string }> = {
    documentation_hold: { label: "DOC", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    security_hold: { label: "SEC", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    damage_hold: { label: "DMG", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    customs_hold: { label: "CST", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    carrier_dispute: { label: "CRR", className: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  };
  const config = map[t] || { label: t.slice(0, 3).toUpperCase(), className: "bg-muted text-muted-foreground" };
  return (
    <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${config.className}`}>
      {config.label}
    </span>
  );
}

function ActivityBoxCard({
  title, icon: Icon, count, href, children, headerRight,
}: {
  title: string; icon: LucideIcon; count?: number; href: string; children: React.ReactNode; headerRight?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col h-full min-h-[260px]">
      <CardHeader className="p-4 pb-3 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-sm font-bold shrink-0">{title}</CardTitle>
            {headerRight ? headerRight : (count !== undefined && count > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] min-w-[18px] justify-center">{count}</Badge>
            ))}
          </div>
          <Link href={href} className="text-[11px] text-primary hover:underline flex items-center gap-0.5 font-medium shrink-0 ml-2">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto">{children}</CardContent>
    </Card>
  );
}

function ActivityGrid({
  visits, dockDoors, moves, exceptions,
}: {
  visits: DashboardStats["recentVisits"];
  dockDoors: DockDoor[];
  moves: MoveTask[];
  exceptions: OpenException[];
}) {
  const activeMoves = moves.filter((m) => ["available", "assigned", "in_progress"].includes(m.status));
  const openExceptions = exceptions.filter((e) => e.status === "open");
  const occupiedDoors = dockDoors.filter((d) => d.visitId !== null);

  const moveStatusStyle: Record<string, string> = {
    available: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    assigned: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    in_progress: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  };

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Yard Activity</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Box 1: Gate Activity ── */}
        <ActivityBoxCard title="Gate Activity" icon={LogIn} count={visits.length} href="/yard/inventory">
          {visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs gap-2">
              <Truck className="h-6 w-6 opacity-20" /><span>No recent yard activity</span>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {visits.slice(0, 4).map((v) => {
                const isAged = (v.dwellMinutes ?? 0) >= 1440;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors ${isAged ? "border-l-[3px] border-l-red-500" : ""}`}
                    data-testid={`activity-gate-${v.id}`}
                  >
                    <div className="shrink-0">{visitDirectionBadge(v)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate">{v.trailerNumber || "—"}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{v.carrierName || ""}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Map className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">{v.location || "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAged && (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-0.5">
                          ⚠ Aged
                        </span>
                      )}
                      <span className={`text-[10px] tabular-nums font-medium ${getDwellColour(v.dwellMinutes ?? 0)}`}>{formatDwell(v.dwellMinutes)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ActivityBoxCard>

        {/* ── Box 2: Live Dock Floor ── */}
        <ActivityBoxCard title="Live Dock Floor" icon={DoorOpen} count={occupiedDoors.length} href="/dock">
          {dockDoors.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs gap-2">
              <DoorOpen className="h-6 w-6 opacity-20" /><span>No dock data available</span>
            </div>
          ) : (
            <div className="p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${(occupiedDoors.length / dockDoors.length) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium tabular-nums shrink-0">
                  {occupiedDoors.length}/{dockDoors.length} occupied
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[...dockDoors].sort((a, b) => (b.visitId ? 1 : 0) - (a.visitId ? 1 : 0)).slice(0, 4).map((d) => {
                  const occ = d.visitId !== null;
                  const op = d.visitStatus;
                  const dot = op === "loading" ? "bg-blue-500" : op === "unloading" ? "bg-amber-500" : occ ? "bg-violet-500" : "bg-emerald-400";
                  const dockDwellMins = d.checkInTime ? Math.floor((Date.now() - new Date(d.checkInTime).getTime()) / 60000) : null;
                  return (
                    <div key={d.id} className={`flex flex-col gap-0.5 rounded-md px-2 py-1.5 ${occ ? "bg-muted/60" : "bg-muted/20"}`} data-testid={`dock-door-activity-${d.id}`}>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
                        <span className="font-mono font-bold text-[11px] shrink-0 text-foreground">{d.doorNumber}</span>
                        <span className="text-muted-foreground truncate text-[10px]">
                          {occ ? (d.trailerNumber || "Occupied") : "Available"}
                        </span>
                      </div>
                      {occ && dockDwellMins !== null && (
                        <span className={`text-[10px] font-medium pl-3.5 tabular-nums ${getDwellColour(dockDwellMins)}`}>
                          {formatDwell(dockDwellMins)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ActivityBoxCard>

        {/* ── Box 3: Move Queue ── */}
        <ActivityBoxCard
          title="Move Queue"
          icon={ArrowRightLeft}
          href="/moves"
          headerRight={activeMoves.length > 0 ? (
            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{activeMoves.filter(m => m.status === "in_progress").length} in progress</Badge>
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{activeMoves.filter(m => m.status !== "in_progress").length} pending</Badge>
            </span>
          ) : undefined}
        >
          {activeMoves.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 opacity-20 text-emerald-500" />
              <span className="text-xs">No active moves in queue</span>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {activeMoves.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors" data-testid={`activity-move-${m.id}`}>
                  {priorityDot(m.priority)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{m.trailerNumber || m.visitNumber}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium leading-none ${moveStatusStyle[m.status] ?? "bg-muted text-muted-foreground"}`}>
                        {formatTitle(m.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                      <span className="truncate max-w-[80px]">{m.fromLocationName}</span>
                      <ArrowRightLeft className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate max-w-[80px]">{m.toLocationName}</span>
                    </div>
                  </div>
                  {m.assignedToName ? (
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0" title={m.assignedToName}>
                      {initials(m.assignedToName)}
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Users className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ActivityBoxCard>

        {/* ── Box 4: Exceptions & Holds ── */}
        <ActivityBoxCard title="Exceptions & Holds" icon={AlertTriangle} count={openExceptions.length} href="/exceptions">
          {openExceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 opacity-20 text-emerald-500" />
              <span className="text-xs">No active exceptions — all clear</span>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {openExceptions.slice(0, 4).map((e) => (
                <div key={e.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors" data-testid={`activity-exception-${e.id}`}>
                  {severityDot(e.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {exTypeBadge(e.type)}
                      <span className="text-xs font-semibold truncate">{e.trailerNumber || e.visitNumber}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{e.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{timeAgo(e.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </ActivityBoxCard>

      </div>
    </section>
  );
}

// ─── Role Dashboards ──────────────────────────────────────────────────────────

function SupervisorDashboard({ s, ms, zc, ds = [], moves = [], exceptions = [] }: { s: DashboardStats; ms?: MoveSummary; zc?: ZoneCapacity[]; ds?: DockDoor[]; moves?: MoveTask[]; exceptions?: OpenException[] }) {
  const { mode } = useProductMode();
  const { tabletMode } = useTabletView();
  const brief = isOptimizeMode(mode) ? buildOperationalBrief(s, moves, ds) : null;
  const assistItems = isAssistMode(mode) ? buildAssistSummary(s, moves) : [];

  return (
    <div className="space-y-4">
      <DemoHelper />

      <PageHeader
        title="Operations Control Board"
        subtitle="Real-time yard performance and action items"
        icon={<Gauge className="h-5 w-5" />}
        kpiStrip={<UnifiedKpiStrip6 s={s} ms={ms} zc={zc} />}
        kpiGrid
      />

      {isAssistMode(mode) && assistItems.length > 0 && (
        <AssistSummaryBanner items={assistItems} />
      )}

      {isOptimizeMode(mode) && brief && (
        <OptimizeDashboardPanel brief={brief} />
      )}

      <div className={`grid gap-4 items-start ${tabletMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"}`}>
        <div className={tabletMode ? "space-y-4" : "lg:col-span-8 space-y-4"}>
          <RoleQuickActions role="yard_manager" />
          <RevenueKpiSection />
        </div>

        <div className={tabletMode ? "space-y-4" : "lg:col-span-4 self-start space-y-4"}>
          <ActionRequiredPanel s={s} exceptions={exceptions} moves={moves} />
          <ROIPanel mode={mode} stats={s} />
        </div>
      </div>

      <ActivityGrid visits={s.recentVisits} dockDoors={ds} moves={moves} exceptions={exceptions} />
    </div>
  );
}

function CarrierDashboard({ s }: { s: DashboardStats }) {
  const myVisits = s.recentVisits;
  return (
    <div className="space-y-4">
      <PageHeader
        title="Carrier Portal"
        subtitle="Trailer status and appointment visibility"
        icon={<Activity className="h-5 w-5" />}
        kpiStrip={
          <>
            <KPICard label="In Yard" value={s.yardInventory} icon={<Truck className="h-4 w-4" />} accent="border-l-emerald-500" />
            <KPICard label="At Dock" value={s.trailersAtDock} icon={<DoorOpen className="h-4 w-4" />} accent="border-l-violet-500" />
            <KPICard label="Ready for Pickup" value={s.readyOutCount} icon={<CheckCircle2 className="h-4 w-4" />} accent={s.readyOutCount > 0 ? "border-l-amber-500" : "border-l-emerald-500"} />
            <KPICard label="Avg Turn Time" value={formatDwell(s.avgDwellMinutes)} icon={<Timer className="h-4 w-4" />} accent="border-l-gray-400" data-testid="kpi-avg-turn-time-carrier" />
          </>
        }
      />

      <div className="space-y-4">
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Quick Links</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ShortcutButton icon={CalendarX} label="Appointments" href="/appointments" />
            <ShortcutButton icon={Truck} label="Yard Inventory" href="/yard/inventory" />
            <ShortcutButton icon={Activity} label="Track Status" href="/yard/inventory" />
          </div>
        </section>
      </div>

      <ActivityFeedTable visits={myVisits} limit={10} />
    </div>
  );
}

function AdminDashboard({ s, ms, zc, ds = [], moves = [], exceptions = [] }: { s: DashboardStats; ms?: MoveSummary; zc?: ZoneCapacity[]; ds?: DockDoor[]; moves?: MoveTask[]; exceptions?: OpenException[] }) {
  const { mode } = useProductMode();
  const { tabletMode } = useTabletView();
  const brief = isOptimizeMode(mode) ? buildOperationalBrief(s, moves, ds) : null;
  const assistItems = isAssistMode(mode) ? buildAssistSummary(s, moves) : [];

  return (
    <div className="space-y-4">
      <DemoHelper />

      <PageHeader
        title="Operational Overview"
        subtitle="Full-facility visibility — yard, gate, dock, and fleet"
        icon={<Activity className="h-5 w-5" />}
        kpiStrip={<UnifiedKpiStrip6 s={s} ms={ms} zc={zc} />}
        kpiGrid
      />

      {isAssistMode(mode) && assistItems.length > 0 && (
        <AssistSummaryBanner items={assistItems} />
      )}

      {isOptimizeMode(mode) && brief && (
        <OptimizeDashboardPanel brief={brief} />
      )}

      <div className={`grid gap-4 items-start ${tabletMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"}`}>
        <div className={tabletMode ? "space-y-4" : "lg:col-span-8 space-y-4"}>
          <RevenueKpiSection />
        </div>

        <div className={tabletMode ? "space-y-4" : "lg:col-span-4 self-start space-y-4"}>
          <ActionRequiredPanel s={s} exceptions={exceptions} moves={moves} />
          <ROIPanel mode={mode} stats={s} />
        </div>
      </div>

      <ActivityGrid visits={s.recentVisits} dockDoors={ds} moves={moves} exceptions={exceptions} />
    </div>
  );
}

const DASHBOARD_COMPONENTS: Record<string, any> = {
  admin: AdminDashboard,
  yard_manager: SupervisorDashboard,
  gate_guard: GateGuardDashboard,
  yard_jockey: YardJockeyDashboard,
  dock_user: DockUserDashboard,
  carrier: CarrierDashboard,
};

export default function DashboardPage({ userRole }: { userRole?: string } = {}) {
  const { data: profile } = useQuery<{ id: string; role: string }>({
    queryKey: ["/api/user/profile"],
  });

  const role = profile?.role || "yard_manager";

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: gateStats } = useQuery<GateStats>({
    queryKey: ["/api/gate/stats"],
    enabled: role === "gate_guard" || role === "yard_manager" || role === "admin",
  });

  const { data: moveSummary } = useQuery<MoveSummary>({
    queryKey: ["/api/moves/summary"],
    enabled: role === "yard_jockey" || role === "yard_manager" || role === "admin",
  });

  const { data: dockDoors } = useQuery<DockDoor[]>({
    queryKey: ["/api/dock/doors"],
    enabled: role === "dock_user" || role === "yard_manager" || role === "admin",
  });

  const { data: zoneCapacity } = useQuery<ZoneCapacity[]>({
    queryKey: ["/api/yard/zones/capacity"],
  });

  const { data: activeMoves = [] } = useQuery<MoveTask[]>({
    queryKey: ["/api/moves"],
    enabled: role === "yard_manager" || role === "admin",
  });

  const { data: openExceptions = [] } = useQuery<OpenException[]>({
    queryKey: ["/api/exceptions"],
    enabled: role === "yard_manager" || role === "admin",
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const DashboardComponent = DASHBOARD_COMPONENTS[role] || SupervisorDashboard;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto pb-20">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Welcome back,</span>
              <StatusChip status={role} colorFn={roleColor} size="sm" />
            </div>
            <h2 className="text-lg font-bold leading-tight">Yard Manager</h2>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            System Live
          </div>
          <div className="h-3 w-px bg-border" />
          <div>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
        </div>
      </div>

      <DashboardComponent
        s={stats}
        gs={gateStats}
        ms={moveSummary}
        ds={dockDoors}
        zc={zoneCapacity}
        moves={activeMoves}
        exceptions={openExceptions}
      />
    </div>
  );
}
