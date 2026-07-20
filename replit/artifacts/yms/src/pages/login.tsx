import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ChevronRight, ChevronLeft, LogIn, Shield, Activity, Layers, GitMerge, Building2 } from "lucide-react";
import { DEMO_USERS, ROLE_META, type DemoUser } from "@/lib/demo-users";
import { apiRequest, storeCurrentRole } from "@/lib/queryClient";

// ─── Isometric constants (module-level, never re-created) ──────────────────
const TW = 48, TH = 24, BH = 28;
const isoSX = (c: number, r: number) => (c - r) * (TW / 2);
const isoSY = (c: number, r: number, z = 0) => (c + r) * (TH / 2) - z * BH;

// Static layout data (defined once outside the hook)
type TStatus = "empty" | "occupied" | "loading" | "ready" | "hold";
const THEMES: Record<TStatus, [string, string, string]> = {
  empty:    ["#e8eef4", "#d2dce6", "#bccad6"],
  occupied: ["#fef3c7", "#fde68a", "#fbbf24"],
  loading:  ["#dbeafe", "#bfdbfe", "#93c5fd"],
  ready:    ["#dcfce7", "#bbf7d0", "#6ee7b7"],
  hold:     ["#ffe4e6", "#fecdd3", "#fda4af"],
};
const SLOTS_L: TStatus[][] = [
  ["occupied","loading","empty"],
  ["ready","occupied","hold"],
  ["empty","ready","occupied"],
  ["loading","empty","occupied"],
];
const SLOTS_R: TStatus[][] = [
  ["loading","empty","occupied"],
  ["occupied","ready","empty"],
  ["hold","occupied","loading"],
  ["ready","empty","occupied"],
];
const DOCK_ACTIVE = [true,false,true,true,false,true,false,true];

interface Tractor { wpIdx: number; progress: number; speed: number; waypoints: [number,number][]; }
const TRACTORS: Tractor[] = [
  { wpIdx:0, progress:0.0, speed:0.008, waypoints:[[4,8],[4,2],[1,2],[1,5],[4,5],[4,8]] },
  { wpIdx:2, progress:0.5, speed:0.006, waypoints:[[4,8],[4,1],[6,1],[6,4],[4,4],[4,8]] },
  { wpIdx:3, progress:0.2, speed:0.010, waypoints:[[4,8],[4,3],[8,3],[8,1],[4,1],[4,8]] },
];

