import OpenAI from "openai";
import { db } from "../db";
import {
  visits,
  exceptions,
  moveTasks,
  appointments,
  yardSlots,
  dockDoors,
  yardZones,
  inspections,
  yardAuditItems,
} from "@workspace/db";
import { storage } from "./storage";
import type { Express } from "express";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "placeholder",
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface CongestionWindow {
  riskLevel: RiskLevel;
  riskScore: number;
  factors: string[];
  impactedAreas: string[];
  recommendations: string[];
}

export interface CongestionReport {
  windows: {
    now: CongestionWindow;
    thirtyMin: CongestionWindow;
    oneHour: CongestionWindow;
    shift: CongestionWindow;
  };
  currentState: {
    yardFillPct: number;
    dockUtilPct: number;
    activeTrailers: number;
    totalSlots: number;
    activeDoors: number;
    occupiedDoors: number;
    activeTasksCount: number;
    overdueTasksCount: number;
    openExceptionsCount: number;
    criticalExceptionsCount: number;
    onHoldCount: number;
    readyOutCount: number;
    waitingForDockCount: number;
  };
}

function riskLabel(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

async function fetchAllData() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(todayStart.getTime() - 7 * 86_400_000);

  const [
    allVisits,
    allCarriers,
    allExceptions,
    allTasks,
    allAppointments,
    allSlots,
    allDoors,
    allZones,
    allInspections,
    allAuditItems,
  ] = await Promise.all([
    db.select().from(visits),
    storage.getCarriers(),
    db.select().from(exceptions),
    db.select().from(moveTasks),
    storage.getAppointments(),
    db.select().from(yardSlots),
    db.select().from(dockDoors),
    db.select().from(yardZones),
    storage.getInspections(),
    storage.getYardAuditItems(),
  ]);

  return {
    now,
    todayStart,
    weekAgo,
    allVisits,
    allCarriers,
    allExceptions,
    allTasks,
    allAppointments,
    allSlots,
    allDoors,
    allZones,
    allInspections,
    allAuditItems,
  };
}

