import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, StatusChip } from "@/components/enterprise";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, DoorOpen, LogIn, Star, CheckSquare, X, Search, LayoutGrid } from "lucide-react";
import type { YardZone, YardSlot, DockDoor, Gate } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZoneCapacity {
  zoneId: number;
  totalSlots: number;
  activeSlots: number;
  availableSlots: number;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  return tier === "premium" ? (
    <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 gap-0.5">
      <Star className="h-2.5 w-2.5 fill-current" /> Premium
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-[10px]">Standard</Badge>
  );
}

function CapacityBar({ cap }: { cap: ZoneCapacity | undefined }) {
  if (!cap) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = cap.totalSlots > 0 ? Math.round((cap.availableSlots / cap.totalSlots) * 100) : 0;
  return (
    <div className="min-w-[110px] space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{cap.availableSlots} free</span><span>{cap.totalSlots} total</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BulkBar({
  count, onClear, onSetTier, onSetStatus, loading,
}: {
  count: number; onClear: () => void;
  onSetTier: (t: string) => void; onSetStatus: (a: boolean) => void; loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
      <CheckSquare className="h-4 w-4 text-primary flex-shrink-0" />
      <span className="font-medium text-primary">{count} selected</span>
      <div className="flex flex-wrap gap-1.5 ml-1">
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading}
          onClick={() => onSetTier("premium")}><Star className="h-3 w-3 mr-1" />Premium</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" disabled={loading}
          onClick={() => onSetTier("standard")}>Standard</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          disabled={loading} onClick={() => onSetStatus(true)}>Activate</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
          disabled={loading} onClick={() => onSetStatus(false)}>Deactivate</Button>
      </div>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto" onClick={onClear}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <Card className="flex-1 min-w-[120px]">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Tab toolbar: search + optional select + optional toggle ──────────────────
function Toolbar({
  search, onSearch, placeholder = "Search…",
  select, addButton,
}: {
  search: string; onSearch: (v: string) => void; placeholder?: string;
  select?: React.ReactNode; addButton: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 justify-between flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder} className="pl-8 h-8 w-[180px] text-sm" />
        </div>
        {select}
      </div>
      {addButton}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminYardSetupPage() {
  const { toast } = useToast();

  // Dialog open state
  const [zoneOpen, setZoneOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  // Deactivate confirmation
  const [confirmTarget, setConfirmTarget] = useState<{ type: string; id: number; name: string } | null>(null);

  // Zones filters
  const [zonesSearch, setZonesSearch] = useState("");
  const [zonesTypeFilter, setZonesTypeFilter] = useState("all");
  const [zonesShowInactive, setZonesShowInactive] = useState(false);

  // Slots filters + bulk
  const [slotsSearch, setSlotsSearch] = useState("");
  const [slotsZoneFilter, setSlotsZoneFilter] = useState("all");
  const [slotsStatusFilter, setSlotsStatusFilter] = useState("active");
  const [selectedSlotIds, setSelectedSlotIds] = useState<number[]>([]);

  // Doors filters + bulk
  const [doorsSearch, setDoorsSearch] = useState("");
  const [doorsTypeFilter, setDoorsTypeFilter] = useState("all");
  const [doorsStatusFilter, setDoorsStatusFilter] = useState("active");
  const [selectedDoorIds, setSelectedDoorIds] = useState<number[]>([]);

  // Gates filters
  const [gatesSearch, setGatesSearch] = useState("");
  const [gatesShowInactive, setGatesShowInactive] = useState(false);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: zones = [], isLoading: zonesLoading } = useQuery<YardZone[]>({ queryKey: ["/api/yard/zones"] });
  const { data: slots = [] } = useQuery<YardSlot[]>({ queryKey: ["/api/yard/slots"] });
  const { data: doors = [] } = useQuery<DockDoor[]>({ queryKey: ["/api/dock/all-doors"] });
  const { data: gatesList = [] } = useQuery<Gate[]>({ queryKey: ["/api/gates"] });
  const { data: capacity = [] } = useQuery<ZoneCapacity[]>({ queryKey: ["/api/yard/zones/capacity"] });

  const capacityMap = useMemo(() => {
    const m: Record<number, ZoneCapacity> = {};
    capacity.forEach((c) => { m[c.zoneId] = c; });
    return m;
  }, [capacity]);

  const zoneMap = useMemo(() => {
    const m: Record<number, string> = {};
    zones.forEach((z) => { m[z.id] = z.name; });
    return m;
  }, [zones]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activeZones = zones.filter((z) => z.isActive).length;
  const activeSlots = slots.filter((s) => s.isActive).length;
  const totalSlots  = slots.length;
  const slotPct     = totalSlots > 0 ? Math.round((activeSlots / totalSlots) * 100) : 0;
  const activeDoors = doors.filter((d) => d.isActive).length;
  const activeGates = gatesList.filter((g) => g.isActive).length;

  // ── Create mutations ───────────────────────────────────────────────────────
  const createZoneMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/yard/zones", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/yard/zones"] }); setZoneOpen(false); toast({ title: "Zone created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const createSlotMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/yard/slots", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yard/slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yard/zones/capacity"] });
      setSlotOpen(false); toast({ title: "Slot created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const createDoorMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/dock/doors", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/dock/all-doors"] }); setDoorOpen(false); toast({ title: "Door created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const createGateMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/gates", data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/gates"] }); setGateOpen(false); toast({ title: "Gate created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Patch mutations ────────────────────────────────────────────────────────
  const patchZoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => (await apiRequest("PATCH", `/api/yard/zones/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/yard/zones"] }); toast({ title: "Zone updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const patchSlotMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/yard/slots/${id}`, data);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yard/slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yard/zones/capacity"] });
      toast({ title: "Slot updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const patchDoorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/dock/doors/${id}`, data);
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/dock/all-doors"] }); toast({ title: "Door updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const patchGateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => (await apiRequest("PATCH", `/api/gates/${id}`, data)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/gates"] }); toast({ title: "Gate updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const bulkSlotsMutation = useMutation({
    mutationFn: async ({ ids, data }: { ids: number[]; data: any }) =>
      (await apiRequest("POST", "/api/yard/slots/bulk", { ids, data })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yard/slots"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yard/zones/capacity"] });
      setSelectedSlotIds([]); toast({ title: "Slots updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const bulkDoorsMutation = useMutation({
    mutationFn: async ({ ids, data }: { ids: number[]; data: any }) =>
      (await apiRequest("POST", "/api/dock/doors/bulk", { ids, data })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dock/all-doors"] });
      setSelectedDoorIds([]); toast({ title: "Doors updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Deactivate confirm ────────────────────────────────────────────────────
  const handleDeactivateConfirm = () => {
    if (!confirmTarget) return;
    const { type, id } = confirmTarget;
    if (type === "zone") patchZoneMutation.mutate({ id, data: { isActive: false } });
    else if (type === "slot") patchSlotMutation.mutate({ id, data: { isActive: false } });
    else if (type === "door") patchDoorMutation.mutate({ id, data: { isActive: false } });
    else if (type === "gate") patchGateMutation.mutate({ id, data: { isActive: false } });
    setConfirmTarget(null);
  };

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filteredZones = useMemo(() => {
    let r = zonesShowInactive ? zones : zones.filter((z) => z.isActive);
    if (zonesSearch) { const q = zonesSearch.toLowerCase(); r = r.filter((z) => z.name.toLowerCase().includes(q) || z.code.toLowerCase().includes(q)); }
    if (zonesTypeFilter !== "all") r = r.filter((z) => z.type === zonesTypeFilter);
    return r;
  }, [zones, zonesSearch, zonesTypeFilter, zonesShowInactive]);

  const filteredSlots = useMemo(() => {
    let r = slotsStatusFilter === "active" ? slots.filter((s) => s.isActive) : slotsStatusFilter === "inactive" ? slots.filter((s) => !s.isActive) : slots;
    if (slotsSearch) { const q = slotsSearch.toLowerCase(); r = r.filter((s) => s.slotNumber.toLowerCase().includes(q)); }
    if (slotsZoneFilter !== "all") r = r.filter((s) => String(s.zoneId) === slotsZoneFilter);
    return r;
  }, [slots, slotsSearch, slotsZoneFilter, slotsStatusFilter]);

  const filteredDoors = useMemo(() => {
    let r = doorsStatusFilter === "active" ? doors.filter((d) => d.isActive) : doorsStatusFilter === "inactive" ? doors.filter((d) => !d.isActive) : doors;
    if (doorsSearch) { const q = doorsSearch.toLowerCase(); r = r.filter((d) => d.doorNumber.toLowerCase().includes(q)); }
    if (doorsTypeFilter !== "all") r = r.filter((d) => d.compatibleType === doorsTypeFilter);
    return r;
  }, [doors, doorsSearch, doorsTypeFilter, doorsStatusFilter]);

  const filteredGates = useMemo(() => {
    let r = gatesShowInactive ? gatesList : gatesList.filter((g) => g.isActive);
    if (gatesSearch) { const q = gatesSearch.toLowerCase(); r = r.filter((g) => g.name.toLowerCase().includes(q)); }
    return r;
  }, [gatesList, gatesSearch, gatesShowInactive]);

  // ── Slot / door checkbox helpers ──────────────────────────────────────────
  const allSlotsSelected = filteredSlots.length > 0 && filteredSlots.every((s) => selectedSlotIds.includes(s.id));
  const toggleAllSlots = () => setSelectedSlotIds(allSlotsSelected ? [] : filteredSlots.map((s) => s.id));
  const toggleSlot = (id: number) => setSelectedSlotIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const allDoorsSelected = filteredDoors.length > 0 && filteredDoors.every((d) => selectedDoorIds.includes(d.id));
  const toggleAllDoors = () => setSelectedDoorIds(allDoorsSelected ? [] : filteredDoors.map((d) => d.id));
  const toggleDoor = (id: number) => setSelectedDoorIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // ── Inline active toggle handler (shows confirm when deactivating) ─────────
  const handleToggle = (type: string, id: number, name: string, current: boolean, patch: (v: boolean) => void) => {
    if (current) setConfirmTarget({ type, id, name });
    else patch(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full space-y-4 pb-6">

      <PageHeader
        title="Yard Setup"
        subtitle="Configure zones, slots, dock doors, and gates"
        icon={<LayoutGrid className="h-5 w-5" />}
      />

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <StatCard label="Active Zones"    value={activeZones}  color="text-blue-600" sub={`${zones.length} total`} />
        <StatCard label="Active Slots"    value={activeSlots}  color="text-emerald-600" sub={`${slotPct}% of ${totalSlots}`} />
        <StatCard label="Dock Doors"      value={activeDoors}  color="text-violet-600" sub={`${doors.length} total`} />
        <StatCard label="Active Gates"    value={activeGates}  color="text-amber-600"  sub={`${gatesList.length} total`} />
      </div>

      {/* ── Deactivate confirm dialog ─────────────────────────────────────── */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {confirmTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmTarget?.name}</strong> will be marked inactive and hidden from operational workflows. This can be reversed at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivateConfirm} className="bg-amber-600 hover:bg-amber-700">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 4 Tabs ───────────────────────────────────────────────────────── */}
      <Tabs defaultValue="zones" className="flex-1">
        <TabsList>
          <TabsTrigger value="zones"  data-testid="tab-zones">
            <MapPin  className="h-3.5 w-3.5 mr-1.5" /> Zones
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{activeZones}</Badge>
          </TabsTrigger>
          <TabsTrigger value="slots"  data-testid="tab-slots">
            Slots
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{activeSlots}</Badge>
          </TabsTrigger>
          <TabsTrigger value="doors"  data-testid="tab-doors">
            <DoorOpen className="h-3.5 w-3.5 mr-1.5" /> Dock Doors
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{activeDoors}</Badge>
          </TabsTrigger>
          <TabsTrigger value="gates"  data-testid="tab-gates">
            <LogIn className="h-3.5 w-3.5 mr-1.5" /> Gates
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">{activeGates}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ─── ZONES ─────────────────────────────────────────────────────── */}
        <TabsContent value="zones" className="space-y-3 mt-4">
          <Toolbar
            search={zonesSearch} onSearch={setZonesSearch} placeholder="Search zones…"
            select={
              <div className="flex items-center gap-2">
                <Select value={zonesTypeFilter} onValueChange={setZonesTypeFilter}>
                  <SelectTrigger className="h-8 w-[140px] text-xs" data-testid="select-zone-type-filter">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="parking">Parking</SelectItem>
                    <SelectItem value="reefer">Reefer</SelectItem>
                    <SelectItem value="hazmat">Hazmat</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  <Switch checked={zonesShowInactive} onCheckedChange={setZonesShowInactive}
                    className="scale-75" data-testid="toggle-zones-inactive" />
                  Show Inactive
                </label>
              </div>
            }
            addButton={
              <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-zone"><Plus className="h-4 w-4 mr-1" />Add Zone</Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Add Yard Zone</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createZoneMutation.mutate({ name: fd.get("name"), code: fd.get("code"), type: fd.get("type"), description: fd.get("description") || null });
                  }} className="space-y-3 mt-2">
                    <div className="space-y-1.5">
                      <Label>Zone Name *</Label>
                      <Input name="name" required data-testid="input-zone-name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Code *</Label>
                        <Input name="code" required maxLength={10} data-testid="input-zone-code" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select name="type" defaultValue="staging">
                          <SelectTrigger data-testid="select-zone-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="staging">Staging</SelectItem>
                            <SelectItem value="parking">Parking</SelectItem>
                            <SelectItem value="reefer">Reefer</SelectItem>
                            <SelectItem value="hazmat">Hazmat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input name="description" data-testid="input-zone-desc" />
                    </div>
                    <Button type="submit" className="w-full" disabled={createZoneMutation.isPending} data-testid="button-submit-zone">
                      {createZoneMutation.isPending ? "Creating…" : "Add Zone"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            }
          />

          {zonesLoading ? (
            <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
          ) : filteredZones.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">No zones match your search</div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <Table data-testid="table-zones">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Zone</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Slot Availability</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredZones.map((z) => (
                      <TableRow key={z.id} data-testid={`row-zone-${z.id}`} className={!z.isActive ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{z.name}</TableCell>
                        <TableCell><Badge variant="secondary" className="font-mono text-xs">{z.code}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{z.type}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{z.description || "—"}</TableCell>
                        <TableCell><CapacityBar cap={capacityMap[z.id]} /></TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={z.isActive}
                            onCheckedChange={() => handleToggle("zone", z.id, z.name, z.isActive,
                              () => patchZoneMutation.mutate({ id: z.id, data: { isActive: true } }))}
                            data-testid={`toggle-zone-${z.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── SLOTS ─────────────────────────────────────────────────────── */}
        <TabsContent value="slots" className="space-y-3 mt-4">
          {selectedSlotIds.length > 0 && (
            <BulkBar
              count={selectedSlotIds.length}
              onClear={() => setSelectedSlotIds([])}
              onSetTier={(tier) => bulkSlotsMutation.mutate({ ids: selectedSlotIds, data: { tier } })}
              onSetStatus={(active) => bulkSlotsMutation.mutate({ ids: selectedSlotIds, data: { isActive: active } })}
              loading={bulkSlotsMutation.isPending}
            />
          )}
          <Toolbar
            search={slotsSearch} onSearch={setSlotsSearch} placeholder="Search slots…"
            select={
              <div className="flex items-center gap-2">
                <Select value={slotsZoneFilter} onValueChange={setSlotsZoneFilter}>
                  <SelectTrigger className="h-8 w-[150px] text-xs" data-testid="select-slots-zone">
                    <SelectValue placeholder="All Zones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Zones</SelectItem>
                    {zones.map((z) => <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={slotsStatusFilter} onValueChange={setSlotsStatusFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs" data-testid="select-slots-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
            addButton={
              <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-slot"><Plus className="h-4 w-4 mr-1" />Add Slot</Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>Add Yard Slot</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createSlotMutation.mutate({
                      zoneId: Number(fd.get("zoneId")), slotNumber: fd.get("slotNumber"),
                      slotType: fd.get("slotType"), slotSize: fd.get("slotSize"),
                      tier: fd.get("tier"),
                      isReefer: fd.get("isReefer") === "on",
                      isHazmat: fd.get("isHazmat") === "on",
                    });
                  }} className="space-y-3 mt-2">
                    <div className="space-y-1.5">
                      <Label>Zone *</Label>
                      <Select name="zoneId" required>
                        <SelectTrigger data-testid="select-slot-zone"><SelectValue placeholder="Select zone" /></SelectTrigger>
                        <SelectContent>
                          {zones.filter((z) => z.isActive).map((z) => (
                            <SelectItem key={z.id} value={String(z.id)}>{z.name} ({z.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Slot Number *</Label>
                      <Input name="slotNumber" required data-testid="input-slot-number" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select name="slotType" defaultValue="standard">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="oversized">Oversized</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Size</Label>
                        <Select name="slotSize" defaultValue="standard">
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                            <SelectItem value="small">Small</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tier</Label>
                        <Select name="tier" defaultValue="standard">
                          <SelectTrigger data-testid="select-slot-tier"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isReefer" className="rounded" /> Reefer</label>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isHazmat" className="rounded" /> Hazmat</label>
                    </div>
                    <Button type="submit" className="w-full" disabled={createSlotMutation.isPending} data-testid="button-submit-slot">
                      {createSlotMutation.isPending ? "Creating…" : "Add Slot"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            }
          />

          {filteredSlots.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">No slots match your search</div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <Table data-testid="table-slots">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-9">
                        <Checkbox checked={allSlotsSelected} onCheckedChange={toggleAllSlots} data-testid="checkbox-select-all-slots" />
                      </TableHead>
                      <TableHead>Slot #</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSlots.map((s) => (
                      <TableRow key={s.id} data-testid={`row-slot-${s.id}`} className={!s.isActive ? "opacity-50" : ""}>
                        <TableCell>
                          <Checkbox checked={selectedSlotIds.includes(s.id)} onCheckedChange={() => toggleSlot(s.id)} data-testid={`checkbox-slot-${s.id}`} />
                        </TableCell>
                        <TableCell className="font-mono font-medium text-sm">{s.slotNumber}</TableCell>
                        <TableCell className="text-sm">{zoneMap[s.zoneId] || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{s.slotType}</Badge></TableCell>
                        <TableCell><TierBadge tier={(s as any).tier || "standard"} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {s.isReefer && <Badge variant="secondary" className="text-[10px]">Reefer</Badge>}
                            {s.isHazmat && <Badge variant="destructive" className="text-[10px]">Hazmat</Badge>}
                            {s.isBlocked && <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600">Blocked</Badge>}
                            {!s.isReefer && !s.isHazmat && !s.isBlocked && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={s.isActive}
                            onCheckedChange={() => handleToggle("slot", s.id, `Slot ${s.slotNumber}`, s.isActive,
                              () => patchSlotMutation.mutate({ id: s.id, data: { isActive: true } }))}
                            data-testid={`toggle-slot-${s.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── DOCK DOORS ────────────────────────────────────────────────── */}
        <TabsContent value="doors" className="space-y-3 mt-4">
          {selectedDoorIds.length > 0 && (
            <BulkBar
              count={selectedDoorIds.length}
              onClear={() => setSelectedDoorIds([])}
              onSetTier={(tier) => bulkDoorsMutation.mutate({ ids: selectedDoorIds, data: { tier } })}
              onSetStatus={(active) => bulkDoorsMutation.mutate({ ids: selectedDoorIds, data: { isActive: active } })}
              loading={bulkDoorsMutation.isPending}
            />
          )}
          <Toolbar
            search={doorsSearch} onSearch={setDoorsSearch} placeholder="Search doors…"
            select={
              <div className="flex items-center gap-2">
                <Select value={doorsTypeFilter} onValueChange={setDoorsTypeFilter}>
                  <SelectTrigger className="h-8 w-[150px] text-xs" data-testid="select-doors-type">
                    <SelectValue placeholder="All Compatible" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Compatible</SelectItem>
                    <SelectItem value="dry">Dry Only</SelectItem>
                    <SelectItem value="reefer">Reefer Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={doorsStatusFilter} onValueChange={setDoorsStatusFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs" data-testid="select-doors-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
            addButton={
              <Dialog open={doorOpen} onOpenChange={setDoorOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-door"><Plus className="h-4 w-4 mr-1" />Add Door</Button>
                </DialogTrigger>
                <DialogContent className="max-w-xs">
                  <DialogHeader><DialogTitle>Add Dock Door</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createDoorMutation.mutate({ doorNumber: fd.get("doorNumber"), compatibleType: fd.get("compatibleType"), tier: fd.get("tier") });
                  }} className="space-y-3 mt-2">
                    <div className="space-y-1.5">
                      <Label>Door Number *</Label>
                      <Input name="doorNumber" required data-testid="input-door-number" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Compatible Type</Label>
                      <Select name="compatibleType" defaultValue="all">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="dry">Dry Only</SelectItem>
                          <SelectItem value="reefer">Reefer Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tier</Label>
                      <Select name="tier" defaultValue="standard">
                        <SelectTrigger data-testid="select-door-tier"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={createDoorMutation.isPending} data-testid="button-submit-door">
                      {createDoorMutation.isPending ? "Creating…" : "Add Door"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            }
          />

          {filteredDoors.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">No dock doors match your search</div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <Table data-testid="table-doors">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-9">
                        <Checkbox checked={allDoorsSelected} onCheckedChange={toggleAllDoors} data-testid="checkbox-select-all-doors" />
                      </TableHead>
                      <TableHead>Door #</TableHead>
                      <TableHead>Compatible</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Op. Status</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoors.map((d) => (
                      <TableRow key={d.id} data-testid={`row-door-${d.id}`} className={!d.isActive ? "opacity-50" : ""}>
                        <TableCell>
                          <Checkbox checked={selectedDoorIds.includes(d.id)} onCheckedChange={() => toggleDoor(d.id)} data-testid={`checkbox-door-${d.id}`} />
                        </TableCell>
                        <TableCell className="font-mono font-medium">Door {d.doorNumber}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{d.compatibleType}</Badge></TableCell>
                        <TableCell><TierBadge tier={(d as any).tier || "standard"} /></TableCell>
                        <TableCell>
                          <StatusChip
                            status={d.status}
                            colorFn={(s) => s === "available"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400"}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={d.isActive}
                            onCheckedChange={() => handleToggle("door", d.id, `Door ${d.doorNumber}`, d.isActive,
                              () => patchDoorMutation.mutate({ id: d.id, data: { isActive: true } }))}
                            data-testid={`toggle-door-${d.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ─── GATES ─────────────────────────────────────────────────────── */}
        <TabsContent value="gates" className="space-y-3 mt-4">
          <Toolbar
            search={gatesSearch} onSearch={setGatesSearch} placeholder="Search gates…"
            select={
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                <Switch checked={gatesShowInactive} onCheckedChange={setGatesShowInactive}
                  className="scale-75" data-testid="toggle-gates-inactive" />
                Show Inactive
              </label>
            }
            addButton={
              <Dialog open={gateOpen} onOpenChange={setGateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-gate"><Plus className="h-4 w-4 mr-1" />Add Gate</Button>
                </DialogTrigger>
                <DialogContent className="max-w-xs">
                  <DialogHeader><DialogTitle>Add Gate</DialogTitle></DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createGateMutation.mutate({ name: fd.get("name"), type: fd.get("type") });
                  }} className="space-y-3 mt-2">
                    <div className="space-y-1.5">
                      <Label>Gate Name *</Label>
                      <Input name="name" required data-testid="input-gate-name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Direction</Label>
                      <Select name="type" defaultValue="both">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">In / Out</SelectItem>
                          <SelectItem value="in">In Only</SelectItem>
                          <SelectItem value="out">Out Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={createGateMutation.isPending} data-testid="button-submit-gate">
                      {createGateMutation.isPending ? "Creating…" : "Add Gate"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            }
          />

          {filteredGates.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">No gates configured yet</div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <Table data-testid="table-gates">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Gate Name</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGates.map((g) => (
                      <TableRow key={g.id} data-testid={`row-gate-${g.id}`} className={!g.isActive ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {g.type === "both" ? "In / Out" : g.type === "in" ? "In Only" : "Out Only"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={g.isActive}
                            onCheckedChange={() => handleToggle("gate", g.id, g.name, g.isActive,
                              () => patchGateMutation.mutate({ id: g.id, data: { isActive: true } }))}
                            data-testid={`toggle-gate-${g.id}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
