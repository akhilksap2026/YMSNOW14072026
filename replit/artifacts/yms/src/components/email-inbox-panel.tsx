import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Bot, ShieldAlert, CheckCheck, Eye, X, ExternalLink,
  RefreshCw, Inbox, AlertTriangle, Clock, Zap,
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
  alertStatus: string;
  senderEmail: string;
  subject: string;
  emailBody: string;
  receivedAt: string;
  matchStatus: string;
  aiSummary: string | null;
  aiActionable: string | null;
  aiIntent: string | null;
  inboundEmailId: number;
}

function senderInitials(email: string) {
  const parts = email.split("@")[0].replace(/[._-]/g, " ").trim().split(" ");
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
}

function avatarColor(email: string) {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-sky-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type FilterKey = "all" | "conflicts" | "new" | "invalid";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailInboxPanel({ isOpen, onClose }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: alerts = [], isLoading } = useQuery<EmailAlert[]>({
    queryKey: ["/api/email-intelligence/alerts"],
    enabled: isOpen,
    refetchInterval: isOpen ? 30_000 : false,
  });

  const processMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/email-intelligence/process-demo"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/email-intelligence/alerts"] });
      toast({ title: "Demo cases loaded", description: "6 carrier emails processed by AI." });
    },
    onError: () => toast({ title: "Processing failed", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/email-intelligence/alerts/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/email-intelligence/alerts"] }),
  });

  const filtered = alerts.filter((a) => {
    if (filter === "conflicts") return a.conflictFlag;
    if (filter === "new") return a.alertStatus === "new";
    if (filter === "invalid") return a.matchStatus === "invalid_sender";
    return true;
  });

  const newCount = alerts.filter((a) => a.alertStatus === "new").length;
  const conflictCount = alerts.filter((a) => a.conflictFlag).length;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed right-3 top-12 z-50 w-[390px] rounded-xl border bg-background shadow-2xl flex flex-col"
        style={{ maxHeight: "calc(100vh - 64px)" }}
        onClick={(e) => e.stopPropagation()}
        data-testid="email-inbox-panel"
      >
        {/* ── Panel Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold leading-none">Carrier Email Inbox</span>
                <Badge className="text-[9px] px-1.5 h-4 bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 gap-1 font-medium">
                  <Bot className="h-2.5 w-2.5" /> AI
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {alerts.length === 0 ? "No emails processed" : `${alerts.length} emails · ${newCount} new · ${conflictCount} conflicts`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link href="/email-intelligence" onClick={onClose}>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Open full page" data-testid="button-open-email-full">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} data-testid="button-close-email-panel">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Filter Pills ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b">
          {(["all", "conflicts", "new", "invalid"] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f === "all" ? `All (${alerts.length})` : f === "conflicts" ? `⚡ Conflicts (${conflictCount})` : f === "new" ? `New (${newCount})` : "Invalid Sender"}
            </button>
          ))}
        </div>

        {/* ── Message List ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40" style={{ minHeight: 0 }}>
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-5 w-5 opacity-40" />
              </div>
              {alerts.length === 0 ? (
                <>
                  <p className="text-sm font-medium">No emails yet</p>
                  <p className="text-xs text-center px-6">Load demo cases to see AI-processed carrier emails with conflict detection.</p>
                  <Button
                    size="sm"
                    className="mt-1 gap-1.5 text-xs"
                    onClick={() => processMutation.mutate()}
                    disabled={processMutation.isPending}
                    data-testid="button-load-demo-empty"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {processMutation.isPending ? "Processing…" : "Load Demo Cases"}
                  </Button>
                </>
              ) : (
                <p className="text-sm">No emails match this filter</p>
              )}
            </div>
          ) : (
            filtered.map((alert) => {
              const isExpanded = expandedId === alert.id;
              const isConflict = alert.conflictFlag;
              const isInvalid = alert.matchStatus === "invalid_sender";
              const initials = senderInitials(alert.senderEmail);
              const avatarCls = isInvalid ? "bg-gray-400" : isConflict ? "bg-red-500" : avatarColor(alert.senderEmail);

              return (
                <div
                  key={alert.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${isConflict ? "border-l-2 border-l-red-400" : isInvalid ? "border-l-2 border-l-gray-300" : "border-l-2 border-l-transparent"}`}
                  onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                  data-testid={`email-panel-alert-${alert.id}`}
                >
                  <div className="flex gap-3">
                    {/* Avatar */}
                    <div className={`h-9 w-9 rounded-full ${avatarCls} flex items-center justify-center shrink-0 text-white text-[11px] font-bold`}>
                      {initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-semibold truncate max-w-[160px] ${alert.alertStatus === "new" ? "text-foreground" : "text-muted-foreground"}`}>
                            {alert.senderEmail.split("@")[0].replace(/[._-]/g, " ")}
                          </span>
                          {isConflict && (
                            <Badge className="text-[9px] px-1 h-3.5 bg-red-100 text-red-700 gap-0.5 border-red-200 dark:bg-red-900/20 dark:text-red-400">
                              <ShieldAlert className="h-2 w-2" /> Conflict
                            </Badge>
                          )}
                          {isInvalid && (
                            <Badge className="text-[9px] px-1 h-3.5 bg-gray-100 text-gray-600 border-gray-200">
                              Unknown
                            </Badge>
                          )}
                          {alert.alertStatus === "new" && !isConflict && !isInvalid && (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(alert.receivedAt)}</span>
                      </div>

                      <p className={`text-xs mt-0.5 truncate ${alert.alertStatus === "new" ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {alert.subject}
                      </p>

                      {alert.shipmentRefNo && (
                        <span className="inline-flex items-center font-mono text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded mt-1 mr-1">
                          {alert.shipmentRefNo}
                        </span>
                      )}

                      {alert.aiSummary && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                          {alert.aiSummary}
                        </p>
                      )}

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div
                          className="mt-3 space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {alert.conflictReason && (
                            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-red-700 dark:text-red-400 font-medium">{alert.conflictReason}</p>
                            </div>
                          )}
                          {alert.suggestedAction && (
                            <div className="flex items-start gap-1.5 p-2 rounded-lg bg-muted/50 border">
                              <Clock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <p className="text-[11px] text-foreground">{alert.suggestedAction}</p>
                            </div>
                          )}
                          <div className="flex gap-1.5 pt-1">
                            {alert.alertStatus === "new" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] gap-1"
                                onClick={() => statusMutation.mutate({ id: alert.id, status: "acknowledged" })}
                                disabled={statusMutation.isPending}
                                data-testid={`button-acknowledge-${alert.id}`}
                              >
                                <Eye className="h-3 w-3" /> Acknowledge
                              </Button>
                            )}
                            {alert.alertStatus !== "reviewed" && (
                              <Button
                                size="sm"
                                className="h-6 text-[11px] gap-1"
                                onClick={() => statusMutation.mutate({ id: alert.id, status: "reviewed" })}
                                disabled={statusMutation.isPending}
                                data-testid={`button-mark-reviewed-${alert.id}`}
                              >
                                <CheckCheck className="h-3 w-3" /> Mark Reviewed
                              </Button>
                            )}
                            {alert.alertStatus === "reviewed" && (
                              <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                                <CheckCheck className="h-3 w-3" /> Reviewed
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t bg-muted/20 rounded-b-xl">
          {alerts.length > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] gap-1.5 text-muted-foreground"
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
              data-testid="button-reload-demo"
            >
              <RefreshCw className={`h-3 w-3 ${processMutation.isPending ? "animate-spin" : ""}`} />
              Reload Demo
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
              data-testid="button-load-demo-footer"
            >
              <Zap className="h-3 w-3" />
              {processMutation.isPending ? "Processing…" : "Load Demo Cases"}
            </Button>
          )}
          <Link href="/email-intelligence" onClick={onClose} className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5">
            Open full page <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </>
  );
}

export function EmailInboxTrigger({ onClick, alertCount }: { onClick: () => void; alertCount: number }) {
  const newCount = alertCount;
  return (
    <button
      onClick={onClick}
      className="relative flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent transition-colors"
      data-testid="button-email-inbox-trigger"
      title="Carrier Email Inbox"
    >
      <Mail className="h-4 w-4 text-muted-foreground" />
      {newCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
          {newCount > 9 ? "9+" : newCount}
        </span>
      )}
    </button>
  );
}
