/**
 * Product mode — Standard / Assist / Optimize.
 *
 * The "ceiling" is now server-derived from the tenant's entitlements:
 *   Enterprise plan  → ceiling "enhanced" (Optimize)
 *   Professional     → ceiling "elevate"  (Assist)
 *   Core             → ceiling "core"     (Standard)
 *
 * On first load with no stored preference, mode defaults to the ceiling
 * (full entitlement). Users may DOWNSHIFT their view; upshifts beyond
 * the ceiling are silently clamped.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EntitlementMap } from "./entitlements";

export type ProductMode = "core" | "elevate" | "enhanced";

const STORAGE_KEY = "ymsnow_product_mode";

// Numeric level used for ceiling comparisons
const MODE_LEVEL: Record<ProductMode, number> = { core: 0, elevate: 1, enhanced: 2 };

function clamp(mode: ProductMode, ceiling: ProductMode): ProductMode {
  return MODE_LEVEL[mode] <= MODE_LEVEL[ceiling] ? mode : ceiling;
}

/** Derive the maximum allowed mode from the tenant's entitlements. */
function deriveCeiling(ents: EntitlementMap | undefined): ProductMode {
  if (!ents || Object.keys(ents).length === 0) return "enhanced"; // still loading → permissive
  if (ents["ai_copilot"]?.enabled) return "enhanced";  // Enterprise
  if (ents["reports"]?.enabled)    return "elevate";   // Professional
  return "core";                                        // Core
}

// ── Context ───────────────────────────────────────────────────────────────────
interface ProductModeContextValue {
  mode: ProductMode;
  /** Maximum mode allowed by the tenant's plan. */
  ceiling: ProductMode;
  setMode: (mode: ProductMode) => void;
}

const ProductModeContext = createContext<ProductModeContextValue>({
  mode: "core",
  ceiling: "core",
  setMode: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function ProductModeProvider({ children }: { children: React.ReactNode }) {
  // Fetch entitlements (deduped — EntitlementsProvider may also fetch the same key)
  const { data: entitlements, isLoading } = useQuery<EntitlementMap>({
    queryKey: ["/api/me/entitlements"],
    staleTime: 30_000,
    retry: false,
  });

  // While loading, use permissive ceiling so stored mode isn't clamped prematurely
  const ceiling = isLoading ? "enhanced" : deriveCeiling(entitlements);

  // Initialize from localStorage or URL param (pre-auth default = "core")
  const [mode, setModeState] = useState<ProductMode>(() => {
    const urlParam = new URLSearchParams(window.location.search).get("mode") as ProductMode | null;
    if (urlParam === "core" || urlParam === "elevate" || urlParam === "enhanced") return urlParam;
    const stored = localStorage.getItem(STORAGE_KEY) as ProductMode | null;
    if (stored === "core" || stored === "elevate" || stored === "enhanced") return stored;
    return "core"; // safe default before entitlements arrive
  });

  // On first entitlement load: set mode to the plan-derived default or clamp
  const initialized = useRef(false);
  useEffect(() => {
    if (isLoading) return;

    if (!initialized.current) {
      initialized.current = true;
      const stored = localStorage.getItem(STORAGE_KEY) as ProductMode | null;
      const hasStoredPref = stored === "core" || stored === "elevate" || stored === "enhanced";
      // If no stored preference, default to the plan ceiling (Optimize for Enterprise, etc.)
      const target = hasStoredPref ? clamp(stored!, ceiling) : ceiling;
      if (target !== mode) {
        setModeState(target);
        localStorage.setItem(STORAGE_KEY, target);
      }
      return;
    }

    // Subsequent refetches — re-clamp if ceiling shrank (e.g. plan downgrade)
    const clamped = clamp(mode, ceiling);
    if (clamped !== mode) {
      setModeState(clamped);
      localStorage.setItem(STORAGE_KEY, clamped);
    }
  }, [isLoading, ceiling]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMode = useCallback(
    (next: ProductMode) => {
      const safe = clamp(next, ceiling);
      localStorage.setItem(STORAGE_KEY, safe);
      setModeState(safe);
    },
    [ceiling],
  );

  // Effective mode is always ≤ ceiling
  const effectiveMode = clamp(mode, ceiling);

  return (
    <ProductModeContext.Provider value={{ mode: effectiveMode, ceiling, setMode }}>
      {children}
    </ProductModeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useProductMode(): ProductModeContextValue {
  return useContext(ProductModeContext);
}

// ── Boolean helpers (unchanged API) ──────────────────────────────────────────
export function isStandardMode(mode: ProductMode): boolean  { return mode === "core"; }
export function isAssistMode(mode: ProductMode): boolean    { return mode === "elevate"; }
export function isOptimizeMode(mode: ProductMode): boolean  { return mode === "enhanced"; }

export function showAIRecommendations(mode: ProductMode): boolean  { return mode === "elevate" || mode === "enhanced"; }
export function showPredictivePanels(mode: ProductMode): boolean   { return mode === "elevate" || mode === "enhanced"; }
export function showOptimizationWidgets(mode: ProductMode): boolean { return mode === "enhanced"; }

// ── Display config ────────────────────────────────────────────────────────────
export const MODE_CONFIG = {
  core: {
    label: "Core",
    description: "Conventional YMS — core operational workflows",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    activeClass: "bg-slate-700 text-white",
  },
  elevate: {
    label: "Elevate",
    description: "AI-assisted YMS — recommendations & alerts",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700",
    activeClass: "bg-violet-600 text-white",
  },
  enhanced: {
    label: "Enhanced",
    description: "AI-enhanced orchestration — predictive & automated",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
    activeClass: "bg-blue-600 text-white",
  },
} as const;
