import { Sparkles, Info, Zap, ShieldCheck } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useProductMode } from "@/lib/product-mode";
import { getAICopy } from "@/lib/ai-copy";
import type { AIRecommendationPayload } from "@/lib/ai-payload";

function ConfidenceBar({ value, label }: { value: number; label: string }) {
  const color =
    value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-400" : "bg-slate-400";
  const textColor =
    value >= 80
      ? "text-emerald-700 dark:text-emerald-400"
      : value >= 60
      ? "text-amber-700 dark:text-amber-400"
      : "text-slate-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span className={`text-sm font-bold tabular-nums ${textColor}`}>{value}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

interface AIExplainabilityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: AIRecommendationPayload | null;
}

export function AIExplainabilityDrawer({
  open,
  onOpenChange,
  payload,
}: AIExplainabilityDrawerProps) {
  const { mode } = useProductMode();
  const copy = getAICopy(mode);

  if (!payload) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] overflow-y-auto"
        data-testid="ai-explainability-drawer"
      >
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/40">
              <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
              {copy.badge}
            </span>
          </div>
          <SheetTitle className="text-base leading-snug">{payload.title}</SheetTitle>
          <SheetDescription className="text-[12px] leading-relaxed">
            {copy.drawerTitle} — {copy.reviewNote}
          </SheetDescription>
        </SheetHeader>

        <div className="py-5 space-y-5">
          {/* Reason */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Reason
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{payload.reason}</p>
          </div>

          {/* Signals */}
          {payload.signals.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Relevant Signals
                </span>
              </div>
              <ul className="space-y-1.5">
                {payload.signals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                    <span className="text-muted-foreground">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Confidence */}
          <ConfidenceBar value={payload.confidence} label={copy.confidenceLabel} />

          {/* Expected impact */}
          <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 px-3.5 py-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                Expected Impact
              </span>
            </div>
            <p className="text-sm text-violet-900 dark:text-violet-200 leading-snug">
              {payload.expectedImpact}
            </p>
          </div>

          {/* Suggested action */}
          <div className="rounded-lg border bg-muted/40 px-3.5 py-3 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Suggested Action
            </span>
            <p className="text-sm font-medium leading-snug">{payload.suggestedAction}</p>
          </div>

          {/* Override reminder */}
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-3 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-[12px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
              {payload.overrideNote || copy.overrideReminder}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
