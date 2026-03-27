import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  CheckCheck,
  ClipboardCheck,
  Zap,
  ShieldAlert,
  Bot,
  Settings,
  Filter,
  User,
  Info,
  ChevronRight,
} from "lucide-react";

interface EmailAlert {
  id: number;
  alertTitle: string;
  alertMessage: string;
  priority: string;
  shipmentRefNo: string | null;
  suggestedAction: string | null;
  conflictFlag: boolean;
  conflictReason: string | null;
  supervisorEmailTarget: string | null;
  alertStatus: string;
  createdAt: string;
  senderEmail: string;
  subject: string;
  emailBody: string;
  receivedAt: string;
  matchStatus: string;
  aiSummary: string | null;
  aiActionable: string | null;
  aiIntent: string | null;
  routedSupervisorEmail: string | null;
  inboundEmailId: number;
}

interface EiConfig {
  id: number;
  testModeEnabled: boolean;
  fixedTestSupervisorEmail: string;
  allowedSenderValidation: boolean;
  aiConfidenceThreshold: string;
}

type FilterType = "all" | "conflict" | "no_conflict" | "invalid";

const INTENT_LABELS: Record<string, string> = {
  delay: "Delay",
  reschedule_request: "Reschedule",
  urgent_unloading_request: "Urgent Unload",
  cancellation_request: "Cancellation",
  vehicle_change_request: "Vehicle Change",
  general_escalation: "Escalation",
};

const INTENT_COLORS: Record<string, string> = {
  delay: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  reschedule_request: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
  urgent_unloading_request: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  cancellation_request: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
  vehicle_change_request: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
  general_escalation: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function conflictBorderClass(alert: EmailAlert) {
  if (alert.matchStatus === "invalid_sender") return "border-l-gray-400";
  if (alert.conflictFlag) return "border-l-red-500";
  if (alert.alertStatus === "new") return "border-l-amber-400";
  return "border-l-emerald-500";
}

function ConflictBadge({ alert }: { alert: EmailAlert }) {
  if (alert.matchStatus === "invalid_sender")
    return <Badge className="text-[10px] px-1.5 bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400">Invalid Sender</Badge>;
  if (alert.conflictFlag)
    return <Badge className="text-[10px] px-1.5 bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400">⚡ Conflict</Badge>;
  return <Badge className="text-[10px] px-1.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400">No Conflict</Badge>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400",
    medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400",
    low: "bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
  };
  return (
    <Badge className={`text-[10px] px-1.5 uppercase tracking-wide font-bold ${styles[priority] ?? styles.medium}`}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "acknowledged")
    return <Badge className="text-[10px] px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">Acknowledged</Badge>;
  if (status === "reviewed")
    return <Badge className="text-[10px] px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Reviewed</Badge>;
  return <Badge className="text-[10px] px-1.5 bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400">New</Badge>;
}

