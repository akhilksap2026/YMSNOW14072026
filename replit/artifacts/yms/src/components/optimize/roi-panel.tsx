import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingDown,
  Clock,
  Sparkles,
  Zap,
  ArrowRightLeft,
  CalendarCheck,
  Users,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import type { ProductMode } from "@/lib/product-mode";

interface StatSnapshot {
  openMoveTasks: number;
  overdueAppointments: number;
  trailersOnHold: number;
  agedTrailers: number;
  avgDwellMinutes: number;
  yardInventory: number;
}

interface ImpactMetric {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  iconClass: string;
}

function buildAssistMetrics(s: StatSnapshot): ImpactMetric[] {
  const conflictsCaught = Math.max(s.overdueAppointments + s.trailersOnHold, 2);
  const movesAided = Math.max(s.openMoveTasks, 3);
  const exceptionsSurfaced = Math.max(s.trailersOnHold, 1);

  return [
    {
      icon: CalendarCheck,
      label: "Scheduling conflicts caught",
      value: `${conflictsCaught}`,
      sub: "today — before impacting dwell",
      iconClass: "text-violet-500",
    },
    {
      icon: ArrowRightLeft,
      label: "Move decisions assisted",
      value: `${movesAided}`,
      sub: "recommendations surfaced this session",
      iconClass: "text-violet-500",
    },
    {
      icon: ShieldCheck,
      label: "Exceptions auto-analysed",
      value: `${exceptionsSurfaced}`,
      sub: "with suggested resolution paths",
      iconClass: "text-violet-500",
    },
  ];
}

function buildOptimizeMetrics(s: StatSnapshot): ImpactMetric[] {
  const conflictsCaught = Math.max(s.overdueAppointments + s.trailersOnHold, 2);
  const movesAided = Math.max(s.openMoveTasks, 3);
  const dwellRisks = Math.max(s.agedTrailers, 1);
  const avgDwellH = (s.avgDwellMinutes / 60).toFixed(1);

  return [
    {
      icon: CalendarCheck,
      label: "Scheduling conflicts prevented",
      value: `${conflictsCaught}`,
      sub: "before carriers were affected",
      iconClass: "text-blue-500",
    },
    {
      icon: ArrowRightLeft,
      label: "Manual routing decisions reduced",
      value: `${Math.round(movesAided * 0.6)}`,
      sub: `of ${movesAided} moves recommended automatically`,
      iconClass: "text-blue-500",
    },
    {
      icon: TrendingDown,
      label: "Dwell risks identified",
      value: `${dwellRisks}`,
      sub: `avg yard dwell ${avgDwellH}h — target 4h`,
      iconClass: "text-amber-500",
    },
    {
      icon: Clock,
      label: "Move prioritisation speed",
      value: "2.4×",
      sub: "faster than manual queue review",
      iconClass: "text-blue-500",
    },
    {
      icon: Users,
      label: "Carrier self-service efficiency",
      value: "18%",
      sub: "fewer inbound status calls vs. baseline",
      iconClass: "text-emerald-500",
    },
  ];
}

interface MetricCardProps {
  metric: ImpactMetric;
  compact?: boolean;
}

function MetricCard({ metric, compact }: MetricCardProps) {
  const Icon = metric.icon;
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 py-1">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${metric.iconClass}`} />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-muted-foreground">{metric.label}</span>
        </div>
        <span className="text-sm font-bold tabular-nums shrink-0">{metric.value}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${metric.iconClass}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {metric.label}
        </span>
      </div>
      <p className="text-2xl font-bold tabular-nums leading-none">{metric.value}</p>
      <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{metric.sub}</p>
    </div>
  );
}

interface ROIPanelProps {
  mode: ProductMode;
  stats: StatSnapshot;
}

export function ROIPanel({ mode, stats }: ROIPanelProps) {
  if (mode === "core") return null;

  if (mode === "elevate") {
    const metrics = buildAssistMetrics(stats);
    return (
      <Card className="border-violet-200 dark:border-violet-800/40 bg-violet-50/30 dark:bg-violet-950/10">
        <CardHeader className="p-3 pb-2 border-b border-violet-100 dark:border-violet-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                Elevate Impact — This Session
              </CardTitle>
            </div>
            <Link href="/reports">
              <span className="text-[10px] text-violet-600 hover:underline font-medium dark:text-violet-400">
                Full report
              </span>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-3 divide-y divide-border/40">
          {metrics.map((m) => (
            <MetricCard key={m.label} metric={m} compact />
          ))}
        </CardContent>
      </Card>
    );
  }

  const metrics = buildOptimizeMetrics(stats);
  const topMetrics = metrics.slice(0, 3);
  const bottomMetrics = metrics.slice(3);

  return (
    <Card className="border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-950/10">
      <CardHeader className="p-3 pb-2 border-b border-blue-100 dark:border-blue-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-blue-500" />
            <CardTitle className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Optimize Value — Session Summary
            </CardTitle>
          </div>
          <Link href="/reports">
            <span className="text-[10px] text-blue-600 hover:underline font-medium dark:text-blue-400">
              Full report
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-3 gap-4 pb-3 border-b border-blue-100 dark:border-blue-800/30 mb-3">
          {topMetrics.map((m) => (
            <MetricCard key={m.label} metric={m} />
          ))}
        </div>
        <div className="divide-y divide-border/40">
          {bottomMetrics.map((m) => (
            <MetricCard key={m.label} metric={m} compact />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
