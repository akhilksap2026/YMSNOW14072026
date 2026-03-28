import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProductMode, showAIRecommendations } from "@/lib/product-mode";
import { AppointmentsAssistPanel } from "@/components/assist/appointments-assist-panel";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { appointmentStatusColor } from "@/lib/status-colors";
import {
  PageHeader, FilterToolbar, StatusChip, DetailDrawer, DrawerSection, DrawerField, EmptyState,
} from "@/components/enterprise";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, CalendarDays, List, Calendar, ChevronLeft, ChevronRight,
  GripVertical, Clock, MoreHorizontal, CheckCircle2, XCircle,
  LogIn, AlertTriangle, ChevronDown, ChevronUp, TrendingUp,
  ArrowUpDown, ArrowUp, ArrowDown, Truck,
} from "lucide-react";
import type { Appointment, Carrier } from "@shared/schema";

type ArrivalStatus = "on_time" | "early" | "late" | "no_show";
type SortField = "scheduledDate" | "carrier" | "status";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "calendar";
type CalendarLayout = "day" | "week" | "month";
type QuickTab = "all" | "today" | "late" | "no_show" | "confirmed" | "cancelled";

function getArrivalStatus(apt: Appointment | undefined | null): ArrivalStatus {
  if (!apt) return "on_time";
  const mockStatuses: ArrivalStatus[] = ["on_time", "early", "late", "no_show"];
  return mockStatuses[apt.id % 4] as ArrivalStatus;
}

function arrivalStatusColor(status: ArrivalStatus): string {
  switch (status) {
    case "on_time": return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "early": return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300";
    case "late": return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300";
    case "no_show": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function formatArrivalStatus(status: ArrivalStatus): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusDotColor(status: string): string {
  switch (status) {
    case "confirmed": case "completed": return "bg-emerald-500";
    case "booked": case "scheduled": case "rescheduled": return "bg-amber-500";
    case "cancelled": case "no_show": return "bg-red-500";
    case "checked_in": return "bg-blue-500";
    default: return "bg-gray-400";
  }
}

function movementTypeShort(t: string): string {
  switch (t) {
    case "inbound": return "IN";
    case "outbound": return "OUT";
    case "empty_drop": return "ED";
    case "loaded_arrival": return "LA";
    case "live_load": return "LL";
    case "live_unload": return "LU";
    default: return t.slice(0, 3).toUpperCase();
  }
}

function movementTypeLabel(t: string): string {
  switch (t) {
    case "inbound": return "Inbound";
    case "outbound": return "Outbound";
    case "empty_drop": return "Empty Drop";
    case "loaded_arrival": return "Loaded Arrival";
    case "live_load": return "Live Load";
    case "live_unload": return "Live Unload";
    default: return formatStatus(t);
  }
}

function movementBg(t: string): string {
  switch (t) {
    case "inbound": case "loaded_arrival": return "bg-[#2B5DAD]/10 border-[#2B5DAD]/30 text-[#2B5DAD] dark:text-blue-300";
    case "outbound": return "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300";
    case "empty_drop": return "bg-gray-500/10 border-gray-500/30 text-gray-600 dark:text-gray-300";
    case "live_load": return "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300";
    case "live_unload": return "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300";
    default: return "bg-muted border-border text-muted-foreground";
  }
}

function rowBorderColor(status: string, arrStatus: ArrivalStatus): string {
  if (status === "cancelled") return "border-l-gray-300 dark:border-l-gray-600";
  if (status === "no_show" || arrStatus === "no_show") return "border-l-[#CC2229]";
  if (arrStatus === "late") return "border-l-amber-500";
  if (status === "confirmed" || status === "checked_in" || status === "completed") return "border-l-emerald-500";
  return "border-l-[#2B5DAD]";
}

const AVATAR_COLORS = [
  "bg-[#2B5DAD]", "bg-violet-600", "bg-emerald-600", "bg-amber-600",
  "bg-[#CC2229]", "bg-cyan-600", "bg-indigo-600", "bg-orange-600",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function carrierInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function formatTimePill(start: string, end: string): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, "0")}${period}`;
  };
  return `${fmt(start)}–${fmt(end)}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const r = new Date(d);
    r.setDate(r.getDate() + i);
    return r;
  });
}

function getMonthDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const days: Date[] = [];
  for (let i = -startDay; i < 42 - startDay; i++) {
    days.push(new Date(year, month, 1 + i));
  }
  return days;
}

interface CalendarAppointment extends Appointment {
  carrierName: string;
}

function AppointmentCard({
  apt,
  compact,
  onDragStart,
}: {
  apt: CalendarAppointment;
  compact?: boolean;
  onDragStart?: (e: React.DragEvent, apt: CalendarAppointment) => void;
}) {
  const bg = movementBg(apt.movementType);
  if (compact) {
    return (
      <div
        draggable={apt.status !== "completed" && apt.status !== "cancelled"}
        onDragStart={(e) => onDragStart?.(e, apt)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-grab active:cursor-grabbing truncate ${bg}`}
        title={`${apt.timeWindowStart}-${apt.timeWindowEnd} ${apt.carrierName} ${apt.trailerNumber || ""}`}
        data-testid={`cal-apt-${apt.id}`}
      >
        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotColor(apt.status)}`} />
        <span className="truncate">{apt.timeWindowStart} {apt.carrierName?.split(" ")[0]}</span>
      </div>
    );
  }
  return (
    <div
      draggable={apt.status !== "completed" && apt.status !== "cancelled"}
      onDragStart={(e) => onDragStart?.(e, apt)}
      className={`flex items-start gap-1.5 px-2 py-1.5 rounded-md border text-xs cursor-grab active:cursor-grabbing group transition-shadow hover:shadow-sm ${bg}`}
      data-testid={`cal-apt-${apt.id}`}
    >
      <GripVertical className="h-3 w-3 mt-0.5 opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotColor(apt.status)}`} />
          <span className="font-semibold truncate">{apt.timeWindowStart}–{apt.timeWindowEnd}</span>
          <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold shrink-0 ml-auto border-current">
            {movementTypeShort(apt.movementType)}
          </Badge>
        </div>
        <div className="truncate text-[11px] mt-0.5 opacity-80">{apt.carrierName}</div>
        {apt.trailerNumber && <div className="truncate text-[10px] opacity-60 font-mono">{apt.trailerNumber}</div>}
      </div>
    </div>
  );
}