export async function computeCongestionRisk(): Promise<CongestionReport> {
  const {
    now,
    todayStart,
    allVisits,
    allExceptions,
    allTasks,
    allAppointments,
    allSlots,
    allDoors,
  } = await fetchAllData();

  const activeVisits = allVisits.filter((v) => v.visitStatus !== "closed");
  const activeDoors = allDoors.filter((d) => d.isActive);
  const activeSlots = allSlots.filter((s) => s.isActive && !s.isBlocked);
  const occupiedDoors = activeDoors.filter((d) =>
    activeVisits.some((v) => v.currentDockDoorId === d.id)
  );
  const activeTasks = allTasks.filter(
    (t) => !["completed", "cancelled"].includes(t.status)
  );
  const openExceptions = allExceptions.filter((e) => e.status === "open");
  const criticalExceptions = openExceptions.filter(
    (e) => e.severity === "critical"
  );
  const onHold = activeVisits.filter((v) => v.holdStatus !== "none");
  const readyOut = activeVisits.filter((v) => v.visitStatus === "ready_out");
  const waitingForDock = activeVisits.filter(
    (v) =>
      v.visitStatus === "in_yard" &&
      !v.currentDockDoorId &&
      v.movementType !== "empty_drop"
  );

  const yardFillPct =
    activeSlots.length > 0
      ? Math.round((activeVisits.length / activeSlots.length) * 100)
      : 0;
  const dockUtilPct =
    activeDoors.length > 0
      ? Math.round((occupiedDoors.length / activeDoors.length) * 100)
      : 0;

  const overdueTasksCount = activeTasks.filter((t) => {
    const ageMins =
      (Date.now() - new Date(t.createdAt!).getTime()) / 60000;
    return (
      (t.priority === "urgent" && ageMins > 30) ||
      (t.priority === "high" && ageMins > 60) ||
      ageMins > 180
    );
  }).length;

  const dwellViolations = activeVisits.filter((v) => {
    if (!v.checkInTime) return false;
    const hours =
      (Date.now() - new Date(v.checkInTime).getTime()) / 3_600_000;
    return hours > 24;
  }).length;

  const upcomingAppts = (windowMins: number) =>
    allAppointments.filter((a) => {
      const d = new Date(a.scheduledDate);
      const diff = d.getTime() - now.getTime();
      return (
        diff >= 0 &&
        diff <= windowMins * 60_000 &&
        !["cancelled", "completed", "no_show"].includes(a.status)
      );
    });

  const todayRemainingAppts = allAppointments.filter((a) => {
    const d = new Date(a.scheduledDate);
    return (
      d >= now &&
      d.getTime() < todayStart.getTime() + 86_400_000 &&
      !["cancelled", "completed", "no_show"].includes(a.status)
    );
  });

  function scoreWindow(
    incomingAppts: number,
    label: string
  ): CongestionWindow {
    let score = 0;
    const factors: string[] = [];
    const impacted: string[] = [];
    const recs: string[] = [];

    if (yardFillPct >= 90) {
      score += 35;
      factors.push(`Yard at ${yardFillPct}% capacity (critical)`);
      impacted.push("Yard Slots");
      recs.push("Expedite checkout for ready-out trailers immediately");
    } else if (yardFillPct >= 75) {
      score += 20;
      factors.push(`Yard at ${yardFillPct}% capacity (high)`);
      impacted.push("Yard Slots");
      recs.push("Begin clearing ready-out trailers to free slot capacity");
    } else if (yardFillPct >= 60) {
      score += 8;
      factors.push(`Yard at ${yardFillPct}% capacity (moderate)`);
    }

    if (dockUtilPct >= 90) {
      score += 25;
      factors.push(`Dock utilization at ${dockUtilPct}% (all doors near full)`);
      impacted.push("Dock Doors");
      recs.push("Expedite unloading on longest-dwell dock trailers");
    } else if (dockUtilPct >= 75) {
      score += 14;
      factors.push(`Dock utilization at ${dockUtilPct}%`);
      impacted.push("Dock Doors");
    }

    if (incomingAppts >= 8) {
      score += 20;
      factors.push(`${incomingAppts} appointments expected in ${label}`);
      impacted.push("Gate", "Yard Slots");
      recs.push("Pre-assign yard slots for upcoming appointments");
    } else if (incomingAppts >= 4) {
      score += 11;
      factors.push(`${incomingAppts} appointments expected in ${label}`);
      impacted.push("Gate");
    } else if (incomingAppts >= 2) {
      score += 5;
      factors.push(`${incomingAppts} appointments expected in ${label}`);
    }

    if (waitingForDock.length >= 5) {
      score += 10;
      factors.push(`${waitingForDock.length} trailers waiting for dock assignment`);
      impacted.push("Dock Doors");
      recs.push("Assign dock doors to highest-priority waiting trailers");
    } else if (waitingForDock.length >= 2) {
      score += 5;
      factors.push(`${waitingForDock.length} trailers waiting for dock`);
    }

    if (overdueTasksCount >= 5) {
      score += 8;
      factors.push(`${overdueTasksCount} move tasks overdue`);
      impacted.push("Yard Operations");
      recs.push("Dispatch additional jockeys or reassign overdue move tasks");
    } else if (overdueTasksCount >= 2) {
      score += 4;
      factors.push(`${overdueTasksCount} move tasks overdue`);
    }

    if (criticalExceptions.length > 0) {
      score += 8;
      factors.push(`${criticalExceptions.length} critical exception(s) active`);
      impacted.push("Exception Queue");
      recs.push("Resolve critical exceptions to unblock held trailers");
    } else if (openExceptions.length >= 5) {
      score += 4;
      factors.push(`${openExceptions.length} open exceptions`);
    }

    if (onHold.length >= 5) {
      score += 6;
      factors.push(`${onHold.length} trailers on hold blocking flow`);
      impacted.push("Throughput");
      recs.push("Clear documentation and seal holds to restore trailer flow");
    } else if (onHold.length >= 2) {
      score += 3;
      factors.push(`${onHold.length} trailers on hold`);
    }

    if (dwellViolations >= 3) {
      score += 6;
      factors.push(`${dwellViolations} trailers exceed 24h dwell time`);
      recs.push("Issue dwell time alerts to carriers for long-parked trailers");
    } else if (dwellViolations > 0) {
      score += 2;
      factors.push(`${dwellViolations} trailer(s) approaching dwell limit`);
    }

    if (readyOut.length >= 5) {
      score -= 5;
      factors.push(`${readyOut.length} trailers ready for exit (reducing pressure)`);
    }

    score = Math.min(100, Math.max(0, score));
    const level = riskLabel(score);

    if (factors.length === 0) factors.push("All indicators within normal range");
    if (recs.length === 0) recs.push("No immediate action required — monitor incoming appointments");
    const uniqueImpacted = [...new Set(impacted)];

    return {
      riskLevel: level,
      riskScore: score,
      factors,
      impactedAreas: uniqueImpacted.length > 0 ? uniqueImpacted : ["None"],
      recommendations: recs,
    };
  }

  const appts30 = upcomingAppts(30);
  const appts60 = upcomingAppts(60);

  return {
    windows: {
      now: scoreWindow(0, "now"),
      thirtyMin: scoreWindow(appts30.length, "next 30 min"),
      oneHour: scoreWindow(appts60.length, "next hour"),
      shift: scoreWindow(todayRemainingAppts.length, "rest of shift"),
    },
    currentState: {
      yardFillPct,
      dockUtilPct,
      activeTrailers: activeVisits.length,
      totalSlots: activeSlots.length,
      activeDoors: activeDoors.length,
      occupiedDoors: occupiedDoors.length,
      activeTasksCount: activeTasks.length,
      overdueTasksCount,
      openExceptionsCount: openExceptions.length,
      criticalExceptionsCount: criticalExceptions.length,
      onHoldCount: onHold.length,
      readyOutCount: readyOut.length,
      waitingForDockCount: waitingForDock.length,
    },
  };
}

