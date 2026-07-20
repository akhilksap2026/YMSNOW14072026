import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ZoomIn, ZoomOut, Maximize2, Truck,
  Layers, ArrowRight, HelpCircle, X,
  BookOpen, MapPin, ArrowUpDown, ChevronDown,
  AlertTriangle, Clock, PanelLeftClose, PanelLeftOpen,
  ShieldAlert, TrendingUp, CheckCircle2, Filter,
} from "lucide-react";
import { useTabletView } from "@/lib/tablet-view";

interface MapSlot {
  id: number; slotNumber: string; zoneName: string; zoneCode: string;
  isBlocked: boolean; isReefer: boolean; isHazmat: boolean;
  gridRow: number | null; gridCol: number | null;
  currentVisitId: number | null; visitNumber: string | null;
  trailerNumber: string | null; carrierName: string | null; carrierScac?: string | null;
  visitStatus: string | null; movementType?: string | null;
  holdStatus?: string | null; movePriority?: string | null;
  checkInTime?: string | null;
}
interface MapDoor {
  id: number; doorNumber: string; status: string;
  currentVisitId: number | null; visitNumber: string | null;
  trailerNumber: string | null; visitStatus: string | null;
}
interface Jockey { id: string; firstName: string | null; lastName: string | null; role: string; }
interface DragPayload {
  visitId: number; visitNumber: string; trailerNumber: string;
  fromType: "slot" | "dock"; fromId: number; fromName: string;
}
interface DropTarget { type: "slot" | "dock" | "gate"; id: number; name: string; }

const SLOT_W = 86;
const SLOT_H = 42;
const SLOT_NUM_H = 14;
const SLOT_GAP = 6;
const ZONE_PAD = 12;
const ZONE_HEADER = 38;
const DRAG_THRESHOLD = 8;

const BLDG_X = 30;
const BLDG_Y = 12;
const BLDG_W = 1360;
const BLDG_H = 82;
const WALL_Y = BLDG_Y + BLDG_H;
const DOOR_STEP = BLDG_W / 10;
const DOOR_W = 106;
const DOOR_H = 66;
const LANE_Y = WALL_Y + DOOR_H;
const LANE_H = 44;

const ZONE_ORIGINS: Record<string, { x: number; y: number; maxCols: number }> = {
  "STG-A": { x: 30,   y: 218, maxCols: 5 },
  "STG-B": { x: 530,  y: 218, maxCols: 6 },
  "HAZ":   { x: 1280, y: 218, maxCols: 1 },
  "RFR":   { x: 30,   y: 480, maxCols: 4 },
  "PKG-C": { x: 440,  y: 480, maxCols: 5 },
};

const GATE_X = 510;
const GATE_Y = 730;
const GATE_W = 240;
const GATE_H = 62;

function zoneW(cols: number) { return cols * (SLOT_W + SLOT_GAP) - SLOT_GAP + ZONE_PAD * 2; }
function zoneH(rows: number) { return ZONE_HEADER + ZONE_PAD + rows * (SLOT_H + SLOT_NUM_H) + (rows - 1) * SLOT_GAP + ZONE_PAD; }

