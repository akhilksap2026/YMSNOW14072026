import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  CalendarX,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  TrendingDown,
} from "lucide-react";
import type {
  OperationalBrief,
  Recommendation,
} from "@/lib/recommendation-service";

const PRIORITY_STYLES: Record<string, { dot: string; badge: string }> = {
  critical: {
    dot: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  high: {
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  medium: {
    dot: "bg-blue-400",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  low: {
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
};

function PriorityDot({ priority }: { priority: string }) {
  const s = PRIORITY_STYLES[priority] || PRIORITY_STYLES.low;
  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1.5 ${s.dot}`} />;
}

function RecRow({ rec }: { rec: Recommendation }) {
  return (
    <Link href={rec.href}>
      <div className="flex items-start gap-2 px-3 py-2 hover:bg-muted/40 transition-colors rounded cursor-pointer group">
        <PriorityDot priority={rec.priority} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold leading-snug truncate">{rec.title}</p>
          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">
            {rec.description}
          </p>
        </div>
        {rec.metric && (
          <span className="text-[10px] font-bold text-muted-foreground shrink-0 tabular-nums">
            {rec.metric.value}
          </span>
        )}
        <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
}

function EmptyBucket({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-3 text-muted-foreground/60">
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/60 shrink-0" />
      <span className="text-[11px]">{label}</span>
    </div>
  );
}

interface BucketProps {
  title: string;
  icon: React.ElementType;
  recs: Recommendation[];
  emptyLabel: string;
  href: string;
}

function AlertBucket({ title, icon: Icon, recs, emptyLabel, href }: BucketProps) {
  const topRecs = recs.slice(0, 2);
  return (
    <Card className="h-full">
      <CardHeader className="p-3 pb-1.5 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {title}
            </CardTitle>
            {recs.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[9px] min-w-[16px] justify-center"
              >
                {recs.length}
              </Badge>
            )}
          </div>
          {recs.length > 0 && (
            <Link href={href}>
              <span className="text-[10px] text-primary hover:underline font-medium">View</span>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-1">
        {topRecs.length === 0 ? (
          <EmptyBucket label={emptyLabel} />
        ) : (
          topRecs.map((r) => <RecRow key={r.id} rec={r} />)
        )}
      </CardContent>
    </Card>
  );
}

function NextBestActionCard({ rec }: { rec: Recommendation }) {
  const s = PRIORITY_STYLES[rec.priority] || PRIORITY_STYLES.medium;
  return (
    <Link href={rec.href}>
      <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-500/20 px-4 py-3 cursor-pointer hover:border-blue-500/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all group">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Next Best Action
              </span>
              <span
                className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wide ${s.badge}`}
              >
                {rec.priority}
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground leading-snug">{rec.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {rec.description}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="default"
          className="shrink-0 h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700"
        >
          {rec.action}
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    </Link>
  );
}

interface OptimizeDashboardPanelProps {
  brief: OperationalBrief;
}

export function OptimizeDashboardPanel({ brief }: OptimizeDashboardPanelProps) {
  const { bottlenecks, dwellRisks, nextMoves, dockRisks, nextBestAction, totalAlerts } = brief;

  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-blue-600 flex items-center justify-center">
            <Zap className="h-3 w-3 text-white" />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Operational Intelligence
          </h2>
          {totalAlerts > 0 && (
            <Badge className="h-4 px-1.5 text-[10px] min-w-[18px] justify-center bg-blue-600 text-white border-0">
              {totalAlerts}
            </Badge>
          )}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Optimize
        </span>
      </div>

      {nextBestAction && (
        <div className="mb-3">
          <NextBestActionCard rec={nextBestAction} />
        </div>
      )}

      {!nextBestAction && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/30 dark:bg-emerald-950/10 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Yard operating within target parameters
            </p>
            <p className="text-[11px] text-muted-foreground">
              No critical actions required — monitoring continues
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AlertBucket
          title="Bottlenecks"
          icon={AlertTriangle}
          recs={bottlenecks}
          emptyLabel="No bottlenecks detected"
          href="/moves"
        />
        <AlertBucket
          title="Dwell Risk"
          icon={TrendingDown}
          recs={dwellRisks}
          emptyLabel="Dwell times on target"
          href="/yard/inventory"
        />
        <AlertBucket
          title="Recommended Moves"
          icon={ArrowRightLeft}
          recs={nextMoves}
          emptyLabel="No unassigned moves"
          href="/moves"
        />
        <AlertBucket
          title="Dock & Appt Risk"
          icon={CalendarX}
          recs={dockRisks}
          emptyLabel="Dock schedule on track"
          href="/appointments"
        />
      </div>
    </section>
  );
}

interface AssistSummaryBannerProps {
  items: { label: string; count: number; href: string }[];
}

export function AssistSummaryBanner({ items }: AssistSummaryBannerProps) {
  if (items.length === 0) return null;

  const total = items.reduce((a, b) => a + b.count, 0);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800/30 dark:bg-violet-950/10 px-4 py-2.5">
      <div className="flex items-center gap-1.5 shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        <span className="text-[11px] font-bold text-violet-700 dark:text-violet-400 uppercase tracking-wider">
          {total} item{total !== 1 ? "s" : ""} need attention
        </span>
      </div>
      <div className="h-3 w-px bg-violet-200 dark:bg-violet-700 hidden sm:block" />
      {items.map((item) => (
        <Link key={item.href} href={item.href}>
          <span className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1">
            <span className="font-semibold text-violet-700 dark:text-violet-400">{item.count}</span>
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
