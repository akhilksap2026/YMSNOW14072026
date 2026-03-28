import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader, EmptyState } from "@/components/enterprise";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import {
  Bell, AlertTriangle, AlertOctagon, Mail, MoveRight, CheckCheck,
  Clock, ShieldAlert, Zap, ChevronRight, BellOff, RefreshCw,
} from "lucide-react";

interface Notification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  entityId: number;
  route: string;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  high: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-l-red-500",
    icon: AlertOctagon,
  },
  medium: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    border: "border-l-amber-500",
    icon: AlertTriangle,
  },
  low: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/20",
    border: "border-l-blue-500",
    icon: Bell,
  },
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; badge: string }> = {
  escalated_task: { label: "Escalated Task", icon: Zap, badge: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  exception: { label: "Exception", icon: ShieldAlert, badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  email_conflict: { label: "Email Conflict", icon: Mail, badge: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  email_alert: { label: "Email Alert", icon: Mail, badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400" },
};

export default function NotificationsPage() {
  const [, navigate] = useLocation();

  const { data: notifications = [], isLoading, refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
  });

  const dismissMutation = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) =>
      apiRequest("PATCH", `/api/notifications/dismiss/${type}/${id}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const high = notifications.filter((n) => n.severity === "high").length;
  const medium = notifications.filter((n) => n.severity === "medium").length;
  const tasks = notifications.filter((n) => n.type === "escalated_task").length;
  const emails = notifications.filter((n) => n.type.startsWith("email")).length;

  const KPI_ITEMS = [
    { label: "Total Alerts", value: notifications.length, icon: Bell, color: "text-primary" },
    { label: "High Priority", value: high, icon: AlertOctagon, color: high > 0 ? "text-red-500" : "text-muted-foreground" },
    { label: "Escalated Tasks", value: tasks, icon: Zap, color: tasks > 0 ? "text-amber-500" : "text-muted-foreground" },
    { label: "Email Conflicts", value: emails, icon: Mail, color: emails > 0 ? "text-violet-500" : "text-muted-foreground" },
  ];

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Notifications"
        subtitle="Unified alert center — escalated tasks, exceptions, and email intelligence conflicts"
        icon={<Bell className="h-5 w-5" />}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
        kpiStrip={
          <>
            {KPI_ITEMS.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex flex-col items-center gap-1 px-4 py-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xl font-bold">{value}</span>
                <span className="text-[10px] text-muted-foreground text-center">{label}</span>
              </div>
            ))}
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<BellOff className="h-5 w-5" />}
          heading="All clear — no active alerts"
          description="Escalated tasks, open exceptions, and email conflicts will appear here when they need attention."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const sev = SEVERITY_CONFIG[n.severity] ?? SEVERITY_CONFIG.medium;
            const typ = TYPE_CONFIG[n.type] ?? { label: n.type, icon: Bell, badge: "bg-gray-100 text-gray-600" };
            const SevIcon = sev.icon;
            const TypIcon = typ.icon;

            return (
              <Card
                key={n.id}
                className={`border-l-4 ${sev.border} ${sev.bg} hover:shadow-md transition-shadow`}
                data-testid={`notification-${n.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${sev.bg} border`}>
                      <TypIcon className={`h-4 w-4 ${sev.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge className={`text-[10px] px-1.5 ${typ.badge}`}>{typ.label}</Badge>
                        <Badge
                          className={`text-[10px] px-1.5 ${
                            n.severity === "high"
                              ? "bg-red-100 text-red-700"
                              : n.severity === "medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {n.severity.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    </div>

                    <div className="flex gap-2 shrink-0 ml-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => navigate(n.route)}
                        data-testid={`btn-view-${n.id}`}
                      >
                        <ChevronRight className="h-3.5 w-3.5 mr-0.5" /> View
                      </Button>
                      {(n.type === "exception" || n.type.startsWith("email")) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-muted-foreground"
                          onClick={() => dismissMutation.mutate({ type: n.type, id: n.entityId })}
                          disabled={dismissMutation.isPending}
                          data-testid={`btn-dismiss-${n.id}`}
                        >
                          <CheckCheck className="h-3.5 w-3.5 mr-0.5" /> Dismiss
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {notifications.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {notifications.length} active alert{notifications.length !== 1 ? "s" : ""} · Auto-refreshes every 30 seconds
        </p>
      )}
    </div>
  );
}