// ─── Drawing primitives ────────────────────────────────────────────────────
function tile(ctx: CanvasRenderingContext2D, c: number, r: number, ox: number, oy: number, fill: string) {
  const x = ox + isoSX(c, r), y = oy + isoSY(c, r);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + TW/2, y + TH/2);
  ctx.lineTo(x, y + TH);
  ctx.lineTo(x - TW/2, y + TH/2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function box(
  ctx: CanvasRenderingContext2D,
  c: number, r: number, ox: number, oy: number,
  w: number, d: number, h: number,
  top: string, left: string, right: string
) {
  const x = ox + isoSX(c, r), y = oy + isoSY(c, r, h);
  const tw2 = w*TW/2, th2 = w*TH/2, dw2 = d*TW/2, dh2 = d*TH/2, bh = h*BH;

  // top face
  ctx.beginPath();
  ctx.moveTo(x,y); ctx.lineTo(x+tw2,y+th2); ctx.lineTo(x+tw2-dw2,y+th2+dh2); ctx.lineTo(x-dw2,y+dh2);
  ctx.closePath(); ctx.fillStyle = top; ctx.fill();

  // left face
  ctx.beginPath();
  ctx.moveTo(x,y); ctx.lineTo(x-dw2,y+dh2); ctx.lineTo(x-dw2,y+dh2+bh); ctx.lineTo(x,y+bh);
  ctx.closePath(); ctx.fillStyle = left; ctx.fill();

  // right face
  ctx.beginPath();
  ctx.moveTo(x,y); ctx.lineTo(x+tw2,y+th2); ctx.lineTo(x+tw2,y+th2+bh); ctx.lineTo(x,y+bh);
  ctx.closePath(); ctx.fillStyle = right; ctx.fill();
}

// ─── Offscreen static cache ────────────────────────────────────────────────
function buildStaticCache(W: number, H: number, ox: number, oy: number): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const c = off.getContext("2d")!;

  // Background
  c.fillStyle = "#edf1f6";
  c.fillRect(0, 0, W, H);

  // Dot grid (drawn once here, not every frame)
  c.fillStyle = "rgba(30,58,95,0.045)";
  for (let gx = 12; gx < W; gx += 24)
    for (let gy = 12; gy < H; gy += 24) {
      c.beginPath(); c.arc(gx, gy, 1, 0, Math.PI*2); c.fill();
    }

  // Ground tiles — batch by color to reduce state changes
  c.strokeStyle = "rgba(0,0,0,0.05)";
  c.lineWidth = 0.5;
  for (let r = 0; r <= 9; r++) {
    for (let col = 0; col <= 9; col++) {
      const road = (col>=3&&col<=5) || r>=7;
      const back = r<=1;
      tile(c, col, r, ox, oy, back?"#d4dce6":road?"#dde4ec":"#e9eef3");
      // stroke outline
      const x = ox+isoSX(col,r), y = oy+isoSY(col,r);
      c.beginPath();
      c.moveTo(x,y); c.lineTo(x+TW/2,y+TH/2); c.lineTo(x,y+TH); c.lineTo(x-TW/2,y+TH/2); c.closePath();
      c.stroke();
    }
  }

  // Road centre dashes — single path, set lineDash once
  c.save();
  c.globalAlpha = 0.3;
  c.strokeStyle = "#f0b429";
  c.lineWidth = 1.5;
  c.setLineDash([3, 6]);
  c.beginPath();
  for (let r = 2; r <= 6; r++) {
    const x = ox+isoSX(4,r), y = oy+isoSY(4,r);
    c.moveTo(x-2, y+TH*0.3); c.lineTo(x+2, y+TH*0.65);
  }
  c.stroke();
  c.restore();

  // Slot zones
  const drawZone = (startC: number, startR: number, statuses: TStatus[][]) => {
    statuses.forEach((row, ri) => row.forEach((status, ci) => {
      const sc = startC+ci, sr = startR+ri;
      tile(c, sc, sr, ox, oy, "#d8e0ea");
      if (status !== "empty") {
        const [t,l,r2] = THEMES[status];
        box(c, sc, sr, ox, oy, 0.88, 0.88, 0.55, t, l, r2);
      }
    }));
  };
  drawZone(0, 2, SLOTS_L);
  drawZone(6, 2, SLOTS_R);

  // Dock building
  box(c, 0, 0, ox, oy, 10, 1, 1.2, "#c5d3e0", "#a8baca", "#8faab8");
  DOCK_ACTIVE.forEach((active, i) => {
    const x = ox+isoSX(i+0.65, 0.5), y = oy+isoSY(i+0.65, 0.5, 0.9);
    c.fillStyle = active ? "rgba(37,99,235,0.65)" : "rgba(148,163,184,0.45)";
    c.fillRect(x-4, y, 8, 14);
  });

  // Gate
  const gx = ox+isoSX(4, 8.5), gy = oy+isoSY(4, 8.5);
  c.fillStyle = "#334155";
  c.fillRect(gx-10, gy-20, 5, 20);
  c.fillRect(gx+5,  gy-20, 5, 20);
  c.fillStyle = "#16a34a";
  c.fillRect(gx-5,  gy-18, 30, 4);
  c.fillStyle = "#334155";
  c.font = "bold 7px system-ui,sans-serif";
  c.textAlign = "center";
  c.fillText("GATE", gx+8, gy-24);

  return off;
}

