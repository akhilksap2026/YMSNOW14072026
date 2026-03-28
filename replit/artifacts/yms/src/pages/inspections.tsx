import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateAll } from "@/lib/invalidation";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusChip, FilterToolbar, EmptyState } from "@/components/enterprise";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ClipboardCheck, CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronRight,
  Camera, Image as ImageIcon, Plus, AlertTriangle, Truck, Save, Send, X,
  Pen, RotateCcw,
} from "lucide-react";

interface ChecklistItem {
  id: string;
  label: string;
  group: string;
  answer: "yes" | "no" | "na" | null;
  notes: string;
  critical: boolean;
  photoUrls: string[];
}

interface InspectionRecord {
  id: number;
  visitId: number | null;
  inspectionType: string;
  trailerNumber: string | null;
  containerNumber: string | null;
  carrierName: string | null;
  currentLocation: string | null;
  equipmentType: string | null;
  shipmentType: string | null;
  weather: string | null;
  sealNumber: string | null;
  result: string;
  inspectionStatus: string | null;
  checklist: ChecklistItem[] | null;
  photoUrls: string[] | null;
  signatureUrl: string | null;
  remarks: string | null;
  issueSeverity: string | null;
  exceptionId: number | null;
  inspectorId: string | null;
  inspectorName: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface YardInventoryItem {
  id: number;
  visitNumber: string;
  trailerNumber: string | null;
  carrierName: string | null;
  currentSlotNumber: string | null;
  currentDockDoor: string | null;
  zoneName: string | null;
  visitStatus: string;
  locationStatus: string;
}

const INSPECTION_TYPES = [
  { value: "gate_inspection", label: "Gate Inspection" },
  { value: "dock_inspection", label: "Dock Inspection" },
  { value: "damage_assessment", label: "Damage Assessment" },
  { value: "yard_spot_check", label: "Yard Spot Check" },
  { value: "reefer_check", label: "Reefer Check" },
  { value: "hazmat_check", label: "Hazmat Check" },
];

const INSPECTION_STATUSES = [
  { value: "pending", label: "Pending", color: "text-slate-500" },
  { value: "in_progress", label: "In Progress", color: "text-blue-600" },
  { value: "completed", label: "Completed", color: "text-emerald-600" },
  { value: "failed", label: "Failed", color: "text-red-600" },
];

const DEFAULT_CHECKLIST: Omit<ChecklistItem, "answer" | "notes" | "photoUrls">[] = [
  { id: "id_plate", label: "Trailer/container ID plate visible and legible", group: "Identity & Documentation", critical: true },
  { id: "id_match", label: "Trailer number matches system records", group: "Identity & Documentation", critical: true },
  { id: "seal_present", label: "Seal present", group: "Identity & Documentation", critical: true },
  { id: "seal_readable", label: "Seal number readable and matches documentation", group: "Identity & Documentation", critical: true },
  { id: "docs_available", label: "Documents available (BOL, manifest, etc.)", group: "Identity & Documentation", critical: false },
  { id: "registration", label: "Registration and compliance stickers current", group: "Identity & Documentation", critical: false },
  { id: "ext_front", label: "Front condition OK (no damage, clean, markings visible)", group: "Exterior Condition", critical: false },
  { id: "ext_left", label: "Left side condition OK (panels, markings, no holes)", group: "Exterior Condition", critical: false },
  { id: "ext_right", label: "Right side condition OK (panels, markings, no holes)", group: "Exterior Condition", critical: false },
  { id: "ext_rear_doors", label: "Rear doors OK (open/close, hinges, latches functional)", group: "Exterior Condition", critical: false },
  { id: "ext_roof", label: "Roof intact, no visible damage or holes", group: "Exterior Condition", critical: false },
  { id: "ext_floor", label: "Floor condition OK (no rot, holes, or debris)", group: "Interior & Structural", critical: false },
  { id: "ext_crossmembers", label: "Cross members OK (no bending, rust-through, or damage)", group: "Interior & Structural", critical: false },
  { id: "ext_no_leakage", label: "No leakage (fluid, water, product)", group: "Interior & Structural", critical: true },
  { id: "ext_no_structural", label: "No major structural damage", group: "Interior & Structural", critical: true },
  { id: "ext_tires", label: "Tires visible / condition OK (tread, inflation, damage)", group: "Wheels & Running Gear", critical: true },
  { id: "ext_lights", label: "All lights and reflectors operational", group: "Wheels & Running Gear", critical: false },
  { id: "saf_brakes", label: "Brake system functional (parking brake engaged)", group: "Wheels & Running Gear", critical: true },
  { id: "saf_landing", label: "Landing gear properly deployed", group: "Safety & Coupling", critical: true },
  { id: "saf_chocks", label: "Wheel chocks in place", group: "Safety & Coupling", critical: true },
  { id: "saf_coupling", label: "Chassis / coupling OK (fifth wheel area clear and safe)", group: "Safety & Coupling", critical: false },
  { id: "saf_safe_move", label: "Unit safe to move", group: "Safety & Coupling", critical: true },
  { id: "saf_hazmat_placard", label: "Hazmat markings correct (if applicable)", group: "Regulatory & Special", critical: true },
  { id: "spc_reefer_unit", label: "Reefer running (if applicable)", group: "Regulatory & Special", critical: true },
  { id: "spc_reefer_temp", label: "Temperature within acceptable range", group: "Regulatory & Special", critical: true },
  { id: "spc_reefer_fuel", label: "Reefer fuel level adequate", group: "Regulatory & Special", critical: false },
  { id: "spc_hazmat_label", label: "Hazmat labels match manifest (if applicable)", group: "Regulatory & Special", critical: true },
  { id: "spc_hazmat_leak", label: "No visible leaks or spills (hazmat)", group: "Regulatory & Special", critical: true },
];

type TruckView = "front" | "left" | "right" | "rear" | "top" | "interior";

interface Hotspot {
  itemId: string;
  x: number;
  y: number;
  label: string;
}

const VIEW_CONFIG: Record<TruckView, { vb: string; ratio: string; label: string }> = {
  left:     { vb: "0 0 520 185", ratio: "520/185", label: "Left Side" },
  right:    { vb: "0 0 520 185", ratio: "520/185", label: "Right Side" },
  front:    { vb: "0 0 300 210", ratio: "300/210", label: "Front" },
  rear:     { vb: "0 0 300 210", ratio: "300/210", label: "Rear" },
  top:      { vb: "0 0 520 160", ratio: "520/160", label: "Top" },
  interior: { vb: "0 0 400 210", ratio: "400/210", label: "Interior" },
};

const HOTSPOT_VIEWS: Record<TruckView, Hotspot[]> = {
  left: [
    { itemId: "ext_front",       x: 4,  y: 50, label: "Front Bumper" },
    { itemId: "ext_left",        x: 68, y: 45, label: "Left Body Panel" },
    { itemId: "id_plate",        x: 55, y: 20, label: "ID Markings" },
    { itemId: "saf_coupling",    x: 37, y: 75, label: "Coupling / 5th Wheel" },
    { itemId: "saf_landing",     x: 44, y: 90, label: "Landing Gear" },
    { itemId: "ext_tires",       x: 13, y: 90, label: "Steer Tires" },
    { itemId: "saf_brakes",      x: 30, y: 90, label: "Drive Axle" },
    { itemId: "ext_tires",       x: 87, y: 90, label: "Trailer Tires" },
    { itemId: "saf_chocks",      x: 87, y: 97, label: "Wheel Chocks" },
    { itemId: "ext_lights",      x: 97, y: 44, label: "Rear Lights" },
    { itemId: "ext_no_leakage",  x: 60, y: 82, label: "No Leakage" },
    { itemId: "spc_reefer_unit", x: 25, y: 10, label: "Reefer / AC Unit" },
  ],
  right: [
    { itemId: "ext_front",       x: 96, y: 50, label: "Front Bumper" },
    { itemId: "ext_right",       x: 32, y: 45, label: "Right Body Panel" },
    { itemId: "id_plate",        x: 45, y: 20, label: "ID Markings" },
    { itemId: "saf_coupling",    x: 63, y: 75, label: "Coupling / 5th Wheel" },
    { itemId: "saf_landing",     x: 56, y: 90, label: "Landing Gear" },
    { itemId: "ext_tires",       x: 87, y: 90, label: "Steer Tires" },
    { itemId: "saf_brakes",      x: 70, y: 90, label: "Drive Axle" },
    { itemId: "ext_tires",       x: 13, y: 90, label: "Trailer Tires" },
    { itemId: "saf_chocks",      x: 13, y: 97, label: "Wheel Chocks" },
    { itemId: "ext_lights",      x: 3,  y: 44, label: "Rear Lights" },
    { itemId: "ext_no_leakage",  x: 40, y: 82, label: "No Leakage" },
    { itemId: "spc_reefer_unit", x: 75, y: 10, label: "Reefer / AC Unit" },
  ],
  front: [
    { itemId: "ext_front",        x: 50, y: 65, label: "Front Bumper/Face" },
    { itemId: "id_plate",         x: 50, y: 20, label: "ID Plate / Number" },
    { itemId: "ext_lights",       x: 17, y: 50, label: "Left Headlight" },
    { itemId: "ext_lights",       x: 83, y: 50, label: "Right Headlight" },
    { itemId: "registration",     x: 72, y: 22, label: "Registration" },
    { itemId: "saf_hazmat_placard", x: 22, y: 50, label: "Hazmat Placard" },
    { itemId: "saf_coupling",     x: 50, y: 88, label: "Kingpin / Coupling" },
    { itemId: "saf_landing",      x: 28, y: 88, label: "Landing Gear L" },
    { itemId: "saf_landing",      x: 72, y: 88, label: "Landing Gear R" },
  ],
  rear: [
    { itemId: "ext_rear_doors",  x: 34, y: 52, label: "Left Rear Door" },
    { itemId: "ext_rear_doors",  x: 66, y: 52, label: "Right Rear Door" },
    { itemId: "seal_present",    x: 50, y: 52, label: "Seal / Lock Bar" },
    { itemId: "ext_lights",      x: 12, y: 68, label: "Left Tail Light" },
    { itemId: "ext_lights",      x: 88, y: 68, label: "Right Tail Light" },
    { itemId: "spc_reefer_unit", x: 50, y: 13, label: "Reefer Unit" },
    { itemId: "ext_no_leakage",  x: 50, y: 84, label: "Floor / Drain" },
    { itemId: "id_plate",        x: 26, y: 22, label: "DOT Number" },
    { itemId: "ext_no_structural", x: 50, y: 35, label: "Structural Integrity" },
  ],
  top: [
    { itemId: "ext_roof",          x: 67, y: 50, label: "Trailer Roof" },
    { itemId: "spc_reefer_unit",   x: 24, y: 50, label: "Reefer Unit" },
    { itemId: "spc_reefer_fuel",   x: 24, y: 72, label: "Reefer Fuel Cap" },
    { itemId: "spc_hazmat_label",  x: 50, y: 28, label: "Hazmat Placards" },
    { itemId: "id_plate",          x: 50, y: 72, label: "Roof ID Markings" },
    { itemId: "ext_no_structural", x: 78, y: 50, label: "Rear Structural" },
  ],
  interior: [
    { itemId: "ext_floor",         x: 50, y: 76, label: "Floor Condition" },
    { itemId: "ext_crossmembers",  x: 28, y: 60, label: "Cross Members" },
    { itemId: "ext_crossmembers",  x: 72, y: 60, label: "Cross Members" },
    { itemId: "ext_no_leakage",    x: 78, y: 35, label: "No Leakage" },
    { itemId: "ext_no_structural", x: 50, y: 30, label: "Structural" },
    { itemId: "seal_readable",     x: 50, y: 15, label: "Seal Verification" },
    { itemId: "docs_available",    x: 22, y: 25, label: "Documents" },
  ],
};

function buildChecklist(): ChecklistItem[] {
  return DEFAULT_CHECKLIST.map((item) => ({
    ...item,
    answer: null,
    notes: "",
    photoUrls: [],
  }));
}

function migrateChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item) => ({ ...item, photoUrls: item.photoUrls || [] }));
}

