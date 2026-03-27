import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Truck, Calendar, Clock, CheckCircle2, ChevronRight, ArrowLeft,
  Package, PackageOpen, RotateCcw, Info,
} from "lucide-react";

interface SlotOption {
  start: string;
  end: string;
  label: string;
  booked: number;
  available: number;
  isFull: boolean;
}

type Step = "date" | "slot" | "form" | "confirm";

const MOVEMENT_TYPES = [
  { value: "inbound", label: "Inbound Delivery", icon: Package },
  { value: "outbound", label: "Outbound Pickup", icon: PackageOpen },
  { value: "drop_and_hook", label: "Drop & Hook", icon: RotateCcw },
];

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function displayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function CarrierPortalPage() {
  const { toast } = useToast();
  const today = new Date();

  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState(formatDate(today));
  const [selectedMovementType, setSelectedMovementType] = useState("inbound");
  const [selectedSlot, setSelectedSlot] = useState<SlotOption | null>(null);
  const [confirmed, setConfirmed] = useState<{ referenceNumber: string } | null>(null);

  const { data: slots = [], isLoading: slotsLoading } = useQuery<SlotOption[]>({
    queryKey: [`/api/portal/available-slots?date=${selectedDate}&movementType=${selectedMovementType}`],
    enabled: step === "slot" || step === "form",
  });

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/portal/book", data);
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmed(data);
      setStep("confirm");
    },
    onError: (e: any) => toast({ title: "Booking failed", description: e.message, variant: "destructive" }),
  });

  const handleBookingSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSlot) return;
    const fd = new FormData(e.currentTarget);
    bookMutation.mutate({
      carrierName: fd.get("carrierName"),
      driverName: fd.get("driverName"),
      truckNumber: fd.get("truckNumber"),
      trailerNumber: fd.get("trailerNumber"),
      movementType: selectedMovementType,
      scheduledDate: selectedDate,
      timeWindowStart: selectedSlot.start,
      timeWindowEnd: selectedSlot.end,
      notes: fd.get("notes") || null,
    });
  };

  const handleReset = () => {
    setStep("date");
    setSelectedDate(formatDate(today));
    setSelectedMovementType("inbound");
    setSelectedSlot(null);
    setConfirmed(null);
  };

  const DATES = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    return { value: formatDate(d), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="bg-white dark:bg-slate-900 border-b shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <img src="/ksap-logo.png" alt="KSAP OTM Now" className="h-7 w-auto object-contain" />
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase mt-0.5">Carrier Appointment Portal</div>
          </div>
        </div>
        <Badge className="text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
          Accepting Bookings
        </Badge>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">

        {step !== "confirm" && (
          <div className="flex items-center gap-2 mb-6">
            {["date", "slot", "form"].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s ? "bg-primary text-primary-foreground" :
                  ["date", "slot", "form"].indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {["date", "slot", "form"].indexOf(step) > i ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:inline ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
                  {["Choose Date", "Pick Slot", "Your Details"][i]}
                </span>
                {i < 2 && <div className="flex-1 h-px bg-border" />}
              </div>
            ))}
          </div>
        )}

        {step === "date" && (
          <Card className="shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" /> Choose Appointment Date
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Select a date and movement type to view available time slots</p>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Movement Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {MOVEMENT_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setSelectedMovementType(value)}
                      className={`border rounded-lg p-3 text-center transition-all ${selectedMovementType === value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/30"}`}
                    >
                      <Icon className={`h-5 w-5 mx-auto mb-1 ${selectedMovementType === value ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-xs font-medium leading-tight">{label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Date</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {DATES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setSelectedDate(value)}
                      className={`border rounded-lg p-2.5 text-center text-xs font-medium transition-all ${selectedDate === value ? "border-primary bg-primary/5 ring-1 ring-primary/30 text-primary" : "border-border hover:border-primary/30"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full h-12 gap-2 text-base" onClick={() => setStep("slot")}>
                View Available Slots <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "slot" && (
          <Card className="shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStep("date")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold">Available Time Slots</h2>
                  <p className="text-sm text-muted-foreground">{displayDate(selectedDate)} · {selectedMovementType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                </div>
              </div>

              {slotsLoading ? (
                <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
              ) : (
                <div className="space-y-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.start}
                      disabled={slot.isFull}
                      onClick={() => { setSelectedSlot(slot); setStep("form"); }}
                      className={`w-full border rounded-xl p-4 text-left flex items-center gap-4 transition-all ${
                        slot.isFull
                          ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                          : "border-border hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99]"
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${slot.isFull ? "bg-muted" : "bg-primary/10"}`}>
                        <Clock className={`h-5 w-5 ${slot.isFull ? "text-muted-foreground" : "text-primary"}`} />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{slot.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {slot.available} slot{slot.available !== 1 ? "s" : ""} available
                        </div>
                      </div>
                      {slot.isFull ? (
                        <Badge className="bg-red-100 text-red-700 text-[10px]">Full</Badge>
                      ) : (
                        <div className="flex gap-0.5">
                          {Array.from({ length: 3 }, (_, i) => (
                            <div key={i} className={`h-2.5 w-2.5 rounded-full ${i < slot.available ? "bg-emerald-500" : "bg-muted"}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === "form" && selectedSlot && (
          <Card className="shadow-sm">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setStep("slot")}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold">Your Details</h2>
                  <p className="text-sm text-muted-foreground">{displayDate(selectedDate)} · {selectedSlot.label}</p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold">{selectedSlot.label}</span>
                  <span className="text-muted-foreground ml-2">on {displayDate(selectedDate)}</span>
                </div>
              </div>

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Company / Carrier Name *</Label>
                  <Input name="carrierName" required placeholder="e.g. FastMove Logistics" className="mt-1 h-11" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Driver Name</Label>
                    <Input name="driverName" placeholder="Driver name" className="mt-1 h-11" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Truck / Tractor #</Label>
                    <Input name="truckNumber" placeholder="TRK-0001" className="mt-1 h-11" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Trailer #</Label>
                    <Input name="trailerNumber" placeholder="TRL-0001" className="mt-1 h-11" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Notes (optional)</Label>
                    <Input name="notes" placeholder="Any special instructions" className="mt-1 h-11" />
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  By submitting this form you confirm your carrier details are accurate. A reference number will be issued upon confirmation.
                </div>

                <Button type="submit" className="w-full h-12 text-base gap-2 font-bold" disabled={bookMutation.isPending}>
                  {bookMutation.isPending ? "Booking…" : <><CheckCircle2 className="h-5 w-5" /> Confirm Booking</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "confirm" && confirmed && (
          <Card className="shadow-sm border-emerald-200 dark:border-emerald-900/50">
            <CardContent className="p-8 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold">Booking Confirmed!</h2>
              <p className="text-muted-foreground text-sm">Your appointment has been scheduled. Show this reference number at the gate.</p>
              <div className="bg-muted/50 rounded-xl py-4 px-6 inline-block mx-auto">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Reference Number</div>
                <div className="text-2xl font-black tracking-widest text-primary">{confirmed.referenceNumber}</div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1 pt-2">
                <p><strong>{displayDate(selectedDate)}</strong> · {selectedSlot?.label}</p>
                <p className="capitalize">{selectedMovementType.replace(/_/g, " ")}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                  Print Confirmation
                </Button>
                <Button className="flex-1" onClick={handleReset}>
                  Book Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
