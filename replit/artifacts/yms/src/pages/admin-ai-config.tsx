import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/enterprise";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, ShieldAlert, Brain, Activity, Users, Database, Bell,
  BarChart3, Lock, CheckCircle2, AlertTriangle,
  XCircle, Info, Zap, Eye, Save, RotateCcw,
  ChevronRight, Cpu, Mail, ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import type { AiConfig } from "@shared/schema";

// ─── Custom Power Icon ────────────────────────────────────────────────────────
function Power(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_DISPLAY: Record<string, { label: string; color: string }> = {
  gate_guard:   { label: "Gate Guard",    color: "bg-sky-100 text-sky-700 border-sky-200" },
  dock_user:    { label: "Dock Operator", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  yard_jockey:  { label: "Yard Jockey",   color: "bg-orange-100 text-orange-700 border-orange-200" },
  yard_manager: { label: "Yard Manager",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  admin:        { label: "System Admin",  color: "bg-purple-100 text-purple-700 border-purple-200" },
  carrier:      { label: "Carrier",       color: "bg-slate-100 text-slate-600 border-slate-200" },
};

const ALL_ROLE_PERMISSIONS = [
  { id: "ask_operational_questions", label: "Ask Operational Questions" },
  { id: "view_gate_alerts",          label: "View Gate Alerts" },
  { id: "view_dock_alerts",          label: "View Dock Alerts" },
  { id: "ask_dock_queries",          label: "Ask Dock Queries" },
  { id: "view_move_suggestions",     label: "View Move Suggestions" },
  { id: "ask_yard_queries",          label: "Ask Yard Queries" },
  { id: "view_utilization_insights", label: "View Utilization Insights" },
  { id: "receive_recommendations",   label: "Receive Recommendations" },
  { id: "view_predictions",          label: "View Predictions" },
  { id: "execute_ai_actions",        label: "Execute AI Actions" },
  { id: "configure_ai",              label: "Configure AI Settings" },
  { id: "access_logs",               label: "Access Audit Logs" },
  { id: "view_analytics",            label: "View Performance Analytics" },
  { id: "full_access",               label: "Full AI Access" },
  { id: "view_appointment_status",   label: "View Appointment Status" },
];

const DATA_SOURCE_DISPLAY: Record<string, string> = {
  appointments:      "Appointments",
  gate_checkin:      "Gate Check-In",
  yard_inventory:    "Yard Inventory",
  dock_management:   "Dock Management",
  jockey_operations: "Jockey Operations",
  inspection:        "Inspections",
  gate_checkout:     "Gate Check-Out",
  reports:           "Reports & Analytics",
};

const ALERT_TYPE_DISPLAY: Record<string, { label: string; icon: any }> = {
  yard_congestion:     { label: "Yard Congestion Risk",      icon: AlertTriangle },
  dock_backlog:        { label: "Dock Backlog",              icon: Activity },
  appointment_overload:{ label: "Appointment Overload",      icon: Bell },
  high_dwell_time:     { label: "High Trailer Dwell Time",   icon: Zap },
  gate_surge:          { label: "Gate Check-In Surge",       icon: ChevronRight },
};

const GUARDRAIL_DISPLAY: Record<string, { label: string; description: string }> = {
  prevent_override_supervisor: {
    label: "Prevent Override of Supervisor Decisions",
    description: "AI cannot override decisions made by a supervisor or yard manager",
  },
  require_approval_critical_records: {
    label: "Require Approval for Critical Record Modifications",
    description: "AI cannot modify gate transactions, visit records, or exception statuses without approval",
  },
  prevent_unauthorized_yard_movement: {
    label: "Prevent Unauthorized Yard Movement",
    description: "AI cannot trigger yard jockey move tasks without authorization",
  },
  allow_emergency_disable: {
    label: "Allow Emergency Disable",
    description: "Administrators can disable all AI functionality instantly during incidents",
  },
  log_all_ai_actions: {
    label: "Log All AI-Initiated Actions",
    description: "All actions taken by or recommended by AI are logged with full context",
  },
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description, accent = "blue" }: {
  icon: any; title: string; description: string; accent?: string;
}) {
  const colors: Record<string, string> = {
    blue:   "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
    purple: "border-purple-500 bg-purple-50 dark:bg-purple-950/20",
    amber:  "border-amber-500 bg-amber-50 dark:bg-amber-950/20",
    green:  "border-green-500 bg-green-50 dark:bg-green-950/20",
    red:    "border-red-500 bg-red-50 dark:bg-red-950/20",
    slate:  "border-slate-400 bg-slate-50 dark:bg-slate-900/30",
  };
  const iconColors: Record<string, string> = {
    blue: "text-blue-600", purple: "text-purple-600", amber: "text-amber-600",
    green: "text-green-600", red: "text-red-600", slate: "text-slate-500",
  };
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border-l-4 mb-4 ${colors[accent]}`}>
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${iconColors[accent]}`} />
      <div>
        <p className="font-semibold text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled = false, testId }: {
  label: string; description?: string; checked: boolean;
  onCheckedChange: (v: boolean) => void; disabled?: boolean; testId?: string;
}) {
  return (
    <div className={`flex items-center justify-between py-3 border-b last:border-0 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} data-testid={testId} />
    </div>
  );
}

function ThresholdRow({ label, values, onChange }: {
  label: string;
  values: { moderate: number; high: number; critical: number };
  onChange: (v: { moderate: number; high: number; critical: number }) => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="grid grid-cols-3 gap-4">
        {(["moderate", "high", "critical"] as const).map((level) => {
          const colors   = { moderate: "text-amber-600",  high: "text-orange-600",  critical: "text-red-600" };
          const bgColors = { moderate: "bg-amber-50 border-amber-200", high: "bg-orange-50 border-orange-200", critical: "bg-red-50 border-red-200" };
          return (
            <div key={level} className={`rounded p-2 border ${bgColors[level]}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase ${colors[level]}`}>{level}</span>
                <span className={`text-xs font-bold ${colors[level]}`}>{values[level]}%</span>
              </div>
              <Slider
                value={[values[level]]}
                onValueChange={([v]) => onChange({ ...values, [level]: v })}
                min={0} max={100} step={5}
                data-testid={`slider-threshold-${label.replace(/\s+/g, "-").toLowerCase()}-${level}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number | string; icon: any; color: string; bg: string;
}) {
  return (
    <Card className="flex-1 min-w-[130px]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div>
          <p className={`text-xl font-bold ${color}`}>{value ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminAiConfigPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("control");
  const [localThresholds, setLocalThresholds] = useState<Record<string, { moderate: number; high: number; critical: number }> | null>(null);
  const [thresholdsDirty, setThresholdsDirty] = useState(false);

  const { data: config, isLoading } = useQuery<AiConfig>({ queryKey: ["/api/ai-config"] });
  const { data: perfStats } = useQuery<Record<string, number>>({ queryKey: ["/api/ai-performance-stats"] });

  const patchMutation = useMutation({
    mutationFn: (data: Partial<AiConfig>) => apiRequest("PATCH", "/api/ai-config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-audit-logs"] });
      toast({ title: "Configuration saved", description: "AI Console settings updated." });
    },
    onError: () => toast({ title: "Save failed", description: "Could not save configuration.", variant: "destructive" }),
  });

  const patch = useCallback((data: Partial<AiConfig>) => patchMutation.mutate(data), [patchMutation]);

  const thresholds     = (localThresholds ?? (config?.thresholds as any)) ?? {};
  const rolePermissions = (config?.rolePermissions as Record<string, string[]>) ?? {};
  const dataSources    = (config?.dataSources as Record<string, { enabled: boolean; canAct: boolean }>) ?? {};
  const alertTypes     = (config?.alertTypes as Record<string, { enabled: boolean; severity: string }>) ?? {};
  const alertChannels  = (config?.alertChannels as Record<string, boolean>) ?? {};
  const guardrails     = (config?.guardrails as Record<string, boolean>) ?? {};

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!config) return null;

  return (
    <div className="flex flex-col h-full space-y-4 pb-6">

      <div className="px-6 pt-6 pb-2">
        <PageHeader
          icon={<Bot className="h-5 w-5" />}
          title="AI Console"
          subtitle="Govern, configure, and audit the AI assistant across all yard operations"
          actions={
            <div className="flex items-center gap-2">
              <Badge
                variant={config.copilotEnabled ? "default" : "secondary"}
                className={`text-xs ${config.copilotEnabled ? "bg-green-600 hover:bg-green-700" : ""}`}
                data-testid="badge-ai-status"
              >
                {config.copilotEnabled ? "AI Active" : "AI Disabled"}
              </Badge>
              <Link href="/email-intelligence">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Mail className="h-3.5 w-3.5" />
                  Email Intelligence
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </Button>
              </Link>
              <Link href="/admin/audit">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  Audit Log
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </Button>
              </Link>
            </div>
          }
        />
      </div>

      {/* ── Performance stats bar ───────────────────────────────────────────── */}
      <div className="px-6">
        <div className="flex gap-3 flex-wrap">
          <StatCard label="Queries Handled"    value={perfStats?.totalQueries ?? 0}       icon={Brain}      color="text-blue-600"    bg="bg-blue-50 dark:bg-blue-950/20" />
          <StatCard label="Alerts Generated"   value={perfStats?.totalAlerts ?? 0}        icon={Bell}       color="text-amber-600"   bg="bg-amber-50 dark:bg-amber-950/20" />
          <StatCard label="Actions Triggered"  value={perfStats?.totalActions ?? 0}       icon={Zap}        color="text-purple-600"  bg="bg-purple-50 dark:bg-purple-950/20" />
          <StatCard label="Unanswered"         value={perfStats?.unansweredQueries ?? 0}  icon={AlertTriangle} color="text-red-600"  bg="bg-red-50 dark:bg-red-950/20" />
          <StatCard label="Alerts Acted On"    value={perfStats?.alertsActedUpon ?? 0}    icon={CheckCircle2} color="text-green-600" bg="bg-green-50 dark:bg-green-950/20" />
          <StatCard label="Incidents Prevented" value={perfStats?.incidentsPrevented ?? 0} icon={ShieldAlert} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/20" />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="px-6 flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-5">
            <TabsTrigger value="control"     data-testid="tab-ai-config-control"     className="gap-1.5 text-xs">
              <Power className="h-3.5 w-3.5" /> Control
            </TabsTrigger>
            <TabsTrigger value="predictions" data-testid="tab-ai-config-predictions" className="gap-1.5 text-xs">
              <Brain className="h-3.5 w-3.5" /> Predictions
            </TabsTrigger>
            <TabsTrigger value="access"      data-testid="tab-ai-config-access"      className="gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Access & Data
            </TabsTrigger>
            <TabsTrigger value="alerts"      data-testid="tab-ai-config-alerts"      className="gap-1.5 text-xs">
              <Bell className="h-3.5 w-3.5" /> Alerts & Visibility
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: CONTROL ─────────────────────────────────────────────── */}
          <TabsContent value="control" className="space-y-5 mt-0">
            <SectionHeader
              icon={Power}
              title="AI Copilot Enablement"
              description="Master controls for enabling or disabling AI features system-wide. Only System Admin may modify these settings."
              accent="blue"
            />

            {/* Master toggle */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-500" /> Global AI Copilot
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Master switch — disabling this hides all AI features for every user
                    </CardDescription>
                  </div>
                  <Switch
                    checked={config.copilotEnabled}
                    onCheckedChange={(v) => patch({ copilotEnabled: v })}
                    data-testid="toggle-copilot-enabled"
                    className="scale-125"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`space-y-0 divide-y rounded-lg border bg-muted/30 px-4 transition-opacity ${!config.copilotEnabled ? "opacity-40 pointer-events-none" : ""}`}>
                  <ToggleRow
                    label="Natural Language Chat Assistant"
                    description="Allows users to ask questions in natural language from the floating assistant"
                    checked={config.chatAssistantEnabled}
                    onCheckedChange={(v) => patch({ chatAssistantEnabled: v })}
                    testId="toggle-chat-assistant"
                  />
                  <ToggleRow
                    label="Predictive Operations Copilot"
                    description="Enables yard congestion prediction, dock forecasting, and dwell time alerts"
                    checked={config.predictiveOpsEnabled}
                    onCheckedChange={(v) => patch({ predictiveOpsEnabled: v })}
                    testId="toggle-predictive-ops"
                  />
                  <ToggleRow
                    label="Smart Suggestions on Screens"
                    description="Shows inline AI suggestions on dock, move tasks, and gate screens"
                    checked={config.smartSuggestionsEnabled}
                    onCheckedChange={(v) => patch({ smartSuggestionsEnabled: v })}
                    testId="toggle-smart-suggestions"
                  />
                  <ToggleRow
                    label="Proactive Operational Alerts"
                    description="AI sends alerts when it detects risk conditions without being asked"
                    checked={config.proactiveAlertsEnabled}
                    onCheckedChange={(v) => patch({ proactiveAlertsEnabled: v })}
                    testId="toggle-proactive-alerts"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <strong>When AI Copilot is disabled:</strong> The floating assistant icon will not appear, all predictive alerts will stop, and AI-driven insights will be hidden from all users regardless of their role. Re-enabling restores all active features.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Automation level */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Automation Level</CardTitle>
                <CardDescription className="text-xs">Controls the maximum level of autonomy the AI is permitted to exercise</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "advisory",  label: "Advisory Mode",   icon: Info, color: "border-slate-300", activeColor: "border-slate-500 bg-slate-50 dark:bg-slate-900",        desc: "AI only provides recommendations — no action buttons shown" },
                    { id: "assistive", label: "Assistive Mode",  icon: Zap,  color: "border-blue-200",  activeColor: "border-blue-500 bg-blue-50 dark:bg-blue-950/20",         desc: "AI provides recommendations with quick-action buttons for one-click execution" },
                    { id: "automated", label: "Automated Mode",  icon: Cpu,  color: "border-amber-200", activeColor: "border-amber-500 bg-amber-50 dark:bg-amber-950/20",      desc: "AI can trigger operational workflows automatically based on predefined rules" },
                  ].map(({ id, label, icon: Icon, color, activeColor, desc }) => {
                    const isActive = config.automationLevel === id;
                    return (
                      <button
                        key={id}
                        data-testid={`btn-automation-${id}`}
                        onClick={() => patch({ automationLevel: id })}
                        className={`text-left p-4 rounded-lg border-2 transition-all ${isActive ? activeColor : color + " hover:bg-muted/40"}`}
                      >
                        <Icon className={`h-5 w-5 mb-2 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                        <p className="text-sm font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                        {isActive && <Badge className="mt-2 text-[10px] px-2 py-0" variant="secondary">Active</Badge>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Action controls */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Action Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 divide-y">
                <ToggleRow
                  label="Allow AI to Trigger Operational Actions"
                  description="When enabled, AI can initiate move tasks, dock assignments, and alerts"
                  checked={config.aiCanTriggerActions}
                  onCheckedChange={(v) => patch({ aiCanTriggerActions: v })}
                  testId="toggle-ai-actions"
                />
                <ToggleRow
                  label="Require Supervisor Approval for AI Suggestions"
                  description="All AI-recommended actions must be reviewed and approved by a Yard Manager or Admin before execution"
                  checked={config.requireSupervisorApproval}
                  onCheckedChange={(v) => patch({ requireSupervisorApproval: v })}
                  testId="toggle-supervisor-approval"
                />
              </CardContent>
            </Card>

            {/* Guardrails */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-red-500" />
                  <CardTitle className="text-sm">Safety Guardrails</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Hard constraints enforced at the system level — independent of automation level
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-0 divide-y">
                {Object.entries(GUARDRAIL_DISPLAY).map(([guardrailId, { label, description }]) => {
                  const isActive = guardrails[guardrailId] ?? true;
                  return (
                    <div key={guardrailId} className="flex items-start justify-between py-3.5 gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium">{label}</p>
                          {isActive && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200" variant="outline">Active</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(v) => patch({ guardrails: { ...guardrails, [guardrailId]: v } })}
                        data-testid={`toggle-guardrail-${guardrailId}`}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/40 dark:bg-red-950/10">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-red-800 dark:text-red-300">Enterprise Safety Notice:</strong> Guardrails are enforced independently of the Automation Level. Disabling a guardrail is logged in the Audit Log and requires Admin role.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 2: PREDICTIONS ─────────────────────────────────────────── */}
          <TabsContent value="predictions" className="space-y-5 mt-0">
            <SectionHeader
              icon={Brain}
              title="Predictive Intelligence Configuration"
              description="Set risk thresholds for each operational indicator and configure how far ahead the AI looks."
              accent="purple"
            />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Prediction Window</CardTitle>
                <CardDescription className="text-xs">How far ahead the AI models should look when generating predictions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { id: "30min", label: "30 Minutes", desc: "Immediate operations" },
                    { id: "1hour", label: "1 Hour",     desc: "Near-term planning" },
                    { id: "2hours",label: "2 Hours",    desc: "Shift coordination" },
                    { id: "shift", label: "Shift Window",desc: "Full shift outlook" },
                  ].map(({ id, label, desc }) => {
                    const isActive = config.predictionWindow === id;
                    return (
                      <button
                        key={id}
                        data-testid={`btn-prediction-window-${id}`}
                        onClick={() => patch({ predictionWindow: id })}
                        className={`text-center p-3 rounded-lg border-2 transition-all ${isActive ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" : "border-border hover:bg-muted/40"}`}
                      >
                        <p className="text-sm font-bold">{label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                        {isActive && <Badge className="mt-2 text-[10px] px-2 py-0 bg-purple-600" variant="default">Active</Badge>}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm">Risk Thresholds</CardTitle>
                    <CardDescription className="text-xs">Configure trigger levels for each operational indicator</CardDescription>
                  </div>
                  {thresholdsDirty && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => { setLocalThresholds(null); setThresholdsDirty(false); }}
                        data-testid="btn-reset-thresholds">
                        <RotateCcw className="h-3 w-3 mr-1" /> Discard
                      </Button>
                      <Button size="sm" className="h-7 text-xs"
                        onClick={() => { patch({ thresholds: localThresholds as any }); setThresholdsDirty(false); }}
                        disabled={patchMutation.isPending}
                        data-testid="btn-save-thresholds">
                        <Save className="h-3 w-3 mr-1" /> Save Thresholds
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "yardCapacity",          label: "Yard Capacity Utilization" },
                  { key: "dockUtilization",        label: "Dock Utilization" },
                  { key: "trailerDwellTime",       label: "Trailer Dwell Time (hours)" },
                  { key: "gateQueueLength",        label: "Gate Queue Length (vehicles)" },
                  { key: "appointmentClustering",  label: "Appointment Clustering (%)" },
                  { key: "inspectionBacklog",      label: "Inspection Backlog (items)" },
                  { key: "jockeyMovementBacklog",  label: "Jockey Movement Backlog (tasks)" },
                ].map(({ key, label }) => {
                  const vals = (thresholds as any)[key] ?? { moderate: 70, high: 85, critical: 95 };
                  return (
                    <ThresholdRow
                      key={key}
                      label={label}
                      values={vals}
                      onChange={(v) => { setLocalThresholds({ ...thresholds, [key]: v }); setThresholdsDirty(true); }}
                    />
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 3: ACCESS & DATA ───────────────────────────────────────── */}
          <TabsContent value="access" className="space-y-5 mt-0">
            <SectionHeader
              icon={Users}
              title="Role-Based AI Access & Data Sources"
              description="Define which AI capabilities each role can access and which modules the AI can read from or act upon."
              accent="amber"
            />

            {/* Role permission matrix */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" /> Role Permissions
                </CardTitle>
                <CardDescription className="text-xs">Click to toggle a permission on or off for each role</CardDescription>
              </CardHeader>
              <CardContent className="pt-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold w-56">AI Capability</TableHead>
                      {Object.entries(ROLE_DISPLAY).map(([roleId, { label, color }]) => (
                        <TableHead key={roleId} className="text-center text-xs font-semibold min-w-[110px]">
                          <Badge variant="outline" className={`text-[11px] px-2 py-0.5 border ${color}`}>{label}</Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALL_ROLE_PERMISSIONS.map((perm) => (
                      <TableRow key={perm.id} className="hover:bg-muted/20">
                        <TableCell className="text-xs font-medium py-2">{perm.label}</TableCell>
                        {Object.keys(ROLE_DISPLAY).map((roleId) => {
                          const perms: string[] = rolePermissions[roleId] ?? [];
                          const hasAccess = perms.includes(perm.id);
                          return (
                            <TableCell key={roleId} className="text-center py-2">
                              <button
                                data-testid={`btn-role-perm-${roleId}-${perm.id}`}
                                onClick={() => {
                                  const current: string[] = rolePermissions[roleId] ?? [];
                                  const updated = hasAccess
                                    ? current.filter((p) => p !== perm.id)
                                    : [...current, perm.id];
                                  patch({ rolePermissions: { ...rolePermissions, [roleId]: updated } });
                                }}
                                className="mx-auto flex items-center justify-center w-6 h-6 rounded transition-colors hover:bg-muted"
                              >
                                {hasAccess
                                  ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  : <XCircle className="h-4 w-4 text-muted-foreground/30" />}
                              </button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Data sources */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500" /> Data Sources
                </CardTitle>
                <CardDescription className="text-xs">Control which modules the AI can read from and which it may act upon</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Module / Data Source</TableHead>
                      <TableHead className="text-center text-xs font-semibold w-32">AI Can Read</TableHead>
                      <TableHead className="text-center text-xs font-semibold w-36">AI Can Act</TableHead>
                      <TableHead className="text-center text-xs font-semibold w-28">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(DATA_SOURCE_DISPLAY).map(([sourceId, label]) => {
                      const src = dataSources[sourceId] ?? { enabled: true, canAct: false };
                      return (
                        <TableRow key={sourceId} className={`hover:bg-muted/20 ${!src.enabled ? "opacity-50" : ""}`}>
                          <TableCell className="text-sm font-medium py-3">{label}</TableCell>
                          <TableCell className="text-center py-3">
                            <Switch
                              checked={src.enabled}
                              onCheckedChange={(v) => patch({ dataSources: { ...dataSources, [sourceId]: { ...src, enabled: v } } })}
                              data-testid={`toggle-datasource-read-${sourceId}`}
                            />
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Switch
                              checked={src.canAct}
                              disabled={!src.enabled}
                              onCheckedChange={(v) => patch({ dataSources: { ...dataSources, [sourceId]: { ...src, canAct: v } } })}
                              data-testid={`toggle-datasource-act-${sourceId}`}
                            />
                          </TableCell>
                          <TableCell className="text-center py-3">
                            {src.enabled
                              ? <Badge className="bg-green-100 text-green-700 border-green-200 text-[11px]" variant="outline">{src.canAct ? "Read + Act" : "Read Only"}</Badge>
                              : <Badge variant="secondary" className="text-[11px]">Disabled</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB 4: ALERTS & VISIBILITY ─────────────────────────────────── */}
          <TabsContent value="alerts" className="space-y-5 mt-0">
            <SectionHeader
              icon={Bell}
              title="Alerts & Visibility"
              description="Configure which conditions trigger AI alerts, their severity, delivery channels, and how AI reasoning is shown to users."
              accent="amber"
            />

            {/* Alert types */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Alert Conditions</CardTitle>
                <CardDescription className="text-xs">Which operational conditions trigger AI alerts and at what severity</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs font-semibold">Alert Condition</TableHead>
                      <TableHead className="text-center text-xs font-semibold w-24">Enabled</TableHead>
                      <TableHead className="text-center text-xs font-semibold w-40">Severity Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(ALERT_TYPE_DISPLAY).map(([alertId, { label, icon: AlertIcon }]) => {
                      const alert = alertTypes[alertId] ?? { enabled: true, severity: "high" };
                      const severityColors: Record<string, string> = {
                        low: "bg-slate-100 text-slate-600", moderate: "bg-amber-100 text-amber-700",
                        high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700",
                      };
                      return (
                        <TableRow key={alertId} className={`hover:bg-muted/20 ${!alert.enabled ? "opacity-50" : ""}`}>
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <AlertIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Switch
                              checked={alert.enabled}
                              onCheckedChange={(v) => patch({ alertTypes: { ...alertTypes, [alertId]: { ...alert, enabled: v } } })}
                              data-testid={`toggle-alert-${alertId}`}
                            />
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Select
                              value={alert.severity}
                              disabled={!alert.enabled}
                              onValueChange={(v) => patch({ alertTypes: { ...alertTypes, [alertId]: { ...alert, severity: v } } })}
                            >
                              <SelectTrigger className={`h-7 text-xs w-28 mx-auto border-0 ${severityColors[alert.severity]}`} data-testid={`select-alert-severity-${alertId}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="moderate">Moderate</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Delivery channels */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Delivery Channels</CardTitle>
                <CardDescription className="text-xs">Where AI alerts are surfaced to users</CardDescription>
              </CardHeader>
              <CardContent className="divide-y space-y-0">
                {[
                  { id: "ai_copilot_panel",         label: "AI Copilot Panel",         desc: "Shown in the floating AI assistant panel" },
                  { id: "dashboard_notifications",   label: "Dashboard Notifications",  desc: "Shown in the Action Required panel on the dashboard" },
                  { id: "alert_badges",              label: "Module Alert Badges",       desc: "Displayed as badge counts on navigation items" },
                ].map(({ id, label, desc }) => (
                  <ToggleRow
                    key={id} label={label} description={desc}
                    checked={alertChannels[id] ?? true}
                    onCheckedChange={(v) => patch({ alertChannels: { ...alertChannels, [id]: v } })}
                    testId={`toggle-alert-channel-${id}`}
                  />
                ))}
              </CardContent>
            </Card>

            {/* Explainability */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-green-500" /> AI Explainability
                </CardTitle>
                <CardDescription className="text-xs">Control how AI reasoning and confidence is shown to users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "all",         label: "All Users",        desc: "Every user sees AI reasoning in plain language" },
                    { id: "supervisors", label: "Supervisors Only", desc: "Only Yard Managers and Admins see detailed explanations" },
                    { id: "hidden",      label: "Hidden",           desc: "No explanations shown — AI conclusions only" },
                  ].map(({ id, label, desc }) => {
                    const isActive = config.showExplanations === id;
                    return (
                      <button
                        key={id}
                        data-testid={`btn-explanation-${id}`}
                        onClick={() => patch({ showExplanations: id })}
                        className={`text-left p-3 rounded-lg border-2 transition-all text-sm ${isActive ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-border hover:bg-muted/40"}`}
                      >
                        <p className="font-semibold">{label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                        {isActive && <Badge className="mt-1.5 text-[10px] px-2 py-0 bg-green-600" variant="default">Selected</Badge>}
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-lg border bg-muted/20 px-4 py-1 space-y-0 divide-y">
                  <ToggleRow
                    label="Show Data Signals Used for Insights"
                    description="Display which operational data points triggered the AI insight"
                    checked={config.showDataSignals}
                    onCheckedChange={(v) => patch({ showDataSignals: v })}
                    testId="toggle-data-signals"
                  />
                  <ToggleRow
                    label="Show Confidence Score of Prediction"
                    description="Display a percentage confidence level next to each AI prediction"
                    checked={config.showConfidenceScores}
                    onCheckedChange={(v) => patch({ showConfidenceScores: v })}
                    testId="toggle-confidence-scores"
                  />
                  <ToggleRow
                    label="Show Contributing Operational Factors"
                    description="Show the list of operational conditions contributing to each alert"
                    checked={config.showContributingFactors}
                    onCheckedChange={(v) => patch({ showContributingFactors: v })}
                    testId="toggle-contributing-factors"
                  />
                </div>

                <Card className="border-green-200 bg-green-50/40 dark:bg-green-950/10">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-2 flex items-center gap-1.5">
                      <Info className="h-3.5 w-3.5" /> Example Explanation Output
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      "Congestion risk is <strong className="text-orange-600 not-italic">High</strong> because 18 inbound trucks are expected in the next 2 hours while only 5 docks are forecast to be available. Contributing factors: appointment clustering at 08:00–10:00 window (82%), current dock utilization at 87%, 3 jockey moves pending assignment."
                    </p>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