// ─── Yard Canvas hook ──────────────────────────────────────────────────────
function useYardCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rafRef    = useRef<number>(0);
  const stateRef  = useRef({ tractors: TRACTORS.map(t => ({ ...t })) });
  const cacheRef  = useRef<{ img: HTMLCanvasElement; W: number; H: number } | null>(null);
  const lastRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    let W = 0, H = 0, ox = 0, oy = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      if (!W || !H) return;          // hidden on mobile — skip
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
      ox = W * 0.5;
      oy = H * 0.16;
      cacheRef.current = { img: buildStaticCache(W, H, ox, oy), W, H };
    }

    function drawTractors(t: number) {
      const { tractors } = stateRef.current;
      tractors.forEach((tr, i) => {
        tr.progress += tr.speed;
        if (tr.progress >= 1) { tr.progress = 0; tr.wpIdx = (tr.wpIdx+1) % tr.waypoints.length; }
        const [fc,fr] = tr.waypoints[tr.wpIdx];
        const [tc,tr2] = tr.waypoints[(tr.wpIdx+1) % tr.waypoints.length];
        const col = fc + (tc-fc)*tr.progress;
        const row = fr + (tr2-fr)*tr.progress;

        // Body + cab as two small iso boxes
        box(ctx, col-0.15, row-0.15, ox, oy, 0.35, 0.35, 0.40, "#475569","#334155","#1e293b");
        box(ctx, col+0.08, row-0.15, ox, oy, 0.18, 0.30, 0.50, "#64748b","#475569","#334155");

        // Headlight glow (cheap: solid small circle, no shadow)
        const pulse = 0.5 + 0.5 * Math.sin(t*0.07 + i*2.1);
        ctx.globalAlpha = pulse * 0.55;
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(ox+isoSX(col+0.22,row), oy+isoSY(col+0.22,row)+4, 2, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    let t = 0;
    function frame(now: number) {
      rafRef.current = requestAnimationFrame(frame);
      // Cap at ~30 fps so the animation uses half the GPU budget
      if (now - lastRef.current < 33) return;
      lastRef.current = now;
      t++;

      const cache = cacheRef.current;
      if (!cache) return;

      ctx.drawImage(cache.img, 0, 0);   // blit pre-rendered static scene
      drawTractors(t);                   // only the moving parts are live
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    rafRef.current = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [canvasRef]);
}

function YardCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useYardCanvas(ref);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

// ─── KPI chip ─────────────────────────────────────────────────────────────
function KPIChip({ icon, label, value, accent, delay }: {
  icon: React.ReactNode; label: string; value: string; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ delay, duration:0.45, ease:"easeOut" }}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
      style={{ background:"rgba(255,255,255,0.80)", backdropFilter:"blur(8px)",
               border:"1px solid rgba(0,0,0,0.07)", boxShadow:"0 2px 10px rgba(0,0,0,0.07)" }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background:accent+"18", color:accent }}>{icon}</div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color:"#64748b" }}>{label}</div>
        <div className="text-[13px] font-bold" style={{ color:"#0f172a" }}>{value}</div>
      </div>
    </motion.div>
  );
}

// ─── Auth sub-components ──────────────────────────────────────────────────
function Avatar({ firstName, lastName, role, sm }: { firstName:string; lastName:string; role:string; sm?:boolean }) {
  const m = ROLE_META[role] ?? ROLE_META.admin;
  return (
    <div className={`${sm?"w-7 h-7 text-[11px]":"w-9 h-9 text-[13px]"} rounded-full flex items-center justify-center font-black flex-shrink-0`}
      style={{ backgroundColor:m.bg, color:m.color, border:`1.5px solid ${m.color}50` }}>
      {firstName[0]}{lastName[0]}
    </div>
  );
}

function RoleBadge({ role }: { role:string }) {
  const m = ROLE_META[role] ?? ROLE_META.admin;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
      style={{ backgroundColor:`${m.color}15`, color:m.color, border:`1px solid ${m.color}30` }}>
      {m.label}
    </span>
  );
}

