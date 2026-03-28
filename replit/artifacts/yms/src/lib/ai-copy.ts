import type { ProductMode } from "@/lib/product-mode";

interface AICopy {
  badge: string;
  source: string;
  reviewNote: string;
  confidenceLabel: string;
  riskLabel: string;
  drawerTitle: string;
  overrideReminder: string;
}

export function getAICopy(mode: ProductMode): AICopy {
  if (mode === "optimize") {
    return {
      badge: "Optimization Insight",
      source: "Predicted by AI",
      reviewNote: "Predicted impact — verify before acting",
      confidenceLabel: "Predicted confidence",
      riskLabel: "Predicted risk",
      drawerTitle: "Optimization Insight",
      overrideReminder:
        "This prediction is based on historical patterns. You can override it at any time using the manual controls.",
    };
  }
  return {
    badge: "Suggested by AI",
    source: "Suggested by AI",
    reviewNote: "Review before applying",
    confidenceLabel: "Confidence",
    riskLabel: "Flagged issue",
    drawerTitle: "AI Suggestion Details",
    overrideReminder:
      "This is a suggestion only. All manual controls remain available and take priority. You are always in control.",
  };
}
