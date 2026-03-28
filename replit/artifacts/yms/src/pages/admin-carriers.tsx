import { useState, useMemo } from "react";
import { SearchAutocomplete } from "@/components/enterprise/search-autocomplete";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatusChip, EmptyState } from "@/components/enterprise";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { activeStatusColor } from "@/lib/status-colors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Building2, ArrowUpDown, ArrowUp, ArrowDown, Star,
  Clock, Truck, Phone, Mail, MapPin, Pencil, X, Check,
  TrendingUp, TrendingDown, Minus, Users,
} from "lucide-react";
import type { Carrier } from "@shared/schema";

interface CarrierPerformance {
  carrierId: number;
  totalVisits: number;
  avgDwellMinutes: number;
  avgDelayMinutes: number;
  onTimeRate: number | null;
  rating: number;
}

type SortField = "name" | "scacCode" | "rating" | "avgDwell" | "onTime" | "inYard";
type SortDir = "asc" | "desc";

function formatDwell(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return sortDir === "asc"
    ? <ArrowUp className="h-3 w-3 ml-1" />
    : <ArrowDown className="h-3 w-3 ml-1" />;
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sz = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sz} ${s <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20 fill-muted-foreground/10"}`}
        />
      ))}
    </div>
  );
}

function ratingLabel(rating: number): string {
  switch (rating) {
    case 5: return "Excellent";
    case 4: return "Good";
    case 3: return "Average";
    case 2: return "Below Avg";
    case 1: return "Poor";
    default: return "No data";
  }
}

function ratingColor(rating: number): string {
  switch (rating) {
    case 5: return "text-emerald-600 dark:text-emerald-400";
    case 4: return "text-blue-600 dark:text-blue-400";
    case 3: return "text-amber-600 dark:text-amber-400";
    case 2: return "text-orange-600 dark:text-orange-400";
    case 1: return "text-red-600 dark:text-red-400";
    default: return "text-muted-foreground";
  }
}

function OnTimeBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = rate >= 90 ? "bg-emerald-500" : rate >= 75 ? "bg-blue-500" : rate >= 60 ? "bg-amber-500" : "bg-red-500";
  const textColor = rate >= 75 ? "text-emerald-600 dark:text-emerald-400" : rate >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${textColor}`}>{rate}%</span>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
      <div className={`rounded-md p-2 ${color} shrink-0`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums leading-tight" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
        <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

interface EditForm {
  name: string;
  scacCode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  isActive: boolean;
}

function CarrierDetailPanel({
  carrier,
  perf,
  inYard,
  onClose,
  onSaved,
}: {
  carrier: Carrier;
  perf: CarrierPerformance | undefined;
  inYard: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({
    name: carrier.name,
    scacCode: carrier.scacCode || "",
    contactName: carrier.contactName || "",
    contactEmail: carrier.contactEmail || "",
    contactPhone: carrier.contactPhone || "",
    address: carrier.address || "",
    isActive: carrier.isActive,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditForm) => {
      const res = await apiRequest("PATCH", `/api/carriers/${carrier.id}`, {
        ...data,
        scacCode: data.scacCode || null,
        contactName: data.contactName || null,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        address: data.address || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      setEditing(false);
      onSaved();
      toast({ title: "Carrier updated", description: `${form.name} has been saved.` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const res = await apiRequest("PATCH", `/api/carriers/${carrier.id}`, { isActive });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      setForm((f) => ({ ...f, isActive: data.isActive }));
      toast({ title: data.isActive ? "Carrier activated" : "Carrier deactivated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const f = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="flex flex-col h-full" data-testid="carrier-detail-panel">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold leading-tight" data-testid="text-detail-carrier-name">{carrier.name}</h2>
            {carrier.scacCode && (
              <Badge variant="secondary" className="font-mono text-xs">{carrier.scacCode}</Badge>
            )}
            <StatusChip
              status={form.isActive ? "active" : "inactive"}
              colorFn={() => activeStatusColor(form.isActive)}
              label={form.isActive ? "Active" : "Inactive"}
              size="sm"
            />
          </div>
          {inYard > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {inYard} trailer{inYard !== 1 ? "s" : ""} in yard now
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" data-testid="button-close-detail">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pt-3">
        {/* Performance Summary */}
        {perf ? (
          <div className="rounded-md border bg-muted/20 p-3 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Performance</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Overall Rating</p>
                <StarRating rating={perf.rating} size="md" />
                <p className={`text-xs font-semibold mt-0.5 ${ratingColor(perf.rating)}`}>{ratingLabel(perf.rating)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">On-Time Rate</p>
                <OnTimeBar rate={perf.onTimeRate} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Avg Dwell Time</p>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className={`text-sm font-semibold tabular-nums ${perf.avgDwellMinutes > 720 ? "text-red-600 dark:text-red-400" : perf.avgDwellMinutes > 480 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                    {formatDwell(perf.avgDwellMinutes)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">Total Visits</p>
                <div className="flex items-center gap-1">
                  <Truck className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm font-semibold tabular-nums">{perf.totalVisits}</span>
                </div>
              </div>
            </div>
            <div className="border-t pt-2.5">
              <p className="text-[10px] text-muted-foreground mb-1">Avg vs Appointment Window</p>
              <div className="flex items-center gap-1.5">
                {perf.avgDelayMinutes > 0
                  ? <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  : perf.avgDelayMinutes < 0
                    ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    : <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                }
                <span className={`text-xs font-medium ${perf.avgDelayMinutes > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {perf.avgDelayMinutes > 0
                    ? `${perf.avgDelayMinutes}m late on average`
                    : perf.avgDelayMinutes < 0
                      ? `${Math.abs(perf.avgDelayMinutes)}m early on average`
                      : "On time"
                  }
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-center text-xs text-muted-foreground">
            No performance data yet — carrier hasn't completed any visits.
          </div>
        )}

        <Separator />

        {/* Contact / Edit section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact Info</p>
            {!editing && (
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setEditing(true)} data-testid="button-edit-carrier">
                <Pencil className="h-2.5 w-2.5 mr-1" /> Edit
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Company Name *</Label>
                  <Input className="h-7 text-xs" value={form.name} onChange={f("name")} data-testid="input-edit-name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">SCAC Code</Label>
                  <Input className="h-7 text-xs font-mono" value={form.scacCode} onChange={f("scacCode")} maxLength={10} data-testid="input-edit-scac" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Contact Name</Label>
                  <Input className="h-7 text-xs" value={form.contactName} onChange={f("contactName")} data-testid="input-edit-contact-name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Contact Email</Label>
                  <Input className="h-7 text-xs" type="email" value={form.contactEmail} onChange={f("contactEmail")} data-testid="input-edit-contact-email" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Phone</Label>
                  <Input className="h-7 text-xs" value={form.contactPhone} onChange={f("contactPhone")} data-testid="input-edit-phone" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Address</Label>
                  <Input className="h-7 text-xs" value={form.address} onChange={f("address")} data-testid="input-edit-address" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm" className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => updateMutation.mutate(form)}
                  disabled={updateMutation.isPending || !form.name}
                  data-testid="button-save-carrier"
                >
                  <Check className="h-3 w-3 mr-1" />
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditing(false); setForm({ name: carrier.name, scacCode: carrier.scacCode || "", contactName: carrier.contactName || "", contactEmail: carrier.contactEmail || "", contactPhone: carrier.contactPhone || "", address: carrier.address || "", isActive: carrier.isActive }); }} data-testid="button-cancel-edit">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {carrier.contactName && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span data-testid="text-detail-contact-name">{carrier.contactName}</span>
                </div>
              )}
              {carrier.contactEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <a href={`mailto:${carrier.contactEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline text-xs" data-testid="text-detail-contact-email">{carrier.contactEmail}</a>
                </div>
              )}
              {carrier.contactPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs" data-testid="text-detail-contact-phone">{carrier.contactPhone}</span>
                </div>
              )}
              {carrier.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs text-muted-foreground" data-testid="text-detail-address">{carrier.address}</span>
                </div>
              )}
              {!carrier.contactName && !carrier.contactEmail && !carrier.contactPhone && !carrier.address && (
                <p className="text-xs text-muted-foreground italic">No contact info on file. Click Edit to add.</p>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Active/Inactive Toggle */}
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Carrier Status</p>
            <p className="text-[11px] text-muted-foreground">
              {form.isActive ? "Accepting visits and appointments" : "Blocked from new appointments"}
            </p>
          </div>
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => toggleActiveMutation.mutate(v)}
            disabled={toggleActiveMutation.isPending}
            data-testid="switch-carrier-active"
          />
        </div>
      </div>
    </div>
  );
}