// ── Tenant meta (step-1 company cards) ───────────────────────────────────────
const TENANT_META: Record<string, { plan: string; color: string; suspended: boolean }> = {
  "Northwind Logistics": { plan: "Enterprise", color: "#1d4ed8", suspended: false },
  "Acme Corp":           { plan: "Core",       color: "#0d9488", suspended: false },
  "Riverton Freight":    { plan: "Core",       color: "#dc2626", suspended: true  },
};
const COMPANIES = Object.keys(TENANT_META);

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepDots({ step }: { step: 1|2|3 }) {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {([1,2,3] as const).map(n => (
        <div key={n} className="rounded-full transition-all duration-300" style={{
          width: n === step ? 24 : 16, height: 6,
          background: n < step ? "#22c55e" : n === step ? "#1d4ed8" : "#e2e8f0",
        }}/>
      ))}
      <span className="ml-1 text-[10px] font-medium" style={{ color:"#94a3b8" }}>Step {step} / 3</span>
    </div>
  );
}

// ─── Login Page ────────────────────────────────────────────────────────────
const KPIs = [
  { icon:<Activity className="w-3.5 h-3.5"/>, label:"Active Yard Moves", value:"24 in progress", accent:"#1d4ed8", delay:0.55 },
  { icon:<Layers className="w-3.5 h-3.5"/>,   label:"Dock Utilization",  value:"6 of 8 doors occupied", accent:"#0d9488", delay:0.70 },
  { icon:<GitMerge className="w-3.5 h-3.5"/>, label:"Gate-to-Gate Rate", value:"96.2% on-time · today", accent:"#d97706", delay:0.85 },
];

const LEGEND = [
  ["#fbbf24","Occupied"], ["#93c5fd","Loading"], ["#6ee7b7","Ready Out"],
  ["#fda4af","On Hold"],  ["#d1d9e3","Empty"],
];

const TRUCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

