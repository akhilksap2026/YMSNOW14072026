/**
 * Platform Admin — Tenant Detail / Module Matrix
 * Rendered by PlatformAdminShell when route is /platform/tenants/:id
 */
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  RefreshCw,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Minus,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type OverrideSource = "plan" | "not-in-plan" | "override-on" | "override-off";
type OverrideMode   = "default" | "on" | "off";

interface ModuleRow {
  code:        string;
  name:        string;
  category:    string;
  description: string | null;
  enabled:     boolean;
  source:      OverrideSource;
  limits:      Record<string, unknown> | null;
  override: {
    enabled:   boolean;
    reason:    string | null;
    expiresAt: string | null;
  } | null;
}

interface SubscriptionInfo {
  subId:            number;
  planId:           number;
  planCode:         string;
  planName:         string;
  status:           string;
  trialEnd:         string | null;
  currentPeriodEnd: string | null;
}

interface PlanInfo { id: number; code: string; name: string; }

interface EntitlementsData {
  tenantId:     string;
  tenantName:   string;
  subscription: SubscriptionInfo | null;
  plans:        PlanInfo[];
  modules:      ModuleRow[];
}

interface LocalOverride { mode: OverrideMode; reason: string; expiresAt: string; }

// ── Source badge ──────────────────────────────────────────────────────────────
const SOURCE_CFG: Record<OverrideSource, { label: string; cls: string }> = {
  "plan":         { label: "PLAN",         cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  "not-in-plan":  { label: "NOT IN PLAN",  cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  "override-on":  { label: "OVERRIDE ON",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  "override-off": { label: "OVERRIDE OFF", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

function SourceBadge({ source }: { source: OverrideSource }) {
  const c = SOURCE_CFG[source];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap ${c.cls}`}>
      {c.label}
    </span>
  );
}

const PLAN_COLORS: Record<string, string> = {
  core:         "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  professional: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  enterprise:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PlatformTenantDetailPage({ tenantId }: { tenantId: string }) {
  const [, navigate] = useLocation();
  const { toast }    = useToast();

  // ── Remote data ────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery<EntitlementsData>({
    queryKey: ["/api/platform/tenants", tenantId, "entitlements"],
    queryFn: () =>
      fetch(`/api/platform/tenants/${tenantId}/entitlements`, { credentials: "include" })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}: ${r.statusText}`);
          return r.json();
        }),
    staleTime: 0,
    retry: false,
  });

  // ── Plan selector state ────────────────────────────────────────────────────
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  useEffect(() => {
    if (data?.subscription?.planId != null) {
      setSelectedPlanId(String(data.subscription.planId));
    }
  }, [data?.subscription?.planId]);

  // ── Override local state ───────────────────────────────────────────────────
  const [localOv, setLocalOv] = useState<Record<string, LocalOverride>>({});
  const [ovDirty, setOvDirty] = useState(false);

  useEffect(() => {
    if (!data?.modules) return;
    const init: Record<string, LocalOverride> = {};
    for (const m of data.modules) {
      init[m.code] = m.override
        ? {
            mode:      m.override.enabled ? "on" : "off",
            reason:    m.override.reason ?? "",
            expiresAt: m.override.expiresAt
              ? new Date(m.override.expiresAt).toISOString().slice(0, 10)
              : "",
          }
        : { mode: "default", reason: "", expiresAt: "" };
    }
    setLocalOv(init);
    setOvDirty(false);
  }, [data]);

  const setOv = (code: string, patch: Partial<LocalOverride>) =>
    setLocalOv((prev) => {
      setOvDirty(true);
      return { ...prev, [code]: { ...(prev[code] ?? { mode: "default", reason: "", expiresAt: "" }), ...patch } };
    });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const subMutation = useMutation({
    mutationFn: (body: { planId?: number; status?: string }) =>
      apiRequest("PUT", `/api/platform/tenants/${tenantId}/subscription`, body).then((r) => r.json()),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/platform/tenants"] });
      toast({ title: "Subscription updated", description: "Entitlement cache cleared." });
    },
    onError: (err: Error) =>
      toast({ title: "Error updating subscription", description: err.message, variant: "destructive" }),
  });

  const ovMutation = useMutation({
    mutationFn: (body: {
      overrides: Array<{ moduleCode: string; enabled: boolean; reason?: string; expiresAt?: string }>;
    }) =>
      apiRequest("PUT", `/api/platform/tenants/${tenantId}/overrides`, body).then((r) => r.json()),
    onSuccess: (result) => {
      setOvDirty(false);
      refetch();
      toast({
        title: "Module overrides saved",
        description: `${result.overridesApplied} override(s) applied. Cache invalidated.`,
      });
    },
    onError: (err: Error) =>
      toast({ title: "Error saving overrides", description: err.message, variant: "destructive" }),
  });

  const handleSavePlan = () => {
    if (!selectedPlanId) return;
    subMutation.mutate({ planId: parseInt(selectedPlanId, 10) });
  };

  const handleSaveOverrides = () => {
    const overrides = Object.entries(localOv)
      .filter(([, v]) => v.mode !== "default")
      .map(([code, v]) => ({
        moduleCode: code,
        enabled:    v.mode === "on",
        ...(v.reason    ? { reason:    v.reason } : {}),
        ...(v.expiresAt ? { expiresAt: new Date(v.expiresAt).toISOString() } : {}),
      }));
    ovMutation.mutate({ overrides });
  };

  // ── Group modules by category ──────────────────────────────────────────────
  const grouped = useMemo<Record<string, ModuleRow[]>>(() => {
    if (!data?.modules) return {};
    const g: Record<string, ModuleRow[]> = {};
    for (const m of data.modules) (g[m.category] ??= []).push(m);
    return g;
  }, [data?.modules]);

  // ── Render: loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Tenant not found.{" "}
        <button className="underline" onClick={() => navigate("/")}>Go back</button>
      </div>
    );
  }

  const planChanged = selectedPlanId && selectedPlanId !== String(data.subscription?.planId);

  return (
    <div className="space-y-6">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Tenants
        </button>
        <span className="text-border">/</span>
        <span className="text-foreground font-medium">{data.tenantName}</span>
      </div>

      {/* ── Page header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{data.tenantName}</h1>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{data.tenantId}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          className="h-8 w-8 p-0 text-muted-foreground"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Subscription card ── */}
      <div className="border rounded-lg p-5 space-y-4 bg-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Subscription</h2>
          {data.subscription && (
            <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${
              data.subscription.status === "active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}>
              {data.subscription.status}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Plan</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="h-8 text-sm w-52">
                <SelectValue placeholder="Select plan…" />
              </SelectTrigger>
              <SelectContent>
                {data.plans.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <span className={`mr-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${PLAN_COLORS[p.code] ?? "bg-muted"}`}>
                      {p.name.toUpperCase()}
                    </span>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={subMutation.isPending || !planChanged}
            onClick={handleSavePlan}
          >
            {subMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save className="h-3.5 w-3.5" />
            }
            Save Plan
          </Button>
        </div>
      </div>

      {/* ── Module matrix ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Module Access</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set "Plan default" to use the plan's setting, or override individual modules.
            </p>
          </div>
          <Button
            size="sm"
            className={`h-8 text-xs gap-1.5 ${ovDirty ? "ring-2 ring-offset-1 ring-primary/40" : ""}`}
            disabled={ovMutation.isPending || !ovDirty}
            onClick={handleSaveOverrides}
          >
            {ovMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save className="h-3.5 w-3.5" />
            }
            {ovDirty ? "Save Overrides *" : "Save Overrides"}
          </Button>
        </div>

        {Object.entries(grouped).map(([category, mods]) => (
          <div key={category} className="border rounded-lg overflow-hidden">
            {/* Category header */}
            <div className="bg-muted/40 px-4 py-2 border-b flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {category}
              </span>
              <span className="text-[10px] text-muted-foreground">({mods.length})</span>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b bg-muted/10">
                  <TableHead className="text-[10px] uppercase tracking-wide font-semibold w-[210px] py-2">Module</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wide font-semibold w-[130px] py-2">Source</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wide font-semibold w-[165px] py-2">Override</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wide font-semibold py-2">Reason</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wide font-semibold w-[150px] py-2">Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mods.map((m) => {
                  const ov        = localOv[m.code] ?? { mode: "default" as OverrideMode, reason: "", expiresAt: "" };
                  const isOverride = ov.mode !== "default";
                  const liveEnabled = ov.mode === "on" ? true : ov.mode === "off" ? false : m.enabled;
                  const liveSource: OverrideSource =
                    ov.mode === "on"  ? "override-on"  :
                    ov.mode === "off" ? "override-off" :
                    m.source;

                  return (
                    <TableRow key={m.code} className="group">
                      {/* Module name */}
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          {liveEnabled
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            : <XCircle      className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                          }
                          <div>
                            <p className="text-xs font-medium leading-tight">{m.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono leading-tight">{m.code}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Live source (updates as you change the override dropdown) */}
                      <TableCell className="py-2">
                        <SourceBadge source={liveSource} />
                      </TableCell>

                      {/* Override mode selector */}
                      <TableCell className="py-2">
                        <Select
                          value={ov.mode}
                          onValueChange={(v) =>
                            setOv(m.code, { mode: v as OverrideMode, reason: "", expiresAt: "" })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-40 font-medium">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <Minus className="h-3 w-3" /> Plan default
                              </span>
                            </SelectItem>
                            <SelectItem value="on">
                              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" /> Override ON
                              </span>
                            </SelectItem>
                            <SelectItem value="off">
                              <span className="flex items-center gap-1.5 text-red-600 font-medium">
                                <XCircle className="h-3 w-3" /> Override OFF
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Reason (only editable when override is set) */}
                      <TableCell className="py-2">
                        <Input
                          className="h-7 text-xs"
                          placeholder={isOverride ? "Reason (optional)" : "—"}
                          value={ov.reason}
                          disabled={!isOverride}
                          onChange={(e) => setOv(m.code, { reason: e.target.value })}
                        />
                      </TableCell>

                      {/* Expiry date */}
                      <TableCell className="py-2">
                        <Input
                          type="date"
                          className="h-7 text-xs"
                          value={ov.expiresAt}
                          disabled={!isOverride}
                          onChange={(e) => setOv(m.code, { expiresAt: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