function resultColor(result: string): string {
  switch (result) {
    case "passed": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "passed_with_notes": return "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200";
    case "failed": return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "exception_raised": return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "draft": return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
    default: return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
  }
}

function resultLabel(result: string): string {
  const map: Record<string, string> = {
    passed: "Passed", passed_with_notes: "Passed with Notes",
    failed: "Failed", exception_raised: "Exception Raised", draft: "Draft",
  };
  return map[result] || result;
}

function typeLabel(type: string): string {
  return INSPECTION_TYPES.find((t) => t.value === type)?.label || type;
}

function computeResult(checklist: ChecklistItem[], remarks: string): string {
  const answered = checklist.filter((i) => i.answer !== null);
  if (answered.length === 0) return "draft";
  const hasNo = checklist.some((i) => i.answer === "no");
  const criticalNo = checklist.some((i) => i.answer === "no" && i.critical);
  if (criticalNo) return "failed";
  if (hasNo) return "passed_with_notes";
  const hasNotes = checklist.some((i) => i.notes.trim()) || remarks.trim();
  if (hasNotes) return "passed_with_notes";
  return "passed";
}

function hotspotColor(answer: "yes" | "no" | "na" | null): { fill: string; stroke: string; textFill: string } {
  switch (answer) {
    case "yes": return { fill: "#22c55e", stroke: "#16a34a", textFill: "#fff" };
    case "no": return { fill: "#ef4444", stroke: "#dc2626", textFill: "#fff" };
    case "na": return { fill: "#9ca3af", stroke: "#6b7280", textFill: "#fff" };
    default: return { fill: "#fff", stroke: "#94a3b8", textFill: "#64748b" };
  }
}

function TruckWheel({ cx, cy, r, isDark }: { cx: number; cy: number; r: number; isDark: boolean }) {
  const tire = isDark ? "#1a1f2e" : "#2d3748";
  const sidewall = isDark ? "#374151" : "#4b5563";
  const hub = isDark ? "#475569" : "#94a3b8";
  const spoke = isDark ? "#334155" : "#6b7280";
  const angles = [0, 60, 120, 180, 240, 300];
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={tire} />
      <circle cx={cx} cy={cy} r={r * 0.75} fill={sidewall} />
      <circle cx={cx} cy={cy} r={r * 0.45} fill={hub} />
      <circle cx={cx} cy={cy} r={r * 0.2} fill={spoke} />
      {angles.map(a => {
        const rad = a * Math.PI / 180;
        const x1 = cx + r * 0.22 * Math.cos(rad); const y1 = cy + r * 0.22 * Math.sin(rad);
        const x2 = cx + r * 0.68 * Math.cos(rad); const y2 = cy + r * 0.68 * Math.sin(rad);
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={spoke} strokeWidth="1.2" />;
      })}
    </g>
  );
}

