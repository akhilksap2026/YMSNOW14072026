import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Factory, CheckCircle2, AlertTriangle,
  Truck, DoorOpen, MapPin, BarChart3, Shield, Users, Settings2,
  ArrowRight, Clock, Package, ClipboardCheck, X, LogIn, LogOut,
  ArrowRightLeft, CalendarDays, UserCheck, Star, Maximize2, Minimize2,
  Download, Mail, MessageSquare, Bell, Lightbulb, Zap, Eye, Brain,
  Layers, Activity, ToggleRight, GitBranch, CheckSquare
} from 'lucide-react';
import { useLocation } from 'wouter';

const SS = (name: string) => `/screenshots/${name}`;

// ─── Slide Definitions ────────────────────────────────────────────────────────

const SLIDES = [
  'hero',
  'lifecycle',
  'appointments',
  'gate-checkin',
  'guard-mode',
  'yard-map',
  'yard-inventory',
  'yard-moves',
  'dock-mgmt',
  'inspections',       // Dedicated
  'holds-exceptions',
  'reports',
  'roles-overview',
  'roles-detail',
  'swimlane',
  'yard-setup',
  'before-after',
  'ai-overview',
  'ai-features',
  'ai-governance',
  'ai-workflow',
  'outro',
] as const;

type SlideId = typeof SLIDES[number];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TruckLifecycleVideo() {
  const [idx, setIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [, navigate] = useLocation();

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIdx(i => Math.min(SLIDES.length - 1, i + 1)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev();
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, navigate]);

  const slide = SLIDES[idx];
  const progress = ((idx) / (SLIDES.length - 1)) * 100;

  return (
    <>
    <div
      id="yms-presentation-interactive"
      className={`${fullscreen ? 'fixed inset-0' : 'fixed inset-0'} bg-[#07111f] text-white overflow-hidden z-50`}
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-5 h-11 bg-[#07111f]/80 backdrop-blur-md border-b border-white/5">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#2563EB] rounded-md flex items-center justify-center">
            <Factory className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">YMSNOW</span>
          <span className="text-[10px] text-white/25 uppercase tracking-widest ml-1 hidden sm:block">Yard Management System</span>
        </div>

        {/* Slide counter */}
        <div className="text-[11px] text-white/30 font-mono">
          {String(idx + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button onClick={() => setFullscreen(f => !f)} className="w-7 h-7 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] text-white/40 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
            title="Save as PDF"
          >
            <Download className="w-3 h-3" /> PDF
          </button>
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] text-white/40 hover:text-white hover:bg-white/10 transition-colors border border-white/10">
            <X className="w-3 h-3" /> Exit
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute top-11 left-0 right-0 h-[2px] bg-white/5 z-50">
        <motion.div
          className="h-full bg-gradient-to-r from-[#2563EB] to-[#10B981]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-1.5 items-center">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className="transition-all duration-200"
            style={{
              width: i === idx ? 20 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === idx ? '#2563EB' : i < idx ? 'rgba(37,99,235,0.35)' : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>

      {/* Prev/Next */}
      <button
        onClick={prev}
        disabled={idx === 0}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>
      <button
        onClick={next}
        disabled={idx === SLIDES.length - 1}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>

      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03] z-0 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Content */}
      <div className="absolute inset-0 top-[52px] bottom-0">
        <AnimatePresence mode="wait">
          <SlideRenderer key={slide} id={slide} onNext={next} />
        </AnimatePresence>
      </div>
    </div>

    {/* Print-only: all slides in sequence */}
    <PrintView />
    </>
  );
}

// ─── Slide Renderer ───────────────────────────────────────────────────────────

function renderSlide(id: SlideId, onNext: () => void): React.ReactNode {
  switch (id) {
    case 'hero':          return <HeroSlide />;
    case 'lifecycle':     return <LifecycleSlide />;
    case 'appointments':  return <ScreenSlide screenshot={SS('appointments.png')} tag="APPOINTMENTS MODULE" title="Appointment Scheduling" caption="Carriers self-book delivery windows from available timeslots" insight="Manage inbound/outbound appointments with dock-level time allocation" accent="#2563EB" />;
    case 'gate-checkin':  return <ScreenSlide screenshot={SS('gate-checkin-visual.png')} tag="GATE CHECK-IN" title="Truck Arrives at Gate" caption="Guard validates trailer, driver, and appointment in one screen" insight="Instant cross-reference with appointment record — no paper required" accent="#0891B2" />;
    case 'guard-mode':    return <ScreenSlide screenshot={SS('guard-mode-visual.png')} tag="GUARD MODE" title="Dedicated Gate Security View" caption="Distraction-free full-screen interface for gate personnel" insight="One-tap approve, hold, or flag — photo & seal capture on same screen" accent="#059669" />;
    case 'yard-map':      return <ScreenSlide screenshot={SS('yard-map-visual.png')} tag="YARD MAP" title="Live Yard Visibility" caption="Real-time bird's-eye view of every slot, zone, and trailer location" insight="Identify idle trailers, hot zones, and slot availability at a glance" accent="#D97706" />;
    case 'yard-inventory':return <ScreenSlide screenshot={SS('inventory.png')} tag="YARD INVENTORY" title="Full Asset Tracking Register" caption="Complete trailer inventory with dwell time, status, and carrier data" insight="Aged trailer alerts and slot utilization KPIs built in" accent="#2563EB" />;
    case 'yard-moves':    return <ScreenSlide screenshot={SS('yard-moves-visual.png')} tag="YARD MOVES" title="Jockey Task Board" caption="Move tasks auto-generated and dispatched to yard jockeys" insight="Priority-driven queue ensures dock doors are never waiting on moves" accent="#7C3AED" />;
    case 'dock-mgmt':     return <ScreenSlide screenshot={SS('dock-mgmt-visual.png')} tag="DOCK MANAGEMENT" title="Kanban Dock Control" caption="Kanban view tracks every door from Pending → Active → Complete" insight="SLA ring indicators alert supervisors before breach occurs" accent="#DC2626" />;
    case 'inspections':   return <InspectionsSlide />;
    case 'holds-exceptions': return <ScreenSlide screenshot={SS('exceptions.png')} tag="HOLDS & EXCEPTIONS" title="Compliance Gates" caption="Every hold captured with reason, owner, and resolution workflow" insight="No trailer exits until all holds are cleared and documented" accent="#D97706" />;
    case 'reports':       return <ScreenSlide screenshot={SS('reports-visual.png')} tag="REPORTS & ANALYTICS" title="Operations Intelligence" caption="Dwell time, dock efficiency, SLA performance — all in one view" insight="Export-ready reports for leadership, auditors, and carriers" accent="#059669" />;
    case 'roles-overview':return <RolesOverviewSlide />;
    case 'roles-detail':  return <AllRolesSlide />;
    case 'swimlane':      return <SwimlaneSlide />;
    case 'yard-setup':    return <YardSetupSlide />;
    case 'before-after':  return <BeforeAfterSlide />;
    case 'ai-overview':   return <AiOverviewSlide />;
    case 'ai-features':   return <AiFeaturesSlide />;
    case 'ai-governance': return <AiGovernanceSlide />;
    case 'ai-workflow':   return <AiWorkflowSlide />;
    case 'outro':         return <OutroSlide onNext={onNext} />;
    default:              return null;
  }
}

function SlideRenderer({ id, onNext }: { id: SlideId; onNext: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full h-full"
    >
      {renderSlide(id, onNext)}
    </motion.div>
  );
}

// ─── Print View (all slides, one per page) ────────────────────────────────────

function PrintView() {
  return (
    <div id="yms-print-view">
      {(SLIDES as readonly SlideId[]).map((id) => (
        <div key={id} className="yms-print-slide">
          <div className="absolute inset-0 opacity-[0.03] z-0 bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute inset-0">
            {renderSlide(id, () => {})}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared: Screen Slide ─────────────────────────────────────────────────────

interface ScreenSlideProps {
  screenshot: string;
  tag: string;
  title: string;
  caption: string;
  insight: string;
  accent: string;
}

function ScreenSlide({ screenshot, tag, title, caption, insight, accent }: ScreenSlideProps) {
  return (
    <div className="w-full h-full flex flex-col px-16 pt-5 pb-10 gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase mb-1" style={{ color: accent }}>{tag}</div>
          <h1 className="text-2xl font-black text-white leading-tight">{title}</h1>
        </div>
        <div className="flex flex-col items-end gap-2 max-w-[40%]">
          <div className="flex items-start gap-2 text-right">
            <div className="text-[12px] text-white/55 leading-snug">{caption}</div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border" style={{ borderColor: `${accent}33`, backgroundColor: `${accent}11` }}>
            <Star className="w-3 h-3 flex-shrink-0" style={{ color: accent }} />
            <span className="text-[11px] font-medium" style={{ color: accent }}>{insight}</span>
          </div>
        </div>
      </div>

      {/* Screenshot — large */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50">
          {/* Browser bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#131f35] border-b border-white/5 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-0.5 bg-[#0d1929] rounded text-[10px] text-white/30 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                ymsnow.app
              </div>
            </div>
          </div>
          <img
            src={screenshot}
            alt={title}
            className="w-full h-full object-contain object-top"
          />
          {/* Accent glow */}
          <div className="absolute inset-0 rounded-xl" style={{ boxShadow: `inset 0 0 0 1px ${accent}22` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Hero Slide ───────────────────────────────────────────────────────────────

function HeroSlide() {
  return (
    <div className="w-full h-full flex">
      {/* Left panel */}
      <div className="w-[38%] flex flex-col justify-center px-12 flex-shrink-0">
        <div className="w-12 h-12 bg-[#2563EB] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(37,99,235,0.5)]">
          <Factory className="text-white w-6 h-6" />
        </div>
        <div className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#2563EB] mb-3">Enterprise Yard Management</div>
        <h1 className="text-[3.5vw] font-black text-white leading-[1.05] mb-4">
          YMSNOW<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #2563EB, #10B981)' }}>
            Platform
          </span>
        </h1>
        <p className="text-[14px] text-white/45 leading-relaxed mb-8 max-w-xs">
          End-to-end yard visibility. Real-time truck lifecycle management. Built for enterprise distribution centers.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { n: '12', l: 'Modules' },
            { n: '6', l: 'User Roles' },
            { n: '100%', l: 'Configurable' },
          ].map(s => (
            <div key={s.l} className="text-center p-3 rounded-xl bg-white/5 border border-white/8">
              <div className="text-2xl font-black text-[#2563EB]">{s.n}</div>
              <div className="text-[10px] text-white/35 uppercase tracking-wider">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — dashboard screenshot large */}
      <div className="flex-1 relative py-4 pr-6">
        <div className="absolute inset-y-4 inset-x-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#131f35] border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-0.5 bg-[#0d1929] rounded text-[10px] text-white/30">ymsnow.app</div>
            </div>
          </div>
          <img src={SS('dashboard.png')} alt="Dashboard" className="w-full h-full object-contain object-top" />
        </div>
        <div className="absolute -inset-4 bg-[#2563EB]/5 rounded-3xl blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Lifecycle Slide ──────────────────────────────────────────────────────────

// Row 1: stages 1–6 (left → right), Row 2: stages 7–12 (right → left, snake)
const ROW1 = [
  { n: 1,  label: 'Appointment\nScheduled',   icon: <CalendarDays className="w-5 h-5" />,   color: '#2563EB', phase: 'PRE-ARRIVAL' },
  { n: 2,  label: 'Carrier\nPortal',           icon: <UserCheck className="w-5 h-5" />,       color: '#0891B2', phase: 'PRE-ARRIVAL' },
  { n: 3,  label: 'Gate\nCheck-In',            icon: <LogIn className="w-5 h-5" />,            color: '#059669', phase: 'GATE IN' },
  { n: 4,  label: 'Guard Mode\nVerify',        icon: <Shield className="w-5 h-5" />,           color: '#16A34A', phase: 'GATE IN' },
  { n: 5,  label: 'Yard Slot\nAssigned',       icon: <MapPin className="w-5 h-5" />,           color: '#D97706', phase: 'YARD' },
  { n: 6,  label: 'Yard\nInventory',           icon: <Package className="w-5 h-5" />,          color: '#CA8A04', phase: 'YARD' },
];
// Row 2 displayed right-to-left (reversed array for snake)
const ROW2_RAW = [
  { n: 7,  label: 'Move Task\nDispatched',     icon: <ArrowRightLeft className="w-5 h-5" />,  color: '#7C3AED', phase: 'MOVE' },
  { n: 8,  label: 'Dock Door\nAssigned',       icon: <DoorOpen className="w-5 h-5" />,         color: '#BE185D', phase: 'DOCK' },
  { n: 9,  label: 'Dock Activity\n& SLA',      icon: <Clock className="w-5 h-5" />,            color: '#DC2626', phase: 'DOCK' },
  { n: 10, label: 'Inspection\nCompleted',     icon: <ClipboardCheck className="w-5 h-5" />,  color: '#EA580C', phase: 'COMPLIANCE' },
  { n: 11, label: 'Holds\nCleared',            icon: <AlertTriangle className="w-5 h-5" />,   color: '#D97706', phase: 'COMPLIANCE' },
  { n: 12, label: 'Gate\nCheck-Out',           icon: <LogOut className="w-5 h-5" />,           color: '#10B981', phase: 'GATE OUT' },
];
const ROW2 = [...ROW2_RAW].reverse(); // display 12→11→10→9→8→7 left-to-right

const PHASE_COLORS: Record<string, string> = {
  'PRE-ARRIVAL': '#2563EB',
  'GATE IN':     '#059669',
  'YARD':        '#D97706',
  'MOVE':        '#7C3AED',
  'DOCK':        '#DC2626',
  'COMPLIANCE':  '#EA580C',
  'GATE OUT':    '#10B981',
};

function LifecycleSlide() {
  return (
    <div className="w-full h-full flex flex-col px-10 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-4 flex-shrink-0">
        <div>
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#2563EB] mb-1">END-TO-END FLOW DIAGRAM</div>
          <h1 className="text-2xl font-black text-white leading-tight">Complete Truck Lifecycle — 12 Stages</h1>
        </div>
        <div className="flex items-center gap-4 pb-0.5">
          {Object.entries(PHASE_COLORS).map(([phase, color]) => (
            <div key={phase} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">{phase}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Flow diagram */}
      <div className="flex-1 flex flex-col justify-center gap-0">

        {/* ── Row 1: stages 1–6 left → right ── */}
        <div className="flex items-stretch gap-0">
          {ROW1.map((step, i) => (
            <div key={step.n} className="flex items-center flex-1">
              <FlowNode step={step} index={i} dir="right" isLast={i === ROW1.length - 1} />
              {i < ROW1.length - 1 && (
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-[2px] w-5" style={{ background: `linear-gradient(90deg, ${ROW1[i].color}60, ${ROW1[i+1].color}60)` }} />
                  <div className="w-0 h-0" style={{ borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${ROW1[i+1].color}60` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Right-side turn connector ── */}
        <div className="flex items-stretch">
          {/* Empty columns 1–5 */}
          <div className="flex-1" style={{ flex: 5 }} />
          {/* Turn: right border + bottom-right corner indicator */}
          <div className="flex-1 flex flex-col items-center justify-center py-1">
            <div className="flex items-center justify-end w-full pr-[10%]">
              <div className="flex flex-col items-center">
                <div className="w-[2px] h-6 bg-gradient-to-b from-[#CA8A04] to-[#7C3AED] opacity-50 rounded-full" />
                <div className="w-0 h-0" style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid rgba(124,58,237,0.6)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: stages 12→7 left → right (snake) ── */}
        <div className="flex items-stretch gap-0">
          {ROW2.map((step, i) => (
            <div key={step.n} className="flex items-center flex-1">
              <FlowNode step={step} index={i + 6} dir="left" isLast={i === ROW2.length - 1} />
              {i < ROW2.length - 1 && (
                <div className="flex-shrink-0 flex items-center">
                  {/* Left-pointing arrows for snake row */}
                  <div className="w-0 h-0" style={{ borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderRight: `6px solid ${ROW2[i].color}60` }} />
                  <div className="h-[2px] w-5" style={{ background: `linear-gradient(270deg, ${ROW2[i].color}60, ${ROW2[i+1].color}60)` }} />
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

function FlowNode({ step, index, dir, isLast }: { step: typeof ROW1[0]; index: number; dir: 'left' | 'right'; isLast: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: dir === 'right' ? 12 : -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 flex flex-col rounded-xl overflow-hidden border border-white/10 shadow-lg"
      style={{ backgroundColor: `${step.color}0e`, borderColor: `${step.color}28` }}
    >
      {/* Phase label bar */}
      <div className="px-2 py-1 text-center" style={{ backgroundColor: `${step.color}22` }}>
        <span className="text-[8px] font-black tracking-[0.15em] uppercase" style={{ color: step.color }}>{step.phase}</span>
      </div>
      {/* Content */}
      <div className="flex flex-col items-center justify-center flex-1 px-2 py-3 text-center gap-2">
        {/* Icon circle */}
        <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor: `${step.color}25`, color: step.color, boxShadow: `0 0 14px ${step.color}30` }}>
          {step.icon}
        </div>
        {/* Stage badge */}
        <div className="text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: `${step.color}30`, color: step.color }}>
          STAGE {String(step.n).padStart(2, '0')}
        </div>
        {/* Label */}
        <div className="text-[12px] font-bold text-white leading-tight whitespace-pre-line">{step.label}</div>
      </div>
    </motion.div>
  );
}

// ─── Inspections Slide (Dedicated) ───────────────────────────────────────────

function InspectionsSlide() {
  const checks = [
    { label: 'Trailer condition checklist', pass: true },
    { label: 'Seal number verified', pass: true },
    { label: 'Damage photos attached', pass: true },
    { label: 'Commodity check', pass: null },
    { label: 'Temperature compliance', pass: false },
  ];
  return (
    <div className="w-full h-full flex px-14 pt-5 pb-10 gap-8">
      {/* Left — screenshot */}
      <div className="flex-1 min-w-0 relative">
        <div className="absolute inset-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#131f35] border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-0.5 bg-[#0d1929] rounded text-[10px] text-white/30">ymsnow.app/inspections</div>
            </div>
          </div>
          <img src={SS('inspections-visual.png')} alt="Inspections" className="w-full h-full object-contain object-top" />
        </div>
        <div className="absolute -inset-4 bg-[#059669]/5 rounded-3xl blur-3xl pointer-events-none" />
      </div>

      {/* Right panel */}
      <div className="w-[36%] flex flex-col justify-center flex-shrink-0">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#059669] mb-2">INSPECTIONS MODULE</div>
        <h1 className="text-[1.9vw] font-black text-white leading-tight mb-1">Quality & Compliance<br />Control Layer</h1>
        <p className="text-[12px] text-white/40 mb-5 italic">Positioned before gate exit — mandatory checkpoint</p>

        {/* Checklist preview */}
        <div className="space-y-2 mb-5">
          {checks.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{
                backgroundColor: c.pass === true ? '#05966912' : c.pass === false ? '#DC262612' : '#D9780612',
                borderLeft: `3px solid ${c.pass === true ? '#059669' : c.pass === false ? '#DC2626' : '#D97706'}`
              }}
            >
              {c.pass === true && <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] flex-shrink-0" />}
              {c.pass === false && <X className="w-3.5 h-3.5 text-[#DC2626] flex-shrink-0" />}
              {c.pass === null && <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] flex-shrink-0" />}
              <span className="text-[12px] text-white/70">{c.label}</span>
              <span className="ml-auto text-[10px] font-bold" style={{ color: c.pass === true ? '#059669' : c.pass === false ? '#DC2626' : '#D97706' }}>
                {c.pass === true ? 'PASS' : c.pass === false ? 'FAIL' : 'COND'}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Key capabilities */}
        <div className="space-y-2">
          {[
            { icon: <ClipboardCheck className="w-3.5 h-3.5" />, text: 'Digital checklist — Pass / Fail / Conditional', color: '#059669' },
            { icon: <AlertTriangle className="w-3.5 h-3.5" />, text: 'Auto hold creation on inspection failure', color: '#DC2626' },
            { icon: <Shield className="w-3.5 h-3.5" />,         text: 'Compliance validation before gate-out', color: '#2563EB' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-[12px] text-white/60">
              <span style={{ color: item.color }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Roles Overview ───────────────────────────────────────────────────────────

const ROLES_DATA = [
  {
    role: 'Admin',
    icon: <Settings2 className="w-4 h-4" />,
    color: '#2563EB',
    level: 'Full Access',
    scope: 100,
    desc: 'Full system control — all modules, users & configuration',
    // 1=full, 0.5=read/limited, 0=none — [Appt, Gate, Yard, Dock, Inspect, Holds, Reports, Config]
    access: [1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    role: 'Yard Manager',
    icon: <BarChart3 className="w-4 h-4" />,
    color: '#7C3AED',
    level: 'Operations',
    scope: 80,
    desc: 'Operational oversight — KPIs, SLA monitoring, exceptions',
    access: [1, 0.5, 1, 1, 1, 1, 1, 0.5],
  },
  {
    role: 'Gate Guard',
    icon: <Shield className="w-4 h-4" />,
    color: '#059669',
    level: 'Gate Only',
    scope: 30,
    desc: 'Gate check-in/out, appointment validation, guard mode',
    access: [0.5, 1, 0.5, 0, 0, 0.5, 0, 0],
  },
  {
    role: 'Yard Jockey',
    icon: <Truck className="w-4 h-4" />,
    color: '#D97706',
    level: 'Yard Only',
    scope: 35,
    desc: 'Move task execution, trailer spotting, yard navigation',
    access: [0, 0, 1, 0.5, 0, 0, 0, 0],
  },
  {
    role: 'Dock Operator',
    icon: <DoorOpen className="w-4 h-4" />,
    color: '#DC2626',
    level: 'Dock Only',
    scope: 40,
    desc: 'Dock door management, SLA tracking, dock activity',
    access: [0, 0, 0.5, 1, 0.5, 0.5, 0, 0],
  },
  {
    role: 'Carrier',
    icon: <Package className="w-4 h-4" />,
    color: '#0891B2',
    level: 'External',
    scope: 15,
    desc: 'Self-service portal — appointment booking, visit tracking',
    access: [1, 0, 0, 0, 0, 0, 0, 0],
  },
];

const MODULE_LABELS = ['Appts', 'Gate', 'Yard', 'Dock', 'Inspect', 'Holds', 'Reports', 'Config'];

function AccessDot({ value, color }: { value: number; color: string }) {
  if (value === 0) return <div className="w-5 h-5 rounded-full bg-white/5 border border-white/8" />;
  if (value === 0.5) return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center border" style={{ borderColor: `${color}40`, backgroundColor: `${color}15` }}>
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: 0.7 }} />
    </div>
  );
  return (
    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}30`, boxShadow: `0 0 6px ${color}40` }}>
      <CheckCircle2 className="w-3 h-3" style={{ color }} />
    </div>
  );
}

function RolesOverviewSlide() {
  return (
    <div className="w-full h-full flex flex-col px-10 pt-4 pb-8">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#2563EB] mb-1">ENTERPRISE ROLE MANAGEMENT</div>
        <h1 className="text-2xl font-black text-white">User Roles & Permissions</h1>
        <p className="text-[13px] text-white/35 mt-0.5">6 purpose-built roles — access scoped to each team's operational needs</p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">

        {/* ── Left: Role strips ── */}
        <div className="flex flex-col gap-2 w-[52%] flex-shrink-0 justify-between">
          {ROLES_DATA.map((r, i) => (
            <motion.div
              key={r.role}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl border flex-shrink-0"
              style={{ borderColor: `${r.color}25`, backgroundColor: `${r.color}08` }}
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: `${r.color}22`, color: r.color }}>
                {r.icon}
              </div>

              {/* Name + desc */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-bold text-white">{r.role}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: `${r.color}22`, color: r.color }}>{r.level}</span>
                </div>
                <p className="text-[10px] text-white/40 leading-snug truncate">{r.desc}</p>
              </div>

              {/* Access scope bar */}
              <div className="w-20 flex-shrink-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] text-white/25 uppercase tracking-wider">Scope</span>
                  <span className="text-[9px] font-bold" style={{ color: r.color }}>{r.scope}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${r.scope}%` }}
                    transition={{ delay: 0.3 + i * 0.07, duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Right: Permission matrix ── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/25 mb-3">Module Access Matrix</div>

          {/* Module header */}
          <div className="flex items-center mb-2 pl-[110px] gap-0">
            {MODULE_LABELS.map(m => (
              <div key={m} className="flex-1 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">{m}</span>
              </div>
            ))}
          </div>

          {/* Role rows */}
          <div className="flex-1 flex flex-col gap-1.5 justify-between">
            {ROLES_DATA.map((r, ri) => (
              <motion.div
                key={r.role}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + ri * 0.07 }}
                className="flex items-center rounded-lg overflow-hidden"
                style={{ backgroundColor: `${r.color}07`, border: `1px solid ${r.color}18` }}
              >
                {/* Role label */}
                <div className="w-[110px] flex-shrink-0 px-3 py-2 flex items-center gap-2">
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${r.color}20`, color: r.color }}>
                    {r.icon}
                  </div>
                  <span className="text-[11px] font-bold text-white truncate">{r.role}</span>
                </div>
                {/* Access dots */}
                <div className="flex flex-1 items-center py-2">
                  {r.access.map((val, mi) => (
                    <div key={mi} className="flex-1 flex justify-center">
                      <AccessDot value={val} color={r.color} />
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4">
            <span className="text-[9px] text-white/20 uppercase tracking-wider">Legend:</span>
            {[
              { label: 'Full Access', val: 1, color: '#10B981' },
              { label: 'Limited',     val: 0.5, color: '#D97706' },
              { label: 'No Access',   val: 0,   color: '#fff' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <AccessDot value={l.val} color={l.color} />
                <span className="text-[9px] text-white/30">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Role Slide ───────────────────────────────────────────────────────────────

const ALL_ROLES = [
  {
    role: 'Yard Manager / Admin',
    color: '#2563EB',
    icon: <BarChart3 className="w-5 h-5" />,
    access: 'Full system access — all modules, all data',
    screens: ['Dashboard', 'Reports', 'Yard Setup', 'AI Copilot'],
    actions: ['Monitor live yard KPIs', 'Configure SLA thresholds', 'Approve exceptions & holds', 'Manage users & permissions'],
    screenshot: 'dashboard.png',
  },
  {
    role: 'Gate Guard',
    color: '#059669',
    icon: <Shield className="w-5 h-5" />,
    access: 'Gate operations — check-in, check-out, guard mode',
    screens: ['Gate Check-In', 'Gate Check-Out', 'Guard Mode'],
    actions: ['Validate truck appointments', 'Scan trailer barcodes', 'Issue digital passes', 'Flag holds at gate'],
    screenshot: 'gate-guard.png',
  },
  {
    role: 'Yard Jockey',
    color: '#7C3AED',
    icon: <Truck className="w-5 h-5" />,
    access: 'Yard operations — move tasks, spot trailers',
    screens: ['Yard Moves', 'Yard Map', 'Yard Inventory'],
    actions: ['Accept and execute move tasks', 'Spot trailers to dock doors', 'Update task status in real time', 'View slot assignments on map'],
    screenshot: 'move-tasks.png',
  },
  {
    role: 'Dock Operator',
    color: '#DC2626',
    icon: <DoorOpen className="w-5 h-5" />,
    access: 'Dock area — door management, activity tracking',
    screens: ['Dock Management', 'Inspections', 'Move Tasks'],
    actions: ['Monitor assigned dock doors', 'Start and complete dock activities', 'Track SLA per door', 'Log dock exceptions'],
    screenshot: 'dock.png',
  },
];

function AllRolesSlide() {
  return (
    <div className="w-full h-full flex flex-col px-10 pt-5 pb-8">
      <div className="mb-4 flex-shrink-0">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#2563EB] mb-1">ROLE PROFILES</div>
        <h1 className="text-2xl font-black text-white">Who Uses YMSNOW</h1>
        <p className="text-[12px] text-white/35 mt-0.5">Four distinct roles — each with a focused, purpose-built experience</p>
      </div>

      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 min-h-0">
        {ALL_ROLES.map((r) => (
          <div
            key={r.role}
            className="rounded-xl border border-white/8 bg-white/[0.03] flex overflow-hidden min-h-0"
          >
            {/* Screenshot strip */}
            <div className="w-[40%] relative flex-shrink-0 overflow-hidden border-r border-white/6">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-[#131f35] border-b border-white/5">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF5F56]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FFBD2E]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#27C93F]" />
                </div>
              </div>
              <img src={SS(r.screenshot)} alt={r.role} className="w-full h-full object-cover object-top" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to right, transparent 70%, ${r.color}18)` }} />
            </div>

            {/* Info */}
            <div className="flex-1 p-3 flex flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${r.color}20`, color: r.color }}>
                  {r.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0" style={{ color: r.color }}>ROLE</div>
                  <div className="text-[13px] font-black text-white leading-tight truncate">{r.role}</div>
                </div>
              </div>

              {/* Access line */}
              <div className="text-[10px] text-white/35 mb-2 leading-snug">{r.access}</div>

              {/* Screens */}
              <div className="flex flex-wrap gap-1 mb-2">
                {r.screens.map(s => (
                  <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ color: r.color, backgroundColor: `${r.color}15`, border: `1px solid ${r.color}25` }}>{s}</span>
                ))}
              </div>

              {/* Actions */}
              <div className="space-y-1 mt-auto">
                {r.actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-white/50">
                    <div className="w-1 h-1 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: r.color }} />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Swimlane Slide ───────────────────────────────────────────────────────────

const SWIMLANE_ROLES = [
  { role: 'Carrier',       color: '#0891B2', steps: ['Books appointment', '', '', '', '', '', '', ''] },
  { role: 'Gate Guard',    color: '#059669', steps: ['', 'Validates check-in', '', '', '', '', 'Issues exit pass', ''] },
  { role: 'Yard Jockey',   color: '#D97706', steps: ['', '', 'Assigns yard slot', '', 'Spots to dock', '', '', ''] },
  { role: 'Dock Operator', color: '#DC2626', steps: ['', '', '', '', '', 'Manages activity', '', ''] },
  { role: 'Yard Manager',  color: '#7C3AED', steps: ['', '', '', 'Monitors KPIs', '', '', '', 'Closes visit'] },
];

const SWIMLANE_PHASES = ['Schedule', 'Gate In', 'Yard Slot', 'Oversight', 'Move', 'Dock', 'Gate Out', 'Close'];

function SwimlaneSlide() {
  return (
    <div className="w-full h-full flex flex-col px-12 pt-5 pb-10">
      <div className="mb-5 flex-shrink-0">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#2563EB] mb-1">ROLE WORKFLOW MAPPING</div>
        <h1 className="text-2xl font-black text-white">Who Does What — Swimlane View</h1>
        <p className="text-[13px] text-white/40 mt-1">Gate → Yard → Dock → Exit — each role plays a defined part in the lifecycle</p>
      </div>

      {/* Phase headers */}
      <div className="flex-shrink-0 flex ml-[110px] mb-2">
        {SWIMLANE_PHASES.map((p, i) => (
          <div key={i} className="flex-1 text-center text-[10px] font-bold uppercase tracking-wider text-white/25">{p}</div>
        ))}
      </div>

      {/* Lanes */}
      <div className="flex-1 flex flex-col gap-2">
        {SWIMLANE_ROLES.map((lane, li) => (
          <div key={li} className="flex items-center flex-1">
            {/* Role label */}
            <div className="w-[110px] flex-shrink-0 pr-3">
              <div className="text-[11px] font-bold text-right" style={{ color: lane.color }}>{lane.role}</div>
            </div>
            {/* Cells */}
            <div className="flex-1 flex gap-1 h-full">
              {lane.steps.map((step, si) => (
                <motion.div
                  key={si}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: li * 0.1 + si * 0.04 }}
                  className="flex-1 rounded-lg flex items-center justify-center text-center p-1"
                  style={{
                    backgroundColor: step ? `${lane.color}15` : 'rgba(255,255,255,0.02)',
                    border: step ? `1px solid ${lane.color}30` : '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {step && (
                    <span className="text-[10px] font-medium leading-tight" style={{ color: lane.color }}>{step}</span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 mt-3 flex items-center gap-6 justify-center">
        <div className="flex items-center gap-2 text-[11px] text-white/30">
          <div className="w-8 h-4 rounded border border-[#2563EB]/40 bg-[#2563EB]/15" />
          <span>Active responsibility</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-white/30">
          <div className="w-8 h-4 rounded border border-white/8 bg-white/3" />
          <span>Not involved</span>
        </div>
        <ArrowRight className="w-4 h-4 text-white/20" />
        <span className="text-[11px] text-white/30">Lifecycle direction →</span>
      </div>
    </div>
  );
}

// ─── Yard Setup Slide ─────────────────────────────────────────────────────────

function YardSetupSlide() {
  const features = [
    { icon: <MapPin className="w-4 h-4" />,    title: 'Zone & Slot Config',    desc: 'Define custom yard zones with named slots, capacities, and trailer type restrictions', color: '#2563EB' },
    { icon: <DoorOpen className="w-4 h-4" />,  title: 'Dock Door Setup',       desc: 'Configure dock doors with type, SLA threshold, and default crew assignments', color: '#DC2626' },
    { icon: <Clock className="w-4 h-4" />,     title: 'SLA Thresholds',        desc: 'Set time-based SLA alerts per dock, activity type, or commodity class', color: '#D97706' },
    { icon: <Users className="w-4 h-4" />,     title: 'Carrier Management',    desc: 'Pre-register carriers with access rights, allowed zones, and appointment quotas', color: '#059669' },
    { icon: <Shield className="w-4 h-4" />,    title: 'Role Permissions',      desc: 'Granular access control — restrict screens and actions per role', color: '#7C3AED' },
    { icon: <Settings2 className="w-4 h-4" />, title: 'Configurable Workflows','desc': 'Adapt move task flows, inspection checklists, and gate protocols to your operation', color: '#0891B2' },
  ];
  return (
    <div className="w-full h-full flex px-14 pt-5 pb-10 gap-8">
      {/* Left */}
      <div className="flex-1 min-w-0 relative">
        <div className="absolute inset-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#131f35] border-b border-white/5">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-0.5 bg-[#0d1929] rounded text-[10px] text-white/30">ymsnow.app/admin/yard-setup</div>
            </div>
          </div>
          <img src={SS('yard-setup.png')} alt="Yard Setup" className="w-full h-full object-contain object-top" />
        </div>
      </div>

      {/* Right */}
      <div className="w-[38%] flex flex-col justify-center flex-shrink-0">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#2563EB] mb-2">YARD CONFIGURATION</div>
        <h1 className="text-[1.9vw] font-black text-white leading-tight mb-1">Built for Any Yard</h1>
        <p className="text-[12px] text-white/40 italic mb-5">Not a fixed template — fully configurable for your operation</p>

        <div className="grid grid-cols-2 gap-2.5">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="p-3 rounded-xl border"
              style={{ borderColor: `${f.color}25`, backgroundColor: `${f.color}08` }}
            >
              <div className="flex items-center gap-2 mb-1.5" style={{ color: f.color }}>
                {f.icon}
                <span className="text-[11px] font-bold text-white">{f.title}</span>
              </div>
              <p className="text-[10px] text-white/40 leading-snug">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Before / After Slide ─────────────────────────────────────────────────────

function BeforeAfterSlide() {
  const before = [
    'Paper-based gate logs & manual check-in',
    'Radio/phone calls to locate trailers',
    'Whiteboards for dock door tracking',
    'No SLA visibility — missed deadlines',
    'Manual exception reporting via email',
    'Siloed data — no cross-role visibility',
    'Carrier calls to check appointment status',
    'Audit trail gaps & compliance risk',
  ];
  const after = [
    'Digital gate check-in in under 60 seconds',
    'Live yard map — find any trailer instantly',
    'Kanban dock board with SLA ring alerts',
    'Real-time SLA monitoring with auto-alerts',
    'Automated exception capture & resolution',
    'Shared live view for all roles & teams',
    'Carrier self-service portal 24/7',
    'Full digital audit trail — always compliant',
  ];
  return (
    <div className="w-full h-full flex flex-col px-12 pt-5 pb-10">
      <div className="mb-5 flex-shrink-0">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#2563EB] mb-1">THE TRANSFORMATION</div>
        <h1 className="text-2xl font-black text-white">Before vs After YMSNOW</h1>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-5">
        {/* Before */}
        <div className="flex flex-col rounded-2xl overflow-hidden border border-[#DC2626]/20">
          <div className="px-5 py-3 bg-[#DC2626]/10 border-b border-[#DC2626]/15">
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-[#DC2626]" />
              <span className="text-sm font-black text-white">Without YMSNOW</span>
              <span className="text-[10px] text-[#DC2626] ml-auto uppercase font-bold">Manual / Siloed</span>
            </div>
          </div>
          <div className="flex-1 p-4 space-y-2">
            {before.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 py-2 border-b border-white/4"
              >
                <X className="w-3.5 h-3.5 text-[#DC2626] flex-shrink-0 mt-0.5" />
                <span className="text-[12px] text-white/55">{b}</span>
              </motion.div>
            ))}
          </div>
        </div>
        {/* After */}
        <div className="flex flex-col rounded-2xl overflow-hidden border border-[#10B981]/20">
          <div className="px-5 py-3 bg-[#10B981]/10 border-b border-[#10B981]/15">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-black text-white">With YMSNOW</span>
              <span className="text-[10px] text-[#10B981] ml-auto uppercase font-bold">Automated / Unified</span>
            </div>
          </div>
          <div className="flex-1 p-4 space-y-2">
            {after.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 py-2 border-b border-white/4"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
                <span className="text-[12px] text-white/70">{a}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Overview Slide ────────────────────────────────────────────────────────

function AiOverviewSlide() {
  const layers = [
    { label: 'User Actions', sub: 'Insights · Suggestions · Auto-triggers', color: '#10B981', icon: <Activity className="w-4 h-4" /> },
    { label: 'AI Engine', sub: 'NLP · Predictive Models · Decision Engine', color: '#7C3AED', icon: <Brain className="w-4 h-4" /> },
    { label: 'Data Fabric', sub: 'Live yard events · Emails · Sensor feeds', color: '#D97706', icon: <Layers className="w-4 h-4" /> },
    { label: 'YMS Core', sub: '12 modules · Gate · Dock · Moves · Reports', color: '#2563EB', icon: <Factory className="w-4 h-4" /> },
  ];

  const benefits = [
    { icon: <Activity className="w-4 h-4" />, text: 'Real-time decision support', color: '#10B981' },
    { icon: <Zap className="w-4 h-4" />, text: 'Intelligent automation', color: '#7C3AED' },
    { icon: <BarChart3 className="w-4 h-4" />, text: 'Improved operational efficiency', color: '#2563EB' },
  ];

  return (
    <div className="w-full h-full flex px-10 pt-5 pb-8 gap-8">
      {/* Left — messaging + layers */}
      <div className="w-[40%] flex flex-col justify-center flex-shrink-0">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#7C3AED] mb-2">AI LAYER</div>
        <h1 className="text-2xl font-black text-white leading-tight mb-3">
          Enhanced YMSNOW<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #7C3AED, #10B981)' }}>
            AI-Powered Operations
          </span>
        </h1>
        <p className="text-[12px] text-white/40 leading-relaxed mb-5">
          AI sits as an assistive intelligence layer on top of YMSNOW — amplifying every workflow without replacing human judgment.
        </p>
        <div className="space-y-2.5">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.12 }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-white/8 bg-white/[0.03]"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${b.color}20`, color: b.color }}>
                {b.icon}
              </div>
              <span className="text-[12px] text-white/65 font-medium">{b.text}</span>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 space-y-1.5">
          {layers.slice().reverse().map((layer, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex items-center gap-3 px-3 py-2 rounded-lg"
              style={{ backgroundColor: `${layer.color}0d`, borderLeft: `2px solid ${layer.color}60` }}
            >
              <div style={{ color: layer.color }}>{layer.icon}</div>
              <div>
                <div className="text-[10px] font-black text-white">{layer.label}</div>
                <div className="text-[9px] text-white/35">{layer.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right — AI copilot panel screenshot */}
      <div className="flex-1 flex items-center justify-center relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative h-full max-h-[560px] w-auto"
          style={{ aspectRatio: '443/629' }}
        >
          {/* Glow */}
          <div className="absolute -inset-8 rounded-3xl blur-3xl pointer-events-none" style={{ backgroundColor: '#7C3AED18' }} />
          {/* Panel frame */}
          <div className="relative h-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
            <img
              src={SS('ai-copilot-panel.png')}
              alt="AI Copilot Panel"
              className="w-full h-full object-contain object-top bg-white"
            />
          </div>
          {/* Live badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#7C3AED] text-white text-[10px] font-bold shadow-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Live AI Copilot
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── AI Features Slide ────────────────────────────────────────────────────────

const AI_FEATURES = [
  {
    icon: <MessageSquare className="w-5 h-5" />,
    title: 'AI Chatbot',
    desc: 'Natural language queries — ask about yard status, trigger actions, get summaries',
    color: '#2563EB',
  },
  {
    icon: <Mail className="w-5 h-5" />,
    title: 'Email Intelligence',
    desc: 'Reads incoming emails, generates alerts, and suggests actionable steps automatically',
    color: '#7C3AED',
  },
  {
    icon: <Bell className="w-5 h-5" />,
    title: 'Predictive Alerts',
    desc: 'Detects yard congestion, dock delays, and SLA breach risks before they happen',
    color: '#DC2626',
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    title: 'Smart Recommendations',
    desc: 'Suggests optimal dock assignments and jockey allocations based on live data',
    color: '#D97706',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Workflow Automation',
    desc: 'Auto-triggers move tasks and alerts based on configurable yard conditions',
    color: '#10B981',
  },
];

function AiFeaturesSlide() {
  return (
    <div className="w-full h-full flex px-10 pt-5 pb-8 gap-8">
      {/* Left — AI Console screenshot */}
      <div className="w-[52%] flex flex-col flex-shrink-0 min-h-0">
        <div className="mb-3 flex-shrink-0">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#7C3AED] mb-1">AI LAYER</div>
          <h1 className="text-2xl font-black text-white">AI Capabilities</h1>
          <p className="text-[11px] text-white/35 mt-0.5">Five intelligent modules — managed from the AI Console</p>
        </div>
        <div className="flex-1 relative min-h-0 rounded-xl overflow-hidden border border-white/10 shadow-xl">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#131f35] border-b border-white/5 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#FF5F56]" />
              <div className="w-2 h-2 rounded-full bg-[#FFBD2E]" />
              <div className="w-2 h-2 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-3 py-0.5 bg-[#0d1929] rounded text-[9px] text-white/30">ymsnow.app/ai-copilot — Enablement</div>
            </div>
          </div>
          <img src={SS('ai-console-enablement.png')} alt="AI Console Enablement" className="w-full h-full object-contain object-top bg-white" />
        </div>
      </div>

      {/* Right — Feature cards */}
      <div className="flex-1 flex flex-col justify-center gap-2.5 min-h-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-white/25 mb-1">Feature Modules</div>
        {AI_FEATURES.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/8 bg-white/[0.03]"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${f.color}20`, color: f.color }}>
              {f.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-black text-white">{f.title}</div>
              <div className="text-[10px] text-white/40 mt-0.5 leading-snug">{f.desc}</div>
            </div>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Governance Slide ──────────────────────────────────────────────────────

function AiGovernanceSlide() {
  const tabs = [
    {
      label: 'Governance',
      sub: 'Automation level · Action controls · Approval workflow',
      color: '#7C3AED',
      screenshot: 'ai-console-governance.png',
      url: 'ai-copilot — Governance',
    },
    {
      label: 'Data Sources',
      sub: 'Module access · Read vs. Act permissions · Status',
      color: '#2563EB',
      screenshot: 'ai-console-datasources.png',
      url: 'ai-copilot — Data Sources',
    },
    {
      label: 'Guardrails',
      sub: 'Safety constraints · Emergency disable · Audit trail',
      color: '#DC2626',
      screenshot: 'ai-console-guardrails.png',
      url: 'ai-copilot — Guardrails',
    },
  ];

  return (
    <div className="w-full h-full flex flex-col px-10 pt-5 pb-8">
      <div className="mb-4 flex-shrink-0">
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#7C3AED] mb-1">AI GOVERNANCE</div>
        <h1 className="text-2xl font-black text-white">AI Control &amp; Explainability</h1>
        <p className="text-[12px] text-white/35 mt-0.5">Full governance through the AI Console — configurable, auditable, and safe</p>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-5 min-h-0">
        {tabs.map((tab, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.12 }}
            className="flex flex-col rounded-xl overflow-hidden border min-h-0"
            style={{ borderColor: `${tab.color}30` }}
          >
            {/* Tab header */}
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: `${tab.color}15`, borderBottom: `1px solid ${tab.color}25` }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tab.color }} />
              <span className="text-[11px] font-black text-white">{tab.label}</span>
            </div>
            {/* Browser chrome */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#131f35] border-b border-white/5 flex-shrink-0">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF5F56]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFBD2E]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#27C93F]" />
              </div>
              <div className="flex-1 text-center text-[8px] text-white/25 truncate">{tab.url}</div>
            </div>
            {/* Screenshot */}
            <div className="flex-1 min-h-0 bg-white overflow-hidden">
              <img src={SS(tab.screenshot)} alt={tab.label} className="w-full h-full object-contain object-top" />
            </div>
            {/* Caption */}
            <div className="flex-shrink-0 px-3 py-2 bg-[#07111f] border-t border-white/5">
              <p className="text-[9px] text-white/35 leading-snug">{tab.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Workflow Slide ────────────────────────────────────────────────────────

function AiWorkflowSlide() {
  const steps = [
    { label: 'Email Received', desc: 'Carrier sends scheduling request', icon: <Mail className="w-4 h-4" />, actor: 'External', color: '#0891B2' },
    { label: 'AI Reads & Summarizes', desc: 'NLP extracts intent, trailer, and time', icon: <Brain className="w-4 h-4" />, actor: 'AI', color: '#7C3AED' },
    { label: 'Conflict Detected', desc: 'Scheduling overlap identified in dock queue', icon: <AlertTriangle className="w-4 h-4" />, actor: 'AI', color: '#DC2626' },
    { label: 'Suggestions Generated', desc: 'Slot change + dock reassignment options', icon: <Lightbulb className="w-4 h-4" />, actor: 'AI', color: '#D97706' },
    { label: 'Supervisor Approves', desc: 'One-click approval from AI recommendation panel', icon: <CheckSquare className="w-4 h-4" />, actor: 'Human', color: '#10B981' },
    { label: 'Move Task Created', desc: 'System auto-executes approved plan', icon: <Zap className="w-4 h-4" />, actor: 'System', color: '#2563EB' },
  ];

  const actorColors: Record<string, string> = {
    External: '#0891B2', AI: '#7C3AED', Human: '#10B981', System: '#2563EB',
  };

  return (
    <div className="w-full h-full flex flex-col px-10 pt-5 pb-6">
      <div className="mb-3 flex-shrink-0 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#7C3AED] mb-1">AI WORKFLOW</div>
          <h1 className="text-2xl font-black text-white">AI-Driven Yard Workflow</h1>
          <p className="text-[11px] text-white/35 mt-0.5">From carrier email to executed move task — automated end-to-end</p>
        </div>
        <div className="flex gap-3">
          {(['External', 'AI', 'Human', 'System'] as const).map(actor => (
            <div key={actor} className="flex items-center gap-1.5 text-[10px] text-white/40">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: actorColors[actor] }} />
              {actor}
            </div>
          ))}
        </div>
      </div>

      {/* Flow diagram */}
      <div className="flex-shrink-0 flex items-center py-3">
        <div className="w-full grid grid-cols-6 gap-0 items-center">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.12, type: 'spring', stiffness: 260 }}
                className="flex-1 flex flex-col rounded-xl border p-2.5 relative"
                style={{ borderColor: `${step.color}35`, backgroundColor: `${step.color}0d` }}
              >
                <div
                  className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ backgroundColor: `${step.color}25`, color: step.color, border: `1px solid ${step.color}40` }}
                >
                  {step.actor}
                </div>
                <div className="flex items-center gap-2 mb-1.5 mt-1">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${step.color}20`, color: step.color }}>
                    {step.icon}
                  </div>
                  <div className="text-[10px] font-black text-white leading-tight">{step.label}</div>
                </div>
                <p className="text-[9px] text-white/40 leading-snug">{step.desc}</p>
                <div
                  className="absolute -bottom-2 right-2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                  style={{ backgroundColor: step.color, color: '#fff' }}
                >
                  {i + 1}
                </div>
              </motion.div>
              {i < steps.length - 1 && (
                <div className="flex items-center justify-center w-5 flex-shrink-0">
                  <ArrowRight className="w-3 h-3 text-white/20" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Screenshots — Email Intelligence */}
      <div className="flex-1 grid grid-cols-2 gap-5 min-h-0 mt-2">
        {/* Email Intelligence full view */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col rounded-xl overflow-hidden border border-white/10 min-h-0"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#131f35] border-b border-white/5 flex-shrink-0">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF5F56]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex-1 text-center text-[8px] text-white/25">ai-copilot — Email Intelligence</div>
          </div>
          <div className="flex-1 min-h-0 bg-white overflow-hidden">
            <img src={SS('ai-email-intelligence.png')} alt="Email Intelligence" className="w-full h-full object-contain object-top" />
          </div>
        </motion.div>

        {/* Carrier email inbox panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.62 }}
          className="flex flex-col rounded-xl overflow-hidden border border-white/10 min-h-0"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#131f35] border-b border-white/5 flex-shrink-0">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF5F56]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#27C93F]" />
            </div>
            <div className="flex-1 text-center text-[8px] text-white/25">Carrier Email Inbox — AI Parsed</div>
          </div>
          <div className="flex-1 min-h-0 bg-white overflow-hidden">
            <img src={SS('ai-carrier-email.png')} alt="Carrier Email Inbox" className="w-full h-full object-contain object-top" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Outro ───────────────────────────────────────────────────────────────────

function OutroSlide({ onNext: _ }: { onNext: () => void }) {
  return (
    <div className="w-full h-full flex">
      {/* Left */}
      <div className="w-[42%] flex flex-col justify-center px-12 flex-shrink-0">
        <div className="w-14 h-14 bg-[#2563EB] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(37,99,235,0.4)]">
          <Factory className="text-white w-8 h-8" />
        </div>
        <h1 className="text-[3vw] font-black text-white leading-tight mb-4">
          Ready to See<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #2563EB, #10B981)' }}>
            It Live?
          </span>
        </h1>
        <p className="text-[14px] text-white/45 leading-relaxed mb-8 max-w-xs">
          YMSNOW is production-ready — connect your yard data and go live in days, not months.
        </p>
        <div className="space-y-3">
          {[
            { icon: <CheckCircle2 className="w-4 h-4" />, text: '12 modules — all connected', color: '#10B981' },
            { icon: <CheckCircle2 className="w-4 h-4" />, text: '6 role-based interfaces', color: '#10B981' },
            { icon: <CheckCircle2 className="w-4 h-4" />, text: 'Fully configurable yard setup', color: '#10B981' },
            { icon: <CheckCircle2 className="w-4 h-4" />, text: 'Real-time SLA & compliance tracking', color: '#10B981' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-[13px] text-white/65">
              <span style={{ color: item.color }}>{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
      {/* Right — Reports + Dashboard collage */}
      <div className="flex-1 relative py-4 pr-6 flex gap-3">
        <div className="flex-1 relative rounded-xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#131f35] border-b border-white/5">
            <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-[#FF5F56]" /><div className="w-2 h-2 rounded-full bg-[#FFBD2E]" /><div className="w-2 h-2 rounded-full bg-[#27C93F]" /></div>
          </div>
          <img src={SS('reports-visual.png')} alt="Reports" className="w-full h-full object-contain object-top" />
        </div>
        <div className="w-[45%] flex flex-col gap-3">
          <div className="flex-1 rounded-xl overflow-hidden border border-white/10 shadow-xl">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-[#131f35] border-b border-white/5">
              <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-[#FF5F56]" /><div className="w-2 h-2 rounded-full bg-[#FFBD2E]" /><div className="w-2 h-2 rounded-full bg-[#27C93F]" /></div>
            </div>
            <img src={SS('dock.png')} alt="Dock" className="w-full h-full object-contain object-top" />
          </div>
          <div className="flex-1 rounded-xl overflow-hidden border border-white/10 shadow-xl">
            <div className="flex items-center gap-1 px-2 py-1.5 bg-[#131f35] border-b border-white/5">
              <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-[#FF5F56]" /><div className="w-2 h-2 rounded-full bg-[#FFBD2E]" /><div className="w-2 h-2 rounded-full bg-[#27C93F]" /></div>
            </div>
            <img src={SS('yard-map-visual.png')} alt="Map" className="w-full h-full object-contain object-top" />
          </div>
        </div>
      </div>
    </div>
  );
}
