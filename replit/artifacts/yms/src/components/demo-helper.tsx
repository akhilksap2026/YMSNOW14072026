import { useState, useEffect } from "react";
import { X, CheckCircle2, Sparkles, Zap, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProductMode } from "@/lib/product-mode";
import type { ProductMode } from "@/lib/product-mode";

const STORAGE_KEY = "ymsnow_demo_helper_dismissed";

function getDismissed(): Set<ProductMode> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as ProductMode[]);
  } catch {
    return new Set();
  }
}

function setDismissed(mode: ProductMode) {
  const existing = getDismissed();
  existing.add(mode);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
}

interface ModeConfig {
  icon: React.ElementType;
  iconClass: string;
  borderClass: string;
  badgeClass: string;
  badgeLabel: string;
  heading: string;
  subtext: string;
  bullets: string[];
}

const MODE_CONFIG: Record<ProductMode, ModeConfig> = {
  core: {
    icon: LayoutDashboard,
    iconClass: "text-slate-600 dark:text-slate-400",
    borderClass: "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    badgeLabel: "Core Mode",
    heading: "Core yard operations — full manual control",
    subtext:
      "Every workflow is manual and explicit. Gate, dock, moves, appointments, and exceptions are all accessible without any AI involvement.",
    bullets: [
      "Real-time yard visibility across gate, dock, and inventory",
      "Manual dispatch, scheduling, and exception resolution",
      "Complete audit trail — no AI dependencies",
    ],
  },
  elevate: {
    icon: Sparkles,
    iconClass: "text-violet-600 dark:text-violet-400",
    borderClass: "border-violet-200 dark:border-violet-800/40 bg-violet-50/50 dark:bg-violet-950/20",
    badgeClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    badgeLabel: "Elevate Mode",
    heading: "AI recommendations reduce manual decision load",
    subtext:
      "The system surfaces suggestions for moves, exceptions, and appointments. Each recommendation is reviewable before acting — you stay in control.",
    bullets: [
      "AI-suggested move priorities on the Yard Moves page",
      "Appointment conflict detection and slot suggestions",
      "Exception cause analysis with suggested next actions",
    ],
  },
  enhanced: {
    icon: Zap,
    iconClass: "text-blue-600 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    badgeLabel: "Enhanced Mode",
    heading: "Proactive orchestration — bottlenecks caught before they compound",
    subtext:
      "The system detects operational risks in real time, recommends the single most impactful next action, and surfaces dwell and scheduling threats early.",
    bullets: [
      "Predicted bottleneck and dwell-risk alerts on the dashboard",
      "Recommended next moves ranked by urgency and dock dependency",
      "Single 'Next Best Action' updated as yard conditions change",
    ],
  },
};

export function DemoHelper() {
  const { mode } = useProductMode();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = getDismissed();
    setVisible(!dismissed.has(mode));
  }, [mode]);

  function dismiss() {
    setDismissed(mode);
    setVisible(false);
  }

  if (!visible) return null;

  const cfg = MODE_CONFIG[mode];
  const Icon = cfg.icon;

  return (
    <div
      className={`rounded-lg border px-4 py-3.5 ${cfg.borderClass} relative`}
      data-testid="demo-helper"
    >
      <button
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors"
        aria-label="Dismiss guide"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="shrink-0 mt-0.5">
          <Icon className={`h-4 w-4 ${cfg.iconClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.badgeClass}`}>
              {cfg.badgeLabel}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug mb-1">
            {cfg.heading}
          </p>
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-2">
            {cfg.subtext}
          </p>
          <ul className="space-y-1">
            {cfg.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5 text-emerald-500" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-current/5 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/60 italic">
          Switch modes using the selector in the top bar — manual workflows remain available in all modes.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismiss}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