function TrailerSVGPaths({ view, isDark }: { view: TruckView; isDark: boolean }) {
  const trFill    = isDark ? "#1e3a5f" : "#2563eb";
  const trDark    = isDark ? "#172d4a" : "#1d4ed8";
  const trLight   = isDark ? "#2a4a73" : "#3b82f6";
  const bodyFill  = isDark ? "#1e2d3d" : "#e8f0f8";
  const bodyStroke= isDark ? "#3d5a7a" : "#64748b";
  const railFill  = isDark ? "#253447" : "#94a3b8";
  const wheelBG   = isDark ? "#0f172a" : "#f1f5f9";
  const glassFill = isDark ? "#0c4a6e" : "#bfdbfe";
  const glassStk  = isDark ? "#0ea5e9" : "#3b82f6";
  const chrome    = isDark ? "#64748b" : "#94a3b8";
  const groundClr = isDark ? "#1e293b" : "#cbd5e1";
  const exhaustClr= isDark ? "#475569" : "#6b7280";
  const reeferFill= isDark ? "#253447" : "#cbd5e1";
  const lightR    = "#ef4444";
  const lightA    = "#f59e0b";
  const lightW    = isDark ? "#fef3c7" : "#fffbeb";
  const lgGray    = isDark ? "#374151" : "#9ca3af";

  if (view === "left" || view === "right") {
    const flip = view === "right";
    const W = 520;
    const content = (
      <g>
        {/* Ground shadow */}
        <rect x="8" y="178" width="504" height="5" rx="2" fill={groundClr} opacity="0.5" />

        {/* ── TRAILER ────────────────────────────────────────── */}
        {/* Main body */}
        <rect x="205" y="22" width="308" height="118" rx="3" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.8" />
        {/* Top rail */}
        <rect x="205" y="19" width="308" height="6" rx="2" fill={railFill} />
        {/* Bottom rail */}
        <rect x="205" y="138" width="308" height="7" rx="2" fill={railFill} />
        {/* Horizontal rivet lines */}
        <line x1="205" y1="42" x2="513" y2="42" stroke={bodyStroke} strokeWidth="0.5" strokeDasharray="12,8" opacity="0.5" />
        <line x1="205" y1="120" x2="513" y2="120" stroke={bodyStroke} strokeWidth="0.5" strokeDasharray="12,8" opacity="0.5" />
        {/* Vertical panel lines */}
        {[260,315,370,425,478].map(x => (
          <line key={x} x1={x} y1="22" x2={x} y2="138" stroke={bodyStroke} strokeWidth="0.4" opacity="0.3" />
        ))}
        {/* Reefer unit on nose of trailer */}
        <rect x="205" y="8" width="58" height="14" rx="3" fill={reeferFill} stroke={bodyStroke} strokeWidth="1" />
        <rect x="210" y="11" width="8" height="8" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        <rect x="222" y="11" width="8" height="8" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        <rect x="234" y="11" width="8" height="8" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        <rect x="246" y="11" width="8" height="8" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        {/* ID / DOT number plate area */}
        <rect x="290" y="26" width="90" height="14" rx="1" fill={isDark ? "#0f172a" : "#fff"} stroke={bodyStroke} strokeWidth="0.5" opacity="0.7" />
        <line x1="295" y1="32" x2="375" y2="32" stroke={bodyStroke} strokeWidth="1" opacity="0.4" />
        <line x1="295" y1="36" x2="355" y2="36" stroke={bodyStroke} strokeWidth="1" opacity="0.3" />

        {/* Rear of trailer */}
        {/* Corner guard strips */}
        <rect x="507" y="22" width="7" height="118" rx="2" fill={railFill} />
        {/* Tail lights L */}
        <rect x="504" y="38" width="9" height="18" rx="2" fill={lightR} />
        <rect x="504" y="62" width="9" height="10" rx="2" fill={lightA} />
        {/* Tail lights R (lower) */}
        <rect x="504" y="104" width="9" height="18" rx="2" fill={lightR} />
        <rect x="504" y="88" width="9" height="10" rx="2" fill={lightA} />
        {/* Reflector strip */}
        <rect x="505" y="78" width="6" height="8" rx="1" fill="#fbbf24" opacity="0.8" />
        {/* Rear bumper */}
        <rect x="500" y="143" width="15" height="5" rx="2" fill={railFill} />
        <rect x="503" y="148" width="9" height="4" rx="1" fill={railFill} opacity="0.6" />

        {/* Landing gear */}
        <rect x="228" y="145" width="5" height="30" rx="1" fill={lgGray} />
        <rect x="237" y="145" width="5" height="30" rx="1" fill={lgGray} />
        <rect x="222" y="172" width="26" height="4" rx="2" fill={lgGray} />
        <rect x="239" y="145" width="16" height="3" rx="1" fill={lgGray} opacity="0.6" />

        {/* Trailer tandem axle beam */}
        <rect x="442" y="143" width="40" height="4" rx="2" fill={railFill} opacity="0.6" />
        {/* Tandem wheels */}
        <TruckWheel cx={448} cy={163} r={16} isDark={isDark} />
        <TruckWheel cx={468} cy={163} r={16} isDark={isDark} />
        {/* Rear mudflap */}
        <path d={`M 485,141 L 490,141 L 492,163 L 483,163 Z`} fill={railFill} opacity="0.6" />

        {/* ── TRACTOR ────────────────────────────────────────── */}
        {/* 5th wheel / coupling plate (visible between cab and trailer) */}
        <rect x="186" y="130" width="22" height="6" rx="2" fill={chrome} />
        <rect x="190" y="126" width="14" height="6" rx="1" fill={isDark ? "#374151" : "#64748b"} />

        {/* Fuel tank (cylindrical, driver side) */}
        <rect x="150" y="120" width="32" height="28" rx="6" fill={isDark ? "#1e3a5f" : "#3b82f6"} stroke={bodyStroke} strokeWidth="1" />
        <rect x="152" y="125" width="28" height="4" rx="1" fill={chrome} opacity="0.3" />
        {/* Steps */}
        <rect x="150" y="112" width="12" height="5" rx="1" fill={railFill} opacity="0.7" />
        <rect x="150" y="104" width="12" height="5" rx="1" fill={railFill} opacity="0.5" />

        {/* Cab body */}
        <rect x="26" y="22" width="168" height="128" rx="5" fill={trFill} stroke={isDark ? "#2a4a73" : "#1d4ed8"} strokeWidth="1.8" />
        {/* Cab roof fairing (aerodynamic) */}
        <path d={`M 26,22 Q 100,10 194,22`} fill={trLight} stroke={isDark ? "#2a4a73" : "#1d4ed8"} strokeWidth="1" />

        {/* Hood / nose slant */}
        <path d={`M 8,148 L 8,90 Q 10,58 26,44 L 26,148 Z`} fill={trDark} stroke={isDark ? "#2a4a73" : "#1d4ed8"} strokeWidth="1.8" />
        {/* Hood crease line */}
        <path d={`M 8,115 Q 15,105 26,100`} stroke={trLight} strokeWidth="0.8" fill="none" opacity="0.6" />

        {/* Windshield */}
        <rect x="28" y="26" width="158" height="52" rx="3" fill={glassFill} stroke={glassStk} strokeWidth="1" />
        {/* Windshield divider */}
        <line x1="107" y1="26" x2="107" y2="78" stroke={glassStk} strokeWidth="1" opacity="0.5" />
        {/* Windshield wiper */}
        <path d={`M 38,74 Q 75,68 112,72`} stroke={bodyStroke} strokeWidth="1.2" fill="none" opacity="0.7" />
        <path d={`M 112,74 Q 145,68 178,72`} stroke={bodyStroke} strokeWidth="1.2" fill="none" opacity="0.7" />

        {/* Side window (sleeper) */}
        <rect x="150" y="84" width="38" height="28" rx="2" fill={glassFill} stroke={glassStk} strokeWidth="0.8" opacity="0.8" />

        {/* Door */}
        <path d={`M 28,82 L 148,82 L 148,148 L 28,148`} fill="none" stroke={isDark ? "#2a4a73" : "#1d4ed8"} strokeWidth="0.8" opacity="0.5" />
        {/* Door window */}
        <rect x="32" y="84" width="112" height="28" rx="2" fill={glassFill} stroke={glassStk} strokeWidth="0.6" opacity="0.7" />
        {/* Door handle */}
        <rect x="135" y="116" width="12" height="4" rx="2" fill={chrome} />
        {/* Door hinges */}
        <rect x="28" y="88" width="4" height="8" rx="1" fill={chrome} opacity="0.8" />
        <rect x="28" y="122" width="4" height="8" rx="1" fill={chrome} opacity="0.8" />
        {/* Cab step */}
        <rect x="14" y="142" width="14" height="5" rx="1" fill={railFill} opacity="0.8" />
        <rect x="14" y="134" width="14" height="5" rx="1" fill={railFill} opacity="0.6" />

        {/* Exhaust stack */}
        <rect x="172" y="4" width="7" height="22" rx="3" fill={exhaustClr} stroke={bodyStroke} strokeWidth="0.8" />
        <ellipse cx="175.5" cy="4" rx="3.5" ry="2" fill={isDark ? "#374151" : "#4b5563"} />
        {/* Second stack (slightly behind) */}
        <rect x="180" y="10" width="5" height="16" rx="2" fill={exhaustClr} opacity="0.5" />

        {/* Air cleaner stack (front L) */}
        <rect x="18" y="30" width="6" height="20" rx="2" fill={trDark} stroke={isDark ? "#2a4a73" : "#1d4ed8"} strokeWidth="0.8" />

        {/* Mirror arm + mirror */}
        <line x1="180" y1="32" x2="196" y2="28" stroke={chrome} strokeWidth="1.2" />
        <rect x="186" y="24" width="20" height="12" rx="2" fill={isDark ? "#1e293b" : "#e2e8f0"} stroke={chrome} strokeWidth="1" />
        {/* Small convex spotter mirror */}
        <ellipse cx="200" cy="40" rx="7" ry="5" fill={isDark ? "#1e293b" : "#e2e8f0"} stroke={chrome} strokeWidth="0.8" />

        {/* Headlights on hood */}
        <rect x="10" y="86" width="8" height="12" rx="1" fill={lightW} stroke={lightA} strokeWidth="0.8" />
        <rect x="10" y="102" width="8" height="8" rx="1" fill={lightA} opacity="0.9" />
        {/* Chrome front bumper strip */}
        <rect x="8" y="143" width="20" height="5" rx="2" fill={chrome} />

        {/* Tractor steer axle */}
        <rect x="54" y="145" width="32" height="4" rx="2" fill={railFill} opacity="0.6" />
        {/* Steer mudflap */}
        <path d={`M 88,141 L 93,141 L 96,163 L 87,163 Z`} fill={railFill} opacity="0.5" />
        {/* Steer wheel */}
        <TruckWheel cx={70} cy={163} r={17} isDark={isDark} />

        {/* Drive tandem axle beam */}
        <rect x="140" y="145" width="40" height="4" rx="2" fill={railFill} opacity="0.6" />
        {/* Drive mudflap */}
        <path d={`M 182,141 L 187,141 L 190,163 L 181,163 Z`} fill={railFill} opacity="0.5" />
        {/* Drive wheels */}
        <TruckWheel cx={148} cy={163} r={16} isDark={isDark} />
        <TruckWheel cx={168} cy={163} r={16} isDark={isDark} />
      </g>
    );
    return flip
      ? <g transform={`scale(-1,1) translate(-${W},0)`}>{content}</g>
      : content;
  }

  if (view === "front") {
    const W = 300; const H = 210;
    const cxC = W / 2;
    return (
      <g>
        {/* Ground */}
        <rect x="10" y="196" width="280" height="6" rx="3" fill={groundClr} opacity="0.5" />
        {/* Sky / BG hint */}
        <rect x="15" y="8" width="270" height="188" rx="6" fill={isDark ? "#0f172a" : "#f8fafc"} stroke={bodyStroke} strokeWidth="0.5" opacity="0.3" />

        {/* === TRAILER (front face) === */}
        {/* Trailer front wall */}
        <rect x="30" y="22" width="240" height="140" rx="4" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.8" />
        {/* Corner posts */}
        <rect x="30" y="22" width="12" height="140" rx="2" fill={railFill} />
        <rect x="258" y="22" width="12" height="140" rx="2" fill={railFill} />
        {/* Top and bottom rails */}
        <rect x="30" y="22" width="240" height="10" rx="2" fill={railFill} />
        <rect x="30" y="152" width="240" height="9" rx="2" fill={railFill} />
        {/* Reefer unit across top */}
        <rect x="50" y="8" width="200" height="16" rx="4" fill={reeferFill} stroke={bodyStroke} strokeWidth="1.2" />
        {[60,90,120,150,180,210].map(x => (
          <rect key={x} x={x} y="11" width="16" height="10" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        ))}

        {/* Horizontal bracing */}
        <line x1="42" y1="80" x2="258" y2="80" stroke={bodyStroke} strokeWidth="0.6" opacity="0.4" />
        <line x1="42" y1="110" x2="258" y2="110" stroke={bodyStroke} strokeWidth="0.6" opacity="0.4" />

        {/* DOT / ID plate */}
        <rect x="100" y="30" width="100" height="22" rx="2" fill={isDark ? "#0f172a" : "#fff"} stroke={bodyStroke} strokeWidth="0.8" />
        <line x1="108" y1="38" x2="192" y2="38" stroke={bodyStroke} strokeWidth="1.2" opacity="0.5" />
        <line x1="108" y1="44" x2="172" y2="44" stroke={bodyStroke} strokeWidth="1.2" opacity="0.3" />

        {/* Landing gear legs (L and R) */}
        <rect x="68" y="161" width="6" height="32" rx="2" fill={lgGray} />
        <rect x="77" y="161" width="6" height="32" rx="2" fill={lgGray} />
        <rect x="62" y="190" width="28" height="4" rx="2" fill={lgGray} />
        <rect x="218" y="161" width="6" height="32" rx="2" fill={lgGray} />
        <rect x="227" y="161" width="6" height="32" rx="2" fill={lgGray} />
        <rect x="212" y="190" width="28" height="4" rx="2" fill={lgGray} />

        {/* Kingpin / fifth wheel (center bottom) */}
        <ellipse cx={cxC} cy="168" rx="20" ry="8" fill={chrome} stroke={bodyStroke} strokeWidth="1" />
        <circle cx={cxC} cy="168" r="6" fill={isDark ? "#1e293b" : "#e2e8f0"} />

        {/* Headlights */}
        <rect x="36" y="58" width="28" height="18" rx="3" fill={lightW} stroke={lightA} strokeWidth="1" />
        <rect x="236" y="58" width="28" height="18" rx="3" fill={lightW} stroke={lightA} strokeWidth="1" />
        {/* Amber turn lights */}
        <rect x="36" y="80" width="28" height="10" rx="2" fill={lightA} opacity="0.9" />
        <rect x="236" y="80" width="28" height="10" rx="2" fill={lightA} opacity="0.9" />
        {/* Grille */}
        <rect x="95" y="58" width="110" height="50" rx="3" fill={isDark ? "#0f172a" : "#e2e8f0"} stroke={bodyStroke} strokeWidth="1" />
        {[65,72,79,86,93,100].map(y => (
          <line key={y} x1="98" y1={y} x2="202" y2={y} stroke={bodyStroke} strokeWidth="0.8" opacity="0.5" />
        ))}
        {/* Front bumper */}
        <rect x="30" y="148" width="240" height="14" rx="3" fill={trFill} stroke={bodyStroke} strokeWidth="1" />
        <rect x="44" y="151" width="50" height="8" rx="1" fill={chrome} opacity="0.5" />
        <rect x="206" y="151" width="50" height="8" rx="1" fill={chrome} opacity="0.5" />
        {/* Hazmat placard area */}
        <rect x="36" y="112" width="28" height="28" rx="2" fill={isDark ? "#1e293b" : "#fff"} stroke="#f59e0b" strokeWidth="1" />
        <text x="50" y="130" textAnchor="middle" fontSize="6" fill={isDark ? "#f59e0b" : "#92400e"} fontWeight="bold">HM</text>
      </g>
    );
  }

  if (view === "rear") {
    const W = 300; const H = 210;
    const cxC = W / 2;
    return (
      <g>
        {/* Ground */}
        <rect x="10" y="196" width="280" height="6" rx="3" fill={groundClr} opacity="0.5" />

        {/* === TRAILER REAR === */}
        {/* Main door frame */}
        <rect x="28" y="22" width="244" height="140" rx="4" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.8" />
        {/* Corner posts */}
        <rect x="28" y="22" width="12" height="140" rx="2" fill={railFill} />
        <rect x="260" y="22" width="12" height="140" rx="2" fill={railFill} />
        {/* Top rail */}
        <rect x="28" y="22" width="244" height="8" rx="2" fill={railFill} />
        {/* Bottom sill */}
        <rect x="28" y="154" width="244" height="8" rx="2" fill={railFill} />
        {/* Rear bumper */}
        <rect x="28" y="160" width="244" height="10" rx="2" fill={railFill} />
        <rect x="44" y="162" width="60" height="6" rx="1" fill={chrome} opacity="0.5" />
        <rect x="196" y="162" width="60" height="6" rx="1" fill={chrome} opacity="0.5" />

        {/* Reefer unit on top */}
        <rect x="48" y="8" width="204" height="16" rx="4" fill={reeferFill} stroke={bodyStroke} strokeWidth="1.2" />
        {[60,90,120,150,180,210].map(x => (
          <rect key={x} x={x} y="11" width="14" height="10" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        ))}

        {/* Door divider center post */}
        <rect x="147" y="28" width="6" height="126" rx="2" fill={railFill} />

        {/* Left door */}
        <rect x="40" y="30" width="107" height="122" rx="2" fill={isDark ? "#1a2840" : "#f0f4f8"} stroke={bodyStroke} strokeWidth="0.8" />
        {/* Left door hinges */}
        <rect x="38" y="42" width="8" height="10" rx="2" fill={chrome} />
        <rect x="38" y="90" width="8" height="10" rx="2" fill={chrome} />
        <rect x="38" y="132" width="8" height="10" rx="2" fill={chrome} />
        {/* Left door latch bar */}
        <rect x="140" y="36" width="6" height="110" rx="3" fill={chrome} />
        <rect x="136" y="70" width="14" height="10" rx="2" fill={isDark ? "#374151" : "#6b7280"} />

        {/* Right door */}
        <rect x="153" y="30" width="107" height="122" rx="2" fill={isDark ? "#1a2840" : "#f0f4f8"} stroke={bodyStroke} strokeWidth="0.8" />
        {/* Right door hinges */}
        <rect x="255" y="42" width="8" height="10" rx="2" fill={chrome} />
        <rect x="255" y="90" width="8" height="10" rx="2" fill={chrome} />
        <rect x="255" y="132" width="8" height="10" rx="2" fill={chrome} />
        {/* Right door latch bar */}
        <rect x="154" y="36" width="6" height="110" rx="3" fill={chrome} />
        <rect x="150" y="70" width="14" height="10" rx="2" fill={isDark ? "#374151" : "#6b7280"} />

        {/* Seal lock bar (horizontal across center) */}
        <rect x="40" y="87" width="220" height="6" rx="3" fill={chrome} stroke={bodyStroke} strokeWidth="0.5" />
        <rect x="140" y="83" width="20" height="14" rx="2" fill={isDark ? "#374151" : "#4b5563"} />
        <circle cx={cxC} cy="90" r="4" fill={isDark ? "#94a3b8" : "#1e293b"} />

        {/* Tail lights */}
        <rect x="28" y="118" width="16" height="26" rx="2" fill={lightR} />
        <rect x="28" y="96" width="16" height="18" rx="2" fill={lightA} />
        <rect x="256" y="118" width="16" height="26" rx="2" fill={lightR} />
        <rect x="256" y="96" width="16" height="18" rx="2" fill={lightA} />
        {/* Side marker lights */}
        <rect x="28" y="30" width="12" height="8" rx="1" fill={lightA} opacity="0.8" />
        <rect x="260" y="30" width="12" height="8" rx="1" fill={lightA} opacity="0.8" />
        {/* Reflector strip */}
        <rect x="44" y="152" width="212" height="5" rx="2" fill="#fbbf24" opacity="0.7" />

        {/* DOT number placard */}
        <rect x="56" y="32" width="80" height="18" rx="1" fill={isDark ? "#0f172a" : "#fff"} stroke={bodyStroke} strokeWidth="0.5" />
        <line x1="62" y1="39" x2="130" y2="39" stroke={bodyStroke} strokeWidth="0.8" opacity="0.4" />
        <line x1="62" y1="44" x2="110" y2="44" stroke={bodyStroke} strokeWidth="0.8" opacity="0.3" />

        {/* Drain/floor area at bottom */}
        <rect x="100" y="160" width="100" height="6" rx="1" fill={isDark ? "#0f172a" : "#e2e8f0"} stroke={bodyStroke} strokeWidth="0.5" />

        {/* Rear axle visible below */}
        <rect x="55" y="170" width="190" height="5" rx="2" fill={railFill} />
        <TruckWheel cx={80} cy={185} r={12} isDark={isDark} />
        <TruckWheel cx={104} cy={185} r={12} isDark={isDark} />
        <TruckWheel cx={196} cy={185} r={12} isDark={isDark} />
        <TruckWheel cx={220} cy={185} r={12} isDark={isDark} />
      </g>
    );
  }

  if (view === "top") {
    const W = 520; const H = 160;
    return (
      <g>
        {/* Road markings */}
        {[1,2,3].map(i => (
          <line key={i} x1="0" y1={i * 40} x2={W} y2={i * 40} stroke={groundClr} strokeWidth="0.4" strokeDasharray="20,15" opacity="0.3" />
        ))}

        {/* === TRACTOR TOP === */}
        {/* Cab roof */}
        <rect x="8" y="35" width="145" height="90" rx="8" fill={trFill} stroke={isDark ? "#2a4a73" : "#1d4ed8"} strokeWidth="1.8" />
        {/* Roof fairing (aerodynamic hump) */}
        <rect x="12" y="38" width="137" height="25" rx="5" fill={trLight} opacity="0.7" />
        {/* Windshield (front edge) */}
        <rect x="16" y="46" width="125" height="14" rx="3" fill={glassFill} stroke={glassStk} strokeWidth="1" />
        {/* Cab outline detail */}
        <rect x="12" y="70" width="40" height="50" rx="3" fill={trDark} opacity="0.5" />
        <rect x="100" y="70" width="40" height="50" rx="3" fill={trDark} opacity="0.5" />
        {/* Sunroof / cab top hatch */}
        <rect x="56" y="68" width="42" height="28" rx="3" fill={glassFill} opacity="0.5" />
        {/* Exhaust stacks (seen from top = circles) */}
        <circle cx="152" cy="50" r="5" fill={exhaustClr} stroke={bodyStroke} strokeWidth="1" />
        <circle cx="162" cy="50" r="4" fill={exhaustClr} stroke={bodyStroke} strokeWidth="0.8" opacity="0.6" />
        {/* Mirrors (protruding sides) */}
        <rect x="8" y="50" width="14" height="8" rx="2" fill={chrome} stroke={bodyStroke} strokeWidth="0.8" />
        <rect x="130" y="50" width="14" height="8" rx="2" fill={chrome} stroke={bodyStroke} strokeWidth="0.8" />
        {/* 5th wheel area */}
        <ellipse cx="155" cy="100" rx="22" ry="12" fill={chrome} stroke={bodyStroke} strokeWidth="1" opacity="0.7" />
        <ellipse cx="155" cy="100" rx="10" ry="5" fill={isDark ? "#1e293b" : "#94a3b8"} />

        {/* === TRAILER TOP === */}
        {/* Main roof */}
        <rect x="170" y="22" width="340" height="116" rx="4" fill={bodyFill} stroke={bodyStroke} strokeWidth="1.8" />
        {/* Reefer unit (front-top of trailer) */}
        <rect x="172" y="24" width="70" height="28" rx="3" fill={reeferFill} stroke={bodyStroke} strokeWidth="1.2" />
        <rect x="176" y="27" width="12" height="22" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        <rect x="192" y="27" width="12" height="22" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        <rect x="208" y="27" width="12" height="22" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        <rect x="224" y="27" width="12" height="22" rx="1" fill={isDark ? "#1e293b" : "#94a3b8"} />
        <circle cx="176" cy="40" r="3" fill="#ef4444" opacity="0.8" />
        {/* Fuel cap */}
        <circle cx="196" cy="52" r="5" fill={chrome} stroke={bodyStroke} strokeWidth="1" />
        {/* Roof panel lines */}
        {[240, 300, 360, 420, 470].map(x => (
          <line key={x} x1={x} y1="22" x2={x} y2="138" stroke={bodyStroke} strokeWidth="0.5" opacity="0.3" />
        ))}
        {/* Hazmat placard area (side of roof — visible from top edge) */}
        <rect x="260" y="24" width="26" height="16" rx="1" fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.8" />
        <text x="273" y="35" textAnchor="middle" fontSize="7" fill="#92400e" fontWeight="bold">HM</text>
        {/* ID plate on trailer top */}
        <rect x="300" y="70" width="100" height="20" rx="2" fill={isDark ? "#0f172a" : "#fff"} stroke={bodyStroke} strokeWidth="0.5" opacity="0.7" />
        <line x1="308" y1="78" x2="392" y2="78" stroke={bodyStroke} strokeWidth="1" opacity="0.4" />
        <line x1="308" y1="83" x2="370" y2="83" stroke={bodyStroke} strokeWidth="1" opacity="0.3" />
        {/* Structural cross bracing (from top) */}
        {[240, 300, 360, 420].map(x => (
          <rect key={x} x={x - 2} y="22" width="4" height="116" rx="2" fill={railFill} opacity="0.15" />
        ))}
        {/* Rear of trailer */}
        <rect x="500" y="22" width="10" height="116" rx="3" fill={railFill} />
      </g>
    );
  }

  if (view === "interior") {
    const W = 400; const H = 210;
    const vanishX = W / 2;
    const vanishY = 60;
    const floorL = 12; const floorR = 388; const floorBot = 198;
    const wallTopL = 30; const wallTopR = 370; const wallH = 20;
    return (
      <g>
        {/* Floor */}
        <polygon
          points={`${floorL},${floorBot} ${vanishX - 80},${vanishY + 50} ${vanishX + 80},${vanishY + 50} ${floorR},${floorBot}`}
          fill={isDark ? "#1a2535" : "#d1d5db"} stroke={bodyStroke} strokeWidth="1.5"
        />
        {/* Left wall */}
        <polygon
          points={`${floorL},${wallH} ${vanishX - 80},${vanishY} ${vanishX - 80},${vanishY + 50} ${floorL},${floorBot}`}
          fill={isDark ? "#1e2d3d" : "#e8edf3"} stroke={bodyStroke} strokeWidth="1.5"
        />
        {/* Right wall */}
        <polygon
          points={`${floorR},${wallH} ${vanishX + 80},${vanishY} ${vanishX + 80},${vanishY + 50} ${floorR},${floorBot}`}
          fill={isDark ? "#1e2d3d" : "#e8edf3"} stroke={bodyStroke} strokeWidth="1.5"
        />
        {/* Ceiling */}
        <polygon
          points={`${floorL},${wallH} ${vanishX - 80},${vanishY} ${vanishX + 80},${vanishY} ${floorR},${wallH}`}
          fill={isDark ? "#253447" : "#f1f5f9"} stroke={bodyStroke} strokeWidth="1.5"
        />
        {/* Rear opening / door frame */}
        <rect x={floorL} y={wallH} width={floorR - floorL} height={floorBot - wallH} fill="none" stroke={railFill} strokeWidth="2.5" rx="2" />

        {/* Cross members on floor */}
        {[0.2, 0.35, 0.5, 0.65, 0.8].map((t, i) => {
          const ly = floorBot - (floorBot - (vanishY + 50)) * (1 - t);
          const halfW = (floorR - floorL) / 2 * (1 - t * 0.6) + 8;
          const cx = W / 2;
          return <rect key={i} x={cx - halfW} y={ly - 3} width={halfW * 2} height="6" rx="2"
            fill={isDark ? "#253447" : "#94a3b8"} stroke={bodyStroke} strokeWidth="0.8" opacity="0.8" />;
        })}
        {/* Floor boards (perspective lines) */}
        {[-3,-2,-1,0,1,2,3].map(i => {
          const fx = vanishX + i * 25;
          return <line key={i} x1={fx} y1={vanishY + 50} x2={vanishX + i * 120} y2={floorBot}
            stroke={bodyStroke} strokeWidth="0.5" opacity="0.3" />;
        })}
        {/* Left wall rib lines */}
        {[0.25, 0.5, 0.75].map((t, i) => {
          const wx = floorL + (vanishX - 80 - floorL) * t;
          const topY = wallH + (vanishY - wallH) * t;
          const botY = floorBot + (vanishY + 50 - floorBot) * t;
          return <line key={i} x1={wx} y1={topY} x2={wx} y2={botY} stroke={bodyStroke} strokeWidth="0.8" opacity="0.4" />;
        })}
        {/* Right wall rib lines */}
        {[0.25, 0.5, 0.75].map((t, i) => {
          const wx = floorR - (floorR - (vanishX + 80)) * t;
          const topY = wallH + (vanishY - wallH) * t;
          const botY = floorBot + (vanishY + 50 - floorBot) * t;
          return <line key={i} x1={wx} y1={topY} x2={wx} y2={botY} stroke={bodyStroke} strokeWidth="0.8" opacity="0.4" />;
        })}
        {/* Far-end door outline */}
        <rect x={vanishX - 75} y={vanishY} width="150" height={50} rx="2"
          fill={isDark ? "#1a2840" : "#f0f4f8"} stroke={railFill} strokeWidth="1.5" />
        <line x1={vanishX} y1={vanishY} x2={vanishX} y2={vanishY + 50} stroke={railFill} strokeWidth="1.5" />
        {/* Seal bar on far end */}
        <rect x={vanishX - 70} y={vanishY + 20} width="140" height="5" rx="2" fill={chrome} />
        <circle cx={vanishX} cy={vanishY + 22.5} r="4" fill={isDark ? "#374151" : "#1e293b"} />
        {/* Leak / stain marker area bottom */}
        <rect x="160" y="185" width="80" height="10" rx="2"
          fill={isDark ? "#1a2535" : "#e2e8f0"} stroke={bodyStroke} strokeWidth="0.5" opacity="0.5" />
      </g>
    );
  }

  return null;
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing.current || !lastPos.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
    setIsEmpty(false);
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange("");
  };

  return (
    <div className="space-y-1.5">
      <div className="relative border rounded-md overflow-hidden bg-white dark:bg-slate-900">
        <canvas
          ref={canvasRef}
          width={600}
          height={140}
          className="w-full touch-none cursor-crosshair"
          style={{ height: "100px" }}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          data-testid="canvas-signature"
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground/40 select-none">Sign here</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Draw your signature above using mouse or finger</p>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={clear} data-testid="button-clear-signature">
          <RotateCcw className="h-3 w-3 mr-1" /> Clear
        </Button>
      </div>
    </div>
  );
}

