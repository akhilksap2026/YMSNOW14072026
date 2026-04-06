import { PageHeader, StatusChip, KPICard, DetailDrawer, DrawerSection, DrawerField } from "@/components/enterprise";
import { visitStatusColor, holdStatusColor } from "@/lib/status-colors";
import { playCheckOut } from "@/lib/audio-feedback";
import { useState, useMemo } from "react";
import { SearchAutocomplete } from "@/components/enterprise/search-autocomplete";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  LogIn,
  LogOut,
  CheckCircle2,
  Truck,
  QrCode,
  ShieldCheck,
  Eye,
  DoorOpen,
  FileCheck,
  AlertTriangle,
  Clock,
  MapPin,
  Timer,
  FileSearch,
  ClipboardCheck,
  Ban,
  Printer,
} from "lucide-react";
import { useLocation } from "wouter";
import type { Visit } from "@shared/schema";

interface GateStats {
  expectedToday: number;
  checkedInToday: number;
  completedExitsToday: number;
  blockedExits: number;
  readyOut: number;
  onHold: number;
}

interface ExpectedCheckout {
  id: number;
  visitNumber: string;
  trailerNumber: string | null;
  truckNumber: string | null;
  carrierName: string;
  visitStatus: string;
  holdStatus: string;
  location: string;
  exitReadiness: string;
  checkInTime: string | null;
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function calcDwell(checkIn: string | null): string {
  if (!checkIn) return "N/A";
  const diff = Date.now() - new Date(checkIn).getTime();
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function exitReadinessColor(status: string): string {
  switch (status) {
    case "Ready": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "On Hold": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "At Dock": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "In Yard": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    case "Pending": return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
    default: return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  }
}

const PROCESS_STEPS = [
  { icon: Search, label: "Find Visit", short: "Find" },
  { icon: Eye, label: "Verify Unit", short: "Verify" },
  { icon: ShieldCheck, label: "Check Clearance", short: "Clear" },
  { icon: DoorOpen, label: "Confirm Exit", short: "Exit" },
  { icon: FileCheck, label: "Exit Pass", short: "Pass" },
];

export default function GateCheckOutPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [step, setStep] = useState<"search" | "confirm" | "done">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [visit, setVisit] = useState<Visit | null>(null);
  const [dwellTime, setDwellTime] = useState("");
  const [activeProcessStep, setActiveProcessStep] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedExpectedCheckout, setSelectedExpectedCheckout] = useState<ExpectedCheckout | null>(null);
  const [outboundSeal, setOutboundSeal] = useState("");

  const { data: gateStats } = useQuery<GateStats>({
    queryKey: ["/api/gate/stats"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: expectedCheckouts = [] } = useQuery<ExpectedCheckout[]>({
    queryKey: ["/api/gate/expected-checkouts"],
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("GET", `/api/visits/search?q=${encodeURIComponent(q)}`);
      return res.json();
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/gate/check-out", data);
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      setDwellTime(data.dwellTime || "");
      setStep("done");
      setActiveProcessStep(4);
      playCheckOut();
      toast({ title: "Check-out complete" });
    },
    onError: (err: Error) => {
      toast({ title: "Check-out failed", description: err.message, variant: "destructive" });
    },
  });

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    expectedCheckouts.forEach((c) => {
      if (c.visitNumber) set.add(c.visitNumber);
      if (c.trailerNumber) set.add(c.trailerNumber);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [expectedCheckouts]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery);
    }
  };

  const handleSelect = (v: Visit) => {
    setVisit(v);
    setStep("confirm");
    setActiveProcessStep(2);
  };

  const handleSelectExpected = (checkout: ExpectedCheckout) => {
    setSelectedExpectedCheckout(checkout);
    setIsDrawerOpen(true);
  };

  const handleConfirmFromDrawer = () => {
    if (selectedExpectedCheckout) {
      setSearchQuery(selectedExpectedCheckout.visitNumber);
      searchMutation.mutate(selectedExpectedCheckout.visitNumber);
      setIsDrawerOpen(false);
    }
  };

