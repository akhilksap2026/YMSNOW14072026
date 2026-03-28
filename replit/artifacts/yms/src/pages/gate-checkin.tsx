import { useState, useMemo, useEffect } from "react";
import { useTabletView } from "@/lib/tablet-view";
import { SearchAutocomplete } from "@/components/enterprise/search-autocomplete";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusChip, KPICard } from "@/components/enterprise";
import { appointmentStatusColor } from "@/lib/status-colors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  LogIn,
  CheckCircle2,
  Truck,
  UserCheck,
  Camera,
  MapPin,
  FileCheck,
  QrCode,
  UserPlus,
  Clock,
  AlertTriangle,
  Shield,
  FileSearch,
  ArrowRight,
  PauseCircle,
  Lock,
  AlertOctagon,
  LogOut,
  Zap,
  PackagePlus,
} from "lucide-react";
import { useLocation } from "wouter";
import { playCheckIn } from "@/lib/audio-feedback";
import { getCurrentRole } from "@/lib/queryClient";
import type { Appointment, Carrier } from "@shared/schema";

const GUARD_AUTO_KEY = "ymsnow_guard_auto_activated";

interface GateStats {
  expectedToday: number;
  checkedInToday: number;
  walkInsToday: number;
  exceptionsToday: number;
}

interface ExpectedTruck {
  id: number;
  referenceNumber: string;
  carrierName: string;
  trailerNumber: string | null;
  movementType: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  driverName: string | null;
  status: string;
  gateStatus: string;
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isAppointmentLate(apt: Appointment | null): boolean {
  if (!apt) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [endH, endM] = (apt.timeWindowEnd || "23:59").split(":").map(Number);
  const endMinutes = endH * 60 + endM;
  const scheduledDate = apt.scheduledDate ? new Date(apt.scheduledDate as any) : null;
  const today = new Date();
  const isToday = !!scheduledDate &&
    scheduledDate.getFullYear() === today.getFullYear() &&
    scheduledDate.getMonth() === today.getMonth() &&
    scheduledDate.getDate() === today.getDate();
  const isPast = !!scheduledDate && scheduledDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (isPast || (isToday && nowMinutes > endMinutes)) && apt.status !== "cancelled" && apt.status !== "completed";
}

const PROCESS_STEPS = [
  { icon: Search,    label: "Find Visit",       short: "Search",  tip: "Search for an appointment by reference #, trailer #, or driver name" },
  { icon: UserCheck, label: "Verify Driver",     short: "Verify",  tip: "Confirm driver identity and vehicle details against the appointment" },
  { icon: Camera,    label: "Photos / Seal",     short: "Capture", tip: "Record seal number, load type, and hazmat status" },
  { icon: MapPin,    label: "Assign or Hold",    short: "Assign",  tip: "Assign the trailer to a yard slot or place a hold" },
  { icon: FileCheck, label: "Gate Pass",         short: "Pass",    tip: "Check-in is complete — print gate pass and dispatch move tasks" },
];

// ─── Tooltip wrapper helper ───────────────────────────────────────────────────
function Tip({ text, children }: { text: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-[220px]">{text}</TooltipContent>
    </Tooltip>
  );
}

export default function GateCheckInPage() {
  const { toast } = useToast();
  const { tabletMode } = useTabletView();
  const [location, setLocation] = useLocation();
  const [fastLane, setFastLane] = useState(false);

  useEffect(() => {
    const role = getCurrentRole();
    if (role === "gate_guard" && !sessionStorage.getItem(GUARD_AUTO_KEY)) {
      sessionStorage.setItem(GUARD_AUTO_KEY, "1");
      setLocation("/gate/guard-mode");
    }
  }, []);

  const [step, setStep] = useState<"search" | "confirm" | "verify" | "form" | "done">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);
  const [listFilter, setListFilter] = useState<"all" | "pending" | "late" | "checked_in">("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [createdVisitNumber, setCreatedVisitNumber] = useState("");
  const [createdVisitId, setCreatedVisitId] = useState<number | null>(null);
  const [createdVisitTrailer, setCreatedVisitTrailer] = useState("");
  const [assignedSlotInfo, setAssignedSlotInfo] = useState<{ id: number; number: string } | null>(null);
  const [createdVisitCarrier, setCreatedVisitCarrier] = useState("");
  const [createdDriverName, setCreatedDriverName] = useState("");
  const [createdTruckNumber, setCreatedTruckNumber] = useState("");
  const [createdMovementType, setCreatedMovementType] = useState("");
  const [activeProcessStep, setActiveProcessStep] = useState(0);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [showHoldPicker, setShowHoldPicker] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{ exists: boolean; visitId?: number } | null>(null);
  const [hazmat, setHazmat] = useState(false);
  const [verifiedDriverName, setVerifiedDriverName] = useState("");
  const [verifiedDriverLicense, setVerifiedDriverLicense] = useState("");
  const [verifiedTruckNumber, setVerifiedTruckNumber] = useState("");
  const [verifiedTrailerNumber, setVerifiedTrailerNumber] = useState("");
  const [discrepancies, setDiscrepancies] = useState<Array<{ field: string; expected: string; actual: string }>>([]);

  const checkDuplicateMutation = useMutation({
    mutationFn: async (trailerNumber: string) => {
      const res = await apiRequest("GET", `/api/gate/check-duplicate?trailerNumber=${encodeURIComponent(trailerNumber)}`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.exists) setDuplicateCheck(data);
      else setDuplicateCheck({ exists: false });
    }
  });

  const { data: carriers = [] } = useQuery<Carrier[]>({ queryKey: ["/api/carriers"] });

  const { data: gateStats } = useQuery<GateStats>({
    queryKey: ["/api/gate/stats"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: expectedTrucks = [] } = useQuery<ExpectedTruck[]>({
    queryKey: ["/api/gate/expected-trucks"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: availableSlots = [] } = useQuery<any[]>({
    queryKey: ["/api/yard/available-slots"],
    enabled: showSlotPicker,
  });

  const assignSlotMutation = useMutation({
    mutationFn: async (slotId: number) => {
      await apiRequest("POST", "/api/yard/assign-slot", { visitId: createdVisitId, slotId });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Slot assigned successfully" });
      setShowSlotPicker(false);
    },
    onError: (err: Error) => {
      setAssignedSlotInfo(null);
      toast({ title: "Failed to assign slot", description: err.message, variant: "destructive" });
    },
  });

  const createMoveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/moves", {
        visitId: createdVisitId,
        moveType: "gate_to_slot",
        fromLocationType: "gate",
        toLocationType: "slot",
        source: "system",
      });
    },
    onSuccess: () => {
      invalidateAll();
      toast({
        title: "Move task created",
        description: "A jockey has been notified to move this trailer.",
        action: (
          <Button variant="outline" size="sm" onClick={() => setLocation("/move-tasks")}>
            View Moves
          </Button>
        ),
      });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create move", description: err.message, variant: "destructive" });
    },
  });

