import React, { createContext, useContext, useState, useCallback } from "react";

export type ProductMode = "core" | "elevate" | "enhanced";

const STORAGE_KEY = "ymsnow_product_mode";
const DEFAULT_MODE: ProductMode = "core";

function readMode(): ProductMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "core" || stored === "elevate" || stored === "enhanced") {
    return stored;
  }
  return DEFAULT_MODE;
}

interface ProductModeContextValue {
  mode: ProductMode;
  setMode: (mode: ProductMode) => void;
}

const ProductModeContext = createContext<ProductModeContextValue>({
  mode: DEFAULT_MODE,
  setMode: () => {},
});

export function ProductModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ProductMode>(readMode);

  const setMode = useCallback((next: ProductMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  return (
    <ProductModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ProductModeContext.Provider>
  );
}

export function useProductMode() {
  return useContext(ProductModeContext);
}

export function isStandardMode(mode: ProductMode): boolean {
  return mode === "core";
}

export function isAssistMode(mode: ProductMode): boolean {
  return mode === "elevate";
}

export function isOptimizeMode(mode: ProductMode): boolean {
  return mode === "enhanced";
}

export function showAIRecommendations(mode: ProductMode): boolean {
  return mode === "elevate" || mode === "enhanced";
}

export function showPredictivePanels(mode: ProductMode): boolean {
  return mode === "elevate" || mode === "enhanced";
}

export function showOptimizationWidgets(mode: ProductMode): boolean {
  return mode === "enhanced";
}

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
