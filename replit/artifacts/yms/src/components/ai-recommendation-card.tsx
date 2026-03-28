import { useState } from "react";
import { Sparkles, CheckCircle2, X, HelpCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AIRecommendationCardProps {
  title: string;
  reason: string;
  confidence: number;
  action: string;
  onAccept: () => void;
  onDismiss: () => void;
  onWhy?: () => void;
  whyText?: string;
  variant?: "default" | "compact";
  className?: string;
  acceptLabel?: string;
  disabled?: boolean;
}

function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-400" : "bg-slate-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
        {value}%
      </span>
    </div>
  );
}

export function AIRecommendationCard({
  title,
  reason,
  confidence,
  action,
  onAccept,
  onDismiss,
  onWhy,
  whyText,
  variant = "default",
  className,
  acceptLabel = "Accept",
  disabled = false,
}: AIRecommendationCardProps) {
  const [whyOpen, setWhyOpen] = useState(false);

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-200 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20",
          className
        )}
        data-testid="ai-rec-card-compact"
      >
        <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{title}</p>
          <p className="text-[10px] text-muted-foreground truncate">{reason}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            data-testid="ai-rec-dismiss"
          >
            <X className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            onClick={onAccept}
            disabled={disabled}
            className="h-6 px-2 text-[11px] bg-violet-600 hover:bg-violet-700 text-white"
            data-testid="ai-rec-accept"
          >
            {acceptLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-violet-200 bg-violet-50/40 dark:border-violet-800 dark:bg-violet-950/20 p-3 space-y-2.5",
        className
      )}
      data-testid="ai-rec-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-px" />
          <span className="text-xs font-semibold text-violet-900 dark:text-violet-200">
            {title}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          data-testid="ai-rec-dismiss"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="text-[12px] text-muted-foreground leading-snug">{reason}</p>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
            Confidence
          </span>
        </div>
        <ConfidenceBar value={confidence} />
      </div>

      <div className="rounded-md bg-violet-100/60 dark:bg-violet-900/20 px-2.5 py-1.5">
        <p className="text-[11px] font-medium text-violet-800 dark:text-violet-300">
          Suggested: {action}
        </p>
      </div>

      {whyText && whyOpen && (
        <div className="rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground leading-relaxed">
          {whyText}
        </div>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        {onWhy && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setWhyOpen((o) => !o);
              onWhy?.();
            }}
            className="h-7 px-2 text-[11px] text-muted-foreground gap-1"
            data-testid="ai-rec-why"
          >
            <HelpCircle className="h-3 w-3" />
            Why this?
            <ChevronDown className={`h-3 w-3 transition-transform ${whyOpen ? "rotate-180" : ""}`} />
          </Button>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={onDismiss}
          className="h-7 px-2 text-[11px]"
          data-testid="ai-rec-dismiss-btn"
        >
          Dismiss
        </Button>
        <Button
          size="sm"
          onClick={onAccept}
          disabled={disabled}
          className="h-7 px-3 text-[11px] bg-violet-600 hover:bg-violet-700 text-white gap-1"
          data-testid="ai-rec-accept-btn"
        >
          <CheckCircle2 className="h-3 w-3" />
          {acceptLabel}
        </Button>
      </div>
    </div>
  );
}
