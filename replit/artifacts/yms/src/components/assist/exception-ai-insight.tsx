import { useState } from "react";
import { Sparkles, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIExplainabilityDrawer } from "@/components/assist/ai-explainability-drawer";
import { useProductMode } from "@/lib/product-mode";
import { getAICopy } from "@/lib/ai-copy";
import type { AIRecommendationPayload } from "@/lib/ai-payload";

interface ExceptionView {
  id: number;
  type: string;
  severity: string;
  description: string | null;
  createdAt: string;
  assignedTo: string | null;
}

function buildPayload(ex: ExceptionView): AIRecommendationPayload {
  const ageMins = (Date.now() - new Date(ex.createdAt).getTime()) / 60000;
  const ageStr =
    ageMins < 60
      ? `${Math.floor(ageMins)}m`
      : `${Math.floor(ageMins / 60)}h ${Math.floor(ageMins % 60)}m`;

  const signals = [
    `Exception type: ${ex.type.replace(/_/g, " ")}`,
    `Severity: ${ex.severity}`,
    `Open for: ${ageStr}`,
    ex.assignedTo ? "Assigned to team member" : "Currently unassigned",
  ];
  if (ex.description) signals.push(`Description: ${ex.description.slice(0, 60)}${ex.description.length > 60 ? "…" : ""}`);

  switch (ex.type) {
    case "seal_mismatch":
      return {
        title: "Seal Mismatch Detected",
        reason: `Trailer seal does not match the documentation on file. Flagged ${ageStr} ago.`,
        signals,
        confidence: 83,
        expectedImpact: "Hold blocks gate checkout and dock assignment until resolved.",
        suggestedAction: "Request physical recheck of seal vs. BOL. Notify the carrier immediately.",
      };
    case "damage_hold":
      return {
        title: "Damage Hold Active",
        reason: `Physical damage was detected on arrival. Hold has been active for ${ageStr}.`,
        signals,
        confidence: 88,
        expectedImpact: "Trailer cannot be moved or released until damage is assessed and documented.",
        suggestedAction: "Schedule a damage inspection. Notify the carrier's claims department.",
      };
    case "documentation_hold":
      return {
        title: "Documentation Hold",
        reason: `Required documents are incomplete or missing. Hold open for ${ageStr}.`,
        signals,
        confidence: 79,
        expectedImpact: "Trailer blocked from gate checkout until documentation is complete.",
        suggestedAction: "Contact carrier to supply missing documents before clearance.",
      };
    case "security_hold":
      return {
        title: "Security Hold",
        reason: `A security flag was raised. Trailer is under hold for ${ageStr}.`,
        signals,
        confidence: 91,
        expectedImpact: "Trailer and load must not be released or moved until security clears the hold.",
        suggestedAction: "Escalate to the security team immediately. Do not release without written clearance.",
      };
    case "customs_hold":
      return {
        title: "Customs Clearance Pending",
        reason: `Customs clearance is pending. Hold active for ${ageStr}.`,
        signals,
        confidence: 85,
        expectedImpact: "Trailer blocked from domestic movement until customs releases the hold.",
        suggestedAction: "Verify customs broker status. Update the exception once clearance is confirmed.",
      };
    case "manual_modification":
      return {
        title: "Manual Data Modification Flagged",
        reason: `A manual record modification was flagged ${ageStr} ago.`,
        signals,
        confidence: 68,
        expectedImpact: "Data integrity may be affected if the modification was unauthorized.",
        suggestedAction: ex.assignedTo
          ? "Follow up with the assigned operator to confirm the change was intentional."
          : "Assign to a supervisor for review and approval.",
      };
    default:
      return {
        title: "Exception Flagged",
        reason: ex.description
          ? ex.description.slice(0, 120)
          : `An exception has been open for ${ageStr} without resolution.`,
        signals,
        confidence: 55,
        expectedImpact: "Hold may be blocking trailer movement or gate checkout.",
        suggestedAction: ex.assignedTo
          ? "Follow up with the assigned team member."
          : "Assign to a responsible party for investigation.",
      };
  }
}

function causeTag(type: string): { label: string; color: string } {
  switch (type) {
    case "seal_mismatch":      return { label: "DOC · Driver", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300" };
    case "damage_hold":        return { label: "DMG · Transit", color: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" };
    case "documentation_hold": return { label: "DOC · Carrier", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300" };
    case "security_hold":      return { label: "SEC · Compliance", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300" };
    case "customs_hold":       return { label: "CST · Customs", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" };
    case "manual_modification": return { label: "OPS · Manual", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" };
    default:                   return { label: "UNK", color: "bg-muted text-muted-foreground" };
  }
}

interface ExceptionAIInsightProps {
  exception: ExceptionView;
}

export function ExceptionAIInsight({ exception }: ExceptionAIInsightProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { mode } = useProductMode();
  const copy = getAICopy(mode);
  const tag = causeTag(exception.type);
  const payload = buildPayload(exception);

  return (
    <>
      <div
        className="mt-2 flex items-center gap-2 flex-wrap"
        data-testid={`ai-insight-${exception.id}`}
      >
        <Sparkles className="h-3 w-3 text-violet-400 shrink-0" />
        <span className="text-[10px] text-muted-foreground">{copy.source}:</span>
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${tag.color}`}
        >
          {tag.label}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDrawerOpen(true)}
          className="h-5 px-1.5 text-[10px] text-violet-600 dark:text-violet-400 hover:text-violet-800 gap-0.5"
          data-testid={`ai-insight-why-${exception.id}`}
        >
          <HelpCircle className="h-3 w-3" />
          View insight
        </Button>
      </div>

      <AIExplainabilityDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        payload={payload}
      />
    </>
  );
}