function DayView({
  date, appointments, onDragStart, onDrop, dragOverSlot, onDragOver, onDragLeave,
}: {
  date: Date;
  appointments: CalendarAppointment[];
  onDragStart: (e: React.DragEvent, apt: CalendarAppointment) => void;
  onDrop: (date: Date, hour: number) => void;
  dragOverSlot: string | null;
  onDragOver: (e: React.DragEvent, slot: string) => void;
  onDragLeave: () => void;
}) {
  const dayApts = appointments.filter((a) => a.scheduledDate && isSameDay(new Date(a.scheduledDate), date));
  const hours = Array.from({ length: 18 }, (_, i) => i + 5);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-muted/40 px-4 py-2.5 border-b text-sm font-semibold flex items-center gap-2">
        {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        <Badge variant="secondary" className="ml-1 text-xs font-semibold">{dayApts.length}</Badge>
      </div>
      <div className="divide-y max-h-[calc(100vh-280px)] overflow-y-auto">
        {hours.map((h) => {
          const slotKey = `day-${h}`;
          const slotApts = dayApts.filter((a) => Math.floor(timeToMinutes(a.timeWindowStart) / 60) === h);
          const isOver = dragOverSlot === slotKey;
          const hasConflict = slotApts.length > 1;
          return (
            <div
              key={h}
              className={`flex min-h-[52px] transition-colors ${isOver ? "bg-primary/10 ring-1 ring-primary/30 ring-inset" : ""}`}
              onDragOver={(e) => { e.preventDefault(); onDragOver(e, slotKey); }}
              onDragLeave={onDragLeave}
              onDrop={(e) => { e.preventDefault(); onDrop(date, h); }}
              data-testid={`day-slot-${h}`}
            >
              <div className="w-16 shrink-0 py-2 px-2 text-[11px] font-medium text-muted-foreground border-r text-right flex flex-col items-end gap-1">
                {formatHour(h)}
                {hasConflict && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" title="Multiple appointments in this slot" />}
              </div>
              <div className="flex-1 p-1 space-y-1">
                {slotApts.map((a) => <AppointmentCard key={a.id} apt={a} onDragStart={onDragStart} />)}
                {isOver && slotApts.length === 0 && (
                  <div className="h-8 rounded border-2 border-dashed border-primary/40 flex items-center justify-center text-[10px] text-primary font-medium">
                    Drop here — {formatHour(h)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  date, appointments, onDragStart, onDrop, dragOverSlot, onDragOver, onDragLeave,
}: {
  date: Date;
  appointments: CalendarAppointment[];
  onDragStart: (e: React.DragEvent, apt: CalendarAppointment) => void;
  onDrop: (date: Date, hour: number) => void;
  dragOverSlot: string | null;
  onDragOver: (e: React.DragEvent, slot: string) => void;
  onDragLeave: () => void;
}) {
  const weekDays = getWeekDays(date);
  const hours = Array.from({ length: 16 }, (_, i) => i + 5);
  const today = new Date();

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-[56px_repeat(7,1fr)] bg-muted/40 border-b">
        <div className="border-r" />
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today);
          const dayCount = appointments.filter((a) => a.scheduledDate && isSameDay(new Date(a.scheduledDate), d)).length;
          return (
            <div key={i} className={`text-center py-2 border-r last:border-r-0 ${isToday ? "bg-primary/5" : ""}`}>
              <div className="text-[10px] font-medium text-muted-foreground uppercase">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className={`text-sm font-bold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
              {dayCount > 0 && (
                <div className="text-[9px] text-muted-foreground font-medium">{dayCount} apt{dayCount !== 1 ? "s" : ""}</div>
              )}
            </div>
          );
        })}
      </div>
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        {hours.map((h) => (
          <div key={h} className="grid grid-cols-[56px_repeat(7,1fr)] border-b last:border-b-0">
            <div className="py-1 px-1 text-[10px] font-medium text-muted-foreground border-r text-right pr-2 min-h-[44px] flex items-start justify-end pt-1">
              {formatHour(h)}
            </div>
            {weekDays.map((d, di) => {
              const slotKey = `week-${di}-${h}`;
              const slotApts = appointments.filter((a) => {
                if (!a.scheduledDate || !isSameDay(new Date(a.scheduledDate), d)) return false;
                return Math.floor(timeToMinutes(a.timeWindowStart) / 60) === h;
              });
              const isOver = dragOverSlot === slotKey;
              const isToday = isSameDay(d, today);
              const hasConflict = slotApts.length > 1;
              return (
                <div
                  key={di}
                  className={`border-r last:border-r-0 p-0.5 min-h-[44px] transition-colors relative ${isOver ? "bg-primary/10 ring-1 ring-primary/30 ring-inset" : isToday ? "bg-primary/[0.02]" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); onDragOver(e, slotKey); }}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => { e.preventDefault(); onDrop(d, h); }}
                  data-testid={`week-slot-${di}-${h}`}
                >
                  {hasConflict && (
                    <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" title="Slot conflict" />
                  )}
                  {slotApts.map((a) => <AppointmentCard key={a.id} apt={a} compact onDragStart={onDragStart} />)}
                  {isOver && slotApts.length === 0 && (
                    <div className="h-6 rounded border border-dashed border-primary/40 flex items-center justify-center text-[9px] text-primary font-medium">Drop</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({
  date, appointments, onDragStart, onDrop, dragOverSlot, onDragOver, onDragLeave,
}: {
  date: Date;
  appointments: CalendarAppointment[];
  onDragStart: (e: React.DragEvent, apt: CalendarAppointment) => void;
  onDrop: (date: Date, hour: number) => void;
  dragOverSlot: string | null;
  onDragOver: (e: React.DragEvent, slot: string) => void;
  onDragLeave: () => void;
}) {
  const monthDays = getMonthDays(date);
  const today = new Date();
  const weeks: Date[][] = [];
  for (let i = 0; i < monthDays.length; i += 7) weeks.push(monthDays.slice(i, i + 7));

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-muted/40 border-b">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center py-1.5 text-[10px] font-bold uppercase text-muted-foreground border-r last:border-r-0">{d}</div>
        ))}
      </div>
      <div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((d, di) => {
              const slotKey = `month-${wi}-${di}`;
              const isCurrentMonth = d.getMonth() === date.getMonth();
              const isToday = isSameDay(d, today);
              const dayApts = appointments.filter((a) => a.scheduledDate && isSameDay(new Date(a.scheduledDate), d));
              const visible = dayApts.slice(0, 3);
              const overflow = dayApts.length - 3;
              const isOver = dragOverSlot === slotKey;
              return (
                <div
                  key={di}
                  className={`border-r last:border-r-0 min-h-[90px] p-1 transition-colors ${!isCurrentMonth ? "bg-muted/20 opacity-50" : ""} ${isOver ? "bg-primary/10 ring-1 ring-primary/30 ring-inset" : ""} ${isToday ? "bg-primary/[0.04]" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); onDragOver(e, slotKey); }}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => { e.preventDefault(); onDrop(d, 8); }}
                  data-testid={`month-cell-${wi}-${di}`}
                >
                  <div className={`text-xs font-medium mb-0.5 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {visible.map((a) => <AppointmentCard key={a.id} apt={a} compact onDragStart={onDragStart} />)}
                    {overflow > 0 && <div className="text-[10px] font-medium text-muted-foreground pl-1 cursor-default">+{overflow} more</div>}
                  </div>
                  {isOver && dayApts.length === 0 && (
                    <div className="h-5 mt-0.5 rounded border border-dashed border-primary/40 flex items-center justify-center text-[9px] text-primary font-medium">Drop</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarLegend() {
  const items = [
    { label: "Inbound / Loaded Arrival", color: "bg-[#2B5DAD]/20 border-[#2B5DAD]/40" },
    { label: "Outbound", color: "bg-emerald-500/20 border-emerald-500/40" },
    { label: "Live Load", color: "bg-violet-500/20 border-violet-500/40" },
    { label: "Live Unload", color: "bg-amber-500/20 border-amber-500/40" },
    { label: "Empty Drop", color: "bg-gray-400/20 border-gray-400/40" },
  ];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={`h-3 w-3 rounded border ${item.color}`} />
          <span className="text-[10px] text-muted-foreground">{item.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <span className="text-[10px] text-muted-foreground">Slot conflict</span>
      </div>
    </div>
  );
}

interface AptRowProps {
  apt: Appointment;
  carrierName: string;
  onSelect: () => void;
  onQuickAction: (id: number, status: string) => void;
  isPending: boolean;
}

function AptRow({ apt, carrierName, onSelect, onQuickAction, isPending }: AptRowProps) {
  const arrStatus = getArrivalStatus(apt);
  const borderColor = rowBorderColor(apt.status, arrStatus);
  const initials = carrierInitials(carrierName);
  const avatarBg = avatarColor(carrierName);

  const showConfirm = apt.status === "booked" || apt.status === "rescheduled" || apt.status === "scheduled";
  const showCheckIn = apt.status === "confirmed" || apt.status === "booked";
  const showCancel = apt.status !== "cancelled" && apt.status !== "completed";

  const urgentRow = apt.status === "no_show" || arrStatus === "no_show" || arrStatus === "late";
  const dimRow = apt.status === "cancelled" || apt.status === "completed";

  return (
    <div
      className={`group flex items-center gap-0 border-l-4 ${borderColor} bg-card hover:bg-muted/30 transition-colors cursor-pointer border-b last:border-b-0 ${dimRow ? "opacity-60" : ""}`}
      onClick={onSelect}
      data-testid={`apt-row-${apt.id}`}
    >
      <div className={`flex items-center gap-3 flex-1 min-w-0 px-4 py-3`}>
        <div className="h-7 min-w-[32px] px-1.5 rounded bg-muted border border-border/60 flex items-center justify-center text-[11px] font-bold text-foreground/80 shrink-0 tabular-nums tracking-wide">
          {initials}
        </div>

        <div className="min-w-0 flex-1 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 items-center">
          <div className="min-w-0">
            <div className="font-semibold text-primary text-sm truncate">{apt.referenceNumber}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {apt.scheduledDate
                ? new Date(apt.scheduledDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "No date"}
            </div>
          </div>

          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{carrierName}</div>
            {apt.trailerNumber ? (
              <code className="text-[11px] text-muted-foreground font-mono">{apt.trailerNumber}</code>
            ) : (
              <span className="text-[11px] text-muted-foreground">No trailer</span>
            )}
          </div>

          <div className="shrink-0">
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${movementBg(apt.movementType)}`}>
              {movementTypeLabel(apt.movementType)}
            </div>
          </div>

          <div className="shrink-0">
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              {formatTimePill(apt.timeWindowStart, apt.timeWindowEnd)}
            </div>
            {apt.driverName && (
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">{apt.driverName}</div>
            )}
          </div>

          <div className="min-w-0 flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <StatusChip status={apt.status} colorFn={appointmentStatusColor} data-testid={`status-apt-${apt.id}`} />
              {(arrStatus === "late" || arrStatus === "no_show") && (
                <Badge variant="outline" className={`text-[9px] py-0 h-4 w-fit ${arrivalStatusColor(arrStatus)}`}>
                  {formatArrivalStatus(arrStatus)}
                </Badge>
              )}
            </div>
            {urgentRow && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" title="Appointment requires urgent attention" />
            )}
          </div>
        </div>
      </div>

      <div
        className="pr-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {showCheckIn && (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => onQuickAction(apt.id, "checked_in")}
            data-testid={`button-checkin-${apt.id}`}
          >
            <LogIn className="h-3 w-3 mr-1" /> Check In
          </Button>
        )}
        {!showCheckIn && showConfirm && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => onQuickAction(apt.id, "confirmed")}
            data-testid={`button-confirm-${apt.id}`}
          >
            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> Confirm
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isPending}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onSelect}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {showConfirm && (
              <DropdownMenuItem onClick={() => onQuickAction(apt.id, "confirmed")} className="text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                Confirm
              </DropdownMenuItem>
            )}
            {showCheckIn && (
              <DropdownMenuItem onClick={() => onQuickAction(apt.id, "checked_in")} className="text-blue-700 dark:text-blue-400">
                <LogIn className="h-3.5 w-3.5 mr-2" />
                Check In
              </DropdownMenuItem>
            )}
            {showCancel && (
              <DropdownMenuItem onClick={() => onQuickAction(apt.id, "cancelled")} className="text-destructive">
                <XCircle className="h-3.5 w-3.5 mr-2" />
                Cancel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface DateGroupSectionProps {
  label: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  isToday?: boolean;
}

function DateGroupSection({ label, count, defaultOpen = true, children, isToday }: DateGroupSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors border-b ${open ? "border-b" : "border-b-0"}`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2.5">
          {isToday && <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
          <span className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>{label}</span>
          <Badge variant={isToday ? "default" : "secondary"} className="text-xs h-5 px-1.5">
            {count} {count === 1 ? "appt" : "appts"}
          </Badge>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

export default function AppointmentsPage({
  userRole,
  currentPersona,
}: {
  userRole?: string;
  currentPersona?: { id: string; carrierId: number | null; carrierName: string | null; role: string } | null;
} = {}) {
  const isCarrier = userRole === "carrier";
  const carrierPersonaId = isCarrier ? currentPersona?.carrierId : null;
  const { mode } = useProductMode();
  const aiEnabled = showAIRecommendations(mode);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [quickTab, setQuickTab] = useState<QuickTab>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("ymsnow_appointments_view");
    return (saved === "list" || saved === "calendar") ? saved : "calendar";
  });
  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("ymsnow_appointments_view", mode);
  };
  const [calLayout, setCalLayout] = useState<CalendarLayout>("week");
  const [calDate, setCalDate] = useState(() => new Date());
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [draggingApt, setDraggingApt] = useState<CalendarAppointment | null>(null);
  const [confirmDrop, setConfirmDrop] = useState<{ apt: CalendarAppointment; newDate: Date; newHour: number } | null>(null);
  const [selectedAptId, setSelectedAptId] = useState<number | null>(null);
  const { toast } = useToast();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { data: allAppointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const appointments = useMemo(() => {
    if (isCarrier && carrierPersonaId != null) {
      return allAppointments.filter((a) => a.carrierId === carrierPersonaId);
    }
    return allAppointments;
  }, [allAppointments, isCarrier, carrierPersonaId]);

  const selectedApt = useMemo(
    () => appointments.find((a) => a.id === selectedAptId),
    [appointments, selectedAptId]
  );

  const { data: carriers = [] } = useQuery<Carrier[]>({
    queryKey: ["/api/carriers"],
  });

  const carrierMap = useMemo(() => {
    const map: Record<number, string> = {};
    carriers.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [carriers]);

  const calAppointments: CalendarAppointment[] = useMemo(
    () => appointments.map((a) => ({ ...a, carrierName: a.carrierId ? carrierMap[a.carrierId] || "Unknown" : "Walk-in" })),
    [appointments, carrierMap]
  );

  const conflictAlert = useMemo(() => {
    if (!selectedApt) return null;
    const sameTime = appointments.filter(
      (a) => a.id !== selectedApt.id && a.scheduledDate === selectedApt.scheduledDate && a.timeWindowStart === selectedApt.timeWindowStart
    );
    return sameTime.length > 0
      ? `Potential slot conflict: ${sameTime.length} other appointment(s) scheduled for this time.`
      : null;
  }, [selectedApt, appointments]);

  const kpiCounts = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const total = appointments.length;
    const todayCount = appointments.filter((a) => a.scheduledDate && isSameDay(new Date(a.scheduledDate), today)).length;
    const lateCount = appointments.filter((a) => getArrivalStatus(a) === "late").length;
    const noShowCount = appointments.filter((a) => getArrivalStatus(a) === "no_show" || a.status === "no_show").length;
    const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
    const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;
    return { total, todayCount, lateCount, noShowCount, confirmedCount, cancelledCount };
  }, [appointments, today]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/appointments", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setOpen(false);
      toast({ title: "Appointment scheduled" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/appointments/${id}`, { status });
      return res.json();
    },
    onSuccess: (_, { status }) => {
      invalidateAll();
      toast({ title: `Appointment ${formatStatus(status)}` });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (data: { id: number; scheduledDate: string; timeWindowStart: string; timeWindowEnd: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/appointments/${data.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setConfirmDrop(null);
      toast({ title: "Appointment rescheduled", description: "The appointment has been moved to the new time slot." });
    },
    onError: (err: Error) => {
      toast({ title: "Reschedule failed", description: err.message, variant: "destructive" });
      setConfirmDrop(null);
    },
  });

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => {
      if (a.referenceNumber) set.add(a.referenceNumber);
      if (a.trailerNumber) set.add(a.trailerNumber);
      if (a.driverName) set.add(a.driverName);
      const cn = a.carrierId ? carrierMap[a.carrierId] : null;
      if (cn) set.add(cn);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [appointments, carrierMap]);

  const filtered = useMemo(() => {
    let result = appointments.filter((a) => {
      const q = search.toLowerCase();
      const carrierName = a.carrierId ? (carrierMap[a.carrierId] || "") : "";
      const matchSearch =
        !search ||
        a.referenceNumber.toLowerCase().includes(q) ||
        a.trailerNumber?.toLowerCase().includes(q) ||
        a.driverName?.toLowerCase().includes(q) ||
        a.poNumber?.toLowerCase().includes(q) ||
        a.bolNumber?.toLowerCase().includes(q) ||
        a.sealNumber?.toLowerCase().includes(q) ||
        a.driverPhone?.toLowerCase().includes(q) ||
        carrierName.toLowerCase().includes(q);

      const matchType = typeFilter === "all" || a.movementType === typeFilter;
      const matchDate = !dateFilter || (a.scheduledDate && new Date(a.scheduledDate).toISOString().slice(0, 10) === dateFilter);

      let matchTab = true;
      if (quickTab === "today") {
        matchTab = !!(a.scheduledDate && isSameDay(new Date(a.scheduledDate), today));
      } else if (quickTab === "late") {
        matchTab = getArrivalStatus(a) === "late";
      } else if (quickTab === "no_show") {
        matchTab = getArrivalStatus(a) === "no_show" || a.status === "no_show";
      } else if (quickTab === "confirmed") {
        matchTab = a.status === "confirmed";
      } else if (quickTab === "cancelled") {
        matchTab = a.status === "cancelled";
      }

      return matchSearch && matchType && matchDate && matchTab;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let valA: string | number = "";
        let valB: string | number = "";
        if (sortField === "scheduledDate") {
          valA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
          valB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
        } else if (sortField === "carrier") {
          valA = (a.carrierId ? carrierMap[a.carrierId] || "" : "").toLowerCase();
          valB = (b.carrierId ? carrierMap[b.carrierId] || "" : "").toLowerCase();
        } else if (sortField === "status") {
          valA = a.status.toLowerCase();
          valB = b.status.toLowerCase();
        }
        if (valA < valB) return sortDir === "asc" ? -1 : 1;
        if (valA > valB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      result = [...result].sort((a, b) => {
        const da = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
        const db = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
        return db - da;
      });
    }

    return result;
  }, [appointments, search, quickTab, typeFilter, dateFilter, sortField, sortDir, carrierMap, today]);

  const grouped = useMemo(() => {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const groups: { key: string; label: string; items: Appointment[]; isToday?: boolean; defaultOpen: boolean }[] = [
      { key: "today", label: "Today", items: [], isToday: true, defaultOpen: true },
      { key: "tomorrow", label: "Tomorrow", items: [], defaultOpen: true },
      { key: "this_week", label: "This Week", items: [], defaultOpen: true },
      { key: "later", label: "Upcoming", items: [], defaultOpen: false },
      { key: "past", label: "Past", items: [], defaultOpen: false },
    ];

    for (const a of filtered) {
      const d = a.scheduledDate ? new Date(a.scheduledDate) : null;
      if (!d) { groups[4].items.push(a); continue; }
      const dc = new Date(d);
      dc.setHours(0, 0, 0, 0);
      if (dc.getTime() === today.getTime()) groups[0].items.push(a);
      else if (dc.getTime() === tomorrow.getTime()) groups[1].items.push(a);
      else if (dc > today && dc <= weekEnd) groups[2].items.push(a);
      else if (dc > weekEnd) groups[3].items.push(a);
      else groups[4].items.push(a);
    }

    return groups.filter((g) => g.items.length > 0);
  }, [filtered, today]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />;
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      carrierId: fd.get("carrierId") ? Number(fd.get("carrierId")) : null,
      scheduledDate: new Date(fd.get("scheduledDate") as string).toISOString(),
      timeWindowStart: fd.get("timeWindowStart"),
      timeWindowEnd: fd.get("timeWindowEnd"),
      movementType: fd.get("movementType"),
      loadType: fd.get("loadType") || null,
      trailerNumber: fd.get("trailerNumber") || null,
      truckNumber: fd.get("truckNumber") || null,
      driverName: fd.get("driverName") || null,
      driverPhone: fd.get("driverPhone") || null,
      poNumber: fd.get("poNumber") || null,
      bolNumber: fd.get("bolNumber") || null,
      sealNumber: fd.get("sealNumber") || null,
      notes: fd.get("notes") || null,
      status: "booked",
      referenceNumber:
        (fd.get("referenceNumber") as string)?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") ||
        `APT-${Date.now().toString(36).toUpperCase()}`,
      carrierEta: fd.get("carrierEta") || null,
    });
  };

  const handleDragStart = useCallback((e: React.DragEvent, apt: CalendarAppointment) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(apt.id));
    setDraggingApt(apt);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, slotKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slotKey);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverSlot(null), []);

  const handleDrop = useCallback(
    (targetDate: Date, targetHour: number) => {
      setDragOverSlot(null);
      if (!draggingApt) return;
      if (draggingApt.status === "completed" || draggingApt.status === "cancelled") {
        toast({ title: "Cannot reschedule", description: "Completed or cancelled appointments cannot be moved.", variant: "destructive" });
        setDraggingApt(null);
        return;
      }
      const existingOnSlot = calAppointments.filter((a) => {
        if (a.id === draggingApt.id) return false;
        if (!a.scheduledDate || !isSameDay(new Date(a.scheduledDate), targetDate)) return false;
        const s = timeToMinutes(a.timeWindowStart);
        const end = timeToMinutes(a.timeWindowEnd);
        return targetHour * 60 >= s && targetHour * 60 < end;
      });
      if (existingOnSlot.length >= 4) {
        toast({ title: "Slot full", description: "This time slot already has too many appointments.", variant: "destructive" });
        setDraggingApt(null);
        return;
      }
      setConfirmDrop({ apt: draggingApt, newDate: targetDate, newHour: targetHour });
      setDraggingApt(null);
    },
    [draggingApt, calAppointments, toast]
  );

  const confirmReschedule = () => {
    if (!confirmDrop) return;
    const { apt, newDate, newHour } = confirmDrop;
    const duration = timeToMinutes(apt.timeWindowEnd) - timeToMinutes(apt.timeWindowStart);
    const newStart = minutesToTime(newHour * 60);
    const newEnd = minutesToTime(newHour * 60 + (duration > 0 ? duration : 60));
    rescheduleMutation.mutate({
      id: apt.id,
      scheduledDate: newDate.toISOString(),
      timeWindowStart: newStart,
      timeWindowEnd: newEnd,
      status: apt.status === "booked" ? "rescheduled" : apt.status,
    });
  };

  const navigateCalendar = (dir: number) => {
    const d = new Date(calDate);
    if (calLayout === "day") d.setDate(d.getDate() + dir);
    else if (calLayout === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCalDate(d);
  };

  const calendarTitle = useMemo(() => {
    if (calLayout === "day") return calDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (calLayout === "week") {
      const days = getWeekDays(calDate);
      const f = days[0];
      const l = days[6];
      if (f.getMonth() === l.getMonth()) return `${f.toLocaleDateString("en-US", { month: "long" })} ${f.getDate()}–${l.getDate()}, ${f.getFullYear()}`;
      return `${f.toLocaleDateString("en-US", { month: "short" })} ${f.getDate()} – ${l.toLocaleDateString("en-US", { month: "short" })} ${l.getDate()}, ${l.getFullYear()}`;
    }
    return calDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [calDate, calLayout]);

  const TABS: { key: QuickTab; label: string; count: number; color?: string }[] = [
    { key: "all", label: "All", count: kpiCounts.total },
    { key: "today", label: "Today", count: kpiCounts.todayCount },
    { key: "late", label: "Late", count: kpiCounts.lateCount, color: kpiCounts.lateCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined },
    { key: "no_show", label: "No Show", count: kpiCounts.noShowCount, color: kpiCounts.noShowCount > 0 ? "text-[#CC2229]" : undefined },
    { key: "confirmed", label: "Confirmed", count: kpiCounts.confirmedCount, color: "text-emerald-700 dark:text-emerald-400" },
    { key: "cancelled", label: "Cancelled", count: kpiCounts.cancelledCount },
  ];

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title={isCarrier ? `My Appointments${currentPersona?.carrierName ? ` — ${currentPersona.carrierName}` : ""}` : "Appointments"}
        subtitle={isCarrier ? "View your scheduled inbound and outbound trailer appointments" : "Manage inbound and outbound trailer schedules"}
        icon={<CalendarDays className="h-5 w-5" />}
        actions={
          !isCarrier ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-appointment">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Appointment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Schedule New Appointment</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="carrierId">Carrier</Label>
                      <Select name="carrierId" required>
                        <SelectTrigger id="carrierId"><SelectValue placeholder="Select Carrier" /></SelectTrigger>
                        <SelectContent>
                          {carriers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="movementType">Movement Type</Label>
                      <Select name="movementType" required defaultValue="inbound">
                        <SelectTrigger id="movementType"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inbound">Inbound</SelectItem>
                          <SelectItem value="outbound">Outbound</SelectItem>
                          <SelectItem value="empty_drop">Empty Drop</SelectItem>
                          <SelectItem value="loaded_arrival">Loaded Arrival</SelectItem>
                          <SelectItem value="live_load">Live Load</SelectItem>
                          <SelectItem value="live_unload">Live Unload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="scheduledDate">Date</Label>
                      <Input id="scheduledDate" name="scheduledDate" type="date" required data-testid="input-apt-date" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeWindowStart">Start Time</Label>
                      <Input id="timeWindowStart" name="timeWindowStart" type="time" required data-testid="input-apt-start" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeWindowEnd">End Time</Label>
                      <Input id="timeWindowEnd" name="timeWindowEnd" type="time" required data-testid="input-apt-end" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="trailerNumber">Trailer Number</Label>
                      <Input id="trailerNumber" name="trailerNumber" placeholder="TRL-1234" data-testid="input-apt-trailer" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="loadType">Load Type</Label>
                      <Input id="loadType" name="loadType" placeholder="Loaded/Empty" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="poNumber">PO Number</Label>
                      <Input id="poNumber" name="poNumber" placeholder="PO-123456" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bolNumber">BOL Number</Label>
                      <Input id="bolNumber" name="bolNumber" placeholder="BOL-7890" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">
                      Appointment # <span className="text-muted-foreground text-xs font-normal">(optional — auto-generated if blank)</span>
                    </Label>
                    <Input
                      id="referenceNumber"
                      name="referenceNumber"
                      placeholder="APT-XXXXX"
                      maxLength={20}
                      pattern="[A-Za-z0-9-]*"
                      data-testid="input-apt-reference"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="driverName">Driver Name</Label>
                      <Input id="driverName" name="driverName" placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driverPhone">Driver Phone</Label>
                      <Input id="driverPhone" name="driverPhone" placeholder="555-0123" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carrierEta">Carrier ETA <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
                    <Input id="carrierEta" name="carrierEta" type="time" placeholder="HH:MM" data-testid="input-apt-carrier-eta" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" name="notes" placeholder="Additional details..." />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-appointment">
                      {createMutation.isPending ? "Scheduling..." : "Schedule Appointment"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {/* KPI Strip */}
      {!isCarrier && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { tab: "today" as QuickTab, label: "Today", value: kpiCounts.todayCount, icon: <Clock className="h-4 w-4" />, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
            { tab: "late" as QuickTab, label: "Late", value: kpiCounts.lateCount, icon: <AlertTriangle className="h-4 w-4" />, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30" },
            { tab: "no_show" as QuickTab, label: "No Show", value: kpiCounts.noShowCount, icon: <XCircle className="h-4 w-4" />, color: "text-[#CC2229]", bg: "bg-red-50 dark:bg-red-950/30" },
            { tab: "confirmed" as QuickTab, label: "Confirmed", value: kpiCounts.confirmedCount, icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { tab: "cancelled" as QuickTab, label: "Cancelled", value: kpiCounts.cancelledCount, icon: <XCircle className="h-4 w-4" />, color: "text-gray-500", bg: "bg-muted/50" },
          ].map(({ tab, label, value, icon, color, bg }) => (
            <button
              key={tab}
              onClick={() => setQuickTab(tab)}
              className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                quickTab === tab ? "ring-2 ring-primary border-primary shadow-sm" : "border-border"
              } ${bg}`}
            >
              <div className={`flex items-center gap-1.5 mb-1.5 ${color}`}>
                {icon}
                <span className="text-xs font-medium">{label}</span>
              </div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </button>
          ))}
        </div>
      )}

      {/* AI Scheduling Assistant (Assist/Optimize mode only) */}
      {aiEnabled && !isCarrier && (
        <AppointmentsAssistPanel appointments={appointments} />
      )}

      {/* Quick filter tabs + secondary filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-1 border-b">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setQuickTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                quickTab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  quickTab === t.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                } ${t.color && quickTab !== t.key ? t.color : ""}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <FilterToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search carrier, trailer, driver, PO..."
          suggestions={suggestions}
          actions={
            <div className="flex items-center bg-muted/50 p-1 rounded-lg border">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => handleViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="h-3.5 w-3.5 mr-1.5" />
                List
              </Button>
              <Button
                variant={viewMode === "calendar" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => handleViewMode("calendar")}
                data-testid="button-view-calendar"
              >
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Calendar
              </Button>
            </div>
          }
          filters={
            <>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="All Types" />
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
              <Input
                type="date"
                className="w-[150px] h-9"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                data-testid="input-filter-date"
              />
            </>
          }
          filterChips={[
            ...(quickTab !== "all" ? [{ label: `Tab: ${TABS.find((t) => t.key === quickTab)?.label}`, value: "tab", onRemove: () => setQuickTab("all") }] : []),
            ...(typeFilter !== "all" ? [{ label: `Type: ${formatStatus(typeFilter)}`, value: "type", onRemove: () => setTypeFilter("all") }] : []),
            ...(dateFilter ? [{ label: `Date: ${dateFilter}`, value: "date", onRemove: () => setDateFilter("") }] : []),
          ]}
          onClearAll={() => { setQuickTab("all"); setTypeFilter("all"); setDateFilter(""); setSearch(""); }}
        />
      </div>

      {/* List or Calendar */}
      {viewMode === "list" ? (
        <div className="space-y-3">
          {isLoading ? (
            <div className="rounded-lg border bg-card overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              heading="No appointments found"
              description="No appointments match your current filters or search. Try adjusting the date range, status, or search term."
            />
          ) : (
            grouped.map((group) => (
              <DateGroupSection
                key={group.key}
                label={group.label}
                count={group.items.length}
                defaultOpen={group.defaultOpen}
                isToday={group.isToday}
              >
                {group.items.map((apt) => (
                  <AptRow
                    key={apt.id}
                    apt={apt}
                    carrierName={apt.carrierId ? (carrierMap[apt.carrierId] || "Unknown") : "Walk-in"}
                    onSelect={() => setSelectedAptId(apt.id)}
                    onQuickAction={(id, status) => updateStatusMutation.mutate({ id, status })}
                    isPending={updateStatusMutation.isPending}
                  />
                ))}
              </DateGroupSection>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {calendarTitle}
              </h3>
              <div className="flex items-center bg-muted p-0.5 rounded-md border">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateCalendar(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs font-medium" onClick={() => setCalDate(new Date())}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateCalendar(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CalendarLegend />
              <div className="flex items-center bg-muted/50 p-1 rounded-lg border">
                {(["day", "week", "month"] as CalendarLayout[]).map((layout) => (
                  <Button
                    key={layout}
                    variant={calLayout === layout ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 px-3 text-xs capitalize"
                    onClick={() => setCalLayout(layout)}
                  >
                    {layout}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {calLayout === "day" && (
            <DayView
              date={calDate}
              appointments={calAppointments}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              dragOverSlot={dragOverSlot}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            />
          )}
          {calLayout === "week" && (
            <WeekView
              date={calDate}
              appointments={calAppointments}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              dragOverSlot={dragOverSlot}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            />
          )}
          {calLayout === "month" && (
            <MonthView
              date={calDate}
              appointments={calAppointments}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              dragOverSlot={dragOverSlot}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            />
          )}
        </div>
      )}

      {/* Reschedule Confirmation Dialog */}
      <Dialog open={!!confirmDrop} onOpenChange={(o) => !o && setConfirmDrop(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Reschedule</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Reschedule appointment <span className="font-semibold text-foreground">{confirmDrop?.apt.referenceNumber}</span>?
            </p>
            <div className="bg-muted/50 p-3 rounded-md border text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carrier:</span>
                <span className="font-medium">{confirmDrop?.apt.carrierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Date:</span>
                <span className="font-medium">{confirmDrop?.newDate.toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Time:</span>
                <span className="font-medium">{confirmDrop && minutesToTime(confirmDrop.newHour * 60)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDrop(null)}>Cancel</Button>
            <Button onClick={confirmReschedule} disabled={rescheduleMutation.isPending}>
              {rescheduleMutation.isPending ? "Updating..." : "Confirm Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedApt}
        onOpenChange={(open) => !open && setSelectedAptId(null)}
        title={`Appointment: ${selectedApt?.referenceNumber}`}
        subtitle={`${selectedApt?.carrierId ? carrierMap[selectedApt.carrierId] : "Walk-in"} • ${selectedApt?.movementType.toUpperCase()}`}
      >
        {conflictAlert && (
          <Alert variant="destructive" className="mb-6 bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>{conflictAlert}</AlertDescription>
          </Alert>
        )}

        <DrawerSection title="Arrival Status">
          <div className="flex items-center gap-3">
            <Badge className={arrivalStatusColor(getArrivalStatus(selectedApt!))}>
              {formatArrivalStatus(getArrivalStatus(selectedApt!))}
            </Badge>
            <StatusChip
              status={selectedApt?.status || ""}
              colorFn={(s: string) => {
                const colors: Record<string, string> = {
                  booked: "bg-blue-100 text-blue-800",
                  confirmed: "bg-emerald-100 text-emerald-800",
                  rescheduled: "bg-amber-100 text-amber-800",
                  cancelled: "bg-red-100 text-red-800",
                  completed: "bg-gray-100 text-gray-800",
                  no_show: "bg-orange-100 text-orange-800",
                };
                return colors[s] || "bg-gray-100 text-gray-700";
              }}
            />
          </div>
        </DrawerSection>

        <DrawerSection title="Quick Actions">
          <div className="flex gap-2 flex-wrap">
            {(selectedApt?.status === "booked" || selectedApt?.status === "rescheduled") && (
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={() => { updateStatusMutation.mutate({ id: selectedApt!.id, status: "confirmed" }); setSelectedAptId(null); }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Confirm
              </Button>
            )}
            {(selectedApt?.status === "confirmed" || selectedApt?.status === "booked") && (
              <Button
                size="sm"
                variant="outline"
                className="text-blue-700 border-blue-300 hover:bg-blue-50"
                onClick={() => { updateStatusMutation.mutate({ id: selectedApt!.id, status: "checked_in" }); setSelectedAptId(null); }}
              >
                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                Check In
              </Button>
            )}
            {selectedApt?.status !== "cancelled" && selectedApt?.status !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => { updateStatusMutation.mutate({ id: selectedApt!.id, status: "cancelled" }); setSelectedAptId(null); }}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Cancel
              </Button>
            )}
          </div>
        </DrawerSection>

        <DrawerSection title="Schedule Details">
          <div className="grid grid-cols-2 gap-4">
            <DrawerField label="Date" value={selectedApt?.scheduledDate ? new Date(selectedApt.scheduledDate).toLocaleDateString() : "N/A"} />
            <DrawerField label="Time Window" value={`${selectedApt?.timeWindowStart} – ${selectedApt?.timeWindowEnd}`} />
            {(selectedApt as any)?.carrierEta && <DrawerField label="Carrier ETA" value={(selectedApt as any).carrierEta} />}
          </div>
        </DrawerSection>

        <DrawerSection title="Equipment & Driver">
          <div className="grid grid-cols-2 gap-4">
            <DrawerField label="Trailer #" value={selectedApt?.trailerNumber} />
            <DrawerField label="Truck #" value={selectedApt?.truckNumber} />
            <DrawerField label="Driver Name" value={selectedApt?.driverName} />
            <DrawerField label="Driver Phone" value={selectedApt?.driverPhone} />
          </div>
        </DrawerSection>

        <DrawerSection title="Reference Info">
          <div className="grid grid-cols-2 gap-4">
            <DrawerField label="PO Number" value={selectedApt?.poNumber} />
            <DrawerField label="BOL Number" value={selectedApt?.bolNumber} />
            <DrawerField label="Seal Number" value={selectedApt?.sealNumber} />
            <DrawerField label="Movement" value={selectedApt?.movementType.toUpperCase()} />
          </div>
        </DrawerSection>

        {selectedApt?.notes && (
          <DrawerSection title="Notes">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedApt.notes}</p>
          </DrawerSection>
        )}

        <div className="mt-8">
          <Button variant="outline" className="w-full" onClick={() => setSelectedAptId(null)}>Close</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