async function buildYardContext(): Promise<string> {
  const {
    now,
    todayStart,
    weekAgo,
    allVisits,
    allCarriers,
    allExceptions,
    allTasks,
    allAppointments,
    allSlots,
    allDoors,
    allZones,
    allInspections,
    allAuditItems,
  } = await fetchAllData();

  const carrierMap = new Map(allCarriers.map((c) => [c.id, c.name]));
  const slotMap = new Map(allSlots.map((s) => [s.id, s.slotNumber]));
  const doorMap = new Map(allDoors.map((d) => [d.id, d.doorNumber]));
  const zoneMap = new Map(allZones.map((z) => [z.id, z.name]));

  const activeVisits = allVisits.filter((v) => v.visitStatus !== "closed");
  const closedVisits = allVisits.filter((v) => v.visitStatus === "closed");
  const recentClosed = closedVisits.filter(
    (v) => v.checkOutTime && new Date(v.checkOutTime) >= weekAgo
  );

  const openExceptions = allExceptions.filter((e) => e.status === "open");
  const resolvedExceptions = allExceptions.filter(
    (e) => e.status !== "open"
  );

  const activeTasks = allTasks.filter(
    (t) => !["completed", "cancelled"].includes(t.status)
  );
  const completedTasks = allTasks.filter((t) => t.status === "completed");

  const todayAppts = allAppointments.filter((a) => {
    const d = new Date(a.scheduledDate);
    return d >= todayStart && d < new Date(todayStart.getTime() + 86_400_000);
  });

  const completedAppts = allAppointments.filter(
    (a) => a.status === "completed"
  );
  const noShowAppts = allAppointments.filter((a) => a.status === "no_show");
  const apptComplianceRate =
    completedAppts.length + noShowAppts.length > 0
      ? Math.round(
          (completedAppts.length /
            (completedAppts.length + noShowAppts.length)) *
            100
        )
      : null;

  const activeDoors = allDoors.filter((d) => d.isActive);
  const occupiedDoors = activeDoors.filter((d) =>
    activeVisits.some((v) => v.currentDockDoorId === d.id)
  );
  const activeSlots = allSlots.filter((s) => s.isActive && !s.isBlocked);
  const availableSlots = activeSlots.filter((s) => !s.currentVisitId);

  const yardFillPct =
    activeSlots.length > 0
      ? Math.round((activeVisits.length / activeSlots.length) * 100)
      : 0;
  const dockUtilPct =
    activeDoors.length > 0
      ? Math.round((occupiedDoors.length / activeDoors.length) * 100)
      : 0;

  const onHold = activeVisits.filter((v) => v.holdStatus !== "none");
  const readyOut = activeVisits.filter((v) => v.visitStatus === "ready_out");
  const atDock = activeVisits.filter((v) =>
    ["at_dock", "loading", "unloading"].includes(v.visitStatus)
  );
  const inYard = activeVisits.filter((v) => v.visitStatus === "in_yard");
  const waitingForDock = activeVisits.filter(
    (v) =>
      v.visitStatus === "in_yard" &&
      !v.currentDockDoorId &&
      v.movementType !== "empty_drop"
  );

  const overdueTasksCount = activeTasks.filter((t) => {
    const ageMins =
      (Date.now() - new Date(t.createdAt!).getTime()) / 60000;
    return (
      (t.priority === "urgent" && ageMins > 30) ||
      (t.priority === "high" && ageMins > 60) ||
      ageMins > 180
    );
  }).length;

  const closedWithTimes = closedVisits.filter(
    (v) => v.checkInTime && v.checkOutTime
  );
  const avgDwellMins =
    closedWithTimes.length > 0
      ? Math.round(
          closedWithTimes.reduce(
            (sum, v) =>
              sum +
              (new Date(v.checkOutTime!).getTime() -
                new Date(v.checkInTime!).getTime()) /
                60000,
            0
          ) / closedWithTimes.length
        )
      : null;

  const tasksWithTime = completedTasks.filter(
    (t) => t.createdAt && t.completedAt
  );
  const avgMoveTaskMins =
    tasksWithTime.length > 0
      ? Math.round(
          tasksWithTime.reduce(
            (sum, t) =>
              sum +
              (new Date(t.completedAt!).getTime() -
                new Date(t.createdAt!).getTime()) /
                60000,
            0
          ) / tasksWithTime.length
        )
      : null;

  const resolvedWithTime = resolvedExceptions.filter(
    (e) => e.createdAt && e.resolvedAt
  );
  const avgExcResolveMins =
    resolvedWithTime.length > 0
      ? Math.round(
          resolvedWithTime.reduce(
            (sum, e) =>
              sum +
              (new Date(e.resolvedAt!).getTime() -
                new Date(e.createdAt!).getTime()) /
                60000,
            0
          ) / resolvedWithTime.length
        )
      : null;

  const carrierStats = new Map<
    number,
    {
      name: string;
      active: number;
      closed: number;
      totalDwell: number;
      dwellCount: number;
      exceptions: number;
      holds: number;
    }
  >();
  for (const v of allVisits) {
    if (!v.carrierId) continue;
    if (!carrierStats.has(v.carrierId)) {
      carrierStats.set(v.carrierId, {
        name: carrierMap.get(v.carrierId) || "Unknown",
        active: 0,
        closed: 0,
        totalDwell: 0,
        dwellCount: 0,
        exceptions: 0,
        holds: 0,
      });
    }
    const s = carrierStats.get(v.carrierId)!;
    if (v.visitStatus === "closed") {
      s.closed++;
      if (v.checkInTime && v.checkOutTime) {
        s.totalDwell +=
          (new Date(v.checkOutTime).getTime() -
            new Date(v.checkInTime).getTime()) /
          60000;
        s.dwellCount++;
      }
    } else {
      s.active++;
    }
    if (v.holdStatus !== "none") s.holds++;
  }
  for (const e of allExceptions) {
    const v = allVisits.find((x) => x.id === e.visitId);
    if (v?.carrierId) {
      const s = carrierStats.get(v.carrierId);
      if (s) s.exceptions++;
    }
  }

  const zoneOccupancy = new Map<string, { total: number; occupied: number }>();
  for (const slot of allSlots) {
    if (!slot.isActive) continue;
    const zoneName = zoneMap.get(slot.zoneId) || `Zone ${slot.zoneId}`;
    if (!zoneOccupancy.has(zoneName)) {
      zoneOccupancy.set(zoneName, { total: 0, occupied: 0 });
    }
    const z = zoneOccupancy.get(zoneName)!;
    z.total++;
    if (slot.currentVisitId) z.occupied++;
  }

  const exByType = allExceptions.reduce(
    (acc, e) => ({ ...acc, [e.type]: (acc[e.type] || 0) + 1 }),
    {} as Record<string, number>
  );
  const exBySeverity = allExceptions.reduce(
    (acc, e) => ({ ...acc, [e.severity]: (acc[e.severity] || 0) + 1 }),
    {} as Record<string, number>
  );

  const passedInsp = allInspections.filter((i) =>
    ["passed", "passed_with_notes"].includes(i.result)
  );
  const failedInsp = allInspections.filter((i) => i.result === "failed");
  const inspPassRate =
    passedInsp.length + failedInsp.length > 0
      ? Math.round(
          (passedInsp.length / (passedInsp.length + failedInsp.length)) * 100
        )
      : null;

  const mismatchedAudit = allAuditItems.filter(
    (a) => a.auditResult === "mismatched"
  );
  const missingAudit = allAuditItems.filter(
    (a) => a.auditResult === "missing"
  );

  const todayCheckins = activeVisits.filter(
    (v) => v.checkInTime && new Date(v.checkInTime) >= todayStart
  ).length;
  const todayDepartures = closedVisits.filter(
    (v) => v.checkOutTime && new Date(v.checkOutTime) >= todayStart
  ).length;

  const dwellViolations = activeVisits.filter((v) => {
    if (!v.checkInTime) return false;
    return (
      (Date.now() - new Date(v.checkInTime).getTime()) / 3_600_000 > 24
    );
  });

  const upcomingAppts30 = allAppointments.filter((a) => {
    const diff = new Date(a.scheduledDate).getTime() - now.getTime();
    return (
      diff >= 0 &&
      diff <= 30 * 60_000 &&
      !["cancelled", "completed", "no_show"].includes(a.status)
    );
  });
  const upcomingAppts60 = allAppointments.filter((a) => {
    const diff = new Date(a.scheduledDate).getTime() - now.getTime();
    return (
      diff >= 0 &&
      diff <= 60 * 60_000 &&
      !["cancelled", "completed", "no_show"].includes(a.status)
    );
  });

  const visitsText = activeVisits
    .map((v) => {
      const carrier = v.carrierId
        ? carrierMap.get(v.carrierId) || "Unknown"
        : "Walk-in";
      const location = v.currentSlotId
        ? `Slot ${slotMap.get(v.currentSlotId) || v.currentSlotId}`
        : v.currentDockDoorId
          ? `Door ${doorMap.get(v.currentDockDoorId) || v.currentDockDoorId}`
          : "Gate Area";
      const hold =
        v.holdStatus !== "none"
          ? ` | HOLD:${v.holdStatus.replace(/_/g, " ")}`
          : "";
      const dwellMins = v.checkInTime
        ? Math.floor(
            (Date.now() - new Date(v.checkInTime).getTime()) / 60000
          )
        : 0;
      const checkin = v.checkInTime
        ? new Date(v.checkInTime).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "pending";
      return `  ${v.visitNumber}|${v.trailerNumber || "N/A"}|${carrier}|${v.visitStatus.replace(/_/g, " ")}|${location}|${v.movementType.replace(/_/g, " ")}|in:${checkin}|dwell:${dwellMins}min${hold}`;
    })
    .join("\n");

  const tasksText = activeTasks
    .map((t) => {
      const visit = allVisits.find((v) => v.id === t.visitId);
      const trailer = visit?.trailerNumber || `visit#${t.visitId}`;
      const ageMins = Math.floor(
        (Date.now() - new Date(t.createdAt!).getTime()) / 60000
      );
      return `  #${t.id}|${trailer}|${t.fromLocationName || "?"}→${t.toLocationName || "?"}|${t.priority}|${t.status}|age:${ageMins}min`;
    })
    .join("\n");

  const exceptionsText = openExceptions
    .map((e) => {
      const v = allVisits.find((x) => x.id === e.visitId);
      const trailer = v?.trailerNumber || `visit#${e.visitId}`;
      const ageMins = Math.floor(
        (Date.now() - new Date(e.createdAt!).getTime()) / 60000
      );
      return `  #${e.id}|${trailer}|${e.type.replace(/_/g, " ")}|${e.severity}|age:${ageMins}min${e.description ? `|${e.description.slice(0, 60)}` : ""}`;
    })
    .join("\n");

  const appointmentsText = todayAppts
    .map((a) => {
      const carrier = a.carrierId
        ? carrierMap.get(a.carrierId) || "Unknown"
        : "Unknown";
      const d = new Date(a.scheduledDate);
      const isUpcoming30 = upcomingAppts30.some((x) => x.id === a.id);
      const isUpcoming60 = upcomingAppts60.some((x) => x.id === a.id);
      const tag = isUpcoming30
        ? " [DUE<30m]"
        : isUpcoming60
          ? " [DUE<1h]"
          : "";
      return `  ${a.referenceNumber}|${carrier}|${a.timeWindowStart}–${a.timeWindowEnd}|${a.status}|${a.movementType.replace(/_/g, " ")}|trailer:${a.trailerNumber || "TBD"}${tag}`;
    })
    .join("\n");

  const carrierText = Array.from(carrierStats.entries())
    .map(([, s]) => {
      const avgDwell =
        s.dwellCount > 0 ? Math.round(s.totalDwell / s.dwellCount) : null;
      return `  ${s.name}|active:${s.active}|completed:${s.closed}|avgDwell:${avgDwell ? avgDwell + "min" : "N/A"}|exceptions:${s.exceptions}|holds:${s.holds}`;
    })
    .join("\n");

  const zoneText = Array.from(zoneOccupancy.entries())
    .map(([name, z]) => {
      const pct =
        z.total > 0 ? Math.round((z.occupied / z.total) * 100) : 0;
      return `  ${name}: ${z.occupied}/${z.total} (${pct}%)`;
    })
    .join("\n");

  const exTypeText = Object.entries(exByType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `  ${type.replace(/_/g, " ")}: ${n}`)
    .join("\n");

  return `=== LIVE SNAPSHOT: ${now.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} ===

OPERATIONAL STATE:
  Yard fill: ${yardFillPct}% (${activeVisits.length} trailers / ${activeSlots.length} slots)
  Dock util: ${dockUtilPct}% (${occupiedDoors.length}/${activeDoors.length} doors occupied)
  At dock (loading/unloading): ${atDock.length}
  In yard (parked): ${inYard.length}
  Waiting for dock: ${waitingForDock.length}
  Ready for checkout: ${readyOut.length}
  On hold: ${onHold.length}
  Open move tasks: ${activeTasks.length} (${overdueTasksCount} overdue)
  Open exceptions: ${openExceptions.length} (${allExceptions.filter((e) => e.severity === "critical" && e.status === "open").length} critical)
  Upcoming appts next 30min: ${upcomingAppts30.length}
  Upcoming appts next 1hr: ${upcomingAppts60.length}
  Dwell violations (>24h): ${dwellViolations.length}
  Available slots: ${availableSlots.length}
  Today check-ins: ${todayCheckins} | Departures: ${todayDepartures}

ACTIVE TRAILERS (${activeVisits.length}):
${visitsText || "  None"}

OPEN MOVE TASKS (${activeTasks.length}):
${tasksText || "  None"}

OPEN EXCEPTIONS (${openExceptions.length}):
${exceptionsText || "  None"}

TODAY'S APPOINTMENTS (${todayAppts.length}):
${appointmentsText || "  None"}

ZONE CAPACITY:
${zoneText || "  No zone data"}

=== ANALYTICS & HISTORY ===

HISTORICAL PERFORMANCE:
  Total visits in system: ${allVisits.length} (${activeVisits.length} active, ${closedVisits.length} completed)
  Today check-ins: ${todayCheckins} | Today departures: ${todayDepartures}
  Avg dwell time (all completed): ${avgDwellMins ? `${avgDwellMins}min (${(avgDwellMins / 60).toFixed(1)}h)` : "N/A"}
  Avg move task completion: ${avgMoveTaskMins ? `${avgMoveTaskMins}min` : "N/A"}
  Total move tasks: ${allTasks.length} (${completedTasks.length} completed, ${activeTasks.length} active)
  Total exceptions: ${allExceptions.length} (${openExceptions.length} open, ${resolvedExceptions.length} resolved)
  Exception resolution rate: ${allExceptions.length > 0 ? Math.round((resolvedExceptions.length / allExceptions.length) * 100) : 0}%
  Avg exception resolution: ${avgExcResolveMins ? `${avgExcResolveMins}min` : "N/A"}
  Appointments: ${allAppointments.length} total | ${completedAppts.length} completed | ${noShowAppts.length} no-shows
  Appointment compliance: ${apptComplianceRate !== null ? `${apptComplianceRate}%` : "N/A"}
  Inspection pass rate: ${inspPassRate !== null ? `${inspPassRate}%` : "N/A"} (${passedInsp.length} passed, ${failedInsp.length} failed)
  Yard audit mismatches: ${mismatchedAudit.length} | Missing: ${missingAudit.length}

CARRIER PERFORMANCE:
${carrierText || "  No carrier data"}

EXCEPTION BREAKDOWN BY TYPE:
${exTypeText || "  None"}
  By severity — critical:${exBySeverity["critical"] || 0}, high:${exBySeverity["high"] || 0}, medium:${exBySeverity["medium"] || 0}, low:${exBySeverity["low"] || 0}`;
}

