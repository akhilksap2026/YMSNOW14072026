import { useState } from "react";
import { Sparkles, X, ChevronDown, ChevronUp } from "lucide-react";

interface ExceptionInsight {
  summary: string;
  likelyCause: string;
  likelyCauseTag: string;
  suggestedAction: string;
  confidence: number;
}

function deriveInsight(ex: {
  type: string;
  severity: string;
  description: string | null;
  createdAt: string;
  assignedTo: string | null;
}): ExceptionInsight {
  const ageMins = (Date.now() - new Date(ex.createdAt).getTime()) / 60000;
  const ageStr = ageMins < 60 ? `${Math.floor(ageMins)}m` : `${Math.floor(ageMins / 60)}h ${Math.floor(ageMins % 60)}m`;

  switch (ex.type) {
    case "seal_mismatch":
      return {
        summary: `Trailer seal does not match documentation. Flagged ${ageStr} ago.`,
        likelyCause: "Driver error or transit tamper",
        likelyCauseTag: "DOC · Driver",
        suggestedAction: "Request recheck of physical seal vs. BOL. Notify carrier.",
        confidence: 83,
      };
    case "damage_hold":
      return {
        summary: `Physical damage detected on arrival. Hold active for ${ageStr}.`,
        likelyCause: "Transit damage",
        likelyCauseTag: "DMG · Transit",
        suggestedAction: "Schedule damage inspection. Notify carrier's claims dept.",
        confidence: 88,
      };
    case "documentation_hold":
      return {
        summary: `Required documents incomplete or missing. Hold open ${ageStr}.`,
        likelyCause: "Incomplete carrier paperwork",
        likelyCauseTag: "DOC · Carrier",
        suggestedAction: "Contact carrier to supply missing docs before clearance.",
        confidence: 79,
      };
    case "security_hold":
      return {
        summary: `Security flag raised. Trailer under hold for ${ageStr}.`,
        likelyCause: "Compliance check triggered",
        likelyCauseTag: "SEC · Compliance",
        suggestedAction: "Escalate to security team. Do not release until cleared.",
        confidence: 91,
      };
    case "customs_hold":
      return {
        summary: `Customs clearance pending. Hold active ${ageStr}.`,
        likelyCause: "Cross-border import clearance",
        likelyCauseTag: "CST · Customs",
        suggestedAction: "Verify customs broker status. Update once cleared.",
        confidence: 85,
      };
    case "manual_modification":
      return {
        summary: `Manual data modification flagged ${ageStr} ago.`,
        likelyCause: "Operator correction or override",
        likelyCauseTag: "OPS · Manual",
        suggestedAction: ex.assignedTo ? "Follow up with assigned operator." : "Assign to supervisor for review.",
        confidence: 68,
      };
    default:
      return {
        summary: ex.description
          ? `${ex.description.slice(0, 80)}${ex.description.length > 80 ? "…" : ""}`
          : `Exception open for ${ageStr}.`,
        likelyCause: "Unknown — manual review required",
        likelyCauseTag: "UNK",
        suggestedAction: ex.assignedTo ? "Follow up with assigned team member." : "Assign to responsible party.",
        confidence: 55,
      };
  }
}

interface ExceptionAIInsightProps {
  exception: {
    id: number;
    type: string;
    severity: string;
    description: string | null;
    createdAt: string;
    assignedTo: string | null;
  };
}

export function ExceptionAIInsight({ exception }: ExceptionAIInsightProps) {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);

  if (!visible) return null;

  const insight = deriveInsight(exception);

  const confidenceColor =
    insight.confidence >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : insight.confidence >= 65
      ? "text-amber-600 dark:text-amber-400"
      : "text-slate-500";

  return (
    <div className="mt-2 rounded-md border border-violet-200 bg-violet-50/40 dark:border-violet-800 dark:bg-violet-950/20 px-3 py-2 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          <Sparkles className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-violet-800 dark:text-violet-200 leading-snug">
              {insight.summary}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                {insight.likelyCauseTag}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Likely: {insight.likelyCause}
              </span>
              <span className={`text-[10px] font-medium ${confidenceColor}`}>
                {insight.confidence}% confidence
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setExpanded((o) => !o)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label="Toggle suggested action"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            aria-label="Dismiss AI insight"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="rounded bg-violet-100/60 dark:bg-violet-900/20 px-2 py-1.5">
          <p className="text-[11px] text-violet-800 dark:text-violet-300">
            <span className="font-semibold">Suggested: </span>{insight.suggestedAction}
          </p>
        </div>
      )}
    </div>
  );
}
