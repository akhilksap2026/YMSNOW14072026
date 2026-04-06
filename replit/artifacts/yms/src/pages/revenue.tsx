import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";
import { SERVICE_COLORS, BILLING_STATUS_CONFIG, UNIT_LABELS } from "@/lib/service-config";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Clock, AlertCircle, Zap,
  Building2, Truck, Package, CheckCircle2, ArrowUpRight, RefreshCw,
  Settings, ChevronDown, BadgeDollarSign, Gauge, Timer, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";


function KpiCard({ icon, label, value, sub, trend, color = "bg-primary/10 text-primary", loading }: { icon: any; label: string; value: string; sub?: string; trend?: number; color?: string; loading?: boolean }) {
  const Icon = icon;
  return (
    <Card data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
              <div className={`p-1.5 rounded-md ${color}`}><Icon className="h-3.5 w-3.5" /></div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}>
                {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}% vs last week
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RevenueTabContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("revenue");
  const [editingRate, setEditingRate] = useState<Record<string, string>>({});

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ["/api/revenue/dashboard"],
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ["/api/revenue/events"],
  });

  const updateRateMutation = useMutation({
    mutationFn: ({ serviceType, body }: { serviceType: string; body: any }) =>
      apiRequest("PATCH", `/api/revenue/rates/${serviceType}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenue/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/revenue/events"] });
      toast({ title: "Rate updated", description: "Billing rate has been saved." });
      setEditingRate({});
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const summary = dashboard?.summary;
  const savings = dashboard?.savings;
  const byType = dashboard?.byType ?? [];
  const byCarrier = dashboard?.byCarrier ?? [];
  const trend = dashboard?.trend ?? [];
  const rates = dashboard?.rates ?? [];

  const trendData = trend.map((t: any) => ({
    ...t,
    label: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenueK: t.revenue / 100,
    savingsK: t.savings / 100,
  }));

  const byTypeChart = byType.map((t: any) => ({
    name: t.displayName,
    value: t.amount / 100,
    color: SERVICE_COLORS[t.serviceType] ?? "#94a3b8",
    count: t.count,
  }));

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/30">
            <BadgeDollarSign className="h-5 w-5 text-green-700 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="page-title">Revenue & Financial Intelligence</h1>
            <p className="text-sm text-muted-foreground">Yard monetization · Cost savings · Billing events · Rate configuration</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/revenue/dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["/api/revenue/events"] });
          }}
          data-testid="button-refresh"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Today's Revenue" value={summary ? formatCurrency(summary.todayRevenue, true) : "—"} sub="all billable events" color="bg-green-100 text-green-700" loading={isLoading} />
        <KpiCard icon={TrendingUp} label="This Week" value={summary ? formatCurrency(summary.weekRevenue, true) : "—"} sub="7-day rolling" color="bg-blue-100 text-blue-700" loading={isLoading} />
        <KpiCard icon={Zap} label="Est. Monthly" value={summary ? formatCurrency(Math.round(summary.weekRevenue * 4.3), true) : "—"} sub="projected from trend" color="bg-purple-100 text-purple-700" loading={isLoading} />
        <KpiCard icon={Gauge} label="Cost Savings" value={savings ? formatCurrency(savings.total, true) : "—"} sub="efficiency gains" color="bg-emerald-100 text-emerald-700" loading={isLoading} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Clock} label="Pending Events" value={summary ? String(summary.activeEvents) : "—"} sub="awaiting final billing" color="bg-amber-100 text-amber-700" loading={isLoading} />
        <KpiCard icon={CheckCircle2} label="Billed Events" value={summary ? String(summary.billedEvents) : "—"} sub="completed & invoiced" color="bg-green-100 text-green-700" loading={isLoading} />
        <KpiCard icon={Truck} label="Avg Rev/Visit" value={summary ? formatCurrency(summary.avgRevenuePerVisit || 0, true) : "—"} sub="per trailer handled" color="bg-sky-100 text-sky-700" loading={isLoading} />
        <KpiCard icon={Building2} label="Dock Utilization" value={summary ? `${summary.currentUtilPct}%` : "—"} sub="vs 55% industry baseline" color="bg-indigo-100 text-indigo-700" loading={isLoading} />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue Intelligence</TabsTrigger>
          <TabsTrigger value="savings" data-testid="tab-savings">Cost Savings</TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">Billing Events</TabsTrigger>
          <TabsTrigger value="rates" data-testid="tab-rates">Rate Configuration</TabsTrigger>
        </TabsList>

        {/* ── REVENUE TAB ─────────────────────────────────────────────────── */}
        <TabsContent value="revenue" className="space-y-5">
          <div className="grid grid-cols-3 gap-5">
            {/* 7-Day Revenue Trend */}
            <Card className="col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">7-Day Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-52 w-full" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="saveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "K" : v}`} />
                      <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(0)}`, ""]} />
                      <Area type="monotone" dataKey="revenueK" stroke="#3b82f6" fill="url(#revGrad)" strokeWidth={2} name="Revenue ($)" />
                      <Area type="monotone" dataKey="savingsK" stroke="#10b981" fill="url(#saveGrad)" strokeWidth={2} name="Savings ($)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Revenue</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-3 h-0.5 bg-emerald-500 inline-block" /> Savings Est.</div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Type */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Revenue by Service Type</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-52 w-full" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byTypeChart} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "K" : v}`} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip formatter={(v: any) => [`$${Number(v).toFixed(0)}`, ""]} />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                        {byTypeChart.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Revenue by Carrier */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Revenue by Carrier</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? <Skeleton className="h-40 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                      <TableHead className="text-right">Total Revenue</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byCarrier.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No revenue data available</TableCell></TableRow>
                    ) : byCarrier.map((c: any, i: number) => {
                      const share = dashboard?.summary?.totalRevenue > 0 ? Math.round((c.amount / dashboard.summary.totalRevenue) * 100) : 0;
                      return (
                        <TableRow key={i} data-testid={`row-carrier-${i}`}>
                          <TableCell className="font-medium text-sm">{c.carrierName}</TableCell>
                          <TableCell className="text-right text-sm">{c.count}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{formatCurrency(c.amount)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 bg-muted rounded-full h-1.5">
                                <div className="bg-primary h-1.5 rounded-full" style={{ width: `${share}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{share}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Revenue breakdown cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {isLoading ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-24" />) :
              byType.map((t: any, i: number) => (
                <Card key={i} className="border-l-4" style={{ borderLeftColor: SERVICE_COLORS[t.serviceType] ?? "#94a3b8" }}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-medium text-muted-foreground">{t.displayName}</p>
                      <Badge variant="outline" className="text-[10px]">{t.count} events</Badge>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(t.amount)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dashboard?.summary?.totalRevenue > 0 ? Math.round((t.amount / dashboard.summary.totalRevenue) * 100) : 0}% of total revenue
                    </p>
                  </CardContent>
                </Card>
              ))
            }
          </div>
        </TabsContent>

        {/* ── SAVINGS TAB ─────────────────────────────────────────────────── */}
        <TabsContent value="savings" className="space-y-5">
          {/* Savings Hero Banner */}
          <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">Total Operational Cost Savings</p>
                <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">{savings ? formatCurrency(savings.total, true) : "—"}</p>
                <p className="text-sm text-muted-foreground mt-1">Estimated value generated through YardNow operational efficiency</p>
              </div>
              <div className="hidden md:grid grid-cols-2 gap-3">
                {[
                  { label: "Dock Gain", value: savings?.dockUtilizationGain, icon: Building2 },
                  { label: "Dwell Reduction", value: savings?.dwellTimeReduction, icon: Timer },
                  { label: "Exception Resolution", value: savings?.exceptionResolution, icon: ShieldCheck },
                  { label: "Move Efficiency", value: savings?.moveEfficiency, icon: Zap },
                ].map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className="flex items-center gap-2 bg-white/60 dark:bg-black/20 rounded-lg px-3 py-2 min-w-[140px]">
                      <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        <p className="text-sm font-bold">{s.value != null ? formatCurrency(s.value, true) : "—"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Dock Utilization */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-semibold">Dock Utilization Improvement</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Industry Baseline</span>
                  <span className="font-semibold">55%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Utilization</span>
                  <span className="font-bold text-blue-600">{summary?.currentUtilPct ?? "—"}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 relative">
                  <div className="bg-slate-400 h-3 rounded-full absolute" style={{ width: "55%" }} />
                  <div className="bg-blue-500 h-3 rounded-l-full" style={{ width: `${Math.min(summary?.currentUtilPct ?? 0, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">Grey bar = 55% baseline. Blue = current. Every percentage point above baseline delivers value in reduced idle dock cost.</p>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-muted-foreground">Estimated savings from dock gains</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{savings ? formatCurrency(savings.dockUtilizationGain, true) : "—"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Dwell Time Reduction */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-sm font-semibold">Trailer Dwell Time Reduction</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Industry Benchmark</span>
                  <span className="font-semibold">{savings?.benchmarkDwell ?? 42} hrs</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Your Avg Dwell</span>
                  <span className={`font-bold ${(savings?.avgDwellHours ?? 99) < (savings?.benchmarkDwell ?? 42) ? "text-green-600" : "text-amber-600"}`}>
                    {savings?.avgDwellHours ?? "—"} hrs
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 relative">
                  <div className="bg-amber-400 h-3 rounded-full absolute" style={{ width: `${Math.min((savings?.avgDwellHours ?? 0) / 60 * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {savings?.dwellSavingHours > 0 ? `YardNow is saving ${savings.dwellSavingHours}h per visit vs. the industry average — reducing labor idle time, detention risk, and slot congestion.` : "Dwell time is above benchmark. Optimize dock assignments and jockey moves to reduce."}
                </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-muted-foreground">Savings from faster turnaround</p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{savings ? formatCurrency(savings.dwellTimeReduction, true) : "—"}</p>
                </div>
              </CardContent>
            </Card>

            {/* Exception Resolution */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-sm font-semibold">Exception & Hold Resolution Value</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Each resolved hold or exception prevents an average of <strong>$250</strong> in carrier downtime, disputes, and manual remediation costs.</p>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-muted-foreground">Estimated resolution savings</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{savings ? formatCurrency(savings.exceptionResolution, true) : "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground">Value based on number of resolved holds × $250 average cost-per-incident avoided through YardNow structured workflows.</p>
              </CardContent>
            </Card>

            {/* Move Task Efficiency */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-600" />
                  <CardTitle className="text-sm font-semibold">Jockey Move Efficiency Value</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Structured digital move task management eliminates idle dispatch, reduces missed moves, and saves an estimated <strong>$45</strong> per completed task in labor efficiency.</p>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200">
                  <p className="text-xs text-muted-foreground">Move efficiency savings</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{savings ? formatCurrency(savings.moveEfficiency, true) : "—"}</p>
                </div>
                <p className="text-xs text-muted-foreground">Calculated from total completed move tasks × $45 estimated labor + fuel savings per structured digital dispatch vs. radio/whiteboard coordination.</p>
              </CardContent>
            </Card>
          </div>

          {/* Value Summary Card */}
          <Card className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/30 dark:to-slate-800/20">
            <CardContent className="p-5">
              <p className="text-sm font-semibold mb-3">Financial Impact Summary — How YardNow Pays for Itself</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Revenue Generated", value: summary ? formatCurrency(summary.totalRevenue, true) : "—", desc: "Through billable yard services", color: "text-blue-700" },
                  { label: "Cost Savings Delivered", value: savings ? formatCurrency(savings.total, true) : "—", desc: "Via operational efficiency", color: "text-green-700" },
                  { label: "Combined Financial Impact", value: summary && savings ? formatCurrency(summary.totalRevenue + savings.total, true) : "—", desc: "Revenue + savings combined", color: "text-purple-700" },
                  { label: "Avg Revenue/Visit", value: summary ? formatCurrency(summary.avgRevenuePerVisit || 0, true) : "—", desc: "Per trailer handled through yard", color: "text-amber-700" },
                ].map((s, i) => (
                  <div key={i} className="text-center p-3 bg-white/70 dark:bg-black/20 rounded-lg border">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs font-semibold mt-1">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BILLING EVENTS TAB ──────────────────────────────────────────── */}
        <TabsContent value="events">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Computed Billing Events</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[11px]">{events.length} total events</Badge>
                  <Badge className="text-[11px] bg-amber-100 text-amber-700 border-amber-200">{events.filter((e: any) => e.status === "pending").length} pending</Badge>
                  <Badge className="text-[11px] bg-green-100 text-green-700 border-green-200">{events.filter((e: any) => e.status === "billed").length} billed</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {eventsLoading ? (
                <div className="space-y-2">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No billing events computed yet. Check-in some trailers to generate revenue data.</TableCell></TableRow>
                    ) : events.slice(0, 200).map((e: any) => {
                      const sc = BILLING_STATUS_CONFIG[e.status] ?? BILLING_STATUS_CONFIG.pending;
                      return (
                        <TableRow key={e.id} data-testid={`row-event-${e.id}`}>
                          <TableCell className="font-mono text-[11px] text-muted-foreground">{e.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SERVICE_COLORS[e.serviceType] ?? "#94a3b8" }} />
                              <span className="text-xs font-medium">{e.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{e.carrierName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.description}</TableCell>
                          <TableCell className="text-xs">{e.quantityDisplay}</TableCell>
                          <TableCell className="text-right text-xs">{formatCurrency(e.ratePerUnit)}</TableCell>
                          <TableCell className="text-right text-sm font-bold">{formatCurrency(e.totalAmount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── RATE CONFIGURATION TAB ──────────────────────────────────────── */}
        <TabsContent value="rates">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Billing Rate Configuration</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Configure the rates used to compute billing events from operational data. Changes apply to all future computations.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {isLoading ? (
                <div className="space-y-3">{Array(9).fill(0).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Free Period</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((r: any) => {
                      const editKey = r.serviceType;
                      const editing = editingRate[editKey] !== undefined;
                      const color = SERVICE_COLORS[r.serviceType] ?? "#94a3b8";
                      return (
                        <TableRow key={r.serviceType} data-testid={`row-rate-${r.serviceType}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                              <span className="text-sm font-medium">{r.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.description}</TableCell>
                          <TableCell className="text-xs">{UNIT_LABELS[r.unit] ?? r.unit}</TableCell>
                          <TableCell className="text-xs">{r.freeHours > 0 ? `${r.freeHours}h free` : "—"}</TableCell>
                          <TableCell className="text-right">
                            {editing ? (
                              <Input
                                type="number"
                                value={editingRate[editKey]}
                                onChange={(e) => setEditingRate((p) => ({ ...p, [editKey]: e.target.value }))}
                                className="w-24 h-7 text-sm text-right"
                                data-testid={`input-rate-${r.serviceType}`}
                              />
                            ) : (
                              <span className="text-sm font-semibold">{formatCurrency(r.ratePerUnit)}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={r.isActive}
                              data-testid={`switch-rate-${r.serviceType}`}
                              onCheckedChange={(checked) =>
                                updateRateMutation.mutate({ serviceType: r.serviceType, body: { isActive: checked, ratePerUnit: r.ratePerUnit, freeHours: r.freeHours } })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            {editing ? (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-6 text-[11px]"
                                  data-testid={`button-save-rate-${r.serviceType}`}
                                  onClick={() => {
                                    const newRate = Math.round(parseFloat(editingRate[editKey]) * 100);
                                    updateRateMutation.mutate({ serviceType: r.serviceType, body: { ratePerUnit: newRate, isActive: r.isActive, freeHours: r.freeHours } });
                                  }}
                                  disabled={updateRateMutation.isPending}
                                >
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setEditingRate((p) => { const n = { ...p }; delete n[editKey]; return n; })}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px]"
                                data-testid={`button-edit-rate-${r.serviceType}`}
                                onClick={() => setEditingRate((p) => ({ ...p, [editKey]: (r.ratePerUnit / 100).toString() }))}
                              >
                                Edit
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <div className="mt-4 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                <strong>Note:</strong> Rates are in US dollars and are stored as cents in the database. Changes to rates affect all future billing event computations. Historical events displayed in the Billing Events tab are recomputed using the current rate configuration on every page load.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function RevenuePage() {
  return <RevenueTabContent />;
}
