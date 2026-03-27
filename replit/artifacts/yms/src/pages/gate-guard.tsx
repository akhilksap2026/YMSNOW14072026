import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { playCheckIn } from "@/lib/audio-feedback";
import { useLocation } from "wouter";
import {
  Search, CheckCircle2, Truck, LogIn, UserPlus, ArrowRight,
  Printer, RotateCcw, Shield, Clock, X, ChevronRight, FileText,
} from "lucide-react";
import type { Carrier } from "@shared/schema";

interface SearchResult {
  id: number;
  referenceNumber: string;
  carrierName?: string;
  trailerNumber: string | null;
  driverName: string | null;
  truckNumber: string | null;
  movementType: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  status: string;
}

type Step = "search" | "form" | "pass";

const MOVE_TYPES = ["inbound", "outbound", "drop_and_hook", "live_load", "live_unload"];

function GatePassPrint({ visit, onClose, onNewCheckIn }: {
  visit: { visitNumber: string; carrierName: string; driverName: string; trailerNumber: string; truckNumber: string; movementType: string; checkInTime: string; };
  onClose: () => void;
  onNewCheckIn: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=700,height=500");
    if (!win) return;
    win.document.write(`
      <html><head><title>Gate Pass — ${visit.visitNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        .header { text-align: center; border-bottom: 3px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 28px; font-weight: 900; letter-spacing: 2px; }
        .sub { font-size: 12px; color: #555; margin-top: 4px; }
        .badge { display: inline-block; background: #111; color: #fff; padding: 6px 16px; border-radius: 4px; font-size: 22px; font-weight: bold; letter-spacing: 3px; margin: 16px 0; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; margin: 20px 0; }
        .field label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; display: block; }
        .field span { font-size: 15px; font-weight: 600; }
        .footer { border-top: 1px solid #ccc; margin-top: 24px; padding-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        .sig-line { border-top: 1px solid #555; margin-top: 32px; padding-top: 4px; font-size: 10px; color: #888; }
        .stamp { text-align: center; font-size: 11px; color: #aaa; margin-top: 24px; }
        @media print { body { margin: 0; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const movLabel = visit.movementType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Gate Pass Ready
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div ref={printRef} className="border-2 border-foreground rounded-lg p-6 bg-background text-foreground">
          <div className="text-center border-b-2 border-foreground pb-4 mb-5">
            <img src="/ksap-logo.png" alt="KSAP OTM Now" className="h-10 w-auto object-contain mx-auto mb-1" />
            <div className="text-xs text-muted-foreground mt-1">Yard Management System — Gate Pass</div>
            <div className="inline-block bg-foreground text-background px-6 py-2 rounded text-2xl font-bold tracking-widest mt-3">
              {visit.visitNumber}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Carrier", value: visit.carrierName },
              { label: "Driver", value: visit.driverName || "—" },
              { label: "Trailer #", value: visit.trailerNumber || "—" },
              { label: "Truck / Tractor", value: visit.truckNumber || "—" },
              { label: "Movement Type", value: movLabel },
              { label: "Check-In Time", value: visit.checkInTime },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-8 border-t pt-4 mt-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-6">Gate Guard Signature</div>
              <div className="border-t border-foreground/40 pt-1 text-[10px] text-muted-foreground">Authorized by Gate</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-6">Driver Signature</div>
              <div className="border-t border-foreground/40 pt-1 text-[10px] text-muted-foreground">I confirm above details</div>
            </div>
          </div>

          <div className="text-center text-[10px] text-muted-foreground mt-4 border-t pt-3">
            This pass is valid for one entry. Keep with you at all times on premises.
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button className="flex-1 h-12 text-base gap-2" onClick={handlePrint}>
            <Printer className="h-5 w-5" /> Print Gate Pass
          </Button>
          <Button variant="outline" className="flex-1 h-12 text-base gap-2" onClick={onNewCheckIn}>
            <RotateCcw className="h-4 w-4" /> New Check-In
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function GateGuardPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [selectedApt, setSelectedApt] = useState<SearchResult | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [createdVisit, setCreatedVisit] = useState<{
    visitNumber: string; carrierName: string; driverName: string;
    trailerNumber: string; truckNumber: string; movementType: string; checkInTime: string;
  } | null>(null);

  const { data: carriers = [] } = useQuery<Carrier[]>({ queryKey: ["/api/carriers"] });

  const searchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("GET", `/api/appointments/search?q=${encodeURIComponent(q)}`);
      return res.json();
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/gate/check-in", data);
      return res.json();
    },
    onSuccess: (data) => {
      invalidateAll();
      playCheckIn();
      const carrierName = carriers.find((c) => c.id === data.carrierId)?.name || selectedApt?.carrierName || "Unknown";
      setCreatedVisit({
        visitNumber: data.visitNumber || "",
        carrierName,
        driverName: data.driverName || "",
        trailerNumber: data.trailerNumber || "",
        truckNumber: data.truckNumber || "",
        movementType: data.movementType || "inbound",
        checkInTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
      setStep("pass");
      toast({ title: "Check-in complete" });
    },
    onError: (err: Error) => toast({ title: "Check-in failed", description: err.message, variant: "destructive" }),
  });

  const handleSearch = () => {
    if (query.trim()) searchMutation.mutate(query);
  };

  const handleReset = () => {
    setStep("search");
    setQuery("");
    setSelectedApt(null);
    setIsWalkIn(false);
    setCreatedVisit(null);
    searchMutation.reset();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    checkInMutation.mutate({
      appointmentId: selectedApt?.id || null,
      carrierId: fd.get("carrierId") ? Number(fd.get("carrierId")) : null,
      driverName: fd.get("driverName"),
      truckNumber: fd.get("truckNumber"),
      trailerNumber: fd.get("trailerNumber"),
      movementType: fd.get("movementType"),
      hazmat: false,
      notes: null,
    });
  };

  const results = (searchMutation.data as SearchResult[]) || [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-foreground text-background px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6" />
          <div>
            <img src="/ksap-logo.png" alt="KSAP OTM Now" className="h-6 w-auto object-contain brightness-0 invert" />
            <div className="text-[10px] opacity-60 tracking-widest mt-0.5">GATE GUARD MODE</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 opacity-60" />
          <span className="text-sm font-mono opacity-80">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <Button size="sm" variant="outline" className="text-background border-background/30 hover:bg-background/10 text-xs" onClick={() => navigate("/gate/check-in")}>
            <X className="h-3.5 w-3.5 mr-1" /> Exit Guard Mode
          </Button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-6">

          {step === "pass" && createdVisit && (
            <GatePassPrint visit={createdVisit} onClose={() => setStep("search")} onNewCheckIn={handleReset} />
          )}

          {step === "search" && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mb-3">
                  <Truck className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-2xl font-bold">Gate Check-In</h1>
                <p className="text-muted-foreground text-sm mt-1">Search by appointment #, trailer #, or truck #</p>
              </div>

              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search appointment, trailer, or truck..."
                  className="h-14 text-lg"
                  autoFocus
                />
                <Button onClick={handleSearch} disabled={searchMutation.isPending} className="h-14 px-6">
                  <Search className="h-5 w-5" />
                </Button>
              </div>

              {searchMutation.data && (
                <div className="space-y-2">
                  {results.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">No matching appointments found</div>
                  ) : (
                    results.map((apt) => (
                      <div
                        key={apt.id}
                        className="border rounded-xl p-4 cursor-pointer hover:bg-accent transition-colors flex items-center gap-4"
                        onClick={() => { setSelectedApt(apt); setIsWalkIn(false); setStep("form"); }}
                      >
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Truck className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base">{apt.referenceNumber}</span>
                            <Badge variant="outline" className="text-[10px]">{apt.movementType}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {apt.trailerNumber || "No trailer"} {apt.driverName ? `· ${apt.driverName}` : ""} · {apt.timeWindowStart}–{apt.timeWindowEnd}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="border-t pt-4 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12 text-base gap-2"
                  onClick={() => { setSelectedApt(null); setIsWalkIn(true); setStep("form"); }}
                >
                  <UserPlus className="h-5 w-5" /> Walk-In (No Appointment)
                </Button>
              </div>
            </div>
          )}

          {step === "form" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={handleReset}><ArrowRight className="h-4 w-4 rotate-180" /></Button>
                <div>
                  <h2 className="text-xl font-bold">{isWalkIn ? "Walk-In Check-In" : `Appointment ${selectedApt?.referenceNumber}`}</h2>
                  <p className="text-sm text-muted-foreground">{isWalkIn ? "Enter driver and vehicle details" : "Confirm and complete check-in"}</p>
                </div>
              </div>

              {selectedApt && (
                <div className="bg-muted/40 rounded-xl p-4 border text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-semibold">{selectedApt.referenceNumber}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Time Window</span><span className="font-semibold">{selectedApt.timeWindowStart} – {selectedApt.timeWindowEnd}</span></div>
                  {selectedApt.trailerNumber && <div className="flex justify-between"><span className="text-muted-foreground">Trailer</span><span className="font-semibold">{selectedApt.trailerNumber}</span></div>}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isWalkIn && (
                  <div>
                    <Label className="text-sm font-medium">Carrier</Label>
                    <Select name="carrierId">
                      <SelectTrigger className="h-12 mt-1">
                        <SelectValue placeholder="Select carrier" />
                      </SelectTrigger>
                      <SelectContent>
                        {carriers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Driver Name</Label>
                    <Input name="driverName" defaultValue={selectedApt?.driverName || ""} placeholder="Driver name" className="h-12 mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Truck / Tractor #</Label>
                    <Input name="truckNumber" defaultValue={selectedApt?.truckNumber || ""} placeholder="Truck #" className="h-12 mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Trailer #</Label>
                    <Input name="trailerNumber" defaultValue={selectedApt?.trailerNumber || ""} placeholder="Trailer #" className="h-12 mt-1" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Movement Type</Label>
                    <Select name="movementType" defaultValue={selectedApt?.movementType || "inbound"}>
                      <SelectTrigger className="h-12 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MOVE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold gap-2"
                  disabled={checkInMutation.isPending}
                >
                  {checkInMutation.isPending ? (
                    <><LogIn className="h-5 w-5 animate-spin" /> Processing…</>
                  ) : (
                    <><CheckCircle2 className="h-5 w-5" /> Complete Check-In</>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