function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    admin:
      "Full system access — all modules, all data, administrative controls",
    yard_manager:
      "Full operational access — yard, dock, gates, reports, exceptions",
    gate_guard:
      "Gate operations — check-in, check-out, inspections, gate exceptions",
    yard_jockey:
      "Move tasks — physical trailer repositioning, yard map, inventory view",
    dock_user:
      "Dock operations — door management, loading/unloading status, dock appointments",
    carrier:
      "Limited carrier portal — own trailer status and scheduled appointments only",
  };
  return descriptions[role] || "Standard access";
}

const VALID_PATHS = [
  "/",
  "/appointments",
  "/gate/check-in",
  "/gate/check-out",
  "/yard/inventory",
  "/yard/map",
  "/dock",
  "/moves",
  "/exceptions",
  "/yard/audit",
  "/inspections",
  "/reports",
  "/admin/carriers",
  "/admin/users",
  "/admin/yard-setup",
  "/admin/audit",
  "/manual",
];

const SYSTEM_PROMPT_BASE = `You are SNOW, the AI Operations Copilot for YMSNOW — a Tier 1 Yard Management System.

You serve three roles simultaneously:
1. SYSTEM GUIDE — help users navigate modules and workflows
2. OPERATIONAL ASSISTANT — answer live queries about trailers, tasks, exceptions, appointments using real data
3. PREDICTIVE COPILOT — proactively warn about congestion risks, explain reasoning, and recommend corrective actions

=== LIVE DATA ACCESS ===
You have full access to all data in the system including: every trailer visit (active and historical), all move tasks, all exceptions (open and resolved), all appointments, carrier performance, zone capacity, dock utilization, inspection records, and yard audit findings. Use this data to calculate, infer, and reason — do not say "I don't have access to that data."

=== CONGESTION PREDICTION ===
You understand the following operational signals:
- Yard fill rate: active trailers vs total available slots (>75% = concern, >90% = critical)
- Dock utilization: occupied doors vs total active doors (>75% = concern, >90% = critical)
- Upcoming appointment pressure: booked appointments arriving in the next 30–60 minutes
- Move task backlog: overdue tasks indicate jockey congestion
- Dwell violations: trailers parked >24h block slot turnover
- On-hold blockage: held trailers reduce effective throughput
- Gate queues: trailers waiting for slot assignment

When asked about congestion risk or yard health, always explain BOTH the risk level and the reasoning behind it. Use the pre-computed operational state data provided.

=== WHAT-IF SIMULATION ===
When users ask "What if X happens?", reason through the operational impact using current data:
- "What if 10 trucks arrive in the next hour?" → add to upcoming count, recalculate yard fill, dock pressure
- "What if Dock 3 becomes unavailable?" → reduce available doors by 1, recalculate dock utilization
- "What if I move two jockeys to Zone B?" → estimate throughput improvement based on current task backlog
Always give a quantitative estimate and explain the downstream effect.

=== RECOMMENDED ACTIONS ===
When congestion risk is medium or above, always recommend specific actions:
- Reassign trailers to alternate docks
- Prioritize unloading of high-dwell trailers  
- Stagger or defer incoming appointments
- Allocate additional jockeys to overdue tasks
- Expedite inspections to clear gate queue
- Open overflow yard space or secondary zones
- Clear documentation holds to restore throughput

=== SYSTEM MODULES ===
- Dashboard (/): KPIs and recent activity
- Appointments (/appointments): Pre-scheduled arrival/departure slots
- Gate Check-In (/gate/check-in): Arrivals, driver/trailer/seal verification, slot assignment
- Gate Check-Out (/gate/check-out): Departures, seal verification, visit completion
- Yard Inventory (/yard/inventory): All trailers with status and location
- Yard Map (/yard/map): Visual zone/slot map
- Dock Management (/dock): Door assignments, loading/unloading
- Move Tasks (/moves): Work orders for yard jockeys
- Holds & Exceptions (/exceptions): Documentation, damage, security, customs holds
- Yard Walk (/yard/audit): Physical trailer location verification
- Inspections (/inspections): Formal inspection records
- Reports (/reports): Operational analytics and KPIs
- Carrier Management (/admin/carriers): Carrier profiles and performance

=== VISIT LIFECYCLE ===
arrived → checked_in → in_yard → at_dock → loading/unloading → ready_out → checked_out → closed

HOLD TYPES: documentation hold, security hold, damage hold, seal mismatch, yard block, driver issue, customs hold, overweight

=== RESPONSE GUIDELINES ===
- Be concise and direct — busy operations staff need immediate answers
- For congestion alerts: state risk level first, then factors, then actions
- For trailer lookups: visit number, trailer number, status, location, dwell time, hold status
- For calculations: show the math (e.g., "18 trucks arriving, 6 docks available = 12 waiting")
- For historical questions: use carrier stats, dwell averages, exception rates from provided data
- Bold critical values using **text**
- Use bullet points for lists of items
- For what-if questions: quantify the impact explicitly

=== NAVIGATION ACTIONS ===
After your response, if navigating to a screen would help, append on its own line:
SNOW_ACTIONS: [{"type":"navigate","label":"Short Label","path":"/valid-path"}]

Valid paths: ${VALID_PATHS.join(", ")}
Rules: 1–3 actions max, 2–4 word labels. Only include when genuinely helpful.`;