  const handleCheckOut = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!visit) return;
    const fd = new FormData(e.currentTarget);
    checkOutMutation.mutate({
      visitId: visit.id,
      sealNumber: fd.get("sealNumber") || null,
      notes: fd.get("notes") || null,
    });
  };

  const handleReset = () => {
    setStep("search");
    setSearchQuery("");
    setVisit(null);
    setDwellTime("");
    setActiveProcessStep(0);
    setOutboundSeal("");
    searchMutation.reset();
  };

  const handlePrintExitPass = () => {
    if (!visit) return;
    const now = new Date().toLocaleString([], { dateStyle: "short", timeStyle: "short" });
    const printWindow = window.open("", "_blank", "width=600,height=500");
    if (!printWindow) {
      toast({ title: "Print failed", description: "Could not open print window. Please allow popups.", variant: "destructive" });
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Exit Pass — ${visit.visitNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #111; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          .subtitle { font-size: 12px; color: #666; margin-bottom: 24px; }
          .pass-border { border: 3px solid #111; padding: 20px; border-radius: 6px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
          .header-title { font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          .header-meta { text-align: right; font-size: 11px; color: #555; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
          .field label { font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; display: block; margin-bottom: 2px; }
          .field span { font-size: 14px; font-weight: bold; }
          .footer { border-top: 1px solid #ccc; padding-top: 12px; font-size: 11px; color: #555; text-align: center; }
          .stamp { text-align: center; margin-top: 20px; }
          .stamp-text { display: inline-block; border: 3px solid #16a34a; color: #16a34a; padding: 6px 20px; font-size: 18px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; border-radius: 4px; transform: rotate(-3deg); }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="pass-border">
          <div class="header">
            <div>
              <div class="header-title">Gate Exit Pass</div>
              <div class="subtitle">YardNow Yard Management System</div>
            </div>
            <div class="header-meta">
              <div>Visit #: <strong>${visit.visitNumber}</strong></div>
              <div>Exit Time: ${now}</div>
            </div>
          </div>
          <div class="grid">
            <div class="field"><label>Trailer Number</label><span>${visit.trailerNumber || "N/A"}</span></div>
            <div class="field"><label>Truck Number</label><span>${visit.truckNumber || "N/A"}</span></div>
            <div class="field"><label>Driver Name</label><span>${visit.driverName || "N/A"}</span></div>
            <div class="field"><label>Driver License</label><span>${visit.driverLicense || "N/A"}</span></div>
            <div class="field"><label>Movement Type</label><span>${visit.movementType ? visit.movementType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "N/A"}</span></div>
            <div class="field"><label>Gate-Out Time</label><span>${now}</span></div>
            <div class="field"><label>Dwell Time</label><span>${dwellTime || "N/A"}</span></div>
            <div class="field"><label>Seal Number</label><span>${visit.sealNumber || "N/A"}</span></div>
          </div>
          <div class="stamp">
            <span class="stamp-text">Cleared for Exit</span>
          </div>
          <div class="footer">
            This pass authorizes the above vehicle to exit the facility. Retain for your records.
          </div>
        </div>
        <script>window.onload = function() { window.print(); };<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const stats = gateStats || { expectedToday: 0, checkedInToday: 0, completedExitsToday: 0, blockedExits: 0, readyOut: 0, onHold: 0 };
  const readyCheckouts = expectedCheckouts.filter((c) => c.exitReadiness === "Ready");

  const kpis = (
    <>
      <KPICard
        label="Ready Out"
        value={stats.readyOut}
        icon={<DoorOpen className="h-4 w-4" />}
        data-testid="text-stat-ready-out"
      />
      <KPICard
        label="Exits Today"
        value={stats.completedExitsToday}
        icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        data-testid="text-stat-exits-today"
      />
      <KPICard
        label="Blocked"
        value={stats.blockedExits}
        icon={<AlertTriangle className="h-4 w-4" />}
        trend={stats.blockedExits > 0 ? { value: stats.blockedExits.toString(), positive: false } : undefined}
        data-testid="text-stat-blocked"
      />
      <KPICard
        label="On Hold"
        value={stats.onHold}
        icon={<Clock className="h-4 w-4" />}
        data-testid="text-stat-on-hold"
      />
    </>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <PageHeader
        title="Gate Check-Out"
        subtitle="Process outbound vehicles and verify exit clearance"
        icon={<LogOut className="h-5 w-5" />}
        kpiStrip={kpis}
        actions={
          <Badge variant="outline" className="text-xs font-normal border-green-200 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5" />
            Gate Active
          </Badge>
        }
      />

      <div className="flex items-center -mx-4 sm:-mx-6 px-4 sm:px-6 border-b">
        <button
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors -mb-px"
          onClick={() => setLocation("/gate/check-in")}
          data-testid="tab-checkin"
        >
          <LogIn className="h-3.5 w-3.5" /> Check-In
        </button>
        <button
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            location === "/gate/check-out"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setLocation("/gate/check-out")}
          data-testid="tab-checkout"
        >
          <LogOut className="h-3.5 w-3.5" /> Check-Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-1 px-1">
            {PROCESS_STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex-1 justify-center ${
                  i < activeProcessStep
                    ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                    : i === activeProcessStep
                      ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                      : "bg-muted/50 text-muted-foreground"
                }`}>
                  {i < activeProcessStep ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <s.icon className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.short}</span>
                </div>
                {i < PROCESS_STEPS.length - 1 && (
                  <div className={`w-4 h-px ${i < activeProcessStep ? "bg-green-400" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>

          {step === "search" && (
            <div className="space-y-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-2">
                    <SearchAutocomplete
                      value={searchQuery}
                      onChange={setSearchQuery}
                      onSelect={(v) => { setSearchQuery(v); searchMutation.mutate(v); }}
                      suggestions={suggestions}
                      placeholder="Visit #, trailer #, or truck #..."
                      className="flex-1"
                      inputClassName="h-12 text-base pl-10"
                      data-testid="input-search-checkout"
                    />
                    <Button onClick={handleSearch} disabled={searchMutation.isPending} className="h-12 px-6 text-base" data-testid="button-search-checkout">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="ghost" size="sm" className="h-10 text-muted-foreground" data-testid="button-scan-qr-out">
                      <QrCode className="h-4 w-4 mr-2" /> Scan Code
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {searchMutation.data && (
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Search Results</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-1.5">
                    {(searchMutation.data as Visit[]).length === 0 ? (
                      <div className="text-center py-6">
                        <Truck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No matching active visits found</p>
                      </div>
                    ) : (
                      (searchMutation.data as Visit[]).map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleSelect(v)}
                          data-testid={`row-checkout-result-${v.id}`}
                        >
                          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Truck className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{v.visitNumber}</span>
                              <StatusChip status={v.visitStatus} colorFn={visitStatusColor} size="sm" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {v.trailerNumber || "N/A"} / {v.truckNumber || "N/A"} · Dwell: {calcDwell(v.checkInTime as string | null)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {v.holdStatus !== "none" && (
                              <StatusChip status={v.holdStatus} colorFn={holdStatusColor} size="sm" label="Hold" />
                            )}
                            <Button size="sm" variant="default" data-testid={`button-select-visit-${v.id}`}>Select</Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === "confirm" && visit && (
            <Card>
              <CardHeader className="p-4 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Outbound Verification
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">{visit.visitNumber}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                {visit.holdStatus !== "none" && (
                  <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">Active Hold: {formatStatus(visit.holdStatus)}</p>
                      <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                        This visit has an active hold. Manager override is required before exit.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Visit</p>
                    <p className="text-sm font-semibold mt-0.5">{visit.visitNumber}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Trailer</p>
                    <p className="text-sm font-semibold mt-0.5">{visit.trailerNumber || "N/A"}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Truck</p>
                    <p className="text-sm font-semibold mt-0.5">{visit.truckNumber || "N/A"}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Status</p>
                    <StatusChip status={visit.visitStatus} colorFn={visitStatusColor} size="sm" className="mt-1" />
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Dwell Time</p>
                    <p className="text-sm font-semibold mt-0.5 flex items-center gap-1">
                      <Timer className="h-3.5 w-3.5 text-muted-foreground" />
                      {calcDwell(visit.checkInTime as string | null)}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Hold Status</p>
                    {visit.holdStatus === "none" ? (
                      <p className="text-sm font-semibold mt-0.5 text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Clear
                      </p>
                    ) : (
                      <StatusChip status={visit.holdStatus} colorFn={holdStatusColor} size="sm" className="mt-1" />
                    )}
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2 border-b pb-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    Final Verification Summary
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Hold Status:</span>
                        {visit.holdStatus === "none" ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Cleared</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Active Hold</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Trailer Status:</span>
                        <Badge variant="outline" className={visit.visitStatus === "ready_out" ? "bg-green-50 text-green-700 border-green-200" : ""}>
                          {formatStatus(visit.visitStatus)}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Paperwork:</span>
                        <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Digital Cleared
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Exit Readiness:</span>
                        {visit.holdStatus === "none" && visit.visitStatus === "ready_out" ? (
                          <span className="text-xs font-bold text-green-600 uppercase">Ready Out</span>
                        ) : visit.holdStatus !== "none" ? (
                          <span className="text-xs font-bold text-red-600 uppercase">Blocked</span>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 uppercase">Not Ready</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCheckOut} className="space-y-3">
                  <div className="rounded-lg border p-3 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Seal Verification
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Inbound Seal (Check-In)</Label>
                        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 min-h-9">
                          <span className="text-sm font-mono font-medium" data-testid="text-inbound-seal">
                            {visit.sealNumber || "No seal recorded"}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Outbound Seal (Exit)</Label>
                        <Input
                          name="sealNumber"
                          placeholder="Seal # (if applicable)"
                          value={outboundSeal}
                          onChange={(e) => setOutboundSeal(e.target.value)}
                          data-testid="input-co-seal"
                        />
                      </div>
                    </div>
                    {outboundSeal.trim() !== "" && visit.sealNumber && outboundSeal.trim().toLowerCase() !== visit.sealNumber.trim().toLowerCase() && (
                      <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 flex items-start gap-2" data-testid="warning-seal-mismatch">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Seal Mismatch Detected</p>
                          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                            Inbound seal "<span className="font-mono font-medium">{visit.sealNumber}</span>" does not match outbound seal "<span className="font-mono font-medium">{outboundSeal.trim()}</span>". Verify before proceeding.
                          </p>
                        </div>
                      </div>
                    )}
                    {outboundSeal.trim() !== "" && visit.sealNumber && outboundSeal.trim().toLowerCase() === visit.sealNumber.trim().toLowerCase() && (
                      <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-2.5 flex items-center gap-2" data-testid="status-seal-match">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                        <p className="text-xs font-medium text-green-700 dark:text-green-300">Seals match</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Exit Notes</Label>
                    <Input name="notes" placeholder="Optional notes" data-testid="input-co-notes" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="secondary" onClick={handleReset}>Back</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation(`/inspections?visitId=${visit.id}&type=gate_outbound&trailer=${encodeURIComponent(visit.trailerNumber as string || "")}`)}
                      data-testid="button-exit-inspection"
                    >
                      <FileSearch className="h-4 w-4 mr-1" /> Inspect
                    </Button>
                    {visit.holdStatus !== "none" ? (
                      <Button type="button" variant="destructive" className="flex-1 h-11" disabled data-testid="button-co-blocked">
                        <AlertTriangle className="h-4 w-4 mr-2" /> Exit Blocked — Hold Active
                      </Button>
                    ) : (
                      <Button type="submit" disabled={checkOutMutation.isPending} className="flex-1 h-11 text-base" data-testid="button-co-submit">
                        <DoorOpen className="h-4 w-4 mr-2" />
                        {checkOutMutation.isPending ? "Processing..." : "Complete Check-Out"}
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {step === "done" && (
            <Card>
              <CardContent className="py-10 text-center space-y-4">
                <div className="h-16 w-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Check-Out Complete</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Visit <span className="font-semibold text-foreground">{visit?.visitNumber}</span> has been closed
                  </p>
                  {dwellTime && (
                    <p className="text-xs text-muted-foreground mt-1">Total dwell time: {dwellTime}</p>
                  )}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" onClick={handlePrintExitPass} data-testid="button-print-exit-pass">
                    <Printer className="h-4 w-4 mr-2" /> Print Exit Pass
                  </Button>
                  <Button onClick={handleReset} data-testid="button-co-new">
                    New Check-Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gate-Out Stats</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/40 p-2.5 text-center">
                  <p className="text-lg font-bold" data-testid="text-stat-ready-out">{stats.readyOut}</p>
                  <p className="text-[10px] text-muted-foreground">Ready Out</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2.5 text-center">
                  <p className="text-lg font-bold text-green-600" data-testid="text-stat-exits-today">{stats.completedExitsToday}</p>
                  <p className="text-[10px] text-muted-foreground">Exits Today</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2.5 text-center">
                  <p className={`text-lg font-bold ${stats.blockedExits > 0 ? "text-red-600" : ""}`} data-testid="text-stat-blocked">{stats.blockedExits}</p>
                  <p className="text-[10px] text-muted-foreground">Blocked</p>
                </div>
                <div className="rounded-md bg-muted/40 p-2.5 text-center">
                  <p className={`text-lg font-bold ${stats.onHold > 0 ? "text-amber-600" : ""}`} data-testid="text-stat-on-hold">{stats.onHold}</p>
                  <p className="text-[10px] text-muted-foreground">On Hold</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expected Check-Outs</CardTitle>
                <Badge variant="outline" className="text-[10px]">{readyCheckouts.length} ready</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
          {expectedCheckouts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No active visits in yard</p>
          ) : (
            <div className="space-y-1.5 max-h-[calc(100vh-480px)] overflow-y-auto pr-1">
              {expectedCheckouts.slice(0, 20).map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-2 p-2 rounded-md border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => handleSelectExpected(c)}
                  data-testid={`row-expected-checkout-${c.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">{c.trailerNumber || c.visitNumber}</span>
                      <span className="text-[10px] text-muted-foreground truncate">{c.carrierName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground truncate">{c.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <StatusChip status={c.exitReadiness} colorFn={exitReadinessColor} size="sm" />
                      {c.checkInTime && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                          <Clock className="h-3 w-3" /> {calcDwell(c.checkInTime)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </CardContent>
          </Card>
        </div>
      </div>
      <DetailDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        title="Check-Out Verification"
        subtitle={`Review details for ${selectedExpectedCheckout?.trailerNumber || selectedExpectedCheckout?.visitNumber}`}
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
            {selectedExpectedCheckout?.exitReadiness === "Ready" ? (
              <Button className="flex-1" onClick={handleConfirmFromDrawer}>
                Process Check-Out
              </Button>
            ) : (
              <Button variant="destructive" className="flex-1" disabled>
                <Ban className="h-4 w-4 mr-2" /> Exit Blocked
              </Button>
            )}
          </div>
        }
      >
        {selectedExpectedCheckout && (
          <div className="space-y-6">
            <DrawerSection title="Vehicle Information">
              <div className="grid grid-cols-2 gap-4">
                <DrawerField label="Visit #" value={selectedExpectedCheckout.visitNumber} />
                <DrawerField label="Trailer #" value={selectedExpectedCheckout.trailerNumber || "N/A"} />
                <DrawerField label="Truck #" value={selectedExpectedCheckout.truckNumber || "N/A"} />
                <DrawerField label="Carrier" value={selectedExpectedCheckout.carrierName} />
              </div>
            </DrawerSection>

            <DrawerSection title="Status & Location">
              <div className="grid grid-cols-2 gap-4">
                <DrawerField label="Location" value={selectedExpectedCheckout.location} />
                <DrawerField label="Dwell Time" value={calcDwell(selectedExpectedCheckout.checkInTime)} />
                <DrawerField 
                  label="Hold Status" 
                  value={<StatusChip status={selectedExpectedCheckout.holdStatus} colorFn={holdStatusColor} size="sm" />} 
                />
                <DrawerField 
                  label="Readiness" 
                  value={<StatusChip status={selectedExpectedCheckout.exitReadiness} colorFn={exitReadinessColor} size="sm" />} 
                />
              </div>
            </DrawerSection>

            {selectedExpectedCheckout.exitReadiness !== "Ready" && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Vehicle not cleared for exit
                </p>
                <p className="mt-1">
                  Ensure all holds are released and trailer status is "Ready Out" before processing check-out.
                </p>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
