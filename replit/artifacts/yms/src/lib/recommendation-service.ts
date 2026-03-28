export type RecType =
  | "bottleneck"
  | "dwell_risk"
  | "next_move"
  | "dock_risk"
  | "appointment_risk"
  | "next_best_action";

export type RecPriority = "critical" | "high" | "medium" | "low";

export interface Recommendation {
  id: string;
  type: RecType;
  priority: RecPriority;
  title: string;
  description: string;
  action: string;
  href: string;
  metric?: { label: string; value: string | number };
}

interface MinStats {
  openMoveTasks: number;
  overdueMoves: number;
  trailersOnHold: number;
  awaitingSlot: number;
  overdueAppointments: number;
  avgDwellMinutes: number;
  trailersAtDock: number;
  yardInventory: number;
  agedTrailers: number;
  recentVisits: Array<{
    id: number;
    trailerNumber: string | null;
    dwellMinutes: number;
    visitStatus: string;
    locationStatus: string;
    location: string;
  }>;
}

interface MinMove {
  id: number;
  priority: string;
  status: string;
  moveType?: string;
  trailerNumber: string | null;
  fromLocationName: string;
  toLocationName: string;
  visitNumber: string;
  createdAt: string;
}

interface MinDock {
  id: number;
  doorNumber: string;
  status: string;
  visitId: number | null;
}

const PRIORITY_ORDER: RecPriority[] = ["critical", "high", "medium", "low"];

export function getBottleneckAlerts(
  stats: MinStats,
  moves: MinMove[],
  docks: MinDock[]
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (stats.overdueMoves >= 3) {
    recs.push({
      id: "bn-overdue-moves",
      type: "bottleneck",
      priority: "critical",
      title: "Move backlog building",
      description: `${stats.overdueMoves} overdue move tasks — jockeys may be insufficient for current yard volume.`,
      action: "Review unassigned moves",
      href: "/moves",
      metric: { label: "Overdue moves", value: stats.overdueMoves },
    });
  } else if (stats.overdueMoves >= 1) {
    recs.push({
      id: "bn-overdue-moves-low",
      type: "bottleneck",
      priority: "medium",
      title: "Overdue moves detected",
      description: `${stats.overdueMoves} move task${stats.overdueMoves > 1 ? "s" : ""} past SLA — assign or escalate promptly.`,
      action: "Assign overdue moves",
      href: "/moves",
      metric: { label: "Overdue", value: stats.overdueMoves },
    });
  }

  const activeDocks = docks.filter((d) => d.visitId !== null);
  const totalServiceable = docks.filter((d) => d.status !== "out_of_service").length;
  if (totalServiceable > 0 && activeDocks.length >= totalServiceable) {
    recs.push({
      id: "bn-docks-full",
      type: "bottleneck",
      priority: "high",
      title: "All docks occupied",
      description: `${activeDocks.length}/${totalServiceable} dock doors in use — inbound trailers may queue at gate.`,
      action: "Monitor dock queue",
      href: "/dock",
      metric: { label: "Doors occupied", value: `${activeDocks.length}/${totalServiceable}` },
    });
  }

  if (stats.awaitingSlot >= 5) {
    recs.push({
      id: "bn-awaiting-slot",
      type: "bottleneck",
      priority: "high",
      title: "Slot assignment backlog",
      description: `${stats.awaitingSlot} trailers waiting for a dock slot — appointment schedule may slip.`,
      action: "Assign dock slots",
      href: "/yard/inventory",
      metric: { label: "Awaiting slot", value: stats.awaitingSlot },
    });
  }

  return recs;
}

export function getDwellRiskAlerts(stats: MinStats): Recommendation[] {
  const recs: Recommendation[] = [];

  const agedVisits = stats.recentVisits.filter((v) => (v.dwellMinutes ?? 0) >= 1440);
  if (agedVisits.length > 0) {
    const worst = agedVisits.reduce((a, b) =>
      (b.dwellMinutes ?? 0) > (a.dwellMinutes ?? 0) ? b : a
    );
    const hours = Math.round((worst.dwellMinutes ?? 0) / 60);
    recs.push({
      id: "dr-aged-trailers",
      type: "dwell_risk",
      priority: agedVisits.length >= 3 ? "critical" : "high",
      title: `${agedVisits.length} aged trailer${agedVisits.length > 1 ? "s" : ""} in yard`,
      description: `Longest dwell: ${worst.trailerNumber || "Unknown"} at ${hours}h — demurrage risk and dock obstruction likely.`,
      action: "Review aged trailers",
      href: "/yard/inventory",
      metric: { label: "Longest dwell", value: `${hours}h` },
    });
  }

  if (stats.avgDwellMinutes >= 240) {
    const avgH = (stats.avgDwellMinutes / 60).toFixed(1);
    recs.push({
      id: "dr-avg-dwell",
      type: "dwell_risk",
      priority: stats.avgDwellMinutes >= 480 ? "high" : "medium",
      title: "Above-target average dwell",
      description: `Yard average dwell is ${avgH}h — exceeds 4h target. Gate throughput may be constrained.`,
      action: "Prioritise departures",
      href: "/yard/inventory",
      metric: { label: "Avg dwell", value: `${avgH}h` },
    });
  }

  return recs;
}