interface LoginPageProps { onLogin: (userId:string, role:string)=>void; }

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [step, setStep]               = useState<1|2|3>(1);
  const [company, setCompany]         = useState<string|null>(null);
  const [selected, setSelected]       = useState<DemoUser|null>(null);
  const [password, setPassword]       = useState("12345");
  const [showPw, setShowPw]           = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [pwFocus, setPwFocus]         = useState(false);
  const [platformMode, setPlatformMode] = useState(false);
  const [manualUser, setManualUser]   = useState("");
  const [userFocus, setUserFocus]     = useState(false);

  const companyUsers = company ? DEMO_USERS.filter(u => u.tenant === company) : [];

  const goBack = () => {
    setError("");
    if (platformMode) { setPlatformMode(false); setManualUser(""); return; }
    if (step === 3) setStep(2);
    else if (step === 2) { setStep(1); setSelected(null); }
  };

  const handleSelectCompany = (c: string) => { setCompany(c); setSelected(null); setError(""); setStep(2); };
  const handleSelectUser    = (u: DemoUser) => { setSelected(u); setError(""); setStep(3); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (platformMode && !manualUser.trim()) { setError("Enter your platform admin username."); return; }
    setLoading(true); setError("");
    try {
      const res = await apiRequest("POST", "/api/auth/login", {
        userId: platformMode ? manualUser.trim() : selected!.id,
        password,
      });
      const data = await res.json();
      storeCurrentRole(data.role);
      onLogin(data.userId, data.role);
    } catch (err: any) {
      // err.message is like "401: {"error":"User not found"}" — parse it nicely
      const raw = (err.message ?? "").replace(/^\d+:\s*/, "");
      let friendly = raw;
      try { friendly = JSON.parse(raw)?.error ?? raw; } catch {}
      setError(friendly || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const heading = platformMode
    ? "Platform Admin Access"
    : step === 1 ? "Sign In to Your Yard"
    : step === 2 ? (company ?? "Select Profile")
    : "Enter Credential";

  const subheading = platformMode
    ? "KSAP internal administration portal"
    : step === 1 ? "Select your organisation to begin"
    : step === 2 ? "Choose your operator profile"
    : `${selected!.firstName} ${selected!.lastName} · ${company}`;

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background:"#f0f4f8" }}>

      {/* ── Left: Live Yard Scene ──────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden">
        <YardCanvas />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background:"linear-gradient(to right, transparent 72%, #f0f4f8 100%)" }}/>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background:"linear-gradient(to bottom, rgba(240,244,248,0.5) 0%, transparent 15%, transparent 82%, rgba(240,244,248,0.6) 100%)" }}/>
        <div className="relative z-10 flex flex-col justify-between h-full p-10 pointer-events-none">
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:0.45, delay:0.1 }} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background:"linear-gradient(135deg,#1e3a8a,#1d4ed8)", boxShadow:"0 4px 14px rgba(29,78,216,0.35)" }}>
                {TRUCK_ICON}
              </div>
              <div>
                <div className="text-sm font-black tracking-tight" style={{ color:"#0f172a" }}>
                  YMS<span style={{ color:"#1d4ed8" }}>NOW</span>
                </div>
                <div className="text-[9px] font-semibold uppercase tracking-widest" style={{ color:"#94a3b8" }}>
                  Yard Intelligence Platform
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background:"rgba(255,255,255,0.85)", border:"1px solid rgba(22,163,74,0.25)", boxShadow:"0 1px 6px rgba(0,0,0,0.07)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color:"#15803d" }}>Live</span>
            </div>
          </motion.div>
          <div className="max-w-sm">
            <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.3, duration:0.55, ease:"easeOut" }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color:"#1d4ed8" }}>
                Gate-to-Gate Operations Control
              </div>
              <h1 className="text-[28px] font-black leading-tight mb-3" style={{ color:"#0f172a" }}>
                Yard Orchestration,<br/>
                <span style={{ color:"#1d4ed8" }}>Precisely Coordinated.</span>
              </h1>
              <p className="text-[13px] leading-relaxed" style={{ color:"#64748b" }}>
                Real-time trailer tracking, dock scheduling, and fleet move coordination — unified across your entire yard.
              </p>
            </motion.div>
            <div className="mt-6 grid gap-2.5">
              {KPIs.map(k => <KPIChip key={k.label} {...k}/>)}
            </div>
          </div>
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.1, duration:0.45 }}>
            <div className="flex items-center gap-4 mb-2">
              {LEGEND.map(([color,label]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background:color }}/>
                  <span className="text-[10px] font-medium" style={{ color:"#64748b" }}>{label}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px]" style={{ color:"#94a3b8" }}>
              Live yard simulation · 847 moves coordinated today · 3 tractors active
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Right: Login Panel ─────────────────────────────── */}
      <div className="w-full lg:w-[420px] flex-shrink-0 flex flex-col"
        style={{ background:"#ffffff", borderLeft:"1px solid #e2e8f0", boxShadow:"-4px 0 28px rgba(0,0,0,0.07)" }}>

        <div className="h-0.5 w-full" style={{ background:"linear-gradient(90deg,#1d4ed8,#0d9488)" }}/>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 px-8 pt-8">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background:"linear-gradient(135deg,#1e3a8a,#1d4ed8)" }}>{TRUCK_ICON}</div>
          <div className="text-base font-black" style={{ color:"#0f172a" }}>YMS<span style={{ color:"#1d4ed8" }}>NOW</span></div>
        </div>

        <div className="flex-1 flex items-center justify-center px-8 py-10">
          <motion.div initial={{ opacity:0, x:14 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:0.4, ease:"easeOut" }} className="w-full max-w-[340px]">

            {/* Back link */}
            <AnimatePresence>
              {(step > 1 || platformMode) && (
                <motion.button key="back" type="button" onClick={goBack}
                  initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0 }}
                  transition={{ duration:0.15 }}
                  className="flex items-center gap-1 mb-4 text-[11px] font-semibold"
                  style={{ color:"#1d4ed8" }}>
                  <ChevronLeft className="w-3.5 h-3.5"/> Back
                </motion.button>
              )}
            </AnimatePresence>

            {/* Step dots (operator flow only) */}
            {!platformMode && <StepDots step={step} />}

            {/* Heading */}
            <div className="mb-6">
              {platformMode && (
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background:"#1e3a8a" }}>
                    <Shield className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color:"#1e3a8a" }}>KSAP Platform</span>
                </div>
              )}
              <h2 className="text-[20px] font-black mb-1" style={{ color:"#0f172a" }}>{heading}</h2>
              <p className="text-[12px] leading-snug" style={{ color:"#94a3b8" }}>{subheading}</p>
            </div>

            <AnimatePresence mode="wait">

              {/* ── Step 1: Company ───────────────────────────── */}
              {!platformMode && step === 1 && (
                <motion.div key="step1"
                  initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-18 }}
                  transition={{ duration:0.18 }} className="space-y-2.5">
                  {COMPANIES.map(c => {
                    const meta = TENANT_META[c];
                    const count = DEMO_USERS.filter(u => u.tenant === c).length;
                    return (
                      <button key={c} type="button" onClick={() => handleSelectCompany(c)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all focus:outline-none"
                        style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0" }}
                        onMouseEnter={e => { const el = e.currentTarget; el.style.border=`1.5px solid ${meta.color}`; el.style.boxShadow=`0 0 0 3px ${meta.color}18`; el.style.background="#fff"; }}
                        onMouseLeave={e => { const el = e.currentTarget; el.style.border="1.5px solid #e2e8f0"; el.style.boxShadow="none"; el.style.background="#f8fafc"; }}
                      >
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background:`${meta.color}15` }}>
                          <Building2 className="w-4 h-4" style={{ color:meta.color }}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold truncate" style={{ color:"#0f172a" }}>{c}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                            <span className="font-bold" style={{ color:meta.color }}>{meta.plan}</span>
                            <span style={{ color:"#cbd5e1" }}>·</span>
                            <span style={{ color:"#94a3b8" }}>{count} operator{count !== 1 ? "s" : ""}</span>
                            {meta.suspended && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                                style={{ background:"#fee2e2", color:"#dc2626" }}>Suspended</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color:"#cbd5e1" }}/>
                      </button>
                    );
                  })}
                  <div className="pt-1 text-center">
                    <button type="button"
                      onClick={() => { setPlatformMode(true); setManualUser("ksap-admin"); setPassword("12345"); setError(""); }}
                      className="text-[10px]" style={{ color:"#94a3b8" }}>
                      Platform admin?{" "}
                      <span className="font-semibold underline" style={{ color:"#1d4ed8" }}>Sign in here</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: User ──────────────────────────────── */}
              {!platformMode && step === 2 && (
                <motion.div key="step2"
                  initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-18 }}
                  transition={{ duration:0.18 }} className="space-y-1.5">
                  {companyUsers.map(u => (
                    <button key={u.id} type="button" onClick={() => handleSelectUser(u)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all focus:outline-none"
                      style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0" }}
                      onMouseEnter={e => { const el = e.currentTarget; el.style.border="1.5px solid #1d4ed8"; el.style.boxShadow="0 0 0 3px rgba(29,78,216,0.08)"; el.style.background="#fff"; }}
                      onMouseLeave={e => { const el = e.currentTarget; el.style.border="1.5px solid #e2e8f0"; el.style.boxShadow="none"; el.style.background="#f8fafc"; }}
                    >
                      <Avatar firstName={u.firstName} lastName={u.lastName} role={u.role}/>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color:"#0f172a" }}>{u.firstName} {u.lastName}</div>
                        <div className="text-[10px] truncate" style={{ color:"#94a3b8" }}>{u.email}</div>
                      </div>
                      <RoleBadge role={u.role}/>
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 ml-1" style={{ color:"#cbd5e1" }}/>
                    </button>
                  ))}
                </motion.div>
              )}

              {/* ── Step 3 / Platform mode: Password ─────────── */}
              {(step === 3 || platformMode) && (
                <motion.div key="step3"
                  initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-18 }}
                  transition={{ duration:0.18 }}>
                  <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Platform admin username */}
                    {platformMode && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:"#475569" }}>
                          Username
                        </label>
                        <input type="text" value={manualUser} autoFocus
                          onChange={e => { setManualUser(e.target.value); setError(""); }}
                          onFocus={() => setUserFocus(true)} onBlur={() => setUserFocus(false)}
                          placeholder="Platform admin username" autoComplete="username"
                          className="w-full px-3 py-2.5 rounded-xl text-[13px] focus:outline-none transition-all"
                          style={{
                            background: userFocus ? "#f0f7ff" : "#f8fafc",
                            border: `1.5px solid ${error ? "#f87171" : userFocus ? "#1d4ed8" : "#e2e8f0"}`,
                            color:"#0f172a",
                            boxShadow: userFocus ? "0 0 0 3px rgba(29,78,216,0.10)" : "none",
                          }}/>
                      </div>
                    )}

                    {/* Selected user summary */}
                    {!platformMode && selected && (
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                        style={{ background:"#f0f7ff", border:"1px solid #bfdbfe" }}>
                        <Avatar firstName={selected.firstName} lastName={selected.lastName} role={selected.role}/>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold truncate" style={{ color:"#0f172a" }}>{selected.firstName} {selected.lastName}</div>
                          <div className="text-[10px] truncate" style={{ color:"#64748b" }}>{company}</div>
                        </div>
                        <RoleBadge role={selected.role}/>
                      </div>
                    )}

                    {/* Password */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color:"#475569" }}>
                        Password
                      </label>
                      <div className="relative">
                        <input type={showPw ? "text" : "password"} value={password}
                          autoComplete="current-password" autoFocus={!platformMode}
                          onChange={e => { setPassword(e.target.value); setError(""); }}
                          onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)}
                          className="w-full px-3 py-2.5 rounded-xl text-[13px] pr-10 focus:outline-none transition-all"
                          style={{
                            background: pwFocus ? "#f0f7ff" : "#f8fafc",
                            border: `1.5px solid ${error ? "#f87171" : pwFocus ? "#1d4ed8" : "#e2e8f0"}`,
                            color:"#0f172a",
                            boxShadow: pwFocus ? "0 0 0 3px rgba(29,78,216,0.10)" : error ? "0 0 0 3px rgba(248,113,113,0.10)" : "none",
                          }}/>
                        <button type="button" onClick={() => setShowPw(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color:"#94a3b8" }}>
                          {showPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                      </div>
                      <AnimatePresence>
                        {error && (
                          <motion.p initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                            className="flex items-center gap-1.5 mt-1.5 text-[11px] text-red-500 overflow-hidden">
                            <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0 inline-block"/>
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <motion.button type="submit" disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.01 }} whileTap={{ scale: loading ? 1 : 0.99 }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white mt-1"
                      style={{
                        background: loading ? "#93c5fd" : "linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 60%,#2563eb 100%)",
                        boxShadow: loading ? "none" : "0 4px 18px rgba(29,78,216,0.30)",
                      }}>
                      {loading ? (
                        <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>Authenticating…</>
                      ) : (
                        <><LogIn className="w-4 h-4"/>Access Operations Portal</>
                      )}
                    </motion.button>
                  </form>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-6">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-4"
            style={{ background:"#f8fafc", border:"1px solid #e2e8f0" }}>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color:"#16a34a" }}>
                System Operational
              </span>
            </div>
            <span className="text-[10px]" style={{ color:"#94a3b8" }}>All services live</span>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color:"#cbd5e1" }}/>
            <p className="text-[10px] leading-relaxed" style={{ color:"#94a3b8" }}>
              Demo environment. All accounts share credential&nbsp;
              <span className="font-mono font-semibold" style={{ color:"#64748b" }}>12345</span>.
              Access is subject to facility security policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