  const placeHoldMutation = useMutation({
    mutationFn: async (holdStatus: string) => {
      await apiRequest("PATCH", `/api/visits/${createdVisitId}/status`, { holdStatus });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Hold placed successfully" });
      setShowHoldPicker(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to place hold", description: err.message, variant: "destructive" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("GET", `/api/appointments/search?q=${encodeURIComponent(q)}`);
      return res.json();
    },
  });

  const createExceptionMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/exceptions", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({
        title: "Discrepancy flagged for supervisor",
        description: "A manual modification exception has been raised and is pending approval.",
      });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/gate/check-in", data);
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      setCreatedVisitNumber(data.visitNumber || "");
      setCreatedVisitId(data.id || null);
      setCreatedVisitTrailer(data.trailerNumber || "");
      const carrierName = carriers.find(c => c.id === data.carrierId)?.name || "Unknown";
      setCreatedVisitCarrier(carrierName);
      setCreatedDriverName(data.driverName || "");
      setCreatedTruckNumber(data.truckNumber || "");
      setCreatedMovementType(data.movementType || "inbound");
      setStep("done");
      setActiveProcessStep(4);
      playCheckIn();
      toast({ title: "Check-in complete" });
      if (discrepancies.length > 0 && data.id) {
        const fieldList = discrepancies.map((d) => `${d.field}: expected "${d.expected}", got "${d.actual}"`).join("; ");
        createExceptionMutation.mutate({
          visitId: data.id,
          type: "manual_modification",
          severity: discrepancies.some((d) => d.field === "Trailer Number") ? "high" : "medium",
          description: `Gate guard modified appointment data during check-in. Changes: ${fieldList}`,
        });
      }
      if (isAppointmentLate(selectedAppointment) && data.id) {
        const window = selectedAppointment ? `${selectedAppointment.timeWindowStart}–${selectedAppointment.timeWindowEnd}` : "N/A";
        createExceptionMutation.mutate({
          visitId: data.id,
          type: "late_arrival",
          severity: "medium",
          description: `Truck arrived after scheduled time window (${window}). Checked in late — requires supervisor review.`,
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    },
  });

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    expectedTrucks.forEach((t) => {
      if (t.referenceNumber) set.add(t.referenceNumber);
      if (t.trailerNumber) set.add(t.trailerNumber);
      if (t.driverName) set.add(t.driverName);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [expectedTrucks]);

  const handleSearch = () => {
    if (searchQuery.trim()) searchMutation.mutate(searchQuery);
  };

  const handleSelectAppointment = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setStep("confirm");
    setActiveProcessStep(1);
  };

  const handleSelectExpected = (truck: ExpectedTruck) => {
    setSelectedTruckId(truck.id);
    setSearchQuery(truck.referenceNumber);
    searchMutation.mutate(truck.referenceNumber, {
      onSuccess: (apts) => {
        if (Array.isArray(apts) && apts.length === 1) handleSelectAppointment(apts[0]);
      },
    });
  };

  const handleWalkIn = () => {
    setSelectedAppointment(null);
    setVerifiedDriverName("");
    setVerifiedDriverLicense("");
    setVerifiedTruckNumber("");
    setVerifiedTrailerNumber("");
    setDiscrepancies([]);
    setStep("verify");
    setActiveProcessStep(1);
  };

  const handleConfirmProceed = () => {
    setVerifiedDriverName(selectedAppointment?.driverName || "");
    setVerifiedDriverLicense("");
    setVerifiedTruckNumber(selectedAppointment?.truckNumber || "");
    setVerifiedTrailerNumber(selectedAppointment?.trailerNumber || "");
    setDiscrepancies([]);
    setStep("verify");
    setActiveProcessStep(2);
  };

  const handleVerifyProceed = () => {
    if (selectedAppointment) {
      const found: Array<{ field: string; expected: string; actual: string }> = [];
      const apt = selectedAppointment;
      if (apt.driverName && verifiedDriverName.trim() && verifiedDriverName.trim() !== apt.driverName.trim())
        found.push({ field: "Driver Name", expected: apt.driverName, actual: verifiedDriverName.trim() });
      if (apt.truckNumber && verifiedTruckNumber.trim() && verifiedTruckNumber.trim() !== apt.truckNumber.trim())
        found.push({ field: "Truck Number", expected: apt.truckNumber, actual: verifiedTruckNumber.trim() });
      if (apt.trailerNumber && verifiedTrailerNumber.trim() && verifiedTrailerNumber.trim() !== apt.trailerNumber.trim())
        found.push({ field: "Trailer Number", expected: apt.trailerNumber, actual: verifiedTrailerNumber.trim() });
      setDiscrepancies(found);
    }
    setStep("form");
    setActiveProcessStep(3);
  };

  const handleCheckIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    checkInMutation.mutate({
      appointmentId: selectedAppointment?.id || null,
      carrierId: fd.get("carrierId") ? Number(fd.get("carrierId")) : selectedAppointment?.carrierId || null,
      driverName: fd.get("driverName"),
      driverLicense: fd.get("driverLicense"),
      truckNumber: fd.get("truckNumber"),
      trailerNumber: fd.get("trailerNumber"),
      sealNumber: fd.get("sealNumber") || null,
      movementType: fd.get("movementType"),
      hazmat,
      notes: fd.get("notes") || null,
    });
  };

  const handlePrintGatePass = () => {
    const movLabel = (createdMovementType || "inbound").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const win = window.open("", "_blank", "width=700,height=520");
    if (!win) return;
    win.document.write(`<html><head><title>Gate Pass — ${createdVisitNumber}</title><style>
      body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:580px;margin:0 auto}
      .header{text-align:center;border-bottom:3px solid #111;padding-bottom:16px;margin-bottom:24px}
      .logo{font-size:28px;font-weight:900;letter-spacing:2px}
      .sub{font-size:12px;color:#777;margin-top:4px}
      .badge{display:inline-block;background:#111;color:#fff;padding:6px 20px;border-radius:4px;font-size:24px;font-weight:bold;letter-spacing:3px;margin:14px 0}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 32px;margin:20px 0}
      .field label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;display:block}
      .field span{font-size:15px;font-weight:600}
      .footer{border-top:1px solid #ccc;margin-top:24px;padding-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:32px}
      .sig-line{border-top:1px solid #555;margin-top:32px;padding-top:4px;font-size:10px;color:#999}
      .notice{text-align:center;font-size:10px;color:#aaa;margin-top:20px;border-top:1px dotted #ddd;padding-top:10px}
      @media print{body{margin:0}}
    </style></head><body>
      <div class="header">
        <div class="logo">YMSNOW</div>
        <div class="sub">Yard Management System — Official Gate Pass</div>
        <div class="badge">${createdVisitNumber}</div>
      </div>
      <div class="grid">
        <div class="field"><label>Carrier</label><span>${createdVisitCarrier}</span></div>
        <div class="field"><label>Driver Name</label><span>${createdDriverName || "—"}</span></div>
        <div class="field"><label>Trailer Number</label><span>${createdVisitTrailer || "—"}</span></div>
        <div class="field"><label>Truck / Tractor</label><span>${createdTruckNumber || "—"}</span></div>
        <div class="field"><label>Movement Type</label><span>${movLabel}</span></div>
        <div class="field"><label>Check-In Time</label><span>${new Date().toLocaleString()}</span></div>
      </div>
      <div class="footer">
        <div><div class="sig-line">Gate Guard Signature</div></div>
        <div><div class="sig-line">Driver Signature</div></div>
      </div>
      <div class="notice">This pass is valid for one (1) entry. Keep with you at all times while on premises.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleReset = () => {
    setStep("search");
    setSearchQuery("");
    setSelectedAppointment(null);
    setSelectedTruckId(null);
    setCreatedVisitNumber("");
    setCreatedVisitId(null);
    setCreatedVisitTrailer("");
    setCreatedVisitCarrier("");
    setCreatedDriverName("");
    setCreatedTruckNumber("");
    setCreatedMovementType("");
    setShowSlotPicker(false);
    setShowHoldPicker(false);
    setActiveProcessStep(0);
    setVerifiedDriverName("");
    setVerifiedDriverLicense("");
    setVerifiedTruckNumber("");
    setVerifiedTrailerNumber("");
    setDiscrepancies([]);
    setHazmat(false);
    searchMutation.reset();
  };

  const stats = gateStats || { expectedToday: 0, checkedInToday: 0, walkInsToday: 0, exceptionsToday: 0 };

  const filteredTrucks = useMemo(() => {
    if (listFilter === "all") return expectedTrucks;
    if (listFilter === "checked_in") return expectedTrucks.filter((t) => t.gateStatus === "Checked In");
    if (listFilter === "late") return expectedTrucks.filter((t) => t.gateStatus === "Late");
    if (listFilter === "pending") return expectedTrucks.filter((t) => t.gateStatus !== "Checked In" && t.gateStatus !== "Cancelled");
    return expectedTrucks;
  }, [expectedTrucks, listFilter]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b bg-background">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <LogIn className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Gate Check-In</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Process inbound trucks, verify drivers, and issue gate passes</p>
            </div>
          </div>

          {/* Secondary controls — right side */}
          <div className="flex items-center gap-2 shrink-0">
            <Tip text="Fast Lane skips verification steps — select from expected arrivals for instant check-in">
              <Button
                variant={fastLane ? "default" : "outline"}
                size="sm"
                className={`h-9 gap-2 text-sm font-medium ${fastLane ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : ""}`}
                onClick={() => setFastLane(v => !v)}
                data-testid="button-fast-lane"
              >
                <Zap className="h-4 w-4" />
                Fast Lane {fastLane ? "ON" : "OFF"}
              </Button>
            </Tip>
            <Tip text="Switch to full-screen Guard Mode optimized for gate check-in stations">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 text-sm font-medium"
                onClick={() => setLocation("/gate/guard-mode")}
                data-testid="button-guard-mode"
              >
                <Shield className="h-4 w-4" />
                Guard Mode
              </Button>
            </Tip>
            <div className="h-4 w-px bg-border" />
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-1 rounded-full" data-testid="status-gate-active">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Gate Active
            </span>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tip text="Total appointments scheduled for arrival today">
            <div>
              <KPICard label="Expected Today" value={stats.expectedToday} icon={<Clock className="h-4 w-4 text-blue-500" />} data-testid="kpi-expected-today" />
            </div>
          </Tip>
          <Tip text="Appointments that have successfully completed check-in today">
            <div>
              <KPICard label="Checked In" value={stats.checkedInToday} icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} data-testid="kpi-checked-in-today" />
            </div>
          </Tip>
          <Tip text="Unscheduled arrivals processed as walk-ins today">
            <div>
              <KPICard label="Walk-Ins" value={stats.walkInsToday} icon={<UserPlus className="h-4 w-4 text-amber-500" />} data-testid="kpi-walk-ins-today" />
            </div>
          </Tip>
          <Tip text="Exceptions raised today (late arrivals, discrepancies, holds)">
            <div>
              <KPICard
                label="Exceptions"
                value={stats.exceptionsToday}
                icon={<AlertTriangle className={`h-4 w-4 ${stats.exceptionsToday > 0 ? "text-red-500" : "text-muted-foreground"}`} />}
                accent={stats.exceptionsToday > 0 ? "border-l-red-500" : undefined}
                data-testid="kpi-exceptions-today"
              />
            </div>
          </Tip>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center px-6 border-b bg-background shrink-0">
        <button
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            location === "/gate/check-in"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setLocation("/gate/check-in")}
          data-testid="tab-checkin"
        >
          <LogIn className="h-3.5 w-3.5" />
          Check-In
          {stats.expectedToday > 0 && (
            <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{stats.expectedToday}</span>
          )}
        </button>
        <button
          className="flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors -mb-px"
          onClick={() => setLocation("/gate/check-out")}
          data-testid="tab-checkout"
        >
          <LogOut className="h-3.5 w-3.5" />
          Check-Out
          {stats.checkedInToday > 0 && (
            <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{stats.checkedInToday}</span>
          )}
        </button>
      </div>

      {/* ── Main body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">

          {/* Fast Lane banner */}
          {fastLane && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50">
              <Zap className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Fast Lane Mode Active</p>
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">Skip verification steps — click any expected arrival below to instantly check them in</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-amber-700 hover:text-amber-900" onClick={() => setFastLane(false)}>
                Disable
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            {/* ── LEFT: process flow ─────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Progress stepper */}
              <div className="flex items-center gap-1.5 bg-muted/40 rounded-xl p-2">
                {PROCESS_STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 flex-1">
                    <Tip text={s.tip}>
                      <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center cursor-default ${
                        i < activeProcessStep
                          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                          : i === activeProcessStep
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground"
                      }`}>
                        {i < activeProcessStep ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <s.icon className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <span className="hidden sm:inline">{s.label}</span>
                        <span className="sm:hidden">{s.short}</span>
                      </div>
                    </Tip>
                    {i < PROCESS_STEPS.length - 1 && (
                      <div className={`w-3 h-0.5 rounded-full shrink-0 ${i < activeProcessStep ? "bg-green-400" : "bg-border"}`} />
                    )}
                  </div>
                ))}
              </div>

              {/* ── STEP: search ────────────────────────────────────────────── */}
              {step === "search" && (
                <div className="space-y-4">
                  <Card className="shadow-sm">
                    <CardContent className="p-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Search for an appointment</p>

                      {/* Primary search row */}
                      <div className="flex gap-3 mb-4">
                        <Tip text="Search by appointment reference number, trailer number, truck number, or driver name">
                          <div className="flex-1">
                            <SearchAutocomplete
                              value={searchQuery}
                              onChange={setSearchQuery}
                              onSelect={(v) => { setSearchQuery(v); searchMutation.mutate(v); }}
                              suggestions={suggestions}
                              placeholder="Appointment #, trailer #, or driver name..."
                              className="w-full"
                              inputClassName="h-13 text-base pl-11"
                              data-testid="input-search-checkin"
                            />
                          </div>
                        </Tip>
                        <Tip text="Search the database for appointments matching your query">
                          <Button
                            onClick={handleSearch}
                            disabled={searchMutation.isPending}
                            className="h-13 px-7 text-base font-semibold gap-2 shadow-sm"
                            data-testid="button-search"
                          >
                            <Search className="h-5 w-5" />
                            Search
                          </Button>
                        </Tip>
                      </div>

                      {/* Divider */}
                      <div className="relative flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground font-medium">OR</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>

                      {/* Walk-in primary action */}
                      <Tip text="Create a walk-in check-in for a truck that does not have a scheduled appointment">
                        <Button
                          variant="outline"
                          onClick={handleWalkIn}
                          className="w-full h-12 text-sm font-semibold gap-2.5 border-2 hover:border-primary/50 hover:bg-primary/5"
                          data-testid="button-walk-in"
                        >
                          <UserPlus className="h-5 w-5 text-primary" />
                          Unscheduled Arrival (Walk-In)
                        </Button>
                      </Tip>
                    </CardContent>
                  </Card>

                  {/* Search results */}
                  {searchMutation.data && (
                    <Card className="shadow-sm">
                      <CardHeader className="px-5 py-3 border-b">
                        <CardTitle className="text-sm font-semibold">
                          Search Results
                          <span className="ml-2 text-muted-foreground font-normal">
                            {(searchMutation.data as Appointment[]).length} found
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 space-y-2">
                        {(searchMutation.data as Appointment[]).length === 0 ? (
                          <div className="text-center py-8">
                            <Truck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">No matching appointments</p>
                            <p className="text-xs text-muted-foreground mt-1 mb-4">This truck may not have an appointment on record</p>
                            <Tip text="Create a walk-in entry for this truck without a scheduled appointment">
                              <Button variant="outline" className="gap-2" onClick={handleWalkIn} data-testid="button-walk-in-fallback">
                                <UserPlus className="h-4 w-4" /> Create Walk-In Entry
                              </Button>
                            </Tip>
                          </div>
                        ) : (
                          (searchMutation.data as Appointment[]).map((apt) => (
                            <div
                              key={apt.id}
                              className="flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                              onClick={() => handleSelectAppointment(apt)}
                              data-testid={`row-search-result-${apt.id}`}
                            >
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Truck className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-bold text-sm">{apt.referenceNumber}</span>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${apt.movementType === "outbound" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                                    {apt.movementType === "outbound" ? "OUT" : "IN"}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {apt.trailerNumber || "No trailer"}{apt.driverName ? ` · ${apt.driverName}` : ""}
                                </p>
                              </div>
                              <Tip text="Select this appointment to begin the check-in process">
                                <Button size="sm" className="gap-1.5 shrink-0" data-testid={`button-select-apt-${apt.id}`}>
                                  Select <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              </Tip>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* ── STEP: confirm ─────────────────────────────────────────── */}
              {step === "confirm" && selectedAppointment && (
                <Card className="shadow-sm">
                  <CardHeader className="px-6 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold">Appointment Confirmation</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Review these details before proceeding to driver verification</p>
                      </div>
                      <Badge variant="secondary" className="font-mono text-sm px-3 py-1">{selectedAppointment.referenceNumber}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    {isAppointmentLate(selectedAppointment) && (
                      <div className="flex items-start gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4" data-testid="banner-late-arrival">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm text-amber-800 dark:text-amber-300">Late Arrival</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                            This appointment missed its scheduled window ({selectedAppointment.timeWindowStart}–{selectedAppointment.timeWindowEnd}). Check-in will proceed but a Late Arrival exception will be automatically created for supervisor review.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className={`grid gap-4 ${tabletMode ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                      {[
                        { label: "Carrier", value: carriers.find((c) => c.id === selectedAppointment.carrierId)?.name || "Unknown" },
                        { label: "Trailer", value: selectedAppointment.trailerNumber || "TBD" },
                        { label: "Truck", value: selectedAppointment.truckNumber || "TBD" },
                        { label: "Driver", value: selectedAppointment.driverName || "TBD" },
                        { label: "Visit Type", value: formatStatus(selectedAppointment.movementType) },
                        { label: "Time Window", value: `${selectedAppointment.timeWindowStart} – ${selectedAppointment.timeWindowEnd}` },
                        ...(selectedAppointment.sealNumber ? [{ label: "Seal #", value: selectedAppointment.sealNumber }] : []),
                      ].map(({ label, value }) => (
                        <div key={label} className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
                          <p className="text-sm font-semibold">{value}</p>
                        </div>
                      ))}
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
                        <StatusChip status={selectedAppointment.status} colorFn={appointmentStatusColor} size="sm" />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2 border-t">
                      <Tip text="Go back to the search step">
                        <Button variant="outline" onClick={handleReset} data-testid="button-back-confirm" className="px-8">Back</Button>
                      </Tip>
                      <Tip text="Proceed to verify the driver's identity and vehicle details against this appointment">
                        <Button onClick={handleConfirmProceed} className="flex-1 h-12 text-base font-semibold gap-2" data-testid="button-proceed-verify">
                          <UserCheck className="h-5 w-5" /> Verify Driver & Vehicle
                        </Button>
                      </Tip>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── STEP: verify ─────────────────────────────────────────── */}
              {step === "verify" && (
                <Card className="shadow-sm">
                  <CardHeader className="px-5 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-base font-bold">Driver & Vehicle Verification</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">Confirm all details match what the driver presents at the gate</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedAppointment ? (
                          <Badge variant="secondary" className="font-mono">{selectedAppointment.referenceNumber}</Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Walk-In</Badge>
                        )}
                        {duplicateCheck?.exists && (
                          <Badge variant="destructive" className="animate-pulse">ALREADY CHECKED IN</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    {duplicateCheck?.exists && (
                      <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 dark:bg-red-950/30 dark:border-red-800 flex gap-3 items-start">
                        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="space-y-2">
                          <p className="text-sm font-bold text-red-700 dark:text-red-400">This trailer is already checked in.</p>
                          <Button size="sm" variant="destructive" onClick={() => setLocation(`/yard-inventory?id=${duplicateCheck.visitId}`)} className="h-8 gap-1.5">
                            Open existing visit <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className={`grid gap-4 ${tabletMode ? "grid-cols-1" : "grid-cols-2"}`}>
                      {/* Driver Name */}
                      <div className="space-y-1.5">
                        <Tip text="Enter the driver's full name exactly as shown on their ID. A mismatch will create an exception for supervisor review.">
                          <Label className="text-xs font-semibold cursor-help">
                            Driver Name *
                            {selectedAppointment?.driverName && verifiedDriverName.trim() && verifiedDriverName.trim() !== selectedAppointment.driverName.trim() && (
                              <span className="ml-1.5 text-amber-600 dark:text-amber-400">(Modified)</span>
                            )}
                          </Label>
                        </Tip>
                        <div className="relative">
                          <Input
                            value={verifiedDriverName}
                            onChange={(e) => setVerifiedDriverName(e.target.value)}
                            placeholder="Full name"
                            data-testid="input-verify-driver-name"
                            className={`pr-9 h-10 ${selectedAppointment?.driverName && verifiedDriverName.trim() && verifiedDriverName.trim() !== selectedAppointment.driverName.trim() ? "border-amber-500" : ""}`}
                          />
                          {selectedAppointment?.driverName && verifiedDriverName.trim() && verifiedDriverName.trim() !== selectedAppointment.driverName.trim() ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          ) : selectedAppointment?.driverName && verifiedDriverName.trim() ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          ) : null}
                        </div>
                        {selectedAppointment?.driverName && verifiedDriverName.trim() && verifiedDriverName.trim() !== selectedAppointment.driverName.trim() && (
                          <p className="text-[10px] text-amber-600">Expected: {selectedAppointment.driverName}</p>
                        )}
                      </div>

                      {/* Driver License */}
                      <div className="space-y-1.5">
                        <Tip text="Scan or manually enter the driver's commercial license number for identity verification">
                          <Label className="text-xs font-semibold cursor-help">Driver License / ID</Label>
                        </Tip>
                        <Input
                          value={verifiedDriverLicense}
                          onChange={(e) => setVerifiedDriverLicense(e.target.value)}
                          placeholder="License number"
                          data-testid="input-verify-driver-license"
                          className="h-10"
                        />
                      </div>

                      {/* Truck Number */}
                      <div className="space-y-1.5">
                        <Tip text="Enter the tractor/truck unit number visible on the vehicle. Mismatches flag a discrepancy for supervisor review.">
                          <Label className="text-xs font-semibold cursor-help">
                            Truck Number *
                            {selectedAppointment?.truckNumber && verifiedTruckNumber.trim() && verifiedTruckNumber.trim() !== selectedAppointment.truckNumber.trim() && (
                              <span className="ml-1.5 text-amber-600">(Modified)</span>
                            )}
                          </Label>
                        </Tip>
                        <div className="relative">
                          <Input
                            value={verifiedTruckNumber}
                            onChange={(e) => setVerifiedTruckNumber(e.target.value)}
                            placeholder="Truck #"
                            data-testid="input-verify-truck"
                            className={`pr-9 h-10 ${selectedAppointment?.truckNumber && verifiedTruckNumber.trim() && verifiedTruckNumber.trim() !== selectedAppointment.truckNumber.trim() ? "border-amber-500" : ""}`}
                          />
                          {selectedAppointment?.truckNumber && verifiedTruckNumber.trim() && verifiedTruckNumber.trim() !== selectedAppointment.truckNumber.trim() ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          ) : selectedAppointment?.truckNumber && verifiedTruckNumber.trim() ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          ) : null}
                        </div>
                        {selectedAppointment?.truckNumber && verifiedTruckNumber.trim() && verifiedTruckNumber.trim() !== selectedAppointment.truckNumber.trim() && (
                          <p className="text-[10px] text-amber-600">Expected: {selectedAppointment.truckNumber}</p>
                        )}
                      </div>

                      {/* Trailer Number */}
                      <div className="space-y-1.5">
                        <Tip text="Enter the trailer number. This is automatically checked against active visits — a duplicate will block check-in.">
                          <Label className="text-xs font-semibold cursor-help">
                            Trailer Number *
                            {selectedAppointment?.trailerNumber && verifiedTrailerNumber.trim() && verifiedTrailerNumber.trim() !== selectedAppointment.trailerNumber.trim() && (
                              <span className="ml-1.5 text-amber-600">(Modified)</span>
                            )}
                          </Label>
                        </Tip>
                        <div className="relative">
                          <Input
                            value={verifiedTrailerNumber}
                            onChange={(e) => setVerifiedTrailerNumber(e.target.value)}
                            placeholder="Trailer #"
                            data-testid="input-verify-trailer"
                            onBlur={(e) => { if (e.target.value.trim()) checkDuplicateMutation.mutate(e.target.value.trim()); }}
                            className={`pr-9 h-10 ${duplicateCheck?.exists ? "border-red-500 ring-1 ring-red-500" : selectedAppointment?.trailerNumber && verifiedTrailerNumber.trim() && verifiedTrailerNumber.trim() !== selectedAppointment.trailerNumber.trim() ? "border-amber-500" : ""}`}
                          />
                          {checkDuplicateMutation.isPending ? (
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          ) : duplicateCheck?.exists ? (
                            <AlertTriangle className="h-4 w-4 text-red-600 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          ) : selectedAppointment?.trailerNumber && verifiedTrailerNumber.trim() && verifiedTrailerNumber.trim() !== selectedAppointment.trailerNumber.trim() ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          ) : duplicateCheck?.exists === false ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                          ) : null}
                        </div>
                        {selectedAppointment?.trailerNumber && verifiedTrailerNumber.trim() && verifiedTrailerNumber.trim() !== selectedAppointment.trailerNumber.trim() && (
                          <p className="text-[10px] text-amber-600">Expected: {selectedAppointment.trailerNumber}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2 border-t">
                      <Tip text="Go back to the previous step">
                        <Button variant="outline" className="px-8" onClick={() => { setStep(selectedAppointment ? "confirm" : "search"); setActiveProcessStep(selectedAppointment ? 1 : 0); }}>
                          Back
                        </Button>
                      </Tip>
                      <Tip text="All details verified — proceed to record seal number, load type, and submit check-in">
                        <Button
                          onClick={handleVerifyProceed}
                          className="flex-1 h-12 text-base font-semibold gap-2"
                          data-testid="button-proceed-capture"
                          disabled={duplicateCheck?.exists}
                        >
                          <Camera className="h-5 w-5" /> Continue to Capture & Assign
                        </Button>
                      </Tip>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── STEP: form ───────────────────────────────────────────── */}
              {step === "form" && (
                <Card className="shadow-sm">
                  <CardHeader className="px-5 py-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-base font-bold">Capture & Assign</CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">Record seal, load type, and finalize check-in</p>
                        </div>
                      </div>
                      {selectedAppointment ? (
                        <Badge variant="secondary" className="font-mono">{selectedAppointment.referenceNumber}</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">Walk-In</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    <form onSubmit={handleCheckIn} className="space-y-4">
                      <input type="hidden" name="driverName" value={verifiedDriverName || selectedAppointment?.driverName || ""} />
                      <input type="hidden" name="driverLicense" value={verifiedDriverLicense} />
                      <input type="hidden" name="truckNumber" value={verifiedTruckNumber || selectedAppointment?.truckNumber || ""} />
                      <input type="hidden" name="trailerNumber" value={verifiedTrailerNumber || selectedAppointment?.trailerNumber || ""} />

                      {discrepancies.length > 0 && (
                        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                              {discrepancies.length} discrepanc{discrepancies.length === 1 ? "y" : "ies"} detected — will be sent to supervisor for approval
                            </p>
                          </div>
                          <ul className="space-y-1 pl-6">
                            {discrepancies.map((d) => (
                              <li key={d.field} className="text-xs text-amber-700 dark:text-amber-400">
                                <span className="font-semibold">{d.field}:</span>{" "}
                                <span className="line-through opacity-70">{d.expected}</span>
                                {" → "}
                                <span className="font-bold">{d.actual}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Seal number — highlighted */}
                      <Tip text="Enter the physical seal number from the trailer door. This is required for chain-of-custody documentation.">
                        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 p-4 space-y-2 cursor-help">
                          <Label className="text-sm font-bold flex items-center gap-2">
                            <Lock className="h-4 w-4 text-primary" />
                            Seal Number
                          </Label>
                          <Input
                            name="sealNumber"
                            defaultValue={selectedAppointment?.sealNumber || ""}
                            placeholder="Enter seal number..."
                            className="bg-background h-10 text-base"
                            data-testid="input-ci-seal"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </Tip>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Tip text="Select the type of load or movement this truck is performing at the yard">
                            <Label className="text-xs font-semibold cursor-help">Load Type</Label>
                          </Tip>
                          <Select name="movementType" defaultValue={selectedAppointment?.movementType || "inbound"}>
                            <SelectTrigger className="h-10" data-testid="select-ci-movement"><SelectValue /></SelectTrigger>
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
                        <div className="space-y-1.5 flex flex-col justify-end">
                          <Tip text="Toggle if this trailer carries hazardous materials — triggers special handling and documentation requirements">
                            <div className="flex items-center justify-between rounded-lg border-2 p-3 cursor-help hover:border-primary/30 transition-colors">
                              <Label className="text-sm font-semibold flex items-center gap-2 cursor-pointer" htmlFor="hazmat-toggle">
                                <AlertOctagon className={`h-4 w-4 ${hazmat ? "text-red-600" : "text-muted-foreground"}`} />
                                Hazmat
                              </Label>
                              <Switch id="hazmat-toggle" checked={hazmat} onCheckedChange={setHazmat} data-testid="switch-hazmat" />
                            </div>
                          </Tip>
                        </div>
                      </div>

                      {hazmat && (
                        <div className="flex items-start gap-3 rounded-xl border-2 border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700 p-4" data-testid="banner-hazmat-warning">
                          <AlertOctagon className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs font-medium text-red-700 dark:text-red-300">
                            <span className="font-bold block mb-0.5">Hazardous Materials Notice</span>
                            This trailer will be flagged for hazmat handling. Ensure the driver has proper hazmat documentation and that designated hazmat parking rules are followed.
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Tip text="Add any gate notes, special instructions, or observations about this check-in">
                          <Label className="text-xs font-semibold cursor-help">Notes (optional)</Label>
                        </Tip>
                        <Textarea name="notes" className="resize-none h-16" placeholder="Optional notes..." data-testid="input-ci-notes" />
                      </div>

                      <div className="flex gap-3 pt-2 border-t">
                        <Tip text="Go back to driver verification">
                          <Button type="button" variant="outline" className="px-8" onClick={() => { setStep("verify"); setActiveProcessStep(2); }}>
                            Back
                          </Button>
                        </Tip>
                        <Button
                          type="submit"
                          disabled={checkInMutation.isPending}
                          className="flex-1 h-13 text-base font-bold gap-2 shadow-sm"
                          data-testid="button-ci-submit"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                          {checkInMutation.isPending ? "Processing..." : "Complete Check-In"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* ── STEP: done ───────────────────────────────────────────── */}
              {step === "done" && (
                <Card className="border-2 border-green-300 shadow-md dark:border-green-800">
                  <CardContent className="p-6">
                    {/* Success banner */}
                    <div className="text-center space-y-3 mb-8">
                      <div className="h-20 w-20 mx-auto rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center ring-4 ring-green-200 dark:ring-green-800">
                        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-green-800 dark:text-green-300">Check-In Complete</h2>
                        <div className="inline-flex items-center gap-2 mt-2 px-4 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-full">
                          <span className="text-sm font-bold text-green-800 dark:text-green-300 font-mono">{createdVisitNumber}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{createdVisitCarrier} · Trailer {createdVisitTrailer}</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {/* Workflow chain */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5" /> Continue Processing
                        </h3>

                        {/* Slot assignment */}
                        <div className={`rounded-xl border-2 px-4 py-3 flex items-center justify-between gap-3 transition-all ${
                          assignedSlotInfo
                            ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20"
                            : "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/10"
                        }`} data-testid="workflow-step-slot">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                              assignedSlotInfo
                                ? "bg-green-200 dark:bg-green-900"
                                : "bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                            }`}>
                              {assignedSlotInfo ? <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" /> : "1"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold">
                                {assignedSlotInfo ? `Slot ${assignedSlotInfo.number} Assigned` : "Assign to Yard Slot"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {assignedSlotInfo
                                  ? "Trailer is parked and awaiting dock assignment"
                                  : "Park this trailer in an available yard slot"}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 flex gap-2">
                            {!assignedSlotInfo && (
                              <Tip text="Select an available yard slot to park this trailer">
                                <Button size="sm" className="h-8 gap-1.5" disabled={assignSlotMutation.isPending} onClick={() => setShowSlotPicker(!showSlotPicker)} data-testid="button-assign-slot">
                                  <MapPin className="h-3.5 w-3.5" /> Assign Slot
                                </Button>
                              </Tip>
                            )}
                            {assignedSlotInfo && (
                              <Tip text="View this trailer in the Yard Inventory">
                                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setLocation(`/yard/inventory?q=${encodeURIComponent(createdVisitTrailer)}`)} data-testid="button-view-in-inventory">
                                  View in Yard →
                                </Button>
                              </Tip>
                            )}
                          </div>
                        </div>

                        {/* Move to dock */}
                        <div className={`rounded-xl border-2 px-4 py-3 flex items-center justify-between gap-3 transition-all ${
                          assignedSlotInfo
                            ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/10"
                            : "border-dashed border-muted-foreground/20 bg-muted/20 opacity-50"
                        }`} data-testid="workflow-step-dock-move">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                              assignedSlotInfo
                                ? "bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                : "bg-muted text-muted-foreground"
                            }`}>
                              2
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold">Ready for Dock? Create Move.</p>
                              <p className="text-xs text-muted-foreground">Dispatch a jockey to bring this trailer to a dock door</p>
                            </div>
                          </div>
                          <Tip text={assignedSlotInfo ? "Create a move task to dispatch a jockey to bring this trailer to a dock door" : "Assign a slot first before creating a move task"}>
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 shrink-0"
                              disabled={!assignedSlotInfo || createMoveMutation.isPending}
                              onClick={() => createMoveMutation.mutate()}
                              data-testid="button-create-move"
                            >
                              <ArrowRight className="h-3.5 w-3.5" /> Create Move
                            </Button>
                          </Tip>
                        </div>
                      </div>

                      {/* Slot picker */}
                      {showSlotPicker && !assignedSlotInfo && (
                        <Card className="bg-muted/30 border-2 border-dashed">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-bold">Select Available Slot</h4>
                              <Button variant="ghost" size="sm" onClick={() => setShowSlotPicker(false)}>Cancel</Button>
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                              {availableSlots.length === 0 ? (
                                <p className="col-span-full text-center text-xs text-muted-foreground py-3">No slots available</p>
                              ) : (
                                availableSlots.map((slot) => (
                                  <Tip key={slot.id} text={`Assign trailer to slot ${slot.slotNumber}`}>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="h-10 font-mono font-bold"
                                      onClick={() => {
                                        setAssignedSlotInfo({ id: slot.id, number: slot.slotNumber });
                                        assignSlotMutation.mutate(slot.id);
                                      }}
                                      data-testid={`button-select-slot-${slot.id}`}
                                    >
                                      {slot.slotNumber}
                                    </Button>
                                  </Tip>
                                ))
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Secondary actions */}
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Secondary Actions</h3>
                        <div className="grid grid-cols-3 gap-3">
                          <Tip text="Start a gate inbound inspection for this trailer">
                            <Button variant="outline" className="justify-start h-12 px-4 gap-3 border-amber-200 hover:border-amber-400 hover:bg-amber-50" onClick={() => setLocation(`/inspections?type=gate_inbound&trailer=${encodeURIComponent(createdVisitTrailer)}`)} data-testid="button-start-inspection">
                              <FileSearch className="h-4 w-4 text-amber-600" />
                              <span className="text-xs font-semibold">Start Inspection</span>
                            </Button>
                          </Tip>
                          <Tip text="Place a hold on this trailer — select the hold reason in the next step">
                            <Button variant="outline" className="justify-start h-12 px-4 gap-3 border-red-200 hover:border-red-400 hover:bg-red-50" onClick={() => setShowHoldPicker(!showHoldPicker)} data-testid="button-place-hold">
                              <PauseCircle className="h-4 w-4 text-red-600" />
                              <span className="text-xs font-semibold">Place Hold</span>
                            </Button>
                          </Tip>
                          <Tip text="Print the official gate pass for the driver to carry while on-site">
                            <Button variant="outline" className="justify-start h-12 px-4 gap-3 border-blue-200 hover:border-blue-400 hover:bg-blue-50" onClick={handlePrintGatePass} data-testid="button-print-pass">
                              <FileCheck className="h-4 w-4 text-blue-600" />
                              <span className="text-xs font-semibold">Print Gate Pass</span>
                            </Button>
                          </Tip>
                        </div>
                      </div>

                      {/* Hold picker */}
                      {showHoldPicker && (
                        <Card className="bg-red-50/50 dark:bg-red-950/10 border-2 border-red-200 dark:border-red-900/30">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-bold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                Select Hold Reason
                              </h4>
                              <Button variant="ghost" size="sm" onClick={() => setShowHoldPicker(false)}>Cancel</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "documentation_hold", label: "Documentation" },
                                { id: "security_hold",      label: "Security" },
                                { id: "damage_hold",        label: "Damage" },
                                { id: "seal_mismatch",      label: "Seal Mismatch" },
                                { id: "driver_issue",       label: "Driver Issue" },
                                { id: "customs_hold",       label: "Customs" },
                              ].map((hold) => (
                                <Tip key={hold.id} text={`Place a ${hold.label.toLowerCase()} hold on this trailer`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="justify-start h-10 text-sm font-medium border-red-200 hover:border-red-400 hover:bg-red-50"
                                    onClick={() => placeHoldMutation.mutate(hold.id)}
                                    data-testid={`button-select-hold-${hold.id}`}
                                  >
                                    {hold.label}
                                  </Button>
                                </Tip>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* New check-in */}
                      <div className="pt-2 border-t">
                        <Tip text="Clear this check-in and start a new one for another truck">
                          <Button onClick={handleReset} className="w-full h-12 text-base font-semibold gap-2" variant="secondary" data-testid="button-ci-new">
                            <PackagePlus className="h-5 w-5" />
                            New Check-In
                          </Button>
                        </Tip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── RIGHT: Expected Today ──────────────────────────────────────── */}
            <div className="sticky top-4 space-y-0">
              <Card className="shadow-sm overflow-hidden border-2">
                {/* Panel header */}
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-bold">Expected Today</h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedTruckId && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        1 selected
                      </span>
                    )}
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {expectedTrucks.length}
                    </span>
                  </div>
                </div>

                {/* Status filter tabs */}
                <div className="px-3 py-2 border-b flex items-center gap-1 bg-background">
                  {[
                    { key: "all",        label: "All",        count: expectedTrucks.length },
                    { key: "pending",    label: "Pending",    count: expectedTrucks.filter((t) => t.gateStatus !== "Checked In" && t.gateStatus !== "Cancelled").length },
                    { key: "late",       label: "Late",       count: expectedTrucks.filter((t) => t.gateStatus === "Late").length },
                    { key: "checked_in", label: "Checked In", count: expectedTrucks.filter((t) => t.gateStatus === "Checked In").length },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setListFilter(f.key as any)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                        listFilter === f.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {f.label}
                      {f.count > 0 && (
                        <span className={`text-[10px] font-bold px-1 rounded ${listFilter === f.key ? "bg-white/20 text-primary-foreground" : "bg-muted-foreground/10"}`}>
                          {f.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* List */}
                <div className="divide-y max-h-[560px] overflow-y-auto">
                {filteredTrucks.length === 0 ? (
                  <div className="p-8 text-center">
                    <Clock className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">No trucks match this filter</p>
                    <button onClick={() => setListFilter("all")} className="text-xs text-primary mt-1 hover:underline">Show all</button>
                  </div>
                ) : (
                  filteredTrucks.map((truck) => {
                    const statusColors: Record<string, string> = {
                      "Checked In":    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                      "Arriving Soon": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                      "Late":          "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
                      "Cancelled":     "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                    };
                    const statusColor = statusColors[truck.gateStatus] ?? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
                    const isCheckedIn = truck.gateStatus === "Checked In";
                    const isSelected = selectedTruckId === truck.id;

                    return (
                      <Tip key={truck.id} text={isCheckedIn ? "This truck is already checked in" : `Click to begin check-in for ${truck.referenceNumber} (${truck.carrierName})`}>
                        <div
                          className={`group flex flex-col gap-2 px-4 py-3 transition-all ${
                            isSelected
                              ? "bg-primary/10 border-l-4 border-l-primary"
                              : isCheckedIn
                                ? "bg-emerald-50/50 dark:bg-emerald-950/10 cursor-default opacity-70"
                                : "bg-card hover:bg-primary/5 cursor-pointer border-l-4 border-l-transparent hover:border-l-primary/40"
                          }`}
                          onClick={() => !isCheckedIn && handleSelectExpected(truck)}
                          data-testid={`card-expected-truck-${truck.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                              <span className={`font-bold text-sm tracking-tight font-mono ${isSelected ? "text-primary" : ""}`}>{truck.referenceNumber}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                truck.movementType === "outbound"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              }`}>
                                {truck.movementType === "outbound" ? "OUT" : "IN"}
                              </span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor}`}>
                                {truck.gateStatus}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-foreground">{truck.carrierName}</span>
                              {truck.trailerNumber && (
                                <span className="text-[10px] text-muted-foreground ml-2 font-mono">#{truck.trailerNumber}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                              <Clock className="h-3 w-3" />
                              {truck.timeWindowStart}
                            </div>
                          </div>
                          {!isCheckedIn && (
                            <div className="flex items-center justify-end">
                              <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                Select to check in <ArrowRight className="h-3 w-3" />
                              </span>
                            </div>
                          )}
                        </div>
                      </Tip>
                    );
                  })
                )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
