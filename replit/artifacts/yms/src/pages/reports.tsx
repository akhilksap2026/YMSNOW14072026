import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, KPICard } from "@/components/enterprise";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  BarChart3, Download, FileText, Clock, Boxes, DoorOpen,
  ArrowRightLeft, CalendarCheck, AlertTriangle, TrendingUp, TrendingDown,
  Minus, RefreshCcw, Filter,
} from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { formatDwell } from "@/lib/format";
import { RevenueTabContent } from "@/pages/revenue";

interface ReportKPIs {
  avgDwellMinutes: number;
  yardOccupancyRate: number;
  dockUtilizationRate: number;
  avgMoveTimeMinutes: number;
  onTimeArrivalRate: number;
  holdPercentage: number;
}

interface ReportsSummary {
  kpis: ReportKPIs;
  yardOccupancyTrend: { day: string; occupancy: number }[];
  dwellTimeTrend: { day: string; avgDwell: number }[];
  dockUtilizationChart: { door: string; active: number; available: number; status: string; trailer: string | null; visitStatus: string | null }[];
  carrierOnTime: { carrier: string; onTime: number; late: number; rate: number; total: number }[];
  moveTaskTrend: { day: string; completed: number; open: number }[];
  holdDistribution: { type: string; count: number }[];
  carrierSummary: { carrier: string; visits: number; avgDwell: number; onTimeRate: number; holds: number }[];
  dockSummary: { door: string; status: string; trailer: string; carrier: string; utilization: number }[];
  yardZoneSummary: { zone: string; total: number; occupied: number; holds: number; rate: number }[];
  moveProductivity: { type: string; completed: number; inProgress: number; open: number; assigned: number; total: number }[];
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

function RateIndicator({ rate, threshold = 70 }: { rate: number; threshold?: number }) {
  if (rate >= threshold + 10) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (rate < threshold) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-amber-500" />;
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <BarChart3 className="h-8 w-8 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

const CustomTooltipStyle = {
  contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" },
  itemStyle: { color: "hsl(var(--foreground))" },
  labelStyle: { fontWeight: 600 },
};

export default function ReportsPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const axisColor = isDark ? "#6b7280" : "#9ca3af";

  const [dateRange, setDateRange] = useState("7d");
  const [carrierFilter, setCarrierFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [movementTypeFilter, setMovementTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"overview" | "carrier" | "dock" | "moves" | "revenue">("overview");

  const { data, isLoading, refetch } = useQuery<ReportsSummary>({
    queryKey: ["/api/reports/summary"],
    staleTime: 60_000,
  });

  const filteredCarrierSummary = useMemo(() => {
    if (!data) return [];
    return data.carrierSummary.filter((c) =>
      carrierFilter === "all" || c.carrier.toLowerCase().includes(carrierFilter.toLowerCase())
    );
  }, [data, carrierFilter]);

  const filteredZoneSummary = useMemo(() => {
    if (!data) return [];
    return data.yardZoneSummary.filter((z) =>
      zoneFilter === "all" || z.zone.toLowerCase().includes(zoneFilter.toLowerCase())
    );
  }, [data, zoneFilter]);

  function exportCSV(rows: Record<string, any>[], filename: string) {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    window.print();
  }

  const kpis = data?.kpis;

  const kpiCards = [
    {
      label: "Avg Dwell Time",
      value: kpis ? formatDwell(kpis.avgDwellMinutes) : "—",
      icon: <Clock className="h-4 w-4" />,
      accent: kpis && kpis.avgDwellMinutes > 480 ? "border-l-red-500" : undefined,
      testId: "kpi-avg-dwell",
    },
    {
      label: "Yard Occupancy",
      value: kpis ? `${kpis.yardOccupancyRate}%` : "—",
      icon: <Boxes className="h-4 w-4" />,
      accent: kpis && kpis.yardOccupancyRate > 85 ? "border-l-amber-500" : undefined,
      testId: "kpi-yard-occupancy",
    },
    {
      label: "Dock Utilization",
      value: kpis ? `${kpis.dockUtilizationRate}%` : "—",
      icon: <DoorOpen className="h-4 w-4" />,
      testId: "kpi-dock-util",
    },
    {
      label: "Avg Move Time",
      value: kpis ? (kpis.avgMoveTimeMinutes > 0 ? formatDwell(kpis.avgMoveTimeMinutes) : "N/A") : "—",
      icon: <ArrowRightLeft className="h-4 w-4" />,
      testId: "kpi-avg-move",
    },
    {
      label: "On-Time Arrivals",
      value: kpis ? `${kpis.onTimeArrivalRate}%` : "—",
      icon: <CalendarCheck className="h-4 w-4" />,
      accent: kpis && kpis.onTimeArrivalRate < 70 ? "border-l-red-500" : undefined,
      testId: "kpi-on-time",
    },
    {
      label: "Hold Rate",
      value: kpis ? `${kpis.holdPercentage}%` : "—",
      icon: <AlertTriangle className="h-4 w-4" />,
      accent: kpis && kpis.holdPercentage > 15 ? "border-l-red-500" : undefined,
      testId: "kpi-hold-rate",
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 print:p-2">
      <PageHeader
        title="Reports & Analytics"
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-reports">
              <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV(data?.carrierSummary || [], "carrier-summary")} data-testid="button-export-csv">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} data-testid="button-export-pdf">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Export PDF
            </Button>
          </div>
        }
      />

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Filter className="h-3.5 w-3.5" /> Filters
            </div>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={carrierFilter} onValueChange={setCarrierFilter}>
              <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-carrier-filter">
                <SelectValue placeholder="All Carriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Carriers</SelectItem>
                {data?.carrierSummary.map((c) => (
                  <SelectItem key={c.carrier} value={c.carrier}>{c.carrier}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-zone-filter">
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {data?.yardZoneSummary.map((z) => (
                  <SelectItem key={z.zone} value={z.zone}>{z.zone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
              <SelectTrigger className="h-8 w-44 text-xs" data-testid="select-movement-filter">
                <SelectValue placeholder="All Movement Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Movement Types</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="live_load">Live Load</SelectItem>
                <SelectItem value="live_unload">Live Unload</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((k) =>
          isLoading ? (
            <Skeleton key={k.label} className="h-20 rounded-lg" />
          ) : (
            <KPICard
              key={k.label}
              label={k.label}
              value={k.value}
              icon={k.icon}
              accent={k.accent}
              data-testid={k.testId}
            />
          )
        )}
      </div>

      {/* ── Tab nav ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b print:hidden">
        {(["overview", "carrier", "dock", "moves", "revenue"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            data-testid={`tab-${tab}`}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "overview" ? "Overview" : tab === "carrier" ? "Carrier" : tab === "dock" ? "Dock" : tab === "moves" ? "Move Tasks" : (
              <>Revenue & Billing</>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────────────────── */}
      {(activeTab === "overview" || typeof window === "undefined") && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Yard Occupancy Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" /> Yard Occupancy Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48" /> : !data?.yardOccupancyTrend.length ? <EmptyState label="No occupancy data available" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data.yardOccupancyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} unit="%" />
                      <Tooltip {...CustomTooltipStyle} formatter={(v: any) => [`${v}%`, "Occupancy"]} />
                      <Area type="monotone" dataKey="occupancy" stroke="#3b82f6" strokeWidth={2} fill="url(#occGrad)" dot={{ r: 3, fill: "#3b82f6" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Dwell Time Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" /> Avg Dwell Time Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48" /> : !data?.dwellTimeTrend.length ? <EmptyState label="No dwell data available" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.dwellTimeTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} />
                      <YAxis tick={{ fontSize: 11, fill: axisColor }} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
                      <Tooltip {...CustomTooltipStyle} formatter={(v: any) => [formatDwell(v), "Avg Dwell"]} />
                      <Line type="monotone" dataKey="avgDwell" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Move Task Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-emerald-500" /> Move Task Completion Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48" /> : !data?.moveTaskTrend.length ? <EmptyState label="No move data available" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.moveTaskTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} />
                      <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                      <Tooltip {...CustomTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="open" name="Open" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Hold / Exception Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Hold & Exception Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-48" /> : !data?.holdDistribution.length ? <EmptyState label="No holds or exceptions" /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={data.holdDistribution} cx="50%" cy="50%" outerRadius={75} dataKey="count" label={false}>
                          {data.holdDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...CustomTooltipStyle} formatter={(v: any, _: any, p: any) => [v, p.payload.type]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      {data.holdDistribution.map((h, i) => (
                        <div key={h.type} className="flex items-center gap-2 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="truncate text-muted-foreground flex-1">{h.type}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{h.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Yard Zone Summary Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" /> Yard Status by Zone
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => exportCSV(filteredZoneSummary, "yard-zone-summary")} data-testid="button-export-zone-csv">
                  <Download className="h-3 w-3 mr-1" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? <Skeleton className="h-32 m-4" /> : !filteredZoneSummary.length ? <EmptyState label="No zone data available" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-right">Total Slots</TableHead>
                      <TableHead className="text-right">Occupied</TableHead>
                      <TableHead className="text-right">On Hold</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredZoneSummary.map((z) => (
                      <TableRow key={z.zone} data-testid={`row-zone-${z.zone}`}>
                        <TableCell className="font-medium">{z.zone}</TableCell>
                        <TableCell className="text-right">{z.total}</TableCell>
                        <TableCell className="text-right">{z.occupied}</TableCell>
                        <TableCell className="text-right">
                          {z.holds > 0 ? <Badge variant="destructive" className="text-[10px]">{z.holds}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${z.rate}%` }} />
                            </div>
                            <span className="text-xs font-medium w-8">{z.rate}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Carrier Tab ───────────────────────────────────────────────────── */}
      {activeTab === "carrier" && (
        <div className="space-y-6">
          {/* Carrier On-Time Bar Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-emerald-500" /> Carrier On-Time Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-64" /> : !data?.carrierOnTime.length ? <EmptyState label="No carrier data available" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.carrierOnTime} layout="vertical" margin={{ top: 4, right: 30, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} unit="%" />
                    <YAxis type="category" dataKey="carrier" tick={{ fontSize: 11, fill: axisColor }} width={75} />
                    <Tooltip {...CustomTooltipStyle} formatter={(v: any) => [`${v}%`, "On-Time Rate"]} />
                    <Bar dataKey="rate" name="On-Time Rate" radius={[0, 3, 3, 0]}>
                      {data.carrierOnTime.map((c, i) => (
                        <Cell key={i} fill={c.rate >= 80 ? "#10b981" : c.rate >= 65 ? "#f59e0b" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Carrier Performance Summary Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Carrier Performance Summary
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => exportCSV(filteredCarrierSummary, "carrier-performance")} data-testid="button-export-carrier-csv">
                  <Download className="h-3 w-3 mr-1" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? <Skeleton className="h-48 m-4" /> : !filteredCarrierSummary.length ? <EmptyState label="No carrier data available" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="text-right">Visits</TableHead>
                      <TableHead className="text-right">Avg Dwell</TableHead>
                      <TableHead className="text-right">On-Time</TableHead>
                      <TableHead className="text-right">Holds</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCarrierSummary.map((c) => (
                      <TableRow key={c.carrier} data-testid={`row-carrier-${c.carrier}`}>
                        <TableCell className="font-medium">{c.carrier}</TableCell>
                        <TableCell className="text-right">{c.visits}</TableCell>
                        <TableCell className="text-right">{c.avgDwell > 0 ? formatDwell(c.avgDwell) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <RateIndicator rate={c.onTimeRate} />
                            <span className={c.onTimeRate >= 80 ? "text-emerald-600" : c.onTimeRate >= 65 ? "text-amber-600" : "text-red-600"}>
                              {c.onTimeRate}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.holds > 0 ? <Badge variant="destructive" className="text-[10px]">{c.holds}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className={`text-xs ${c.onTimeRate >= star * 20 ? "text-amber-400" : "text-muted"}`}>★</span>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Dock Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "dock" && (
        <div className="space-y-6">
          {/* Dock Utilization Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-primary" /> Dock Door Utilization
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-56" /> : !data?.dockUtilizationChart.length ? <EmptyState label="No dock data available" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dockUtilizationChart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="door" tick={{ fontSize: 11, fill: axisColor }} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} domain={[0, 1]} tickFormatter={(v) => v === 1 ? "Active" : "Open"} />
                    <Tooltip {...CustomTooltipStyle} formatter={(_: any, __: any, p: any) => [p.payload.trailer || "Empty", p.payload.door]} />
                    <Bar dataKey="active" name="Active" radius={[3, 3, 0, 0]}>
                      {data.dockUtilizationChart.map((d, i) => (
                        <Cell key={i} fill={d.active ? "#3b82f6" : "#e5e7eb"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Dock Performance Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-primary" /> Dock Performance Summary
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => exportCSV(data?.dockSummary || [], "dock-performance")} data-testid="button-export-dock-csv">
                  <Download className="h-3 w-3 mr-1" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? <Skeleton className="h-48 m-4" /> : !data?.dockSummary.length ? <EmptyState label="No dock data available" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Door</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trailer</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.dockSummary.map((d) => (
                      <TableRow key={d.door} data-testid={`row-dock-${d.door}`}>
                        <TableCell className="font-mono font-medium">{d.door}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${d.status === "available" && d.trailer === "—" ? "text-muted-foreground" : "text-blue-600 border-blue-200 dark:border-blue-800"}`}>
                            {d.status === "available" && d.trailer === "—" ? "Open" : d.status?.replace(/_/g, " ") || "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.trailer}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{d.carrier}</TableCell>
                        <TableCell className="text-right">
                          {d.utilization > 0
                            ? <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Active</Badge>
                            : <Badge variant="outline" className="text-[10px] text-muted-foreground">Open</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Move Tasks Tab ────────────────────────────────────────────────── */}
      {activeTab === "moves" && (
        <div className="space-y-6">
          {/* Move Productivity Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-primary" /> Move Task Productivity
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => exportCSV(data?.moveProductivity || [], "move-productivity")} data-testid="button-export-move-csv">
                  <Download className="h-3 w-3 mr-1" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? <Skeleton className="h-48 m-4" /> : !data?.moveProductivity.length ? <EmptyState label="No move task data available" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Move Type</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">In Progress</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                      <TableHead className="text-right">Assigned</TableHead>
                      <TableHead className="text-right">Completion Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.moveProductivity.map((m) => {
                      const rate = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                      return (
                        <TableRow key={m.type} data-testid={`row-move-${m.type}`}>
                          <TableCell className="font-medium">{m.type}</TableCell>
                          <TableCell className="text-right">{m.total}</TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium">{m.completed}</TableCell>
                          <TableCell className="text-right text-blue-600">{m.inProgress}</TableCell>
                          <TableCell className="text-right text-amber-600">{m.open}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{m.assigned}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
                              </div>
                              <span className="text-xs font-medium w-8">{rate}%</span>
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

          {/* Move Task Trend Chart (repeated in move tab) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-emerald-500" /> 7-Day Move Task Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : !data?.moveTaskTrend.length ? <EmptyState label="No move data available" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.moveTaskTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} />
                    <YAxis tick={{ fontSize: 11, fill: axisColor }} />
                    <Tooltip {...CustomTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} fill="url(#moveGrad)" />
                    <Line type="monotone" dataKey="open" name="Open" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Revenue & Billing Tab ─────────────────────────────────────────── */}
      {activeTab === "revenue" && (
        <div className="-mx-6 -mb-6">
          <RevenueTabContent />
        </div>
      )}
    </div>
  );
}