export default function InspectionsPage({ userRole, currentPersona }: { userRole?: string; currentPersona?: any } = {}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const searchString = useSearch();
  const [showNewForm, setShowNewForm] = useState(false);
  const [urlParamsHandled, setUrlParamsHandled] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);
  const [activeInspection, setActiveInspection] = useState<{
    id: number | null;
    inspectionType: string;
    trailerNumber: string;
    containerNumber: string;
    carrierName: string;
    currentLocation: string;
    equipmentType: string;
    shipmentType: string;
    weather: string;
    sealNumber: string;
    visitId: number | null;
    visitNumber: string;
    checklist: ChecklistItem[];
    remarks: string;
    photoUrls: string[];
    signatureUrl: string;
    inspectionStatus: string;
    expandedGroups: Set<string>;
  } | null>(null);

  const [viewMode, setViewMode] = useState<"checklist" | "visual">("checklist");
  const [activeTruckView, setActiveTruckView] = useState<TruckView>("left");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeHotspot, setActiveHotspot] = useState<{ itemId: string; x: number; y: number } | null>(null);
  const [pendingPhotoItemId, setPendingPhotoItemId] = useState<string | null>(null);
  const [exceptionDialog, setExceptionDialog] = useState(false);
  const [exceptionSeverity, setExceptionSeverity] = useState("medium");
  const [exceptionDescription, setExceptionDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const isDarkMode = document.documentElement.classList.contains("dark");

  const urlParams = new URLSearchParams(searchString);
  const urlVisitId = urlParams.get("visitId");
  const urlTrailer = urlParams.get("trailer");
  const urlCarrier = urlParams.get("carrier");
  const urlType = urlParams.get("type");

  const { data: inspectionsList, isLoading } = useQuery<InspectionRecord[]>({ queryKey: ["/api/inspections"] });
  const { data: yardInventory } = useQuery<YardInventoryItem[]>({ queryKey: ["/api/yard/inventory"] });

  useEffect(() => {
    if (urlParamsHandled || !searchString) return;
    if (urlVisitId || urlTrailer || urlType) {
      setShowNewForm(true);
      setUrlParamsHandled(true);
    }
  }, [searchString, urlParamsHandled, urlVisitId, urlTrailer, urlType]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/inspections", data);
      return res.json();
    },
    onSuccess: (data: InspectionRecord) => {
      invalidateAll();
      setShowNewForm(false);
      startInspection(data);
      toast({ title: "Inspection started", description: `Inspection #${data.id} created as draft.` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/inspections/${id}`, data);
      return res.json();
    },
    onSuccess: () => invalidateAll(),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const raiseExceptionMutation = useMutation({
    mutationFn: async ({ id, severity, description }: { id: number; severity: string; description: string }) => {
      const res = await apiRequest("POST", `/api/inspections/${id}/raise-exception`, { severity, description });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setExceptionDialog(false);
      setActiveInspection(null);
      toast({ title: "Exception raised", description: "An exception has been created from this inspection." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const startInspection = (record: InspectionRecord) => {
    const existingChecklist = record.checklist as ChecklistItem[] | null;
    setActiveInspection({
      id: record.id,
      inspectionType: record.inspectionType,
      trailerNumber: record.trailerNumber || "",
      containerNumber: record.containerNumber || "",
      carrierName: record.carrierName || "",
      currentLocation: record.currentLocation || "",
      equipmentType: record.equipmentType || "",
      shipmentType: record.shipmentType || "",
      weather: record.weather || "",
      sealNumber: record.sealNumber || "",
      visitId: record.visitId,
      visitNumber: "",
      checklist: existingChecklist?.length ? migrateChecklist(existingChecklist) : buildChecklist(),
      remarks: record.remarks || "",
      photoUrls: record.photoUrls || [],
      signatureUrl: record.signatureUrl || "",
      inspectionStatus: record.inspectionStatus || "in_progress",
      expandedGroups: new Set(["Identity & Documentation"]),
    });
    setViewMode("checklist");
    setSelectedItems(new Set());
    setActiveHotspot(null);
  };

  const handleSaveDraft = () => {
    if (!activeInspection?.id) return;
    updateMutation.mutate({
      id: activeInspection.id,
      data: {
        checklist: activeInspection.checklist,
        remarks: activeInspection.remarks,
        photoUrls: activeInspection.photoUrls,
        signatureUrl: activeInspection.signatureUrl || null,
        equipmentType: activeInspection.equipmentType || null,
        shipmentType: activeInspection.shipmentType || null,
        weather: activeInspection.weather || null,
        sealNumber: activeInspection.sealNumber || null,
        inspectionStatus: "in_progress",
        result: "draft",
      },
    });
    toast({ title: "Draft saved", description: "Your inspection progress has been saved." });
  };

  const handleSubmit = () => {
    if (!activeInspection?.id) return;
    const outcome = computeResult(activeInspection.checklist, activeInspection.remarks);
    const finalStatus = outcome === "failed" || outcome === "exception_raised" ? "failed" : "completed";
    updateMutation.mutate({
      id: activeInspection.id,
      data: {
        checklist: activeInspection.checklist,
        remarks: activeInspection.remarks,
        photoUrls: activeInspection.photoUrls,
        signatureUrl: activeInspection.signatureUrl || null,
        equipmentType: activeInspection.equipmentType || null,
        shipmentType: activeInspection.shipmentType || null,
        weather: activeInspection.weather || null,
        sealNumber: activeInspection.sealNumber || null,
        inspectionStatus: finalStatus,
        result: outcome,
        submittedAt: new Date().toISOString(),
      },
    });
    setActiveInspection(null);
    toast({ title: "Inspection submitted", description: `Result: ${resultLabel(outcome)}` });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeInspection) return;
    const file = e.target.files[0];
    if (!file) return;
    const capturedItemId = pendingPhotoItemId;
    setPendingPhotoItemId(null);
    try {
      const urlRes = await apiRequest("GET", "/api/inspections-upload-url");
      const { uploadUrl } = await urlRes.json();
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const objectPath = new URL(uploadUrl).pathname;
      if (capturedItemId) {
        setActiveInspection((prev) =>
          prev ? {
            ...prev,
            checklist: prev.checklist.map((item) =>
              item.id === capturedItemId
                ? { ...item, photoUrls: [...(item.photoUrls || []), objectPath] }
                : item
            ),
          } : prev
        );
      } else {
        setActiveInspection((prev) =>
          prev ? { ...prev, photoUrls: [...prev.photoUrls, objectPath] } : prev
        );
      }
      toast({ title: "Photo uploaded", description: file.name });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload photo. Try again.", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerPhotoForItem = (itemId: string) => {
    setPendingPhotoItemId(itemId);
    fileInputRef.current?.click();
  };

  const triggerGlobalPhoto = () => {
    setPendingPhotoItemId(null);
    fileInputRef.current?.click();
  };

  const setChecklistAnswer = useCallback((itemId: string, answer: "yes" | "no" | "na") => {
    setActiveInspection((prev) => {
      if (!prev) return prev;
      return { ...prev, checklist: prev.checklist.map((item) => item.id === itemId ? { ...item, answer } : item) };
    });
  }, []);

  const setChecklistNotes = useCallback((itemId: string, notes: string) => {
    setActiveInspection((prev) => {
      if (!prev) return prev;
      return { ...prev, checklist: prev.checklist.map((item) => item.id === itemId ? { ...item, notes } : item) };
    });
  }, []);

  const toggleGroup = (group: string) => {
    setActiveInspection((prev) => {
      if (!prev) return prev;
      const newGroups = new Set(prev.expandedGroups);
      if (newGroups.has(group)) newGroups.delete(group);
      else newGroups.add(group);
      return { ...prev, expandedGroups: newGroups };
    });
  };

  const toggleItemSelected = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!activeInspection) return;
    if (selectedItems.size === activeInspection.checklist.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(activeInspection.checklist.map((i) => i.id)));
    }
  };

  const bulkSetAnswer = (answer: "yes" | "no" | "na") => {
    if (!activeInspection || selectedItems.size === 0) return;
    setActiveInspection((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checklist: prev.checklist.map((item) =>
          selectedItems.has(item.id) ? { ...item, answer } : item
        ),
      };
    });
    toast({ title: `Bulk update applied`, description: `${selectedItems.size} items set to ${answer === "yes" ? "Pass" : answer === "no" ? "Fail" : "N/A"}` });
  };

  const handleHotspotClick = (itemId: string, svgPercentX: number, svgPercentY: number) => {
    if (activeHotspot?.itemId === itemId) {
      setActiveHotspot(null);
      return;
    }
    setActiveHotspot({ itemId, x: svgPercentX, y: svgPercentY });
  };

  const groups = activeInspection
    ? Array.from(new Set(activeInspection.checklist.map((i) => i.group)))
    : [];

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const processedInspections = useMemo(() => {
    if (!inspectionsList) return [];
    let filtered = [...inspectionsList];
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((ins) =>
        ins.trailerNumber?.toLowerCase().includes(q) ||
        ins.carrierName?.toLowerCase().includes(q) ||
        ins.inspectorName?.toLowerCase().includes(q) ||
        `INS-${String(ins.id).padStart(5, "0")}`.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") filtered = filtered.filter((ins) => ins.inspectionType === typeFilter);
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [inspectionsList, search, typeFilter]);

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    (inspectionsList || []).forEach((i) => {
      if (i.trailerNumber) set.add(i.trailerNumber);
      if (i.carrierName) set.add(i.carrierName);
      if (i.inspectorName) set.add(i.inspectorName);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [inspectionsList]);

  if (activeInspection) {
    const answered = activeInspection.checklist.filter((i) => i.answer !== null).length;
    const passedCount = activeInspection.checklist.filter((i) => i.answer === "yes").length;
    const failedCount = activeInspection.checklist.filter((i) => i.answer === "no").length;
    const naCount = activeInspection.checklist.filter((i) => i.answer === "na").length;
    const total = activeInspection.checklist.length;
    const failedItems = activeInspection.checklist.filter((i) => i.answer === "no");
    const criticalFails = failedItems.filter((i) => i.critical);
    const computedResult = computeResult(activeInspection.checklist, activeInspection.remarks);
    const currentHotspots = HOTSPOT_VIEWS[activeTruckView];
    const statusSteps = INSPECTION_STATUSES;

    return (
      <div className="p-4 space-y-3 max-w-4xl mx-auto" onClick={() => setActiveHotspot(null)}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold" data-testid="text-inspection-title">Inspection</h1>
            <p className="text-sm text-muted-foreground">
              {typeLabel(activeInspection.inspectionType)} — {activeInspection.trailerNumber || "No Trailer"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={updateMutation.isPending} data-testid="button-save-draft">
              <Save className="h-3.5 w-3.5 mr-1" /> Save Draft
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveInspection(null)} data-testid="button-back">
              <X className="h-4 w-4 mr-1" /> Close
            </Button>
          </div>
        </div>

        {/* Status Stepper */}
        <div className="flex items-center gap-1" data-testid="status-stepper">
          {statusSteps.map((step, idx) => {
            const currentIdx = statusSteps.findIndex((s) => s.value === activeInspection.inspectionStatus);
            const isActive = step.value === activeInspection.inspectionStatus;
            const isDone = idx < currentIdx;
            return (
              <div key={step.value} className="flex items-center gap-1 flex-1 min-w-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-sm" :
                  isDone ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <span className="w-3 h-3 rounded-full border-2 border-current shrink-0" />}
                  <span className="truncate">{step.label}</span>
                </div>
                {idx < statusSteps.length - 1 && <div className={`h-px flex-1 ${isDone ? "bg-emerald-300" : "bg-muted"}`} />}
              </div>
            );
          })}
        </div>

        {/* Inspection Header Card */}
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">Inspection Ref No.</p>
                <p className="font-mono font-bold" data-testid="text-insp-ref">INS-{String(activeInspection.id || 0).padStart(5, "0")}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Inspection Type</p>
                <p className="font-medium" data-testid="text-insp-type">{typeLabel(activeInspection.inspectionType)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Equipment / Trailer ID</p>
                <p className="font-mono font-medium" data-testid="text-insp-trailer">{activeInspection.trailerNumber || activeInspection.containerNumber || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Carrier / SCAC</p>
                <p data-testid="text-insp-carrier">{activeInspection.carrierName || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Equipment Type</p>
                <Select value={activeInspection.equipmentType || ""} onValueChange={(v) => setActiveInspection((prev) => prev ? { ...prev, equipmentType: v } : prev)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-equipment-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dry_van">Dry Van</SelectItem>
                    <SelectItem value="reefer">Reefer</SelectItem>
                    <SelectItem value="flatbed">Flatbed</SelectItem>
                    <SelectItem value="tanker">Tanker</SelectItem>
                    <SelectItem value="container_20">Container 20'</SelectItem>
                    <SelectItem value="container_40">Container 40'</SelectItem>
                    <SelectItem value="container_45">Container 45'</SelectItem>
                    <SelectItem value="chassis">Chassis</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Shipment Type</p>
                <Select value={activeInspection.shipmentType || ""} onValueChange={(v) => setActiveInspection((prev) => prev ? { ...prev, shipmentType: v } : prev)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-shipment-type"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="empty">Empty</SelectItem>
                    <SelectItem value="loaded">Loaded</SelectItem>
                    <SelectItem value="live_load">Live Load</SelectItem>
                    <SelectItem value="live_unload">Live Unload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Weather</p>
                <Select value={activeInspection.weather || ""} onValueChange={(v) => setActiveInspection((prev) => prev ? { ...prev, weather: v } : prev)}>
                  <SelectTrigger className="h-7 text-xs mt-0.5" data-testid="select-weather"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clear">Clear</SelectItem>
                    <SelectItem value="cloudy">Cloudy</SelectItem>
                    <SelectItem value="rain">Rain</SelectItem>
                    <SelectItem value="snow">Snow</SelectItem>
                    <SelectItem value="fog">Fog</SelectItem>
                    <SelectItem value="windy">Windy</SelectItem>
                    <SelectItem value="extreme_heat">Extreme Heat</SelectItem>
                    <SelectItem value="extreme_cold">Extreme Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Inspector</p>
                <p data-testid="text-insp-inspector">{user?.firstName || "Unknown"} {user?.lastName || ""}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${computedResult === "failed" ? "bg-red-500" : computedResult === "passed" ? "bg-emerald-500" : "bg-blue-500"}`}
                    style={{ width: `${total > 0 ? (answered / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{answered}/{total} checked</span>
              <Badge className={`text-xs ${resultColor(computedResult)}`} data-testid="text-insp-result">{resultLabel(computedResult)}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit" data-testid="view-mode-toggle">
          <button
            onClick={() => setViewMode("checklist")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "checklist" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="button-view-checklist"
          >
            <ClipboardCheck className="h-3.5 w-3.5" /> Checklist
          </button>
          <button
            onClick={() => setViewMode("visual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === "visual" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="button-view-visual"
          >
            <Truck className="h-3.5 w-3.5" /> Visual Map
          </button>
        </div>

        {/* ===== CHECKLIST VIEW ===== */}
        {viewMode === "checklist" && (
          <div className="space-y-2">
            {/* Bulk Action Bar */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-2.5 flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    checked={selectedItems.size === total && total > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedItems.size > 0 ? `${selectedItems.size} selected` : "Select all"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300"
                    onClick={() => bulkSetAnswer("yes")}
                    disabled={selectedItems.size === 0}
                    data-testid="button-bulk-yes"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Bulk Pass
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs bg-red-50 border-red-200 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                    onClick={() => bulkSetAnswer("no")}
                    disabled={selectedItems.size === 0}
                    data-testid="button-bulk-no"
                  >
                    <XCircle className="h-3 w-3 mr-1" /> Bulk Fail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => bulkSetAnswer("na")}
                    disabled={selectedItems.size === 0}
                    data-testid="button-bulk-na"
                  >
                    <MinusCircle className="h-3 w-3 mr-1" /> Bulk N/A
                  </Button>
                  {selectedItems.size > 0 && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedItems(new Set())} data-testid="button-bulk-clear">
                      <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Checklist Groups */}
            {groups.map((group) => {
              const items = activeInspection.checklist.filter((i) => i.group === group);
              const isOpen = activeInspection.expandedGroups.has(group);
              const groupAnswered = items.filter((i) => i.answer !== null).length;
              const groupFailed = items.filter((i) => i.answer === "no").length;
              return (
                <Collapsible key={group} open={isOpen} onOpenChange={() => toggleGroup(group)}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="p-3 cursor-pointer hover:bg-muted/30 transition-colors" data-testid={`section-${group.toLowerCase().replace(/\s+/g, "-")}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <CardTitle className="text-sm font-semibold">{group}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            {groupFailed > 0 && <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200">{groupFailed} failed</Badge>}
                            <span className="text-xs text-muted-foreground">{groupAnswered}/{items.length}</span>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="px-3 pb-3 pt-0 space-y-1">
                        {items.map((item) => (
                          <div key={item.id} className="space-y-1.5" data-testid={`checklist-item-${item.id}`}>
                            <div className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                              item.answer === "no" ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10" :
                              item.answer === "yes" ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-900/10" :
                              item.answer === "na" ? "border-muted bg-muted/20" : "border-transparent"
                            }`}>
                              <Checkbox
                                checked={selectedItems.has(item.id)}
                                onCheckedChange={() => toggleItemSelected(item.id)}
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`checkbox-item-${item.id}`}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-tight">
                                  {item.label}
                                  {item.critical && <span className="text-red-500 ml-1 text-xs">*</span>}
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant={item.answer === "yes" ? "default" : "outline"}
                                  size="sm"
                                  className={`h-8 w-14 text-xs ${item.answer === "yes" ? "bg-emerald-600 hover:bg-emerald-700 text-white border-0" : ""}`}
                                  onClick={() => setChecklistAnswer(item.id, "yes")}
                                  data-testid={`button-yes-${item.id}`}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-0.5" /> Yes
                                </Button>
                                <Button
                                  variant={item.answer === "no" ? "destructive" : "outline"}
                                  size="sm"
                                  className="h-8 w-14 text-xs"
                                  onClick={() => setChecklistAnswer(item.id, "no")}
                                  data-testid={`button-no-${item.id}`}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-0.5" /> No
                                </Button>
                                <Button
                                  variant={item.answer === "na" ? "secondary" : "outline"}
                                  size="sm"
                                  className="h-8 w-12 text-xs"
                                  onClick={() => setChecklistAnswer(item.id, "na")}
                                  data-testid={`button-na-${item.id}`}
                                >
                                  <MinusCircle className="h-3.5 w-3.5 mr-0.5" /> N/A
                                </Button>
                              </div>
                            </div>

                            {item.answer === "no" && (
                              <div className="ml-6 pl-3 border-l-2 border-red-300 dark:border-red-700 space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  {item.critical ? "Critical item failed — notes required" : "Item failed — add notes"}
                                </div>
                                <Textarea
                                  placeholder="Describe the issue..."
                                  value={item.notes}
                                  onChange={(e) => setChecklistNotes(item.id, e.target.value)}
                                  className="h-14 text-xs"
                                  data-testid={`input-notes-${item.id}`}
                                />
                                {/* Per-item photos */}
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {(item.photoUrls || []).map((url, idx) => (
                                    <div key={idx} className="relative h-12 w-12 rounded border overflow-hidden bg-muted flex items-center justify-center group">
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                      <button
                                        className="absolute top-0 right-0 p-0.5 bg-destructive text-destructive-foreground rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => setActiveInspection((prev) => prev ? {
                                          ...prev,
                                          checklist: prev.checklist.map((ci) =>
                                            ci.id === item.id ? { ...ci, photoUrls: ci.photoUrls.filter((_, i2) => i2 !== idx) } : ci
                                          ),
                                        } : prev)}
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                      <span className="absolute bottom-0 inset-x-0 text-[8px] text-center bg-black/60 text-white py-0.5 truncate px-0.5">P{idx + 1}</span>
                                    </div>
                                  ))}
                                  <button
                                    className="h-12 w-12 rounded border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-0.5 transition-colors"
                                    onClick={() => triggerPhotoForItem(item.id)}
                                    data-testid={`button-photo-${item.id}`}
                                  >
                                    <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[8px] text-muted-foreground">Photo</span>
                                  </button>
                                  {item.critical && activeInspection.id && activeInspection.visitId && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
                                      onClick={() => { setExceptionDescription(item.notes || `Failed: ${item.label}`); setExceptionDialog(true); }}
                                      data-testid={`button-raise-exception-${item.id}`}
                                    >
                                      <AlertTriangle className="h-3 w-3 mr-1" /> Raise Exception
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}

        {/* ===== VISUAL MAP VIEW ===== */}
        {viewMode === "visual" && (
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Visual Inspection Diagram
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  Tap a hotspot → mark Pass / Fail / N/A
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              {/* View selector */}
              <div className="flex flex-wrap gap-1.5" data-testid="truck-view-tabs">
                {(["left", "right", "front", "rear", "top", "interior"] as TruckView[]).map((v) => {
                  const cfg = VIEW_CONFIG[v];
                  const spots = HOTSPOT_VIEWS[v];
                  const failed = spots.filter(h => {
                    const it = activeInspection.checklist.find(i => i.id === h.itemId);
                    return it?.answer === "no";
                  }).length;
                  const passed = spots.filter(h => {
                    const it = activeInspection.checklist.find(i => i.id === h.itemId);
                    return it?.answer === "yes";
                  }).length;
                  return (
                    <button
                      key={v}
                      onClick={(e) => { e.stopPropagation(); setActiveTruckView(v); setActiveHotspot(null); }}
                      className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        activeTruckView === v
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted border-transparent"
                      }`}
                      data-testid={`button-truck-view-${v}`}
                    >
                      {cfg.label}
                      {failed > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold leading-none">
                          {failed}
                        </span>
                      )}
                      {failed === 0 && passed > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center font-bold leading-none">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground px-1">
                {[
                  { color: "#22c55e", label: "Pass" },
                  { color: "#ef4444", label: "Fail" },
                  { color: "#9ca3af", label: "N/A" },
                  { color: "#fff", stroke: "#94a3b8", label: "Unchecked" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <svg width="14" height="14">
                      <circle cx="7" cy="7" r="6" fill={l.color} stroke={l.stroke || l.color} strokeWidth="1.2" />
                    </svg>
                    <span>{l.label}</span>
                  </div>
                ))}
                <div className="ml-auto text-[10px] text-muted-foreground/60 italic">{VIEW_CONFIG[activeTruckView].label} view</div>
              </div>

              {/* SVG Diagram */}
              <div
                ref={svgContainerRef}
                className="relative w-full border-2 border-muted rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950 shadow-inner"
                style={{ aspectRatio: VIEW_CONFIG[activeTruckView].ratio }}
                onClick={(e) => e.stopPropagation()}
                data-testid="truck-diagram"
              >
                <svg
                  viewBox={VIEW_CONFIG[activeTruckView].vb}
                  className="w-full h-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <TrailerSVGPaths view={activeTruckView} isDark={isDarkMode} />

                  {currentHotspots.map((hotspot, idx) => {
                    const item = activeInspection.checklist.find((i) => i.id === hotspot.itemId);
                    const answer = item?.answer ?? null;
                    const { fill, stroke } = hotspotColor(answer);
                    const vbParts = VIEW_CONFIG[activeTruckView].vb.split(" ").map(Number);
                    const vbW = vbParts[2]; const vbH = vbParts[3];
                    const cx = (hotspot.x / 100) * vbW;
                    const cy = (hotspot.y / 100) * vbH;
                    const isActive = activeHotspot?.itemId === hotspot.itemId && activeHotspot?.x === hotspot.x && activeHotspot?.y === hotspot.y;
                    const r = 11;

                    return (
                      <g
                        key={`${hotspot.itemId}-${idx}`}
                        onClick={(e) => { e.stopPropagation(); handleHotspotClick(hotspot.itemId, hotspot.x, hotspot.y); }}
                        style={{ cursor: "pointer" }}
                        data-testid={`hotspot-${hotspot.itemId}-${idx}`}
                      >
                        {/* Pulse ring for active */}
                        {isActive && <circle cx={cx} cy={cy} r={r + 7} fill="#eab308" opacity="0.25" />}
                        {/* Fail glow */}
                        {answer === "no" && <circle cx={cx} cy={cy} r={r + 4} fill="#ef4444" opacity="0.18" />}
                        {/* Shadow */}
                        <circle cx={cx} cy={cy} r={r + 1} fill="rgba(0,0,0,0.15)" />
                        {/* Main hotspot */}
                        <circle cx={cx} cy={cy} r={r} fill={fill} stroke={isActive ? "#eab308" : stroke} strokeWidth={isActive ? 2.5 : 1.8} />
                        {answer === "yes" && (
                          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#fff" fontWeight="bold">✓</text>
                        )}
                        {answer === "no" && (
                          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#fff" fontWeight="bold">✕</text>
                        )}
                        {answer === "na" && (
                          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#fff" fontWeight="bold">N/A</text>
                        )}
                        {answer === null && (
                          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#94a3b8" fontWeight="bold">?</text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Active Hotspot Panel */}
                {activeHotspot && (() => {
                  const item = activeInspection.checklist.find((i) => i.id === activeHotspot.itemId);
                  if (!item) return null;
                  const leftPct = activeHotspot.x;
                  const topPct = activeHotspot.y;
                  const alignRight = leftPct > 55;
                  const alignBottom = topPct > 60;
                  const hotspotLabel = currentHotspots.find(h => h.itemId === activeHotspot.itemId && h.x === activeHotspot.x)?.label || item.label;
                  return (
                    <div
                      className="absolute z-20 bg-popover border-2 rounded-xl shadow-2xl p-3 w-60"
                      style={{
                        left: alignRight ? "auto" : `calc(${leftPct}% + 14px)`,
                        right: alignRight ? `calc(${100 - leftPct}% + 14px)` : "auto",
                        top: alignBottom ? "auto" : `calc(${topPct}% + 14px)`,
                        bottom: alignBottom ? `calc(${100 - topPct}% + 14px)` : "auto",
                        borderColor: item.answer === "no" ? "#ef4444" : item.answer === "yes" ? "#22c55e" : item.answer === "na" ? "#9ca3af" : undefined,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-[12px] font-semibold leading-tight pr-2">
                          {hotspotLabel}
                          {item.critical && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        <button onClick={() => setActiveHotspot(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{item.label}</p>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        <button
                          onClick={() => { setChecklistAnswer(item.id, "yes"); setActiveHotspot(null); }}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all border ${item.answer === "yes" ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800"}`}
                          data-testid={`hotspot-btn-yes-${item.id}`}
                        >
                          ✓ Pass
                        </button>
                        <button
                          onClick={() => { setChecklistAnswer(item.id, "no"); }}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all border ${item.answer === "no" ? "bg-red-600 text-white border-red-600 shadow-sm" : "bg-red-50 text-red-700 hover:bg-red-100 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"}`}
                          data-testid={`hotspot-btn-no-${item.id}`}
                        >
                          ✕ Fail
                        </button>
                        <button
                          onClick={() => { setChecklistAnswer(item.id, "na"); setActiveHotspot(null); }}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all border ${item.answer === "na" ? "bg-slate-600 text-white border-slate-600 shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"}`}
                          data-testid={`hotspot-btn-na-${item.id}`}
                        >
                          – N/A
                        </button>
                      </div>

                      {/* Photo evidence when failed */}
                      {item.answer === "no" && (
                        <div className="border-t pt-2 space-y-1.5">
                          <p className="text-[10px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Evidence Photos
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(item.photoUrls || []).map((url, pi) => (
                              <div key={pi} className="relative h-10 w-10 rounded border overflow-hidden bg-muted flex items-center justify-center group">
                                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <button
                                  className="absolute inset-0 bg-destructive/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                  onClick={() => setActiveInspection((prev) => prev ? {
                                    ...prev,
                                    checklist: prev.checklist.map((ci) =>
                                      ci.id === item.id ? { ...ci, photoUrls: ci.photoUrls.filter((_, i2) => i2 !== pi) } : ci
                                    ),
                                  } : prev)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                                <span className="absolute bottom-0 inset-x-0 text-[7px] text-center bg-black/60 text-white py-0.5">P{pi + 1}</span>
                              </div>
                            ))}
                            <button
                              className="h-10 w-10 rounded border-2 border-dashed border-red-300 dark:border-red-700 hover:border-red-500 flex flex-col items-center justify-center gap-0.5 transition-colors bg-red-50 dark:bg-red-900/10"
                              onClick={() => { triggerPhotoForItem(item.id); }}
                              data-testid={`hotspot-photo-${item.id}`}
                            >
                              <Camera className="h-3 w-3 text-red-500" />
                              <span className="text-[7px] text-red-500 font-medium">Photo</span>
                            </button>
                          </div>
                          {item.notes && (
                            <p className="text-[10px] text-muted-foreground italic mt-1 truncate">{item.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Hotspot status list */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest px-0.5">
                  Checkpoints — {VIEW_CONFIG[activeTruckView].label}
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {currentHotspots.map((hotspot, idx) => {
                    const item = activeInspection.checklist.find((i) => i.id === hotspot.itemId);
                    const answer = item?.answer ?? null;
                    const { fill } = hotspotColor(answer);
                    const isActive = activeHotspot?.itemId === hotspot.itemId && activeHotspot?.x === hotspot.x;
                    return (
                      <button
                        key={`${hotspot.itemId}-list-${idx}`}
                        onClick={(e) => { e.stopPropagation(); handleHotspotClick(hotspot.itemId, hotspot.x, hotspot.y); }}
                        className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-all text-left border ${
                          isActive ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700" :
                          answer === "no" ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800" :
                          answer === "yes" ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" :
                          "bg-muted/30 border-transparent hover:bg-muted/50"
                        }`}
                        data-testid={`hotspot-list-${hotspot.itemId}-${idx}`}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0 border-[1.5px]" style={{ backgroundColor: fill, borderColor: fill === "#fff" ? "#94a3b8" : fill }} />
                        <span className="truncate text-[11px] font-medium">{hotspot.label}</span>
                        {item?.answer === "no" && (item.photoUrls?.length ?? 0) > 0 && (
                          <Camera className="h-3 w-3 text-red-400 shrink-0 ml-auto" />
                        )}
                        {item?.critical && <span className="text-red-400 text-[9px] shrink-0">*</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Evidence & Notes */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-semibold">Evidence & Notes</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">General Photos</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {activeInspection.photoUrls.length === 0 && (
                  <div className="h-14 w-full rounded-md border-2 border-dashed border-muted flex flex-col items-center justify-center gap-1 bg-muted/20">
                    <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground/40">No general photos</span>
                  </div>
                )}
                {activeInspection.photoUrls.map((url, i) => (
                  <div key={i} className="relative h-14 w-14 rounded-md border overflow-hidden bg-muted flex items-center justify-center group">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <button
                      className="absolute top-0 right-0 p-0.5 bg-destructive text-destructive-foreground rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setActiveInspection((prev) => prev ? { ...prev, photoUrls: prev.photoUrls.filter((_, idx) => idx !== i) } : prev)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/60 text-white py-0.5 truncate px-1">Photo {i + 1}</span>
                  </div>
                ))}
                <button
                  className="h-14 w-14 rounded-md border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 flex flex-col items-center justify-center gap-0.5 transition-colors"
                  onClick={triggerGlobalPhoto}
                  data-testid="button-add-photo"
                >
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">Add</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} data-testid="input-photo-file" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">General Remarks</label>
              <Textarea
                className="mt-1 text-sm"
                placeholder="Overall observations, notes for records..."
                value={activeInspection.remarks}
                onChange={(e) => setActiveInspection((prev) => prev ? { ...prev, remarks: e.target.value } : prev)}
                data-testid="input-remarks"
              />
            </div>
          </CardContent>
        </Card>

        {/* Signature Section */}
        <Card>
          <CardHeader className="p-3 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Pen className="h-4 w-4" />
                Inspector Signature
              </CardTitle>
              {activeInspection.signatureUrl && (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Signed
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <SignaturePad
              value={activeInspection.signatureUrl}
              onChange={(dataUrl) => setActiveInspection((prev) => prev ? { ...prev, signatureUrl: dataUrl } : prev)}
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">
              By signing, you confirm this inspection was performed accurately.
              {activeInspection.signatureUrl && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                  Signed at {new Date().toLocaleTimeString()}
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <div className="grid grid-cols-4 gap-2" data-testid="inspection-summary">
          {[
            { label: "Total", value: total, color: "text-foreground" },
            { label: "Passed", value: passedCount, color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Failed", value: failedCount, color: "text-red-600 dark:text-red-400" },
            { label: "N/A", value: naCount, color: "text-slate-500" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${stat.color}`} data-testid={`summary-${stat.label.toLowerCase()}`}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Failed Items Summary */}
        {failedItems.length > 0 && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50/10">
            <CardHeader className="p-3 pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                {failedItems.length} Failed Items
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 pt-0 space-y-1.5">
              {failedItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-xs p-2 rounded bg-white dark:bg-black/20 border border-red-100 dark:border-red-900/50">
                  <div className="flex-1">
                    <p className="font-medium text-red-800 dark:text-red-300">
                      {item.label}
                      {item.critical && <Badge variant="destructive" className="ml-2 h-4 px-1 text-[9px] uppercase">Critical</Badge>}
                    </p>
                    <p className="text-muted-foreground mt-0.5 italic">{item.notes || "No notes provided"}</p>
                    {(item.photoUrls?.length ?? 0) > 0 && (
                      <p className="text-muted-foreground">{item.photoUrls!.length} photo(s) attached</p>
                    )}
                  </div>
                  <Button
                    variant="ghost" size="sm" className="h-6 px-2 text-[10px]"
                    onClick={() => {
                      setViewMode("checklist");
                      const newGroups = new Set(activeInspection.expandedGroups);
                      newGroups.add(item.group);
                      setActiveInspection((prev) => prev ? { ...prev, expandedGroups: newGroups } : prev);
                      setTimeout(() => {
                        document.querySelector(`[data-testid="checklist-item-${item.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 100);
                    }}
                  >
                    View
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Final Outcome & Actions */}
        <Card className={`border-2 ${computedResult === "passed" ? "border-emerald-200 dark:border-emerald-800" : computedResult === "failed" ? "border-red-200 dark:border-red-800" : "border-muted"}`}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">Inspection Outcome</p>
                  <p className="text-xs text-muted-foreground">{answered} of {total} items checked • {failedItems.length} failed ({criticalFails.length} critical)</p>
                </div>
              </div>
              <Badge className={`text-sm px-3 py-1 ${resultColor(computedResult)}`} data-testid="badge-final-result">{resultLabel(computedResult)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={updateMutation.isPending} data-testid="button-save-draft-bottom">
                <Save className="h-3.5 w-3.5 mr-1" /> Save Draft
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={updateMutation.isPending || answered === 0} data-testid="button-submit-inspection">
                <Send className="h-3.5 w-3.5 mr-1" /> Submit Inspection
              </Button>
              {computedResult === "failed" && activeInspection.visitId && activeInspection.id && (
                <Button variant="destructive" size="sm"
                  onClick={() => { setExceptionDescription(criticalFails.map((i) => i.label).join("; ") || "Inspection failed"); setExceptionDialog(true); }}
                  data-testid="button-raise-exception-final"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Raise Exception
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Exception Dialog */}
        <Dialog open={exceptionDialog} onOpenChange={setExceptionDialog}>
          <DialogContent data-testid="dialog-raise-exception">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" />Raise Exception</DialogTitle>
              <DialogDescription>Create an exception from this inspection. This will flag the trailer for follow-up.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium">Severity</label>
                <Select value={exceptionSeverity} onValueChange={setExceptionSeverity}>
                  <SelectTrigger className="mt-1" data-testid="select-exception-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Description</label>
                <Textarea className="mt-1" value={exceptionDescription} onChange={(e) => setExceptionDescription(e.target.value)} data-testid="input-exception-description" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExceptionDialog(false)} data-testid="button-exception-cancel">Cancel</Button>
              <Button variant="destructive"
                onClick={() => { if (activeInspection?.id) raiseExceptionMutation.mutate({ id: activeInspection.id, severity: exceptionSeverity, description: exceptionDescription }); }}
                disabled={raiseExceptionMutation.isPending}
                data-testid="button-exception-confirm"
              >
                {raiseExceptionMutation.isPending ? "Creating..." : "Raise Exception"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // === LIST VIEW ===
  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Inspections"
        subtitle="Asset inspection checklists with photo evidence and visual damage mapping"
        icon={<ClipboardCheck className="h-5 w-5" />}
        actions={
          <Button onClick={() => setShowNewForm(true)} data-testid="button-new-inspection">
            <Plus className="h-4 w-4 mr-1.5" /> New Inspection
          </Button>
        }
      />

      <FilterToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by trailer, carrier, or ID..."
        suggestions={suggestions}
        filters={
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-type"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {INSPECTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : processedInspections.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-5 w-5" />}
          heading="No inspections found"
          description="No inspection records match your current filters. Adjust the date range, status, or type to find what you're looking for."
        />
      ) : (
        <div className="rounded-lg border shadow-sm bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[120px]">Ref No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Trailer / ID</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedInspections.map((insp) => (
                <TableRow key={insp.id} className="cursor-pointer hover:bg-muted/30"
                  onClick={() => { if (insp.result === "draft") startInspection(insp); else setSelectedInspection(insp); }}
                  data-testid={`row-inspection-${insp.id}`}
                >
                  <TableCell className="font-mono text-xs font-bold">INS-{String(insp.id).padStart(5, "0")}</TableCell>
                  <TableCell className="text-xs font-medium">{typeLabel(insp.inspectionType)}</TableCell>
                  <TableCell className="font-mono font-medium">{insp.trailerNumber || insp.containerNumber || "—"}</TableCell>
                  <TableCell className="text-sm">{insp.carrierName || "—"}</TableCell>
                  <TableCell className="text-xs">{insp.inspectorName || "—"}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] px-1.5 py-0.5 ${
                      insp.inspectionStatus === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                      insp.inspectionStatus === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" :
                      insp.inspectionStatus === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`} data-testid={`status-flow-${insp.id}`}>
                      {INSPECTION_STATUSES.find((s) => s.value === (insp.inspectionStatus || "pending"))?.label || "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={insp.result} colorFn={resultColor} label={resultLabel(insp.result)} size="sm" data-testid={`status-insp-${insp.id}`} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(insp.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                      onClick={(e) => { e.stopPropagation(); if (insp.result === "draft") startInspection(insp); else setSelectedInspection(insp); }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </div>
      )}

      <NewInspectionDialog
        open={showNewForm}
        onOpenChange={setShowNewForm}
        yardInventory={yardInventory || []}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
        initialVisitId={urlVisitId}
        initialTrailer={urlTrailer}
        initialCarrier={urlCarrier}
        initialType={urlType}
      />

      <Dialog open={!!selectedInspection} onOpenChange={() => setSelectedInspection(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-view-inspection">
          {selectedInspection && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Inspection #{selectedInspection.id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><p className="text-[11px] text-muted-foreground">Ref No.</p><p className="font-mono font-bold">INS-{String(selectedInspection.id).padStart(5, "0")}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Type</p><p>{typeLabel(selectedInspection.inspectionType)}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Trailer / Container</p><p className="font-mono">{selectedInspection.trailerNumber || selectedInspection.containerNumber || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Carrier</p><p>{selectedInspection.carrierName || "—"}</p></div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Result</p>
                    <Badge className={`text-xs ${resultColor(selectedInspection.result)}`}>{resultLabel(selectedInspection.result)}</Badge>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Status</p>
                    <Badge className="text-xs">{INSPECTION_STATUSES.find((s) => s.value === (selectedInspection.inspectionStatus || "pending"))?.label || "Pending"}</Badge>
                  </div>
                  <div><p className="text-[11px] text-muted-foreground">Inspector</p><p>{selectedInspection.inspectorName || "—"}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">Submitted</p><p>{selectedInspection.submittedAt ? new Date(selectedInspection.submittedAt).toLocaleString() : "—"}</p></div>
                </div>
                {selectedInspection.checklist && Array.isArray(selectedInspection.checklist) && (() => {
                  const cl = selectedInspection.checklist as ChecklistItem[];
                  const passed = cl.filter((i) => i.answer === "yes").length;
                  const failed = cl.filter((i) => i.answer === "no").length;
                  const na = cl.filter((i) => i.answer === "na").length;
                  return (
                    <div>
                      <div className="flex gap-3 mb-2">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{passed} passed</span>
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">{failed} failed</span>
                        <span className="text-xs text-slate-500 font-medium">{na} N/A</span>
                      </div>
                      <div className="space-y-0.5 text-sm max-h-40 overflow-y-auto">
                        {cl.filter((i) => i.answer !== null).map((item) => (
                          <div key={item.id} className="flex items-center gap-2">
                            {item.answer === "yes" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                            {item.answer === "no" && <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                            {item.answer === "na" && <MinusCircle className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                            <span className={`text-xs ${item.answer === "no" ? "text-red-700 dark:text-red-400" : ""}`}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {selectedInspection.signatureUrl && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Inspector Signature</p>
                    <div className="border rounded p-1 bg-white dark:bg-slate-900">
                      <img src={selectedInspection.signatureUrl} alt="Inspector signature" className="max-h-16 w-auto" />
                    </div>
                  </div>
                )}
                {selectedInspection.remarks && (
                  <div><p className="text-xs font-medium text-muted-foreground mb-1">Remarks</p><p className="text-sm">{selectedInspection.remarks}</p></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewInspectionDialog({
  open, onOpenChange, yardInventory, onSubmit, isPending,
  initialVisitId, initialTrailer, initialCarrier, initialType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yardInventory: YardInventoryItem[];
  onSubmit: (data: any) => void;
  isPending: boolean;
  initialVisitId?: string | null;
  initialTrailer?: string | null;
  initialCarrier?: string | null;
  initialType?: string | null;
}) {
  const [inspectionType, setInspectionType] = useState(initialType || "gate_inbound");
  const [selectedVisitId, setSelectedVisitId] = useState(initialVisitId || "");
  const [trailerNumber, setTrailerNumber] = useState(initialTrailer || "");
  const [containerNumber, setContainerNumber] = useState("");

  const selectedVisit = yardInventory.find((v) => String(v.id) === selectedVisitId);

  const handleCreate = () => {
    const location = selectedVisit
      ? selectedVisit.currentDockDoor || (selectedVisit.zoneName ? `${selectedVisit.zoneName} - ${selectedVisit.currentSlotNumber}` : "") || selectedVisit.locationStatus
      : "";
    onSubmit({
      visitId: selectedVisitId ? Number(selectedVisitId) : null,
      inspectionType,
      trailerNumber: selectedVisit?.trailerNumber || trailerNumber || null,
      containerNumber: containerNumber || null,
      carrierName: selectedVisit?.carrierName || null,
      currentLocation: location || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-new-inspection">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />New Inspection</DialogTitle>
          <DialogDescription>Select an asset from the yard or enter details manually.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Inspection Type</label>
            <Select value={inspectionType} onValueChange={setInspectionType}>
              <SelectTrigger className="mt-1" data-testid="select-inspection-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INSPECTION_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Link to Yard Asset (optional)</label>
            <Select value={selectedVisitId} onValueChange={(v) => {
              setSelectedVisitId(v);
              const visit = yardInventory.find((vi) => String(vi.id) === v);
              if (visit?.trailerNumber) setTrailerNumber(visit.trailerNumber);
            }}>
              <SelectTrigger className="mt-1" data-testid="select-visit"><SelectValue placeholder="Select a trailer/visit..." /></SelectTrigger>
              <SelectContent>
                {yardInventory.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.trailerNumber || v.visitNumber} — {v.carrierName || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!selectedVisitId && (
            <>
              <div>
                <label className="text-xs font-medium">Trailer Number</label>
                <Input className="mt-1" placeholder="e.g., SWFT-53201" value={trailerNumber} onChange={(e) => setTrailerNumber(e.target.value)} data-testid="input-trailer-number" />
              </div>
              <div>
                <label className="text-xs font-medium">Container Number (if applicable)</label>
                <Input className="mt-1" placeholder="e.g., MSCU-1234567" value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} data-testid="input-container-number" />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isPending || (!selectedVisitId && !trailerNumber && !containerNumber)} data-testid="button-create-inspection">
            {isPending ? "Creating..." : "Start Inspection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
