import { useState, useMemo } from "react";
import { Sparkles, ChevronDown, ChevronUp, Clock, DoorOpen, AlertTriangle, TrendingUp, ChevronsDown } from "lucide-react";
import { AIRecommendationCard } from "@/components/ai-recommendation-card";
import { useProductMode } from "@/lib/product-mode";
import { getAICopy } from "@/lib/ai-copy";
import type { AIRecommendationPayload } from "@/lib/ai-payload";

interface MoveTaskView {
  id: number;
  trailerNumber: string | null;
  visitNumber: string;
  status: string;
  priority: string;
  source: string;
  createdAt: string;
  fromLocationName: string | null;
  toLocationName: string | null;
  fromLocationType: string;
  toLocationType: string;
  moveType: string;
  assignedToName: string | null;
}

function calcAgeMinutes(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 60000;
}

interface RecommendedMove {
  task: MoveTaskView;
  title: string;
  reason: string;
  confidence: number;
  action: string;
  payload: AIRecommendationPayload;
  priorityTag: { label: string; icon: React.ElementType; color: string };
}

function buildRecommendations(tasks: MoveTaskView[]): RecommendedMove[] {
  const unassigned = tasks.filter((t) => t.status === "open" || t.status === "escalated");

  return unassigned
    .map((task): RecommendedMove => {
      const ageMins = calcAgeMinutes(task.createdAt);
      const ageStr =
        ageMins < 60
          ? `${Math.floor(ageMins)}m`
          : `${Math.floor(ageMins / 60)}h ${Math.floor(ageMins % 60)}m`;
      const isDockDep = task.source === "dock_request" || task.toLocationType === "dock";
      const isUrgent = task.priority === "urgent";
      const isHighPriority = task.priority === "high";
      const isEscalated = task.status === "escalated";
      const isAging = ageMins > 60 && !isUrgent;

      let confidence = 70;
      let reason = "Task waiting in unassigned queue.";
      let action = `Assign ${task.trailerNumber || "trailer"} — ${task.fromLocationName || "origin"} → ${task.toLocationName || "destination"}`;
      let expectedImpact = "Reduces queue backlog.";
      let signals: string[] = [
        `Queue status: ${task.status}`,
        `Priority: ${task.priority}`,
        `Age: ${ageStr}`,
        `Source: ${task.source}`,
      ];
      if (task.fromLocationName) signals.push(`From: ${task.fromLocationName}`);
      if (task.toLocationName) signals.push(`To: ${task.toLocationName}`);
      let priorityTag = {
        label: "Normal",
        icon: TrendingUp,
        color: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800",
      };

      if (isEscalated) {
        confidence = 95;
        reason = `Escalated — over 90 min without assignment. SLA breach imminent.`;
        action = `Immediately assign ${task.trailerNumber || "trailer"} to an available jockey`;
        expectedImpact = "Prevents SLA breach. Stops automatic re-escalation.";
        signals = [
          `Status: escalated (>90 min unassigned)`,
          `Age: ${ageStr}`,
          `Priority: ${task.priority}`,
          `Source: ${task.source}`,
        ];
        priorityTag = {
          label: "Escalated",
          icon: AlertTriangle,
          color: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950/40",
        };
      } else if (isUrgent) {
        confidence = 92;
        reason = "Urgent priority — requires immediate jockey assignment.";
        action = `Urgently assign ${task.trailerNumber || "trailer"} to an idle jockey`;
        expectedImpact = "Prevents further operational delay. Urgent moves unblock downstream tasks.";
        signals = [
          `Priority flagged: urgent`,
          `Age: ${ageStr}`,
          `Source: ${task.source}`,
        ];
        priorityTag = {
          label: "Urgent",
          icon: AlertTriangle,
          color: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-950/40",
        };
      } else if (isDockDep) {
        confidence = 87;
        reason = "Dock dependency — a dock door is waiting on this move.";
        action = `Move ${task.trailerNumber || "trailer"} to ${task.toLocationName || "dock"} to unblock the waiting door`;
        expectedImpact = "Unblocks dock door and restores inbound/outbound flow.";
        signals = [
          `Source: ${task.source === "dock_request" ? "dock request" : "manual"}`,
          `Destination type: ${task.toLocationType}`,
          `Age: ${ageStr}`,
          `Priority: ${task.priority}`,
        ];
        priorityTag = {
          label: "Dock Dep.",
          icon: DoorOpen,
          color: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40",
        };
      } else if (isHighPriority) {
        confidence = 82;
        reason = "High priority — should be assigned ahead of the normal queue.";
        action = `Assign ${task.trailerNumber || "trailer"} to next available jockey`;
        expectedImpact = "Maintains throughput and respects supervisor priority flag.";
        signals = [
          `Priority flagged: high`,
          `Age: ${ageStr}`,
          `Source: ${task.source}`,
        ];
        priorityTag = {
          label: "High Pri.",
          icon: TrendingUp,
          color: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40",
        };
      } else if (isAging) {
        confidence = 74;
        reason = `Aging trailer — queued for ${ageStr}. Approaching the 90-min SLA threshold.`;
        action = `Assign ${task.trailerNumber || "trailer"} before the 90-min SLA triggers auto-escalation`;
        expectedImpact = "Prevents automatic escalation and keeps the queue clean.";
        signals = [
          `Age: ${ageStr} (SLA threshold: 90 min)`,
          `Status: ${task.status}`,
          `Priority: ${task.priority}`,
        ];
        priorityTag = {
          label: "Aging",
          icon: Clock,
          color: "text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-950/40",
        };
      } else {
        confidence = 65;
        reason = "Standard queue move awaiting assignment.";
        expectedImpact = "Keeps the queue moving and prevents future backlogs.";
      }

      return {
        task,
        title: `Move ${task.trailerNumber || task.visitNumber}`,
        reason,
        confidence,
        action,
        priorityTag,
        payload: {
          title: `Move ${task.trailerNumber || task.visitNumber}`,
          reason,
          signals,
          confidence,
          expectedImpact,
          suggestedAction: action,
        },
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

interface MovesAssistPanelProps {
  allTasks: MoveTaskView[];
  onAssignTask?: (taskId: number) => void;
}

const DEFAULT_VISIBLE = 2;

export function MovesAssistPanel({ allTasks, onAssignTask }: MovesAssistPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const { mode } = useProductMode();
  const copy = getAICopy(mode);

  const recommendations = useMemo(() => buildRecommendations(allTasks), [allTasks]);
  const visible = recommendations.filter((r) => !dismissed.has(r.task.id));
  const shown = showAll ? visible : visible.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = visible.length - shown.length;

  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/30 dark:border-violet-800 dark:bg-violet-950/15 overflow-hidden mb-3">
      <button
        onClick={() => setExpanded((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-violet-50/50 dark:hover:bg-violet-950/30 transition-colors"
        data-testid="assist-moves-toggle"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[12px] font-semibold text-violet-800 dark:text-violet-200">
            {copy.badge}
          </span>
          <span className="text-[10px] bg-violet-200 dark:bg-violet-800 text-violet-700 dark:text-violet-200 rounded-full px-1.5 py-0.5">
            {visible.length}
          </span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-[10px] hidden sm:inline">{copy.reviewNote}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-violet-100 dark:border-violet-900 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shown.map((rec) => {
              const TagIcon = rec.priorityTag.icon;
              return (
                <div key={rec.task.id} className="flex flex-col gap-1.5">
                  <div
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit ${rec.priorityTag.color}`}
                  >
                    <TagIcon className="h-3 w-3" />
                    {rec.priorityTag.label}
                  </div>
                  <AIRecommendationCard
                    title={rec.title}
                    reason={rec.reason}
                    confidence={rec.confidence}
                    action={rec.action}
                    payload={rec.payload}
                    onAccept={() => onAssignTask?.(rec.task.id)}
                    onDismiss={() => setDismissed((prev) => new Set(prev).add(rec.task.id))}
                    acceptLabel="Assign"
                    className="flex-1"
                  />
                </div>
              );
            })}
          </div>

          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-3 flex items-center gap-1 text-[11px] text-violet-700 dark:text-violet-300 hover:underline"
              data-testid="assist-moves-show-more"
            >
              <ChevronsDown className="h-3.5 w-3.5" />
              Show {hiddenCount} more suggestion{hiddenCount > 1 ? "s" : ""}
            </button>
          )}
          {showAll && visible.length > DEFAULT_VISIBLE && (
            <button
              onClick={() => setShowAll(false)}
              className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground hover:underline"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Show fewer
            </button>
          )}

          <p className="text-[10px] text-muted-foreground mt-3">
            {copy.source} based on task age, priority, and source. Manual assignment controls remain unchanged.
          </p>
        </div>
      )}
    </div>
  );
}