export function getRecommendedNextMoves(moves: MinMove[]): Recommendation[] {
  const available = moves.filter((m) => m.status === "available");

  const sorted = [...available].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const ap = order[a.priority] ?? 4;
    const bp = order[b.priority] ?? 4;
    if (ap !== bp) return ap - bp;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return sorted.slice(0, 3).map((m, i) => ({
    id: `nm-${m.id}`,
    type: "next_move" as RecType,
    priority: (m.priority as RecPriority) || "medium",
    title: `${m.trailerNumber || m.visitNumber} · ${m.moveType || "Move"}`,
    description: `${m.fromLocationName} → ${m.toLocationName}`,
    action: "Assign move",
    href: "/moves",
    metric: { label: "Priority", value: m.priority },
  }));
}

export function getDockAppointmentRisk(stats: MinStats): Recommendation[] {
  const recs: Recommendation[] = [];

  if (stats.overdueAppointments >= 3) {
    recs.push({
      id: "da-overdue-appts",
      type: "appointment_risk",
      priority: "critical",
      title: "Appointment schedule breaking down",
      description: `${stats.overdueAppointments} overdue appointments — carriers may divert or charge wait fees.`,
      action: "Resolve overdue appointments",
      href: "/appointments",
      metric: { label: "Overdue", value: stats.overdueAppointments },
    });
  } else if (stats.overdueAppointments >= 1) {
    recs.push({
      id: "da-overdue-appts-low",
      type: "appointment_risk",
      priority: "medium",
      title: "Overdue appointment detected",
      description: `${stats.overdueAppointments} appointment${stats.overdueAppointments > 1 ? "s" : ""} overdue — check carrier status.`,
      action: "Review appointments",
      href: "/appointments",
      metric: { label: "Overdue", value: stats.overdueAppointments },
    });
  }

  if (stats.trailersOnHold >= 2) {
    recs.push({
      id: "da-holds",
      type: "dock_risk",
      priority: stats.trailersOnHold >= 4 ? "high" : "medium",
      title: "Multiple trailers on hold",
      description: `${stats.trailersOnHold} trailers blocked by exceptions — dock throughput impacted.`,
      action: "Clear holds",
      href: "/exceptions",
      metric: { label: "On hold", value: stats.trailersOnHold },
    });
  }

  return recs;
}

export function getNextBestAction(all: Recommendation[]): Recommendation | null {
  for (const priority of PRIORITY_ORDER) {
    const match = all.find((r) => r.priority === priority && r.type !== "next_best_action");
    if (match) return match;
  }
  return null;
}

export interface OperationalBrief {
  bottlenecks: Recommendation[];
  dwellRisks: Recommendation[];
  nextMoves: Recommendation[];
  dockRisks: Recommendation[];
  nextBestAction: Recommendation | null;
  totalAlerts: number;
}

export function buildOperationalBrief(
  stats: MinStats,
  moves: MinMove[],
  docks: MinDock[]
): OperationalBrief {
  const bottlenecks = getBottleneckAlerts(stats, moves, docks);
  const dwellRisks = getDwellRiskAlerts(stats);
  const nextMoves = getRecommendedNextMoves(moves);
  const dockRisks = getDockAppointmentRisk(stats);

  const allAlerts = [...bottlenecks, ...dwellRisks, ...dockRisks];
  const nextBestAction = getNextBestAction(allAlerts);
  const totalAlerts = allAlerts.length;

  return { bottlenecks, dwellRisks, nextMoves, dockRisks, nextBestAction, totalAlerts };
}

export function buildAssistSummary(
  stats: MinStats,
  moves: MinMove[]
): { label: string; count: number; href: string }[] {
  const summary: { label: string; count: number; href: string }[] = [];
  const unassignedMoves = moves.filter((m) => m.status === "available").length;
  if (unassignedMoves > 0) summary.push({ label: "Moves to assign", count: unassignedMoves, href: "/moves" });
  if (stats.overdueAppointments > 0) summary.push({ label: "Overdue appointments", count: stats.overdueAppointments, href: "/appointments" });
  if (stats.trailersOnHold > 0) summary.push({ label: "Exceptions to clear", count: stats.trailersOnHold, href: "/exceptions" });
  if (stats.agedTrailers > 0) summary.push({ label: "Aged trailers", count: stats.agedTrailers, href: "/yard/inventory" });
  return summary;
}
