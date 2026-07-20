/**
 * Client-side entitlement layer.
 *
 * Fetches /api/me/entitlements (30 s stale-time, deduped by TanStack Query)
 * and exposes:
 *   - EntitlementsProvider / useEntitlements()  – context + hook
 *   - moduleEnabled(map, code)                  – boolean helper
 *   - <Gated module="...">children</Gated>      – conditional render wrapper
 *
 * While the map is still loading (empty object), moduleEnabled returns true
 * so nothing flashes as "locked" during the initial fetch.
 * The 403 enforcement from the API server (Prompt 1.3) remains the real boundary.
 */
import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ModuleEntitlement {
  enabled: boolean;
  limits?: Record<string, unknown> | null;
}
export type EntitlementMap = Record<string, ModuleEntitlement>;

interface EntitlementsContextValue {
  entitlements: EntitlementMap;
  isLoading: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────
const EntitlementsContext = createContext<EntitlementsContextValue>({
  entitlements: {},
  isLoading: true,
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery<EntitlementMap>({
    queryKey: ["/api/me/entitlements"],
    staleTime: 30_000,
    retry: false,
  });

  return (
    <EntitlementsContext.Provider value={{ entitlements: data ?? {}, isLoading }}>
      {children}
    </EntitlementsContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useEntitlements(): EntitlementsContextValue {
  return useContext(EntitlementsContext);
}

// ── Helper ────────────────────────────────────────────────────────────────────
/**
 * Returns true when the module is enabled.
 * While the map is empty (still loading), returns true to avoid locking the UI
 * before the server responds.
 */
export function moduleEnabled(entitlements: EntitlementMap, moduleCode: string): boolean {
  if (Object.keys(entitlements).length === 0) return true; // loading — assume ok
  return entitlements[moduleCode]?.enabled === true;
}

// ── Gated wrapper ─────────────────────────────────────────────────────────────
/**
 * Renders children only when the named module is enabled for this tenant.
 * Renders `fallback` (default: nothing) otherwise.
 *
 * @example
 *   <Gated module="ai_copilot" fallback={<LockedBanner />}>
 *     <AICopilotPanel />
 *   </Gated>
 */
export function Gated({
  module: moduleCode,
  fallback = null,
  children,
}: {
  module: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  const { entitlements } = useEntitlements();
  if (!moduleEnabled(entitlements, moduleCode)) return <>{fallback}</>;
  return <>{children}</>;
}