function trailerFill(slot: MapSlot, isOver: boolean): string {
  if (isOver)                                              return "#3b82f6";
  if (slot.isBlocked)                                      return "#94a3b8";
  if (slot.holdStatus && slot.holdStatus !== "none")        return "#dc2626";
  if (slot.visitNumber) {
    if (slot.visitStatus === "ready_out")                   return "#d97706";
    if (slot.isReefer)                                      return "#0891b2";
    if (slot.movementType === "outbound")                   return "#7c3aed";
    return "#2563eb";
  }
  return "";
}
function trailerStroke(slot: MapSlot, isHov: boolean, isOver: boolean): string {
  if (isOver)                                              return "#2563eb";
  if (isHov)                                               return "#3b82f6";
  if (slot.holdStatus && slot.holdStatus !== "none")        return "#b91c1c";
  if (slot.visitNumber) {
    if (slot.visitStatus === "ready_out")                   return "#b45309";
    if (slot.isReefer)                                      return "#0e7490";
    if (slot.movementType === "outbound")                   return "#6d28d9";
    return "#1d4ed8";
  }
  return "#94a3b8";
}
function doorFill(door: MapDoor, isOver: boolean): string {
  if (isOver) return "#3b82f6";
  if (door.status === "maintenance") return "#64748b";
  return "#1e293b";
}
function scac(t: string | null): string { return t ? (t.split("-")[0] || "") : ""; }
function fmtStatus(s: string): string { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function dwellHours(checkInTime: string | null): number {
  if (!checkInTime) return 0;
  return (Date.now() - new Date(checkInTime).getTime()) / 3600000;
}
function isDetention(slot: MapSlot): boolean {
  if (slot.holdStatus && slot.holdStatus !== "none") return true;
  return dwellHours(slot.checkInTime ?? null) > 24;
}

function zTheme(code: string) {
  if (code === "RFR")   return { hdr: "#e0f2fe", border: "#38bdf8", title: "#0369a1", fill: "#f0f9ff" };
  if (code === "HAZ")   return { hdr: "#fecaca", border: "#ef4444", title: "#991b1b", fill: "#fef2f2" };
  if (code === "PKG-C") return { hdr: "#fef3c7", border: "#fbbf24", title: "#92400e", fill: "#fffbeb" };
  return { hdr: "#dcfce7", border: "#4ade80", title: "#15803d", fill: "#f0fdf4" };
}

type ZoomLevel = "far" | "mid" | "near";

const LEGEND_STATUS = [
  { color: "#f8fafc", stroke: "#cbd5e1", dash: true, label: "Empty slot" },
  { color: "#2563eb", label: "Inbound (active)" },
  { color: "#7c3aed", label: "Outbound" },
  { color: "#d97706", label: "Ready Out (pending)" },
  { color: "#dc2626", label: "On Hold (critical)" },
  { color: "#94a3b8", label: "Blocked" },
];
const LEGEND_ZONE = [
  { color: "#0891b2", label: "Reefer zone" },
  { color: "#dc2626", label: "Hazmat zone" },
  { color: "#4ade80", label: "Staging zone" },
  { color: "#fbbf24", label: "Package zone" },
];
const LEGEND_INDICATORS = [
  { node: <span key="p-high" className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /><span className="text-xs text-gray-600">High priority</span></span> },
  { node: <span key="p-med" className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /><span className="text-xs text-gray-600">Med priority</span></span> },
  { node: <span key="det" className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-dashed border-red-500 inline-block" /><span className="text-xs text-gray-600">Detention / Hold</span></span> },
  { node: <span key="in" className="flex items-center gap-1.5"><span className="text-blue-600 font-bold text-sm">▼</span><span className="text-xs text-gray-600">Inbound direction</span></span> },
  { node: <span key="out" className="flex items-center gap-1.5"><span className="text-violet-600 font-bold text-sm">▲</span><span className="text-xs text-gray-600">Outbound direction</span></span> },
];

const ZONE_DISPLAY_NAMES: Record<string, string> = {
  "STG-A": "Inbound Staging",
  "STG-B": "Outbound Ready",
  "HAZ":   "Insp. Hold",
  "RFR":   "Reefer Row",
  "PKG-C": "Live Load / Unload",
};
const ZONE_SUBTITLES: Record<string, string> = {
  "STG-A": "Drop & hook · Inbound",
  "STG-B": "Pre-departure · Loaded",
  "RFR":   "Temp-controlled · Plug-in",
  "PKG-C": "Dock-adjacent · Live moves",
};

export default function YardMapPage() {
  const { toast } = useToast();
  const { tabletMode } = useTabletView();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewBox, setViewBox] = useState({ x: -10, y: 0, w: 1430, h: 830 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
  const [hoveredDoor, setHoveredDoor] = useState<number | null>(null);
  const [hoverSlotData, setHoverSlotData] = useState<{ slot: MapSlot; x: number; y: number } | null>(null);
  const [hoverDoorData, setHoverDoorData] = useState<{ door: MapDoor; x: number; y: number } | null>(null);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPending, setDragPending] = useState(false);
  const [dragLine, setDragLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const pendingPayload = useRef<DragPayload | null>(null);
  const pendingOrigin = useRef<{ cx: number; cy: number } | null>(null);

  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveFrom, setMoveFrom] = useState<{ type: string; id: number; name: string } | null>(null);
  const [moveTo, setMoveTo] = useState<{ type: string; id: number; name: string } | null>(null);
  const [moveVisitId, setMoveVisitId] = useState<number | null>(null);
  const [moveVisitNumber, setMoveVisitNumber] = useState("");
  const [moveTrailer, setMoveTrailer] = useState("");
  const [selectedJockey, setSelectedJockey] = useState("");
  const [movePriority, setMovePriority] = useState("normal");
  const [moveNotes, setMoveNotes] = useState("");

  const [filterCarrier, setFilterCarrier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterZone, setFilterZone] = useState("all");
  const [filterDwell, setFilterDwell] = useState("all");

  const [showLegend, setShowLegend] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<MapSlot | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // Collapse left panel automatically in tablet mode
  useEffect(() => {
    if (tabletMode) setLeftPanelOpen(false);
    else setLeftPanelOpen(true);
  }, [tabletMode]);

  const { data: mapData, isLoading } = useQuery<{
    slots: MapSlot[];
    doors: MapDoor[];
    zones: Array<{ id: number; name: string; code: string }>;
  }>({ queryKey: ["/api/yard/map"], refetchInterval: 60000, refetchIntervalInBackground: false });

  const { data: jockeys = [] } = useQuery<Jockey[]>({ queryKey: ["/api/yard/jockeys"] });

  const createMoveMutation = useMutation({
    mutationFn: async (data: any) => (await apiRequest("POST", "/api/moves", data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moves"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yard/map"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yard/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/moves/summary"] });
      toast({ title: "Move request created", description: "Task added to work queue" });
      closeMoveDialog();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const slots = mapData?.slots || [];
  const doors = mapData?.doors || [];
  const zones = mapData?.zones || [];

  const zoomLevel = useMemo<ZoomLevel>(() => {
    if (viewBox.w > 1600) return "far";
    if (viewBox.w < 700) return "near";
    return "mid";
  }, [viewBox.w]);

  const zoneLayouts = useMemo(() => {
    const grouped: Record<string, MapSlot[]> = {};
    slots.forEach(s => {
      if (!grouped[s.zoneCode]) grouped[s.zoneCode] = [];
      grouped[s.zoneCode].push(s);
    });
    const layouts: Record<string, { x: number; y: number; w: number; h: number; cols: number; rows: number; zone: any }> = {};
    Object.entries(grouped).forEach(([code, zs]) => {
      const origin = ZONE_ORIGINS[code] || { x: 30, y: 218, maxCols: 5 };
      const zone = zones.find(z => z.code === code);
      const cols = Math.min(zs.length, origin.maxCols);
      const rows = Math.ceil(zs.length / cols);
      layouts[code] = { x: origin.x, y: origin.y, w: zoneW(cols), h: zoneH(rows), cols, rows, zone };
    });
    return { layouts, grouped };
  }, [slots, zones]);

  const slotPositions = useMemo(() => {
    const positions: Record<number, { cx: number; cy: number }> = {};
    Object.entries(zoneLayouts.grouped).forEach(([code, zs]) => {
      const layout = zoneLayouts.layouts[code];
      if (!layout) return;
      zs.forEach((s, idx) => {
        const col = idx % layout.cols;
        const row = Math.floor(idx / layout.cols);
        const cx = layout.x + ZONE_PAD + col * (SLOT_W + SLOT_GAP) + SLOT_W / 2;
        const cy = layout.y + ZONE_HEADER + ZONE_PAD + row * (SLOT_H + SLOT_NUM_H + SLOT_GAP) + SLOT_H / 2;
        positions[s.id] = { cx, cy };
      });
    });
    return positions;
  }, [zoneLayouts]);

  const doorPositions = useMemo(() => {
    const pos: Record<number, { cx: number; cy: number }> = {};
    doors.forEach((d, i) => { pos[d.id] = { cx: BLDG_X + (i + 0.5) * DOOR_STEP, cy: WALL_Y + DOOR_H / 2 }; });
    return pos;
  }, [doors]);

  const gatePos = useMemo(() => ({ x: GATE_X, y: GATE_Y, w: GATE_W, h: GATE_H }), []);

  // ── Operational queues ─────────────────────────────────────────────────────
  const queueOnHold = useMemo(() =>
    slots.filter(s => s.visitNumber && s.holdStatus && s.holdStatus !== "none"),
  [slots]);

  const queueAging = useMemo(() =>
    slots.filter(s => s.visitNumber && dwellHours(s.checkInTime ?? null) > 24 && !(s.holdStatus && s.holdStatus !== "none")),
  [slots]);

  const queueReadyOut = useMemo(() =>
    slots.filter(s => s.visitStatus === "ready_out"),
  [slots]);

  const queueHighPri = useMemo(() =>
    slots.filter(s => s.visitNumber && (s.movePriority === "high" || s.movePriority === "urgent") && !(s.holdStatus && s.holdStatus !== "none") && dwellHours(s.checkInTime ?? null) <= 24),
  [slots]);

  const uniqueCarriers = useMemo(() => {
    const names = new Set<string>();
    slots.forEach(s => { if (s.visitNumber && s.carrierName) names.add(s.carrierName); });
    return Array.from(names).sort();
  }, [slots]);

  const uniqueZones = useMemo(() =>
    zones.map(z => ({ code: z.code, name: z.name })),
  [zones]);

  function svgCoords(clientX: number, clientY: number) {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: ((clientX - r.left) / r.width) * viewBox.w + viewBox.x, y: ((clientY - r.top) / r.height) * viewBox.h + viewBox.y };
  }

  const handleZoom = useCallback((factor: number) => {
    setViewBox(p => {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      return { x: cx - (p.w * factor) / 2, y: cy - (p.h * factor) / 2, w: p.w * factor, h: p.h * factor };
    });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    setViewBox(p => {
      const mx = ((e.clientX - r.left) / r.width) * p.w + p.x;
      const my = ((e.clientY - r.top) / r.height) * p.h + p.y;
      const nw = p.w * factor, nh = p.h * factor;
      return { x: mx - (mx - p.x) * (nw / p.w), y: my - (my - p.y) * (nh / p.h), w: nw, h: nh };
    });
  }, []);

  const handleFitAll = useCallback(() => setViewBox({ x: -10, y: 0, w: 1430, h: 830 }), []);

  // Focus map on a specific slot and select it
  function focusSlot(slot: MapSlot) {
    const pos = slotPositions[slot.id];
    if (pos) {
      setViewBox({ x: pos.cx - 320, y: pos.cy - 220, w: 640, h: 440 });
    }
    setSelectedSlot(prev => prev?.id === slot.id ? null : slot);
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isDragging || dragPending) return;
    setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragPending]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragPending && dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x, dy = e.clientY - dragStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) activateDrag();
      return;
    }
    if (isDragging && dragStartPos.current) {
      const pt = svgCoords(e.clientX, e.clientY);
      setDragLine(p => p ? { ...p, x2: pt.x, y2: pt.y } : null);
      let found: DropTarget | null = null;
      for (const s of slots) {
        if (s.isBlocked || s.visitNumber) continue;
        if (dragPayload?.fromType === "slot" && dragPayload.fromId === s.id) continue;
        const pos = slotPositions[s.id];
        if (pos && Math.abs(pt.x - pos.cx) < SLOT_W / 2 + 6 && Math.abs(pt.y - pos.cy) < SLOT_H / 2 + 6) {
          found = { type: "slot", id: s.id, name: s.slotNumber }; break;
        }
      }
      if (!found) for (const d of doors) {
        if (d.status === "maintenance" || d.visitNumber) continue;
        if (dragPayload?.fromType === "dock" && dragPayload.fromId === d.id) continue;
        const pos = doorPositions[d.id];
        if (pos && Math.abs(pt.x - pos.cx) < DOOR_W / 2 + 6 && Math.abs(pt.y - pos.cy) < DOOR_H / 2 + 6) {
          found = { type: "dock", id: d.id, name: `Door ${d.doorNumber}` }; break;
        }
      }
      if (!found) {
        const g = gatePos;
        if (pt.x >= g.x && pt.x <= g.x + g.w && pt.y >= g.y && pt.y <= g.y + g.h)
          found = { type: "gate", id: 0, name: "Gate 3 - Outbound" };
      }
      setDropTarget(found); return;
    }
    if (isPanning) {
      const r = svgRef.current?.getBoundingClientRect();
      if (!r) return;
      setViewBox(p => ({
        ...p,
        x: p.x - ((e.clientX - panStart.x) / r.width) * p.w,
        y: p.y - ((e.clientY - panStart.y) / r.height) * p.h,
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, panStart, isDragging, dragPending, dragPayload, slots, doors, slotPositions, doorPositions, gatePos]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragPayload && dropTarget) {
      setMoveFrom({ type: dragPayload.fromType, id: dragPayload.fromId, name: dragPayload.fromName });
      setMoveTo(dropTarget);
      setMoveVisitId(dragPayload.visitId);
      setMoveVisitNumber(dragPayload.visitNumber);
      setMoveTrailer(dragPayload.trailerNumber);
      setShowMoveDialog(true);
    } else if (dragPending && pendingPayload.current) {
      const pp = pendingPayload.current;
      if (pp.fromType === "slot") {
        const clickedSlot = slots.find(s => s.id === pp.fromId) || null;
        setSelectedSlot(prev => prev?.id === pp.fromId ? null : clickedSlot);
      }
    }
    setIsPanning(false); setIsDragging(false); setDragPending(false);
    setDragPayload(null); setDropTarget(null); setDragLine(null);
    dragStartPos.current = null; pendingPayload.current = null; pendingOrigin.current = null;
  }, [isDragging, dragPayload, dropTarget, dragPending, slots]);

  function startDragSlot(s: MapSlot, e: React.MouseEvent) {
    if (!s.visitNumber || !s.currentVisitId) return;
    e.stopPropagation();
    const pos = slotPositions[s.id] || { cx: 0, cy: 0 };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    pendingOrigin.current = pos;
    pendingPayload.current = { visitId: s.currentVisitId, visitNumber: s.visitNumber!, trailerNumber: s.trailerNumber || "?", fromType: "slot", fromId: s.id, fromName: s.slotNumber };
    setDragPending(true);
  }

  function startDragDoor(d: MapDoor, e: React.MouseEvent) {
    if (!d.visitNumber || !d.currentVisitId) return;
    e.stopPropagation();
    const pos = doorPositions[d.id] || { cx: 0, cy: 0 };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    pendingOrigin.current = pos;
    pendingPayload.current = { visitId: d.currentVisitId!, visitNumber: d.visitNumber, trailerNumber: d.trailerNumber || "?", fromType: "dock", fromId: d.id, fromName: `Door ${d.doorNumber}` };
    setDragPending(true);
  }

  function activateDrag() {
    if (!pendingPayload.current || !pendingOrigin.current) return;
    setIsDragging(true);
    setDragPayload(pendingPayload.current);
    setDragLine({ x1: pendingOrigin.current.cx, y1: pendingOrigin.current.cy, x2: pendingOrigin.current.cx, y2: pendingOrigin.current.cy });
    setDragPending(false); setHoverSlotData(null); setHoverDoorData(null);
  }

  function closeMoveDialog() {
    setShowMoveDialog(false); setMoveFrom(null); setMoveTo(null);
    setMoveVisitId(null); setMoveVisitNumber(""); setMoveTrailer("");
    setSelectedJockey(""); setMovePriority("normal"); setMoveNotes("");
  }

  function handleCreateMove() {
    if (!moveFrom || !moveTo || !moveVisitId) return;
    createMoveMutation.mutate({
      visitId: moveVisitId,
      fromLocationType: moveFrom.type, fromLocationId: moveFrom.id || null, fromLocationName: moveFrom.name,
      toLocationType: moveTo.type, toLocationId: moveTo.id || null, toLocationName: moveTo.name,
      priority: movePriority,
      assignedTo: selectedJockey || null,
      notes: moveNotes || null,
    });
  }

  function openMoveFromSelection() {
    if (!selectedSlot?.currentVisitId) return;
    setMoveFrom({ type: "slot", id: selectedSlot.id, name: selectedSlot.slotNumber });
    setMoveTo(null);
    setMoveVisitId(selectedSlot.currentVisitId);
    setMoveVisitNumber(selectedSlot.visitNumber || "");
    setMoveTrailer(selectedSlot.trailerNumber || "");
    setShowMoveDialog(true);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHoverSlotData(null); setHoverDoorData(null);
        setSelectedSlot(null);
        if (isDragging || dragPending) {
          setIsDragging(false); setDragPending(false); setDragPayload(null);
          setDropTarget(null); setDragLine(null);
          dragStartPos.current = null; pendingPayload.current = null; pendingOrigin.current = null;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDragging, dragPending]);

  if (isLoading) return <div className="p-4"><Skeleton className="h-[600px] rounded-md" /></div>;

  const occupied = slots.filter(s => s.visitNumber).length;
  const blocked = slots.filter(s => s.isBlocked).length;
  const available = slots.length - occupied - blocked;
  const doorsOccupied = doors.filter(d => d.visitNumber).length;
  const onHoldCount = queueOnHold.length;

  const hasFilters = filterCarrier !== "all" || filterStatus !== "all" || filterZone !== "all" || filterDwell !== "all";

  const slotMatchesFilter = (s: MapSlot): boolean => {
    if (filterCarrier !== "all" && s.carrierName !== filterCarrier) return false;
    if (filterZone !== "all" && s.zoneCode !== filterZone) return false;
    if (filterStatus !== "all") {
      if (filterStatus === "empty" && s.visitNumber) return false;
      if (filterStatus === "occupied" && !s.visitNumber) return false;
      if (filterStatus === "hold" && s.holdStatus !== "on_hold") return false;
      if (filterStatus === "ready_out" && s.visitStatus !== "ready_out") return false;
    }
    if (filterDwell !== "all" && s.visitNumber) {
      const dh = dwellHours(s.checkInTime ?? null);
      if (filterDwell === "fresh" && dh > 12) return false;
      if (filterDwell === "aging" && (dh <= 12 || dh > 24)) return false;
      if (filterDwell === "detention" && dh <= 24) return false;
    }
    return true;
  };

  const MID_LANE_Y = 458;
  const MID_LANE_H = 16;
  const BTM_ROAD_Y = 690;
  const BTM_ROAD_H = 30;
  const VERT_LANE_X = 508;
  const VERT_LANE_W = 14;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]" data-testid="yard-map-page">

      {/* ── Compact header toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 border-b bg-background shrink-0">

        {/* Left panel toggle */}
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setLeftPanelOpen(v => !v)}
          title={leftPanelOpen ? "Hide queue panel" : "Show queue panel"}
          aria-label={leftPanelOpen ? "Hide queue panel" : "Show queue panel"}
          data-testid="button-toggle-left-panel"
        >
          {leftPanelOpen
            ? <PanelLeftClose className="h-3.5 w-3.5 text-muted-foreground" />
            : <PanelLeftOpen className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </Button>

        {/* Title + stats */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center">
            <Layers className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground hidden sm:block" data-testid="text-map-title">Yard Control</span>
          <div className="flex items-center gap-1.5">
            <StatPill label="Empty"    value={available}     color="#94a3b8" textColor="#475569" />
            <StatPill label="Occupied" value={occupied}      color="#2563eb" />
            <StatPill label="Dock"     value={doorsOccupied} color="#7c3aed" />
            {onHoldCount > 0 && <StatPill label="Hold" value={onHoldCount} color="#dc2626" />}
          </div>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Filters row */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" />

          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger className="h-6 text-xs w-[110px] border-dashed" data-testid="select-filter-zone">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {uniqueZones.map(z => <SelectItem key={z.code} value={z.code}>{ZONE_DISPLAY_NAMES[z.code] || z.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-6 text-xs w-[120px] border-dashed" data-testid="select-filter-status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="empty">Empty</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="hold">On Hold</SelectItem>
              <SelectItem value="ready_out">Ready Out</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterDwell} onValueChange={setFilterDwell}>
            <SelectTrigger className="h-6 text-xs w-[120px] border-dashed" data-testid="select-filter-dwell">
              <SelectValue placeholder="Any dwell" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any dwell</SelectItem>
              <SelectItem value="fresh">Fresh (&lt;12h)</SelectItem>
              <SelectItem value="aging">Aging (12–24h)</SelectItem>
              <SelectItem value="detention">Detention (&gt;24h)</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCarrier} onValueChange={setFilterCarrier}>
            <SelectTrigger className="h-6 text-xs w-[130px] border-dashed" data-testid="select-filter-carrier">
              <SelectValue placeholder="All carriers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All carriers</SelectItem>
              {uniqueCarriers.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {hasFilters && (
            <>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground gap-1 shrink-0"
                onClick={() => { setFilterCarrier("all"); setFilterStatus("all"); setFilterZone("all"); setFilterDwell("all"); }}
                data-testid="button-clear-filters">
                <X className="h-3 w-3" /> Clear
              </Button>
              <span className="text-xs text-muted-foreground shrink-0">
                {slots.filter(slotMatchesFilter).length}/{slots.length}
              </span>
            </>
          )}
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Map controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant={showLegend ? "secondary" : "ghost"} size="sm"
            className="h-6 px-2 text-xs gap-1 font-medium"
            onClick={() => setShowLegend(v => !v)}
            data-testid="button-toggle-legend"
          >
            <BookOpen className="h-3 w-3" />
            <span className="hidden sm:inline">Legend</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleZoom(0.8)} title="Zoom in" aria-label="Zoom in" data-testid="button-zoom-in"><ZoomIn className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleZoom(1.25)} title="Zoom out" aria-label="Zoom out" data-testid="button-zoom-out"><ZoomOut className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleFitAll} title="Fit all" aria-label="Fit all" data-testid="button-fit-all"><Maximize2 className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" title="Click slot to select · Drag to move · Scroll to zoom · Hold to pan" aria-label="Map keyboard shortcuts: click to select, drag to move, scroll to zoom, hold to pan" data-testid="button-map-help">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* ── 3-panel body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left operational queue panel ──────────────────────────────── */}
        {leftPanelOpen && (
          <div className="w-56 shrink-0 border-r bg-background flex flex-col overflow-hidden" data-testid="panel-left-queue">

            {/* Panel header */}
            <div className="px-3 py-2 border-b bg-muted/30 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operational Queue</p>
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* On Hold — critical */}
              <QueueSection
                title="On Hold"
                count={queueOnHold.length}
                urgency="critical"
                icon={<ShieldAlert className="h-3 w-3" />}
                emptyText="No units on hold"
                data-testid="queue-on-hold"
              >
                {queueOnHold.map(s => (
                  <QueueItem key={s.id} slot={s} isSelected={selectedSlot?.id === s.id} onClick={() => focusSlot(s)} />
                ))}
              </QueueSection>

              {/* Aging / Detention */}
              <QueueSection
                title="Aging / Detention"
                count={queueAging.length}
                urgency="warning"
                icon={<Clock className="h-3 w-3" />}
                emptyText="No units past 24h dwell"
              >
                {queueAging.map(s => (
                  <QueueItem key={s.id} slot={s} isSelected={selectedSlot?.id === s.id} onClick={() => focusSlot(s)} />
                ))}
              </QueueSection>

              {/* Ready for dock */}
              <QueueSection
                title="Ready for Dock"
                count={queueReadyOut.length}
                urgency="ready"
                icon={<CheckCircle2 className="h-3 w-3" />}
                emptyText="No units ready to move"
              >
                {queueReadyOut.map(s => (
                  <QueueItem key={s.id} slot={s} isSelected={selectedSlot?.id === s.id} onClick={() => focusSlot(s)} />
                ))}
              </QueueSection>

              {/* High priority */}
              <QueueSection
                title="High Priority"
                count={queueHighPri.length}
                urgency="elevated"
                icon={<TrendingUp className="h-3 w-3" />}
                emptyText="No high-priority moves pending"
              >
                {queueHighPri.map(s => (
                  <QueueItem key={s.id} slot={s} isSelected={selectedSlot?.id === s.id} onClick={() => focusSlot(s)} />
                ))}
              </QueueSection>

            </div>

            {/* Panel footer — yard summary */}
            <div className="border-t px-3 py-2 bg-muted/20 shrink-0 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Slot utilization</span>
                <span className="font-bold text-foreground">{slots.length > 0 ? Math.round((occupied / slots.length) * 100) : 0}%</span>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${slots.length > 0 ? (occupied / slots.length) * 100 : 0}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{occupied} occupied</span>
                <span>{available} free</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Center map canvas ──────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{ background: "#d8d2c4", cursor: isDragging ? "grabbing" : isPanning ? "grabbing" : "grab" }}
        >
          {/* Legend panel (floating, top-left of map) */}
          {showLegend && (
            <div className="absolute top-3 left-3 z-40 bg-white/97 dark:bg-gray-900/97 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-48 text-xs backdrop-blur-sm" data-testid="panel-legend">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[10px] uppercase tracking-wider text-gray-500">Legend</span>
                <button
                  className="h-5 w-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setShowLegend(false)}
                  data-testid="button-close-legend"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">Slot Status</p>
                  <div className="space-y-1">
                    {LEGEND_STATUS.map(item => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <span className="w-4 h-3 rounded-sm shrink-0" style={{ background: item.color, border: `1.5px ${item.dash ? "dashed" : "solid"} ${item.stroke || item.color}` }} />
                        <span className="text-gray-600 dark:text-gray-300 text-[10px]">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1">Zone Types</p>
                  <div className="space-y-1">
                    {LEGEND_ZONE.map(item => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <span className="w-4 h-3 rounded-sm shrink-0" style={{ background: item.color }} />
                        <span className="text-gray-600 dark:text-gray-300 text-[10px]">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-1.5 text-[9px] text-gray-400 space-y-0.5">
                  <p>Click slot to select · Drag to move</p>
                  <p>Scroll to zoom · Hold to pan</p>
                </div>
              </div>
            </div>
          )}

          {/* SVG map */}
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="w-full h-full select-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { handleMouseUp(); setHoverSlotData(null); setHoverDoorData(null); }}
          >
            <defs>
              <filter id="cs" x="-5%" y="-5%" width="115%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000018" /></filter>
              <filter id="lift" x="-8%" y="-8%" width="125%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#00000040" /></filter>
              <filter id="sel" x="-12%" y="-12%" width="130%" height="150%"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f59e0b" floodOpacity="0.8" /></filter>
              <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0,10 3.5,0 7" fill="#3b82f6" />
              </marker>
              <pattern id="sh" width="36" height="1" patternUnits="userSpaceOnUse">
                <rect width="20" height="1" fill="#f5c542" opacity="0.75" />
              </pattern>
              <pattern id="sv" width="1" height="36" patternUnits="userSpaceOnUse">
                <rect y="0" width="1" height="20" fill="#f5c542" opacity="0.75" />
              </pattern>
              <pattern id="haz-bg" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="10" height="20" fill="#fef2f2" />
                <rect x="10" width="10" height="20" fill="#fff1f2" />
              </pattern>
            </defs>

            {/* Yard ground */}
            <rect x={-200} y={-200} width={1900} height={1300} fill="#cdc7b8" />
            <rect x={BLDG_X} y={WALL_Y} width={BLDG_W} height={700} fill="#dbd5c5" />

            {/* Dock-adjacent zone — slightly darker apron strip to show dock proximity */}
            <rect x={BLDG_X} y={WALL_Y} width={BLDG_W} height={230} fill="#c8c2b0" opacity={0.45} />

            {/* Dock split — Receiving (doors 1–4) and Shipping (doors 7–10) coloring on warehouse roof */}
            <rect x={BLDG_X} y={BLDG_Y} width={DOOR_STEP * 4} height={20} fill="#0c4a6e" opacity={0.18} rx={1} />
            <text x={BLDG_X + DOOR_STEP * 2} y={BLDG_Y + 13} textAnchor="middle" fontSize={7} fill="#93c5fd" fontFamily="system-ui" letterSpacing="2" opacity={0.9}>RECEIVING</text>
            <rect x={BLDG_X + DOOR_STEP * 6} y={BLDG_Y} width={DOOR_STEP * 4} height={20} fill="#4c1d95" opacity={0.18} rx={1} />
            <text x={BLDG_X + DOOR_STEP * 8} y={BLDG_Y + 13} textAnchor="middle" fontSize={7} fill="#c4b5fd" fontFamily="system-ui" letterSpacing="2" opacity={0.9}>SHIPPING</text>
            <text x={BLDG_X + DOOR_STEP * 5} y={BLDG_Y + 13} textAnchor="middle" fontSize={6.5} fill="#9ab0c0" fontFamily="system-ui" opacity={0.7}>CROSS-DOCK</text>

            {/* Overflow yard area indicator — far right ground (past main zones) */}
            <rect x={1140} y={480} width={120} height={190} fill="#c8c2b0" opacity={0.3} rx={4} />
            <text x={1200} y={580} textAnchor="middle" fontSize={8} fill="#9a9080" fontFamily="system-ui" opacity={0.7}
              transform="rotate(-90, 1200, 580)">OVERFLOW YARD</text>

            {/* Hazmat isolation visual boundary */}
            <rect x={1268} y={WALL_Y} width={140} height={570} fill="#fef2f2" opacity={0.3} rx={4} />
            <rect x={1268} y={WALL_Y} width={3} height={570} fill="#dc2626" opacity={0.25} />

            {/* Dock access lane */}
            <rect x={BLDG_X} y={LANE_Y} width={BLDG_W} height={LANE_H} fill="#c4bcac" />
            <line x1={BLDG_X} y1={LANE_Y + LANE_H / 2} x2={BLDG_X + BLDG_W} y2={LANE_Y + LANE_H / 2} stroke="url(#sh)" strokeWidth={2.5} />
            <line x1={BLDG_X} y1={LANE_Y} x2={BLDG_X + BLDG_W} y2={LANE_Y} stroke="#f5c542" strokeWidth={1} opacity={0.45} />
            <line x1={BLDG_X} y1={LANE_Y + LANE_H} x2={BLDG_X + BLDG_W} y2={LANE_Y + LANE_H} stroke="#f5c542" strokeWidth={1} opacity={0.45} />
            {[180, 500, 820, 1140].map(x => (
              <polygon key={x} points={`${x},${LANE_Y + LANE_H / 2 - 6} ${x + 14},${LANE_Y + LANE_H / 2} ${x},${LANE_Y + LANE_H / 2 + 6}`} fill="#f5c542" opacity={0.5} />
            ))}
            {/* Dock approach lane label */}
            <text x={BLDG_X + BLDG_W / 2} y={LANE_Y + LANE_H / 2 + 4} textAnchor="middle" fontSize={7.5} fill="#9a9280" fontFamily="system-ui" letterSpacing="3" opacity={0.85}>DOCK APPROACH LANE</text>

            {/* Center vertical lane */}
            <rect x={VERT_LANE_X} y={LANE_Y + LANE_H} width={VERT_LANE_W} height={500} fill="#c4bcac" />
            <line x1={VERT_LANE_X + VERT_LANE_W / 2} y1={LANE_Y + LANE_H} x2={VERT_LANE_X + VERT_LANE_W / 2} y2={GATE_Y} stroke="url(#sv)" strokeWidth={2} />
            {[280, 380, 530, 630].map(y => (
              <polygon key={y} points={`${VERT_LANE_X + 4},${y} ${VERT_LANE_X + VERT_LANE_W / 2},${y + 12} ${VERT_LANE_X + VERT_LANE_W - 4},${y}`} fill="#f5c542" opacity={0.45} />
            ))}
            {/* Vertical lane direction labels */}
            <text x={VERT_LANE_X - 18} y={LANE_Y + LANE_H + 20} textAnchor="middle" fontSize={7} fill="#9a9080" fontFamily="system-ui" opacity={0.8}
              transform={`rotate(-90, ${VERT_LANE_X - 18}, ${LANE_Y + LANE_H + 55})`}>↑ TO DOCK</text>
            <text x={VERT_LANE_X - 18} y={BTM_ROAD_Y - 20} textAnchor="middle" fontSize={7} fill="#9a9080" fontFamily="system-ui" opacity={0.8}
              transform={`rotate(-90, ${VERT_LANE_X - 18}, ${BTM_ROAD_Y - 60})`}>↓ TO GATE</text>

            {/* Mid horizontal lane */}
            <rect x={BLDG_X} y={MID_LANE_Y} width={BLDG_W} height={MID_LANE_H} fill="#c4bcac" />
            <line x1={BLDG_X} y1={MID_LANE_Y + MID_LANE_H / 2} x2={BLDG_X + BLDG_W} y2={MID_LANE_Y + MID_LANE_H / 2} stroke="url(#sh)" strokeWidth={2} />
            {/* Mid lane direction labels — inbound left → right, outbound right → left */}
            <text x={BLDG_X + 44} y={MID_LANE_Y + MID_LANE_H - 2} textAnchor="start" fontSize={7} fill="#9a9080" fontFamily="system-ui" opacity={0.85}>↑ INBOUND</text>
            <text x={BLDG_X + BLDG_W - 44} y={MID_LANE_Y + MID_LANE_H - 2} textAnchor="end" fontSize={7} fill="#9a9080" fontFamily="system-ui" opacity={0.85}>OUTBOUND ↓</text>

            {/* Bottom access road */}
            <rect x={BLDG_X} y={BTM_ROAD_Y} width={BLDG_W} height={BTM_ROAD_H} fill="#c4bcac" />
            <line x1={BLDG_X} y1={BTM_ROAD_Y + BTM_ROAD_H / 2} x2={BLDG_X + BLDG_W} y2={BTM_ROAD_Y + BTM_ROAD_H / 2} stroke="url(#sh)" strokeWidth={2} />
            {/* Gate approach */}
            <rect x={GATE_X + 20} y={BTM_ROAD_Y} width={GATE_W - 40} height={BTM_ROAD_H} fill="#b8b0a0" />
            {/* Yard access road label */}
            <text x={BLDG_X + 82} y={BTM_ROAD_Y + BTM_ROAD_H - 5} textAnchor="start" fontSize={7} fill="#9a9080" fontFamily="system-ui" letterSpacing="2" opacity={0.8}>YARD ACCESS ROAD</text>

            {/* Entry gate (Gate 1 — Inbound Check-in) */}
            <rect x={120} y={GATE_Y} width={220} height={GATE_H} rx={6} fill="#166534" stroke="#14532d" strokeWidth={2} filter="url(#cs)" />
            <text x={230} y={GATE_Y + 22} textAnchor="middle" fontSize={9} fontWeight="700" fill="#dcfce7" fontFamily="system-ui">GATE 1 — ENTRY</text>
            <text x={230} y={GATE_Y + 37} textAnchor="middle" fontSize={7} fill="#86efac" fontFamily="system-ui">Inbound Check-in · Arrival</text>
            {/* Entry gate approach path */}
            <rect x={180} y={BTM_ROAD_Y} width={100} height={BTM_ROAD_H} fill="#b0a898" opacity={0.6} />

            {/* Corner greenery */}
            {([[BLDG_X - 20, 500], [BLDG_X - 20, 650], [BLDG_X + BLDG_W + 8, 400], [BLDG_X + BLDG_W + 8, 560]] as [number, number][]).map(([tx, ty], i) => (
              <g key={i}>
                <circle cx={tx} cy={ty} r={16} fill="#4a8040" opacity={0.55} />
                <circle cx={tx} cy={ty} r={10} fill="#3a7030" opacity={0.75} />
              </g>
            ))}

            {/* Warehouse building */}
            <rect x={BLDG_X + 4} y={BLDG_Y + 8} width={BLDG_W} height={BLDG_H + DOOR_H} fill="#00000014" rx={2} />
            <rect x={BLDG_X} y={BLDG_Y} width={BLDG_W} height={BLDG_H} fill="#b5c0cc" rx={2} />
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={i} x1={BLDG_X} y1={BLDG_Y + (i + 1) * 11} x2={BLDG_X + BLDG_W} y2={BLDG_Y + (i + 1) * 11} stroke="#a5b0bc" strokeWidth={0.8} opacity={0.5} />
            ))}
            <rect x={BLDG_X} y={BLDG_Y} width={BLDG_W} height={20} fill="#7888a0" rx={2} />
            <rect x={BLDG_X} y={BLDG_Y + 4} width={BLDG_W} height={3} fill="#6880a0" />
            <text x={BLDG_X + BLDG_W / 2} y={BLDG_Y + 14} textAnchor="middle" fontSize={10} fontWeight="700" fill="#dce8f4" fontFamily="system-ui" letterSpacing="4">DISTRIBUTION CENTER</text>
            {[200, 500, 800, 1100].map(x => (
              <rect key={x} x={x} y={BLDG_Y + 26} width={120} height={24} rx={2} fill="#9ab0c0" stroke="#8aa0b0" strokeWidth={0.8} />
            ))}
            <rect x={BLDG_X} y={WALL_Y - 8} width={BLDG_W} height={9} fill="#6878a0" />

            {/* Dock bays */}
            {doors.map((d, i) => {
              const cx = BLDG_X + (i + 0.5) * DOOR_STEP;
              const bx = cx - DOOR_W / 2;
              const isOver = dropTarget?.type === "dock" && dropTarget.id === d.id;
              const isHov = hoveredDoor === d.id;
              const occ = !!d.visitNumber;
              return (
                <g key={d.id} data-testid={`map-door-${d.id}`}
                  onMouseEnter={e => { setHoveredDoor(d.id); setHoverDoorData({ door: d, x: e.clientX, y: e.clientY }); setHoverSlotData(null); }}
                  onMouseLeave={() => { setHoveredDoor(null); setHoverDoorData(null); }}
                  onMouseDown={e => { if (d.visitNumber) startDragDoor(d, e); }}
                  style={{ cursor: d.visitNumber ? "grab" : "default" }}>
                  <rect x={bx - 2} y={WALL_Y - 2} width={DOOR_W + 4} height={DOOR_H + 4} fill="#7888a0" rx={1} />
                  <rect x={bx} y={WALL_Y} width={DOOR_W} height={DOOR_H} fill={isOver ? "#2563eb" : "#1a2535"} rx={1} />
                  <rect x={bx + 3} y={WALL_Y + DOOR_H - 8} width={DOOR_W - 6} height={5} rx={1} fill="#2d3a50" />
                  <rect x={bx + 2} y={WALL_Y + DOOR_H - 12} width={6} height={8} rx={1.5} fill="#556" />
                  <rect x={bx + DOOR_W - 8} y={WALL_Y + DOOR_H - 12} width={6} height={8} rx={1.5} fill="#556" />
                  {occ && (
                    <>
                      <rect x={bx + 4} y={WALL_Y + 3} width={DOOR_W - 8} height={DOOR_H - 16} rx={2}
                        fill={isHov || isOver ? "#bfd4f0" : "#d4dce8"} stroke={isHov ? "#3b82f6" : "#a0b0c0"} strokeWidth={1.2} />
                      <text x={cx} y={WALL_Y + 28} textAnchor="middle" fontSize={10} fontWeight="800" fill="#1e293b" fontFamily="monospace">{scac(d.trailerNumber)}</text>
                      <text x={cx} y={WALL_Y + 40} textAnchor="middle" fontSize={7.5} fill="#475569" fontFamily="monospace">{(d.trailerNumber || "").slice(-5)}</text>
                    </>
                  )}
                  {!occ && <text x={cx} y={WALL_Y + DOOR_H / 2 + 3} textAnchor="middle" fontSize={8} fill="#475569">OPEN</text>}
                  <rect x={bx} y={WALL_Y + DOOR_H + 6} width={DOOR_W} height={13} fill="#c0b8a8" rx={1} />
                  <text x={cx} y={WALL_Y + DOOR_H + 16} textAnchor="middle" fontSize={8.5} fontWeight="700" fill="#374151" fontFamily="system-ui">{d.doorNumber}</text>
                </g>
              );
            })}

            {/* Zone panels */}
            {Object.entries(zoneLayouts.layouts).map(([code, layout]) => {
              const zs = zoneLayouts.grouped[code] || [];
              const theme = zTheme(code);
              const occ = zs.filter(s => s.visitNumber).length;
              const isHaz = code === "HAZ";
              const borderDash = isHaz ? "5 3" : undefined;

              return (
                <g key={code}>
                  <rect x={layout.x + 3} y={layout.y + 5} width={layout.w} height={layout.h} rx={isHaz ? 3 : 6} fill="#00000018" />
                  <rect x={layout.x} y={layout.y} width={layout.w} height={layout.h} rx={isHaz ? 3 : 6}
                    fill={isHaz ? "url(#haz-bg)" : theme.fill}
                    stroke={theme.border} strokeWidth={isHaz ? 2 : 1.5}
                    strokeDasharray={borderDash}
                    filter={isHaz ? undefined : "url(#cs)"} />
                  <rect x={layout.x} y={layout.y} width={layout.w} height={ZONE_HEADER} rx={isHaz ? 3 : 6} fill={theme.hdr} />
                  {!isHaz && <rect x={layout.x} y={layout.y + ZONE_HEADER - 5} width={layout.w} height={5} fill={theme.hdr} />}
                  <line x1={layout.x + 5} y1={layout.y + ZONE_HEADER - 0.5} x2={layout.x + layout.w - 5} y2={layout.y + ZONE_HEADER - 0.5} stroke={theme.border} strokeWidth={0.8} />

                  {isHaz ? (
                    <>
                      <text x={layout.x + layout.w / 2} y={layout.y + 11} textAnchor="middle" fontSize={10} fontWeight="900" fill={theme.title} fontFamily="system-ui">&#9888;</text>
                      <text x={layout.x + layout.w / 2} y={layout.y + 22} textAnchor="middle" fontSize={7} fontWeight="800" fill={theme.title} fontFamily="system-ui">INSP.</text>
                      <text x={layout.x + layout.w / 2} y={layout.y + 32} textAnchor="middle" fontSize={7} fontWeight="800" fill={theme.title} fontFamily="system-ui">HOLD</text>
                    </>
                  ) : (
                    <>
                      <text x={layout.x + 9} y={layout.y + 15} fontSize={11} fontWeight="600" fill={theme.title} fontFamily="system-ui" textAnchor="start">
                        {ZONE_DISPLAY_NAMES[code] || layout.zone?.name || code}
                      </text>
                      <text x={layout.x + 9} y={layout.y + 27} fontSize={8} fontWeight="400" fill={theme.title} fontFamily="system-ui" textAnchor="start" opacity={0.65}>
                        {occ}/{zs.length} occ · {ZONE_SUBTITLES[code] || ""}
                      </text>
                    </>
                  )}

                  {zs.map((s, idx) => {
                    const col = idx % layout.cols;
                    const row = Math.floor(idx / layout.cols);
                    const sx = layout.x + ZONE_PAD + col * (SLOT_W + SLOT_GAP);
                    const sy = layout.y + ZONE_HEADER + ZONE_PAD + row * (SLOT_H + SLOT_NUM_H + SLOT_GAP);
                    const cx = sx + SLOT_W / 2;
                    const isOver = dropTarget?.type === "slot" && dropTarget.id === s.id;
                    const isHov = hoveredSlot === s.id;
                    const isSelected = selectedSlot?.id === s.id;
                    const fill = trailerFill(s, isOver);
                    const stroke = trailerStroke(s, isHov, isOver);
                    const detained = isDetention(s);

                    const matchesFilter = slotMatchesFilter(s);
                    return (
                      <g key={s.id} data-testid={`map-slot-${s.id}`}
                        role="button"
                        aria-label={s.visitNumber ? `Slot ${s.slotNumber}: ${s.trailerNumber || s.visitNumber}${s.movementType ? `, ${s.movementType}` : ''}${isSelected ? ', selected' : ''}` : s.isBlocked ? `Slot ${s.slotNumber}: blocked` : `Slot ${s.slotNumber}: empty`}
                        aria-pressed={isSelected}
                        tabIndex={0}
                        onMouseEnter={e => { setHoveredSlot(s.id); setHoverSlotData({ slot: s, x: e.clientX, y: e.clientY }); setHoverDoorData(null); }}
                        onMouseLeave={() => { setHoveredSlot(null); setHoverSlotData(null); }}
                        onMouseDown={e => { if (s.visitNumber) startDragSlot(s, e); }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedSlot(s); } }}
                        style={{ cursor: s.visitNumber ? "grab" : "default", opacity: hasFilters && !matchesFilter ? 0.15 : 1, transition: "opacity 0.2s" }}>

                        {/* Selection highlight ring */}
                        {isSelected && (
                          <rect x={sx - 5} y={sy - 5} width={SLOT_W + 10} height={SLOT_H + 10} rx={6}
                            fill="none" stroke="#f59e0b" strokeWidth={3} filter="url(#sel)">
                            <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" />
                          </rect>
                        )}

                        {s.visitNumber ? (
                          <>
                            <rect x={sx} y={sy} width={SLOT_W} height={SLOT_H} rx={3}
                              fill={fill} stroke={isSelected ? "#f59e0b" : stroke}
                              strokeWidth={isSelected ? 2.5 : isHov || isOver ? 2.5 : 1.5}
                              filter={isHov || isSelected ? "url(#lift)" : "url(#cs)"}
                              strokeDasharray={detained && !isSelected ? "4 2" : undefined} />

                            {/* Direction arrow */}
                            {zoomLevel !== "far" && s.movementType && (
                              <text x={cx} y={sy + 10} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.85)" fontFamily="system-ui">
                                {s.movementType === "outbound" ? "▲" : "▼"}
                              </text>
                            )}

                            {/* SCAC / carrier code */}
                            <text x={cx} y={sy + (zoomLevel !== "far" ? 23 : 16)} textAnchor="middle" fontSize={zoomLevel === "near" ? 11 : 9}
                              fontWeight="800" fill="white" fontFamily="monospace">
                              {scac(s.trailerNumber)}
                            </text>

                            {/* Trailer suffix */}
                            {zoomLevel === "near" && (
                              <text x={cx} y={sy + 34} textAnchor="middle" fontSize={7.5} fill="rgba(255,255,255,0.8)" fontFamily="monospace">
                                {(s.trailerNumber || "").slice(-5)}
                              </text>
                            )}

                            {/* Priority dot */}
                            {(s.movePriority === "high" || s.movePriority === "urgent") && (
                              <circle cx={sx + SLOT_W - 6} cy={sy + 6} r={4}
                                fill={s.movePriority === "urgent" ? "#dc2626" : "#f97316"} stroke="white" strokeWidth={1} />
                            )}

                            {/* Dwell warning */}
                            {detained && zoomLevel !== "far" && (
                              <text x={sx + 5} y={sy + 10} fontSize={8} fill="rgba(255,255,255,0.9)" fontFamily="system-ui">⚠</text>
                            )}
                          </>
                        ) : s.isBlocked ? (
                          <>
                            <rect x={sx} y={sy} width={SLOT_W} height={SLOT_H} rx={3} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.5} />
                            <line x1={sx + 6} y1={sy + 6} x2={sx + SLOT_W - 6} y2={sy + SLOT_H - 6} stroke="#94a3b8" strokeWidth={1.5} />
                            <line x1={sx + SLOT_W - 6} y1={sy + 6} x2={sx + 6} y2={sy + SLOT_H - 6} stroke="#94a3b8" strokeWidth={1.5} />
                          </>
                        ) : (
                          <>
                            <rect x={sx} y={sy} width={SLOT_W} height={SLOT_H} rx={3}
                              fill={isOver ? "#dbeafe" : "#f8fafc"}
                              stroke={isOver ? "#3b82f6" : "#cbd5e1"}
                              strokeWidth={isOver ? 2.5 : 1}
                              strokeDasharray={isOver ? undefined : "5 3"} />
                            {isOver && (
                              <text x={cx} y={sy + SLOT_H / 2 + 4} textAnchor="middle" fontSize={9} fill="#2563eb" fontWeight="700">DROP</text>
                            )}
                          </>
                        )}

                        {/* Slot number label below tile */}
                        <text x={cx} y={sy + SLOT_H + SLOT_NUM_H - 2} textAnchor="middle" fontSize={8}
                          fill={isSelected ? "#92400e" : s.visitNumber ? "#374151" : "#94a3b8"} fontFamily="system-ui" fontWeight={isSelected ? "700" : "400"}>
                          {s.slotNumber}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* Gate */}
            <rect x={GATE_X} y={GATE_Y} width={GATE_W} height={GATE_H} rx={6}
              fill={dropTarget?.type === "gate" ? "#1d4ed8" : "#92400e"}
              stroke={dropTarget?.type === "gate" ? "#3b82f6" : "#78350f"} strokeWidth={2}
              filter="url(#cs)" />
            <text x={GATE_X + GATE_W / 2} y={GATE_Y + 20} textAnchor="middle" fontSize={9} fontWeight="700"
              fill={dropTarget?.type === "gate" ? "#1d4ed8" : "#92400e"} fontFamily="system-ui">
              GATE 3 &#8211; OUTBOUND
            </text>
            <text x={GATE_X + GATE_W / 2} y={GATE_Y + 35} textAnchor="middle" fontSize={7} fill="#a16207" fontFamily="system-ui">
              Drag trailer here to exit
            </text>

            {/* Drag line */}
            {dragLine && (
              <g>
                <line x1={dragLine.x1} y1={dragLine.y1} x2={dragLine.x2} y2={dragLine.y2}
                  stroke="#3b82f6" strokeWidth={2.5} strokeDasharray="7 4" opacity={0.9} markerEnd="url(#arrow)" />
                <circle cx={dragLine.x1} cy={dragLine.y1} r={7} fill="#3b82f6" opacity={0.35} />
                <circle cx={dragLine.x2} cy={dragLine.y2} r={9} fill={dropTarget ? "#22c55e" : "#ef4444"} opacity={0.7} />
              </g>
            )}
          </svg>

          {hoverSlotData && !isDragging && !dragPending && (
            <SlotTooltip data={hoverSlotData} containerRef={containerRef} />
          )}
          {hoverDoorData && !isDragging && !dragPending && (
            <DoorTooltip data={hoverDoorData} containerRef={containerRef} />
          )}

          {isDragging && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-2xl text-sm font-semibold flex items-center gap-2 z-50 pointer-events-none border border-blue-400">
              <Truck className="h-4 w-4" /> Moving {dragPayload?.trailerNumber}
              <ArrowRight className="h-4 w-4" />
              {dropTarget ? <span className="text-green-300">{dropTarget.name}</span>
                : <span className="text-yellow-300">Drop on empty slot, dock, or gate</span>}
            </div>
          )}

          {/* Mini-map (bottom-right) */}
          <MiniMap
            viewBox={viewBox}
            slots={slots}
            doors={doors}
            selectedSlotId={selectedSlot?.id ?? null}
            slotPositions={slotPositions}
            doorPositions={doorPositions}
            zoneLayouts={zoneLayouts}
          />
        </div>

        {/* ── Right detail panel ─────────────────────────────────────────── */}
        {selectedSlot && !isDragging && (
          <div
            className={`shrink-0 border-l bg-background flex flex-col overflow-hidden ${tabletMode ? "w-full absolute inset-y-0 right-0 z-50 shadow-2xl" : "w-72"}`}
            data-testid="panel-slot-detail"
          >
            {/* Detail panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-bold text-foreground truncate">{selectedSlot.slotNumber}</span>
                <span className="text-xs text-muted-foreground truncate hidden sm:block">· {selectedSlot.zoneName}</span>
              </div>
              <button
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                onClick={() => setSelectedSlot(null)}
                data-testid="button-close-detail"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedSlot.visitNumber ? (
                <div className="p-4 space-y-4">

                  {/* Status banner */}
                  <div className={`rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
                    selectedSlot.holdStatus && selectedSlot.holdStatus !== "none"
                      ? "bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
                      : selectedSlot.visitStatus === "ready_out"
                      ? "bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400"
                      : "bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
                  }`}>
                    {selectedSlot.holdStatus && selectedSlot.holdStatus !== "none"
                      ? <><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{fmtStatus(selectedSlot.holdStatus)}</>
                      : selectedSlot.visitStatus === "ready_out"
                      ? <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" />Ready for Dock</>
                      : <>{fmtStatus(selectedSlot.visitStatus || "")}</>
                    }
                  </div>

                  {/* Unit info */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Unit</p>
                    <div className="space-y-1.5">
                      <DetailRow label="Trailer" value={selectedSlot.trailerNumber || "—"} mono />
                      <DetailRow label="Carrier" value={selectedSlot.carrierName || "—"} />
                      <DetailRow label="Visit" value={selectedSlot.visitNumber || "—"} mono />
                      {selectedSlot.movementType && (
                        <DetailRow
                          label="Direction"
                          value={(selectedSlot.movementType === "outbound" ? "▲ " : "▼ ") + fmtStatus(selectedSlot.movementType)}
                          className={selectedSlot.movementType === "outbound" ? "text-violet-600" : "text-blue-600"}
                        />
                      )}
                    </div>
                  </div>

                  <div className="border-t" />

                  {/* Location */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Location</p>
                    <div className="space-y-1.5">
                      <DetailRow label="Slot" value={selectedSlot.slotNumber} />
                      <DetailRow label="Zone" value={selectedSlot.zoneName} />
                      {selectedSlot.isReefer && <DetailRow label="Type" value="Reefer" className="text-cyan-600" />}
                      {selectedSlot.isHazmat && <DetailRow label="Type" value="Hazmat" className="text-red-600" />}
                    </div>
                  </div>

                  {/* Dwell */}
                  {selectedSlot.checkInTime && (() => {
                    const dh = dwellHours(selectedSlot.checkInTime ?? null);
                    const detained = dh > 24;
                    return (
                      <>
                        <div className="border-t" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Dwell</p>
                          <div className="space-y-1.5">
                            <DetailRow
                              label="Time in yard"
                              value={dh < 1 ? "<1h" : `${Math.round(dh)}h`}
                              className={detained ? "text-red-600 font-bold" : dh > 12 ? "text-amber-600 font-semibold" : ""}
                            />
                            {detained && (
                              <div className="flex items-center gap-1.5 text-[10px] text-red-600 font-semibold">
                                <AlertTriangle className="h-3 w-3 shrink-0" /> Detention threshold exceeded
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Priority / Hold */}
                  {((selectedSlot.movePriority && selectedSlot.movePriority !== "normal") || (selectedSlot.holdStatus && selectedSlot.holdStatus !== "none")) && (
                    <>
                      <div className="border-t" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Flags</p>
                        <div className="space-y-1.5">
                          {selectedSlot.holdStatus && selectedSlot.holdStatus !== "none" && (
                            <DetailRow label="Hold" value={fmtStatus(selectedSlot.holdStatus)} className="text-red-600 font-bold" />
                          )}
                          {selectedSlot.movePriority && selectedSlot.movePriority !== "normal" && (
                            <DetailRow
                              label="Move priority"
                              value={fmtStatus(selectedSlot.movePriority)}
                              className={selectedSlot.movePriority === "urgent" || selectedSlot.movePriority === "high" ? "text-red-600 font-bold" : "text-orange-600 font-bold"}
                            />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-4">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/40 p-3 text-center">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Available</p>
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-500/70 mt-0.5">This slot is empty and ready to receive a trailer</p>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <DetailRow label="Slot" value={selectedSlot.slotNumber} />
                    <DetailRow label="Zone" value={selectedSlot.zoneName} />
                    {selectedSlot.isReefer && <DetailRow label="Type" value="Reefer" className="text-cyan-600" />}
                    {selectedSlot.isHazmat && <DetailRow label="Type" value="Hazmat" className="text-red-600" />}
                    {selectedSlot.isBlocked && <DetailRow label="Status" value="Blocked" className="text-slate-500" />}
                  </div>
                </div>
              )}
            </div>

            {/* Actions footer */}
            {selectedSlot.visitNumber && (
              <div className="border-t px-4 py-3 shrink-0 space-y-2">
                <Button
                  className={`w-full gap-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white ${tabletMode ? "h-11 text-sm" : "h-8 text-xs"}`}
                  onClick={openMoveFromSelection}
                  data-testid="button-slot-detail-move"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" /> Create Move Request
                </Button>
                <Button
                  variant="ghost"
                  className={`w-full text-muted-foreground ${tabletMode ? "h-9 text-sm" : "h-7 text-xs"}`}
                  onClick={() => setSelectedSlot(null)}
                >
                  <X className="h-3 w-3 mr-1" /> Deselect
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Move Request Dialog ────────────────────────────────────────────── */}
      <Dialog open={showMoveDialog} onOpenChange={o => { if (!o) closeMoveDialog(); }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-create-move">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Create Move Request</DialogTitle>
            <DialogDescription>Creates a pending task in the Move Tasks work queue</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-md bg-muted/50 text-center">
              <div className="text-xs text-muted-foreground">Trailer</div>
              <div className="font-bold text-sm font-mono">{moveTrailer}</div>
              <div className="text-xs text-muted-foreground">{moveVisitNumber}</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex-1 p-2 rounded-md bg-red-50 border border-red-200 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">From</div>
                <div className="font-semibold text-red-700">{moveFrom?.name}</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 p-2 rounded-md bg-green-50 border border-green-200 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">To</div>
                <div className="font-semibold text-green-700">{moveTo?.name || "Select on map"}</div>
              </div>
            </div>
            {!moveTo && (
              <p className="text-xs text-amber-600 text-center bg-amber-50 border border-amber-200 rounded-md p-2">
                Close this dialog and drag the trailer to a destination slot or dock door, or use the move tasks page to assign manually.
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-sm">Assign Jockey <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={selectedJockey} onValueChange={v => setSelectedJockey(v === "__none__" ? "" : v)}>
                <SelectTrigger data-testid="select-jockey"><SelectValue placeholder="Leave unassigned or select jockey..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">&#8212; Leave unassigned &#8212;</SelectItem>
                  {jockeys.map(j => <SelectItem key={j.id} value={j.id} data-testid={`option-jockey-${j.id}`}>{j.firstName} {j.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Priority</Label>
              <Select value={movePriority} onValueChange={setMovePriority}>
                <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Notes</Label>
              <Textarea data-testid="input-move-notes" placeholder="Optional instructions..." value={moveNotes} onChange={e => setMoveNotes(e.target.value)} className="h-20 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeMoveDialog}>Cancel</Button>
            <Button onClick={handleCreateMove} disabled={createMoveMutation.isPending || !moveTo} data-testid="button-confirm-move">
              {createMoveMutation.isPending ? "Creating..." : "Create Move Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function StatPill({ label, value, color, textColor }: { label: string; value: number; color: string; textColor?: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-bold" style={{ color: textColor || color }}>{value}</span>
    </span>
  );
}

function DetailRow({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-semibold text-right ${mono ? "font-mono" : ""} ${className || "text-foreground"}`}>{value}</span>
    </div>
  );
}

type QueueUrgency = "critical" | "warning" | "ready" | "elevated";

function QueueSection({
  title, count, urgency, icon, emptyText, children,
}: {
  title: string; count: number; urgency: QueueUrgency; icon: React.ReactNode;
  emptyText: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  const countStyle: Record<QueueUrgency, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    warning:  "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    ready:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    elevated: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  };
  const iconStyle: Record<QueueUrgency, string> = {
    critical: "text-red-500",
    warning:  "text-amber-500",
    ready:    "text-emerald-500",
    elevated: "text-orange-500",
  };

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-150 ${!open ? "-rotate-90" : ""}`} />
        <span className={`${iconStyle[urgency]} shrink-0`}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-1 leading-none">{title}</span>
        {count > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${countStyle[urgency]}`}>{count}</span>
        )}
      </button>

      {open && (
        <div className="px-1.5 pb-1.5">
          {count === 0 ? (
            <p className="text-[10px] text-muted-foreground px-2 py-1.5 italic">{emptyText}</p>
          ) : (
            <div className="space-y-0.5">{children}</div>
          )}
        </div>
      )}
    </div>
  );
}

function QueueItem({ slot, isSelected, onClick }: { slot: MapSlot; isSelected: boolean; onClick: () => void }) {
  const dh = dwellHours(slot.checkInTime ?? null);
  const isOnHold = slot.holdStatus && slot.holdStatus !== "none";
  const isDetained = dh > 24;
  const isAging = dh > 12 && dh <= 24;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-2 px-2 py-2 rounded-md text-left transition-colors ${
        isSelected
          ? "bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
          : "hover:bg-muted/50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-mono font-bold text-foreground truncate">{slot.trailerNumber}</span>
          {isOnHold && <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />}
          {isDetained && !isOnHold && <Clock className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
        </div>
        <div className="text-[9px] text-muted-foreground truncate mt-0.5">{slot.slotNumber} · {slot.zoneName}</div>
      </div>
      {dh > 0 && (
        <span className={`text-[9px] font-bold shrink-0 mt-0.5 tabular-nums ${
          isDetained ? "text-red-500" : isAging ? "text-amber-500" : "text-muted-foreground"
        }`}>
          {Math.round(dh)}h
        </span>
      )}
    </button>
  );
}

function fmtS(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

function SlotTooltip({ data, containerRef }: { data: { slot: MapSlot; x: number; y: number }; containerRef: React.RefObject<HTMLDivElement> }) {
  const { slot, x, y } = data;
  const r = containerRef.current?.getBoundingClientRect() || { right: 0, bottom: 0 };
  const dwell = dwellHours(slot.checkInTime ?? null);
  const statusColors: Record<string, string> = {
    ready_out: "text-amber-600",
    on_hold: "text-red-600",
    completed: "text-green-600",
  };
  return (
    <div className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3.5 z-50 text-sm min-w-[240px] pointer-events-none"
      style={{ left: Math.min(x + 14, r.right - 260), top: Math.min(y - 80, r.bottom - 280) }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-gray-900 dark:text-gray-100 text-base">{slot.slotNumber}</span>
        <div className="flex gap-1">
          {slot.isReefer && <Badge className="text-[10px] bg-cyan-600 text-white py-0 px-1.5">Reefer</Badge>}
          {slot.isHazmat && <Badge variant="destructive" className="text-[10px] py-0 px-1.5">Hazmat</Badge>}
          {slot.isBlocked && <Badge variant="secondary" className="text-[10px] py-0 px-1.5">Blocked</Badge>}
        </div>
      </div>
      <p className="text-gray-400 text-xs mb-2.5">{slot.zoneName}</p>
      {slot.visitNumber ? (
        <div className="space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-2.5">
          <div className="flex justify-between text-xs"><span className="text-gray-400">Trailer</span><span className="font-mono font-bold text-gray-900 dark:text-gray-100">{slot.trailerNumber}</span></div>
          {slot.carrierName && <div className="flex justify-between text-xs"><span className="text-gray-400">Carrier</span><span className="font-medium">{slot.carrierName}</span></div>}
          <div className="flex justify-between text-xs items-center">
            <span className="text-gray-400">Status</span>
            <span className={`font-semibold ${statusColors[slot.visitStatus || ""] || "text-blue-600"}`}>{fmtS(slot.visitStatus || "")}</span>
          </div>
          {slot.movementType && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Direction</span>
              <span className={`font-semibold ${slot.movementType === "outbound" ? "text-violet-600" : "text-blue-600"}`}>
                {slot.movementType === "outbound" ? "▲ " : "▼ "}{slot.movementType.replace(/_/g, " ")}
              </span>
            </div>
          )}
          {slot.holdStatus && slot.holdStatus !== "none" && (
            <div className="flex justify-between text-xs"><span className="text-gray-400">Hold</span><span className="font-bold text-red-600">{fmtS(slot.holdStatus)}</span></div>
          )}
          {slot.movePriority && slot.movePriority !== "normal" && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Move Priority</span>
              <span className={`font-semibold ${slot.movePriority === "high" || slot.movePriority === "urgent" ? "text-red-600" : "text-orange-600"}`}>
                {fmtS(slot.movePriority)}
              </span>
            </div>
          )}
          {dwell >= 1 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Dwell time</span>
              <span className={dwell > 24 ? "text-red-600 font-bold" : "text-gray-700 dark:text-gray-300"}>{Math.round(dwell)}h</span>
            </div>
          )}
          <div className="text-[10px] text-blue-500 dark:text-blue-400 mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-700 font-medium">
            Click to select · Drag to create a move
          </div>
        </div>
      ) : <div className="text-emerald-600 text-sm font-semibold mt-1.5">Available — drop here to assign</div>}
    </div>
  );
}

function DoorTooltip({ data, containerRef }: { data: { door: MapDoor; x: number; y: number }; containerRef: React.RefObject<HTMLDivElement> }) {
  const { door, x, y } = data;
  const r = containerRef.current?.getBoundingClientRect() || { right: 0, bottom: 0 };
  return (
    <div className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-3.5 z-50 text-sm min-w-[210px] pointer-events-none"
      style={{ left: Math.min(x + 14, r.right - 230), top: Math.min(y - 80, r.bottom - 200) }}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-gray-900 dark:text-gray-100 text-base">Dock Door {door.doorNumber}</span>
        {door.status === "maintenance" && <Badge variant="secondary" className="text-[10px]">Maintenance</Badge>}
      </div>
      {door.visitNumber ? (
        <div className="space-y-1.5 border-t border-gray-100 dark:border-gray-700 pt-2.5">
          <div className="flex justify-between text-xs"><span className="text-gray-400">Trailer</span><span className="font-mono font-bold text-gray-900 dark:text-gray-100">{door.trailerNumber}</span></div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Status</span>
            <span className="font-semibold text-blue-600">{fmtS(door.visitStatus || "")}</span>
          </div>
          <div className="text-[10px] text-blue-500 dark:text-blue-400 mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-700 font-medium">
            Drag to create a move request
          </div>
        </div>
      ) : <div className="text-emerald-600 text-sm font-semibold mt-1.5">Available — drop here to assign</div>}
    </div>
  );
}

// ── Mini-map (bottom-right corner overlay) ─────────────────────────────────
const MINI_W = 160;
const MINI_H = 95;
const MINI_SCALE = MINI_W / 1430;

function MiniMap({
  viewBox, slots, doors, selectedSlotId, slotPositions, doorPositions, zoneLayouts,
}: {
  viewBox: { x: number; y: number; w: number; h: number };
  slots: MapSlot[];
  doors: MapDoor[];
  selectedSlotId: number | null;
  slotPositions: Record<number, { cx: number; cy: number }>;
  doorPositions: Record<number, { cx: number; cy: number }>;
  zoneLayouts: { layouts: Record<string, any>; grouped: Record<string, MapSlot[]> };
}) {
  return (
    <div className="absolute bottom-3 right-3 z-30 rounded-xl overflow-hidden border border-gray-300/60 shadow-lg bg-[#cdc7b8]" style={{ width: MINI_W, height: MINI_H }}>
      <svg width={MINI_W} height={MINI_H} viewBox="0 0 1430 830" style={{ display: "block" }}>
        {/* Warehouse silhouette */}
        <rect x={30} y={12} width={1360} height={150} fill="#b5c0cc" rx={2} opacity={0.7} />
        {/* Zone backgrounds */}
        {Object.entries(zoneLayouts.layouts).map(([code, layout]) => {
          const theme = { "RFR": "#e0f2fe", "HAZ": "#fecaca", "PKG-C": "#fef3c7" }[code] || "#dcfce7";
          return <rect key={code} x={layout.x} y={layout.y} width={layout.w} height={layout.h} fill={theme} rx={4} opacity={0.6} />;
        })}
        {/* Slots */}
        {slots.map(s => {
          const pos = slotPositions[s.id];
          if (!pos) return null;
          const color = s.isBlocked ? "#94a3b8" :
            s.holdStatus && s.holdStatus !== "none" ? "#dc2626" :
            s.visitNumber ? (s.visitStatus === "ready_out" ? "#d97706" : s.isReefer ? "#0891b2" : s.movementType === "outbound" ? "#7c3aed" : "#2563eb") :
            "#e2e8f0";
          return (
            <rect key={s.id} x={pos.cx - 5} y={pos.cy - 3} width={10} height={6} rx={1} fill={color}
              stroke={selectedSlotId === s.id ? "#f59e0b" : "none"} strokeWidth={3} />
          );
        })}
        {/* Viewport frame */}
        <rect
          x={Math.max(0, viewBox.x)} y={Math.max(0, viewBox.y)}
          width={Math.min(1430, viewBox.w)} height={Math.min(830, viewBox.h)}
          fill="none" stroke="#1d4ed8" strokeWidth={12} opacity={0.5} rx={4}
        />
      </svg>
    </div>
  );
}