export function registerAssistantRoutes(app: Express): void {
  app.get("/api/assistant/congestion", async (_req, res) => {
    try {
      const report = await computeCongestionRisk();
      res.json(report);
    } catch (error: any) {
      console.error("Congestion report error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/assistant/chat", async (req, res) => {
    try {
      const { message, history = [], screenContext } = req.body;
      if (!message?.trim()) {
        return res.status(400).json({ message: "Message is required" });
      }

      const [yardContext, congestionReport] = await Promise.all([
        buildYardContext(),
        computeCongestionRisk(),
      ]);

      const { windows, currentState } = congestionReport;
      const worstWindow = [
        windows.now,
        windows.thirtyMin,
        windows.oneHour,
      ].reduce((worst, w) =>
        w.riskScore > worst.riskScore ? w : worst
      );

      const congestionSection = `
=== CONGESTION RISK ASSESSMENT ===
Current: ${windows.now.riskLevel.toUpperCase()} (score ${windows.now.riskScore}/100)
Next 30 min: ${windows.thirtyMin.riskLevel.toUpperCase()} (score ${windows.thirtyMin.riskScore}/100)
Next hour: ${windows.oneHour.riskLevel.toUpperCase()} (score ${windows.oneHour.riskScore}/100)
Rest of shift: ${windows.shift.riskLevel.toUpperCase()} (score ${windows.shift.riskScore}/100)

${worstWindow.riskScore >= 25 ? `PRIMARY RISK FACTORS:\n${worstWindow.factors.map((f) => `  - ${f}`).join("\n")}

IMPACTED AREAS: ${worstWindow.impactedAreas.join(", ")}

RECOMMENDED ACTIONS:\n${worstWindow.recommendations.map((r) => `  - ${r}`).join("\n")}` : "All systems operating within normal parameters."}`;

      let screenSection = "";
      if (screenContext?.currentPath) {
        const { currentPath, screenName, userRole } = screenContext;
        const roleDesc = getRoleDescription(userRole || "admin");
        screenSection = `

CURRENT USER CONTEXT:
  Active Screen: ${screenName || currentPath} (${currentPath})
  User Role: ${userRole || "admin"} — ${roleDesc}

Prioritize information relevant to "${screenName || currentPath}". Tailor your response to what a ${userRole || "admin"} needs from this screen.`;
      }

      const systemPrompt = `${SYSTEM_PROMPT_BASE}${screenSection}

LIVE YARD DATA:
${yardContext}
${congestionSection}`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...(
          history as Array<{ role: "user" | "assistant"; content: string }>
        ).map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ];

      const stream = await getOpenAI().chat.completions.create({
        model: "gpt-5.1",
        messages,
        stream: true,
        max_completion_tokens: 1500,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Assistant error:", error);
      if (res.headersSent) {
        res.write(
          `data: ${JSON.stringify({ error: "Assistant unavailable" })}\n\n`
        );
        res.end();
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });
}