export function EmailIntelligenceContent({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterType>("all");
  const [selected, setSelected] = useState<EmailAlert | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [configForm, setConfigForm] = useState<Partial<EiConfig>>({});

  const { data: aiConfig } = useQuery<{ copilotEnabled: boolean }>({
    queryKey: ["/api/ai-config"],
    select: (d: any) => ({ copilotEnabled: d.copilotEnabled }),
  });
  const aiEnabled = aiConfig?.copilotEnabled !== false;

  const { data: alerts = [], isLoading } = useQuery<EmailAlert[]>({
    queryKey: ["/api/email-intelligence/alerts"],
    enabled: aiEnabled,
  });

  const { data: config } = useQuery<EiConfig>({
    queryKey: ["/api/email-intelligence/config"],
  });

  const { data: contacts = [] } = useQuery<{ id: number; carrierName: string; contactEmail: string; isActive: boolean }[]>({
    queryKey: ["/api/email-intelligence/carrier-contacts"],
  });

  const processDemo = useMutation({
    mutationFn: () => apiRequest("POST", "/api/email-intelligence/process-demo"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/email-intelligence/alerts"] });
      toast({ title: "Demo emails processed", description: "AI analysis complete. 6 cases loaded." });
    },
    onError: (e: any) => toast({ title: "Processing failed", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, alertStatus }: { id: number; alertStatus: string }) =>
      apiRequest("PATCH", `/api/email-intelligence/alerts/${id}/status`, { alertStatus }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/email-intelligence/alerts"] }),
  });

  const updateConfig = useMutation({
    mutationFn: (data: Partial<EiConfig>) => apiRequest("PATCH", "/api/email-intelligence/config", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/email-intelligence/config"] });
      toast({ title: "Settings saved" });
      setShowConfig(false);
    },
  });

  const filtered = alerts.filter((a) => {
    if (filter === "conflict") return a.conflictFlag && a.matchStatus !== "invalid_sender";
    if (filter === "no_conflict") return !a.conflictFlag && a.matchStatus !== "invalid_sender";
    if (filter === "invalid") return a.matchStatus === "invalid_sender";
    return true;
  });

  const conflictCount = alerts.filter((a) => a.conflictFlag).length;
  const newCount = alerts.filter((a) => a.alertStatus === "new").length;
  const invalidCount = alerts.filter((a) => a.matchStatus === "invalid_sender").length;

  const actionButtons = (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setConfigForm(config ?? {});
          setShowConfig(true);
        }}
        data-testid="button-ei-settings"
      >
        <Settings className="h-3.5 w-3.5 mr-1.5" /> Settings
      </Button>
      <Button
        size="sm"
        onClick={() => processDemo.mutate()}
        disabled={processDemo.isPending}
        data-testid="button-load-demo"
      >
        {processDemo.isPending ? (
          <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Processing…</>
        ) : (
          <><Zap className="h-3.5 w-3.5 mr-1.5" /> Load Demo Email Cases</>
        )}
      </Button>
    </div>
  );

  if (!aiEnabled) {
    return (
      <div className={embedded ? "flex flex-col items-center justify-center py-16 gap-4 text-center" : "p-4 sm:p-6 max-w-[1400px] mx-auto pb-20 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center"}>
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Bot className="h-8 w-8 text-muted-foreground opacity-40" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Email Intelligence Unavailable</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            The AI Co-Pilot is currently disabled. Email Intelligence is an AI-powered feature and requires the global AI Co-Pilot to be active.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Go to <strong>Configurations → AI Console</strong> to re-enable the AI Co-Pilot.
        </p>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-4" : "p-4 sm:p-6 max-w-[1400px] mx-auto pb-20 space-y-5"}>
      {embedded ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            AI parses inbound carrier emails, identifies shipment references, and surfaces supervisor alerts with conflict detection.
          </p>
          {actionButtons}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Carrier Email Intelligence</h1>
              <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 gap-1">
                <Bot className="h-3 w-3" /> AI-Powered
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground ml-10">
              AI parses inbound carrier emails, identifies shipment references, and surfaces supervisor alerts with conflict detection.
            </p>
          </div>
          {actionButtons}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Alerts", value: alerts.length, icon: Mail, color: "text-primary" },
          { label: "Conflicts", value: conflictCount, icon: ShieldAlert, color: conflictCount > 0 ? "text-red-500" : "text-muted-foreground" },
          { label: "Awaiting Review", value: newCount, icon: Clock, color: newCount > 0 ? "text-amber-500" : "text-muted-foreground" },
          { label: "Invalid Senders", value: invalidCount, icon: User, color: invalidCount > 0 ? "text-gray-500" : "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        {(
          [
            { key: "all", label: "All", count: alerts.length },
            { key: "conflict", label: "Conflicts Only", count: conflictCount },
            { key: "no_conflict", label: "No Conflict", count: alerts.length - conflictCount - invalidCount },
            { key: "invalid", label: "Invalid Sender", count: invalidCount },
          ] as { key: FilterType; label: string; count: number }[]
        ).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid={`filter-${key}`}
          >
            <Filter className="h-3 w-3" />
            {label}
            {count > 0 && (
              <span className={`text-[10px] px-1 rounded-full font-bold ${filter === key ? "bg-primary/10 text-primary" : "bg-muted-foreground/20"}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground border-dashed">
          <Mail className="h-10 w-10 opacity-20" />
          <p className="text-sm font-medium">No alerts found</p>
          <p className="text-xs">Click "Load Demo Email Cases" to populate the demo data</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <Card
              key={alert.id}
              className={`border-l-4 ${conflictBorderClass(alert)} hover:shadow-md transition-shadow`}
              data-testid={`alert-card-${alert.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Left: main info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Row 1: badges + title */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {alert.shipmentRefNo && (
                        <span className="font-mono text-xs font-bold bg-muted px-1.5 py-0.5 rounded text-foreground">
                          {alert.shipmentRefNo}
                        </span>
                      )}
                      {alert.aiIntent && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${INTENT_COLORS[alert.aiIntent] ?? INTENT_COLORS.general_escalation}`}>
                          {INTENT_LABELS[alert.aiIntent] ?? alert.aiIntent}
                        </span>
                      )}
                      <ConflictBadge alert={alert} />
                      <PriorityBadge priority={alert.priority} />
                      <StatusBadge status={alert.alertStatus} />
                    </div>

                    {/* Row 2: title */}
                    <p className="text-sm font-semibold leading-snug">{alert.alertTitle}</p>

                    {/* Row 3: sender + subject */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-foreground/80">{alert.senderEmail}</span>
                      </span>
                      <span className="hidden sm:block text-border">|</span>
                      <span className="italic truncate max-w-[300px]">{alert.subject}</span>
                    </div>

                    {/* Row 4: AI summary */}
                    {alert.aiSummary && alert.matchStatus !== "invalid_sender" && (
                      <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-2.5">
                        <Bot className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-xs text-foreground leading-snug">{alert.aiSummary}</p>
                          {alert.suggestedAction && (
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-semibold text-primary">→ </span>
                              {alert.suggestedAction}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Row 5: conflict reason */}
                    {alert.conflictFlag && alert.conflictReason && (
                      <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-md px-2.5 py-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium">Conflict: </span>
                        <span>{alert.conflictReason}</span>
                      </div>
                    )}

                    {/* Row 6: routing info */}
                    {alert.routedSupervisorEmail && (
                      <p className="text-[10px] text-muted-foreground">
                        Routed to: <span className="font-mono">{alert.routedSupervisorEmail}</span>
                        <span className="ml-1.5 italic">(test mode)</span>
                      </p>
                    )}
                  </div>

                  {/* Right: time + actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground tabular-nums">{timeAgo(alert.createdAt)}</span>
                    <div className="flex gap-1.5 flex-wrap sm:flex-nowrap sm:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setSelected(alert)}
                        data-testid={`btn-view-${alert.id}`}
                      >
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      {alert.alertStatus === "new" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => updateStatus.mutate({ id: alert.id, alertStatus: "acknowledged" })}
                          data-testid={`btn-ack-${alert.id}`}
                        >
                          <CheckCheck className="h-3 w-3 mr-1" /> Ack
                        </Button>
                      )}
                      {alert.alertStatus !== "reviewed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => updateStatus.mutate({ id: alert.id, alertStatus: "reviewed" })}
                          data-testid={`btn-review-${alert.id}`}
                        >
                          <ClipboardCheck className="h-3 w-3 mr-1" /> Done
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Carrier Contacts reference */}
      {contacts.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Registered Carrier Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{c.carrierName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{c.contactEmail}</p>
                  </div>
                  <Badge className={c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}>
                    {c.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-[540px] overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Intelligence Detail
                </SheetTitle>
                <SheetDescription>Full email content and AI analysis</SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  {selected.shipmentRefNo && (
                    <span className="font-mono text-xs font-bold bg-muted px-2 py-1 rounded">{selected.shipmentRefNo}</span>
                  )}
                  <ConflictBadge alert={selected} />
                  <PriorityBadge priority={selected.priority} />
                  <StatusBadge status={selected.alertStatus} />
                </div>

                {/* Email header */}
                <Card className="bg-muted/30">
                  <CardContent className="p-3 space-y-1.5 text-sm">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">From:</span>
                      <span className="font-mono font-medium">{selected.senderEmail}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Subject:</span>
                      <span className="font-medium">{selected.subject}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Received:</span>
                      <span className="text-muted-foreground">{timeAgo(selected.receivedAt)}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground w-16 shrink-0">Sender:</span>
                      <Badge className={selected.matchStatus === "invalid_sender" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                        {selected.matchStatus === "invalid_sender" ? "Invalid / Unknown" : "Verified Carrier"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Email body */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Email Body</p>
                  <div className="bg-muted/40 rounded-lg p-3 text-sm text-foreground leading-relaxed border">
                    {selected.emailBody}
                  </div>
                </div>

                {/* AI Analysis */}
                {selected.aiSummary && selected.matchStatus !== "invalid_sender" && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-primary" /> AI Analysis
                    </p>
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-3 space-y-2.5">
                        {selected.aiIntent && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-20">Intent:</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${INTENT_COLORS[selected.aiIntent] ?? ""}`}>
                              {INTENT_LABELS[selected.aiIntent] ?? selected.aiIntent}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-xs text-muted-foreground">Summary:</span>
                          <p className="text-sm mt-0.5">{selected.aiSummary}</p>
                        </div>
                        {selected.aiActionable && (
                          <div>
                            <span className="text-xs text-muted-foreground">Action for Supervisor:</span>
                            <p className="text-sm mt-0.5 font-medium">{selected.aiActionable}</p>
                          </div>
                        )}
                        {selected.suggestedAction && (
                          <div className="border-t pt-2">
                            <span className="text-xs text-muted-foreground">Recommended YMS Action:</span>
                            <p className="text-sm mt-0.5 text-primary font-medium">{selected.suggestedAction}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Conflict detail */}
                {selected.conflictFlag && selected.conflictReason && (
                  <Card className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                    <CardContent className="p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">Workflow Conflict Detected</p>
                        <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">{selected.conflictReason}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Routing */}
                {selected.routedSupervisorEmail && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    Alert routed to <span className="font-mono font-medium ml-1">{selected.routedSupervisorEmail}</span>
                    <span className="ml-auto italic">(test mode)</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  {selected.alertStatus === "new" && (
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => {
                        updateStatus.mutate({ id: selected.id, alertStatus: "acknowledged" });
                        setSelected((prev) => prev ? { ...prev, alertStatus: "acknowledged" } : null);
                      }}
                    >
                      <CheckCheck className="h-4 w-4 mr-2" /> Acknowledge
                    </Button>
                  )}
                  {selected.alertStatus !== "reviewed" && (
                    <Button
                      className="flex-1"
                      onClick={() => {
                        updateStatus.mutate({ id: selected.id, alertStatus: "reviewed" });
                        setSelected(null);
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4 mr-2" /> Mark Reviewed
                    </Button>
                  )}
                  {selected.alertStatus === "reviewed" && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" /> This alert has been reviewed
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Settings sheet */}
      <Sheet open={showConfig} onOpenChange={setShowConfig}>
        <SheetContent className="w-full sm:max-w-[440px]">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Email Intelligence Settings
            </SheetTitle>
            <SheetDescription>Configure AI email processing behaviour</SheetDescription>
          </SheetHeader>

          {config && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Test Mode</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Route all alerts to a fixed supervisor email</p>
                </div>
                <Switch
                  checked={configForm.testModeEnabled ?? config.testModeEnabled}
                  onCheckedChange={(v) => setConfigForm((p) => ({ ...p, testModeEnabled: v }))}
                  data-testid="switch-test-mode"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Test Supervisor Email</Label>
                <Input
                  value={configForm.fixedTestSupervisorEmail ?? config.fixedTestSupervisorEmail}
                  onChange={(e) => setConfigForm((p) => ({ ...p, fixedTestSupervisorEmail: e.target.value }))}
                  placeholder="supervisor@example.com"
                  data-testid="input-supervisor-email"
                />
                <p className="text-xs text-muted-foreground">All demo alerts route to this address in test mode</p>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Sender Validation</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Reject emails from unregistered carrier contacts</p>
                </div>
                <Switch
                  checked={configForm.allowedSenderValidation ?? config.allowedSenderValidation}
                  onCheckedChange={(v) => setConfigForm((p) => ({ ...p, allowedSenderValidation: v }))}
                  data-testid="switch-sender-validation"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">AI Confidence Threshold</Label>
                <Input
                  value={configForm.aiConfidenceThreshold ?? config.aiConfidenceThreshold}
                  onChange={(e) => setConfigForm((p) => ({ ...p, aiConfidenceThreshold: e.target.value }))}
                  placeholder="0.70"
                  data-testid="input-confidence-threshold"
                />
                <p className="text-xs text-muted-foreground">Minimum confidence score to auto-classify intent (0.0–1.0)</p>
              </div>

              <Button
                className="w-full"
                onClick={() => updateConfig.mutate(configForm)}
                disabled={updateConfig.isPending}
                data-testid="button-save-config"
              >
                Save Settings
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function EmailIntelligencePage() {
  return <EmailIntelligenceContent />;
}