export default function AdminCarriersPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField | null>("rating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);

  const { data: carriers = [], isLoading } = useQuery<Carrier[]>({ queryKey: ["/api/carriers"] });
  const { data: performance = [] } = useQuery<CarrierPerformance[]>({ queryKey: ["/api/admin/carriers/performance"], refetchInterval: 120000, refetchIntervalInBackground: false });
  const { data: inYardMap = {} } = useQuery<Record<number, number>>({ queryKey: ["/api/carriers/in-yard"], refetchInterval: 60000, refetchIntervalInBackground: false });

  const perfMap = useMemo(() => {
    const m: Record<number, CarrierPerformance> = {};
    performance.forEach((p) => { m[p.carrierId] = p; });
    return m;
  }, [performance]);

  const kpis = useMemo(() => {
    const active = carriers.filter((c) => c.isActive).length;
    const totalInYard = Object.values(inYardMap).reduce((a, b) => a + b, 0);
    const withRate = performance.filter((p) => p.onTimeRate !== null);
    const avgOnTime = withRate.length > 0
      ? Math.round(withRate.reduce((a, p) => a + (p.onTimeRate ?? 0), 0) / withRate.length)
      : null;
    const worst = performance.length > 0
      ? performance.reduce((a, b) => (a.rating < b.rating ? a : b))
      : null;
    const worstCarrier = worst ? carriers.find((c) => c.id === worst.carrierId) : null;
    return { active, total: carriers.length, totalInYard, avgOnTime, worstCarrier, worstRating: worst?.rating };
  }, [carriers, performance, inYardMap]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/carriers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carriers"] });
      setOpen(false);
      toast({ title: "Carrier created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate({
      name: fd.get("name"),
      scacCode: fd.get("scacCode") || null,
      contactName: fd.get("contactName") || null,
      contactEmail: fd.get("contactEmail") || null,
      contactPhone: fd.get("contactPhone") || null,
      address: fd.get("address") || null,
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "rating" || field === "inYard" ? "desc" : "asc"); }
  };

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    carriers.forEach((c) => {
      set.add(c.name);
      if (c.scacCode) set.add(c.scacCode);
      if (c.contactName) set.add(c.contactName);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [carriers]);

  const processed = useMemo(() => {
    let result = [...carriers];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.scacCode?.toLowerCase().includes(q) ||
        c.contactName?.toLowerCase().includes(q) ||
        c.contactEmail?.toLowerCase().includes(q)
      );
    }
    if (activeFilter === "active") result = result.filter((c) => c.isActive);
    else if (activeFilter === "inactive") result = result.filter((c) => !c.isActive);
    else if (activeFilter === "in-yard") result = result.filter((c) => (inYardMap[c.id] ?? 0) > 0);
    if (sortField) {
      result.sort((a, b) => {
        let aVal: number | string = 0;
        let bVal: number | string = 0;
        if (sortField === "name") { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
        else if (sortField === "scacCode") { aVal = (a.scacCode ?? "").toLowerCase(); bVal = (b.scacCode ?? "").toLowerCase(); }
        else if (sortField === "rating") { aVal = perfMap[a.id]?.rating ?? 0; bVal = perfMap[b.id]?.rating ?? 0; }
        else if (sortField === "avgDwell") { aVal = perfMap[a.id]?.avgDwellMinutes ?? 9999; bVal = perfMap[b.id]?.avgDwellMinutes ?? 9999; }
        else if (sortField === "onTime") { aVal = perfMap[a.id]?.onTimeRate ?? -1; bVal = perfMap[b.id]?.onTimeRate ?? -1; }
        else if (sortField === "inYard") { aVal = inYardMap[a.id] ?? 0; bVal = inYardMap[b.id] ?? 0; }
        const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [carriers, search, activeFilter, sortField, sortDir, perfMap, inYardMap]);

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="inline-flex items-center cursor-pointer select-none font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap"
      onClick={() => toggleSort(field)}
      data-testid={`sort-${field}`}
    >
      {children}<SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  );

  const selectedPerf = selectedCarrier ? perfMap[selectedCarrier.id] : undefined;
  const selectedInYard = selectedCarrier ? (inYardMap[selectedCarrier.id] ?? 0) : 0;

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Carrier Management"
        subtitle="Monitor performance, manage contacts, and control access for all carrier partners"
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-carrier">
                <Plus className="h-4 w-4 mr-1.5" /> Add Carrier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Carrier</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Company Name *</Label><Input name="name" required data-testid="input-carrier-name" /></div>
                  <div className="space-y-1.5"><Label>SCAC Code</Label><Input name="scacCode" maxLength={10} data-testid="input-scac" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Contact Name</Label><Input name="contactName" data-testid="input-contact-name" /></div>
                  <div className="space-y-1.5"><Label>Contact Email</Label><Input name="contactEmail" type="email" data-testid="input-contact-email" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Contact Phone</Label><Input name="contactPhone" data-testid="input-contact-phone" /></div>
                  <div className="space-y-1.5"><Label>Address</Label><Input name="address" data-testid="input-address" /></div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-carrier">
                    {createMutation.isPending ? "Creating…" : "Add Carrier"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {/* KPI Strip */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total Carriers" value={kpis.total} sub={`${kpis.active} active`} icon={Building2} color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />
          <KpiCard label="Trailers In Yard" value={kpis.totalInYard} sub="across all carriers" icon={Truck} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
          <KpiCard label="Avg On-Time Rate" value={kpis.avgOnTime !== null ? `${kpis.avgOnTime}%` : "—"} sub="across all carriers" icon={TrendingUp} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" />
          <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
            <div className="rounded-md p-2 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 shrink-0">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">Needs Attention</p>
              {kpis.worstCarrier ? (
                <>
                  <p className="text-sm font-bold leading-tight truncate mt-0.5" data-testid="kpi-worst-carrier">{kpis.worstCarrier.name}</p>
                  <StarRating rating={kpis.worstRating ?? 0} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">—</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <SearchAutocomplete
          value={search}
          onChange={setSearch}
          suggestions={suggestions}
          placeholder="Search carriers…"
          className="max-w-xs"
          data-testid="input-search-carriers"
        />
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-active-filter">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Carriers</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
            <SelectItem value="in-yard">In Yard Now</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Two-column body */}
      <div className="flex gap-3 flex-1 min-h-0" style={{ minHeight: "400px" }}>
        {/* Left — carrier list */}
        <div className={`flex flex-col min-h-0 overflow-hidden rounded-lg border bg-card transition-all ${selectedCarrier ? "w-[58%] shrink-0" : "flex-1"}`}>
          {/* List header */}
          <div className="grid gap-0 border-b bg-muted/40 px-3 py-2" style={{ gridTemplateColumns: "1fr 70px 90px 80px 80px 55px" }}>
            <SortBtn field="name">Carrier</SortBtn>
            <SortBtn field="scacCode">SCAC</SortBtn>
            <SortBtn field="rating">Rating</SortBtn>
            <SortBtn field="onTime">On-Time</SortBtn>
            <SortBtn field="avgDwell">Dwell</SortBtn>
            <SortBtn field="inYard">In Yard</SortBtn>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y" data-testid="table-carriers">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : processed.length === 0 ? (
              <EmptyState
                icon={<Building2 className="h-5 w-5" />}
                heading="No carriers found"
                description="No carriers match the current search. Add a carrier or adjust the filter."
                compact
                data-testid="text-no-carriers"
              />
            ) : (
              processed.map((c) => {
                const perf = perfMap[c.id];
                const yard = inYardMap[c.id] ?? 0;
                const isSelected = selectedCarrier?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className={`grid items-center gap-0 px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${
                      isSelected
                        ? "bg-primary/8 dark:bg-primary/12 border-l-primary"
                        : "hover:bg-muted/30 border-l-transparent"
                    } ${!c.isActive ? "opacity-60" : ""}`}
                    style={{ gridTemplateColumns: "1fr 70px 90px 80px 80px 55px" }}
                    onClick={() => setSelectedCarrier(isSelected ? null : c)}
                    data-testid={`row-carrier-${c.id}`}
                  >
                    {/* Name */}
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm truncate" data-testid={`text-carrier-name-${c.id}`}>{c.name}</span>
                        {!c.isActive && <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">Inactive</Badge>}
                      </div>
                      {c.contactName && <p className="text-[10px] text-muted-foreground truncate">{c.contactName}</p>}
                    </div>

                    {/* SCAC */}
                    <div>
                      {c.scacCode
                        ? <Badge variant="secondary" className="text-[10px] font-mono px-1.5" data-testid={`text-carrier-scac-${c.id}`}>{c.scacCode}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>
                      }
                    </div>

                    {/* Rating */}
                    <div data-testid={`text-carrier-rating-${c.id}`}>
                      {perf
                        ? <div className="space-y-0.5"><StarRating rating={perf.rating} /><p className={`text-[9px] font-semibold ${ratingColor(perf.rating)}`}>{ratingLabel(perf.rating)}</p></div>
                        : <span className="text-[10px] text-muted-foreground">No data</span>
                      }
                    </div>

                    {/* On-Time */}
                    <div data-testid={`text-carrier-ontime-${c.id}`}>
                      <OnTimeBar rate={perf?.onTimeRate ?? null} />
                    </div>

                    {/* Avg Dwell */}
                    <div data-testid={`text-carrier-dwell-${c.id}`}>
                      {perf ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                          <span className={`text-xs font-medium tabular-nums ${perf.avgDwellMinutes > 720 ? "text-red-600 dark:text-red-400" : perf.avgDwellMinutes > 480 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                            {formatDwell(perf.avgDwellMinutes)}
                          </span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>

                    {/* In Yard */}
                    <div data-testid={`text-carrier-inyard-${c.id}`}>
                      {yard > 0
                        ? <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" /><span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{yard}</span></div>
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer count */}
          {processed.length > 0 && (
            <div className="px-3 py-1.5 border-t bg-muted/30 text-[10px] text-muted-foreground">
              {processed.length} carrier{processed.length !== 1 ? "s" : ""}
              {Object.values(inYardMap).reduce((a, b) => a + b, 0) > 0 && ` · ${Object.values(inYardMap).reduce((a, b) => a + b, 0)} trailers in yard`}
            </div>
          )}
        </div>

        {/* Right — detail panel */}
        {selectedCarrier && (
          <div className="flex-1 min-w-0 rounded-lg border bg-card p-4 overflow-hidden" data-testid="right-panel">
            <CarrierDetailPanel
              key={selectedCarrier.id}
              carrier={selectedCarrier}
              perf={selectedPerf}
              inYard={selectedInYard}
              onClose={() => setSelectedCarrier(null)}
              onSaved={() => {}}
            />
          </div>
        )}

        {/* Empty right state */}
        {!selectedCarrier && !isLoading && processed.length > 0 && (
          <div className="w-[280px] shrink-0 rounded-lg border border-dashed border-muted-foreground/20 bg-muted/10 flex flex-col items-center justify-center gap-2 text-center px-6">
            <Building2 className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground font-medium">Select a carrier</p>
            <p className="text-[10px] text-muted-foreground/60">to view performance, contact details, and edit settings</p>
          </div>
        )}
      </div>
    </div>
  );
}
