import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck, ScanBarcode, AlertTriangle, RotateCcw, PackageX, Loader2, Users, ChevronLeft, ChevronRight, Trophy, TrendingUp, BarChart3, Target, Scale } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import InfoButton from "@/components/dashboard/InfoButton";
import { format } from "date-fns";
import { getBrazilDayRange, getBrazilTodayStr, toBrazilDateStr } from "@/lib/utils";
import { fetchAllRows, fetchAllRowsWithIn } from "@/lib/supabase-helpers";

interface Props {
  unitId: string;
  startDate?: Date;
  endDate?: Date;
}

const PAGE_SIZE = 5;

interface DriverAvg {
  name: string;
  avg: number;
}


const DashboardMetrics = ({ unitId, startDate, endDate }: Props) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todayRides: 0, todayTbrs: 0, openPs: 0, pendingDisputes: 0, openPiso: 0, activeLoading: 0,
  });
  const [barData, setBarData] = useState<{ day: string; count: number }[]>([]);
  const [lineData, setLineData] = useState<{ day: string; count: number }[]>([]);
  const [driverAvgs, setDriverAvgs] = useState<DriverAvg[]>([]);
  const [driverAvgPage, setDriverAvgPage] = useState(0);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [chartLoading, setChartLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const globalStart = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
    const globalEnd = endDate ? format(endDate, "yyyy-MM-dd") : undefined;

    const { start: todayStart, end: todayEnd } = globalStart
      ? getBrazilDayRange(globalStart)
      : getBrazilDayRange();
    const effectiveTodayEnd = globalEnd ? getBrazilDayRange(globalEnd).end : todayEnd;

    const [ridesRes, psRes, disputesRes, pisoRes, loadingRes] = await Promise.all([
      supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("unit_id", unitId).gte("completed_at", todayStart).lte("completed_at", effectiveTodayEnd).neq("loading_status", "cancelled"),
      supabase.from("ps_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("ride_disputes" as any).select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "pending"),
      supabase.from("piso_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("loading_status", "loading"),
    ]);

    // Use RPC for accurate TBR count (no 1000 limit)
    let todayTbrCount = 0;
    try {
      const { data: rpcCount, error: rpcError } = await (supabase.rpc as any)("get_unit_tbr_count", {
        p_unit_id: unitId,
        p_start: todayStart,
        p_end: effectiveTodayEnd,
      });
      if (rpcError) {
        console.warn("RPC get_unit_tbr_count failed, falling back to 0:", rpcError);
      } else {
        todayTbrCount = Number(rpcCount ?? 0);
      }
    } catch (e) {
      console.error("Error during RPC get_unit_tbr_count:", e);
    }

    // RPC already includes returns (piso+ps+rto) linked to same rides

    setMetrics({
      todayRides: ridesRes.count ?? 0,
      todayTbrs: todayTbrCount,
      openPs: psRes.count ?? 0,
      pendingDisputes: disputesRes.count ?? 0,
      openPiso: pisoRes.count ?? 0,
      activeLoading: loadingRes.count ?? 0,
    });
    setLoading(false);
  }, [unitId, startDate, endDate]);

  // Fetch chart data using global dates only
  const fetchChartData = useCallback(async () => {
    setChartLoading(true);
    const todayStr = getBrazilTodayStr();
    const todayDate = new Date(todayStr);

    const effectiveEnd = endDate ? endDate : todayDate;
    const effectiveStart = startDate ? startDate : new Date(new Date(effectiveEnd).setDate(effectiveEnd.getDate() - 14));

    const days: string[] = [];
    const cursor = new Date(effectiveStart);
    const endD = new Date(effectiveEnd);
    while (cursor <= endD) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    if (days.length === 0) days.push(todayStr);

    const { start: rangeStart } = getBrazilDayRange(days[0]);
    const { end: rangeEnd } = getBrazilDayRange(days[days.length - 1]);

    // CONSOLIDATED: Single query for all driver_rides in range (saves ~3 queries)
    const allRidesInRange = await fetchAllRows<{ id: string; driver_id: string; completed_at: string; loading_status: string | null }>((from, to) =>
      supabase.from("driver_rides").select("id, driver_id, completed_at, loading_status")
        .eq("unit_id", unitId)
        .gte("completed_at", rangeStart)
        .lte("completed_at", rangeEnd)
        .order("id").range(from, to)
    );

    // Bar chart - rides per day (all rides including cancelled)
    const ridesByDay: Record<string, number> = {};
    days.forEach(d => ridesByDay[d] = 0);
    allRidesInRange
      .filter(r => r.loading_status !== "cancelled")
      .forEach(r => {
        const d = toBrazilDateStr(r.completed_at);
        if (ridesByDay[d] !== undefined) ridesByDay[d]++;
      });
    setBarData(days.map(d => ({ day: d.slice(8, 10) + "/" + d.slice(5, 7), count: ridesByDay[d] })));

    const allRIds = allRidesInRange.map(r => r.id);

    // Line chart - TBRs per day (CONSOLIDATED: Single chunked query for all TBRs in range based on rides)
    const tbrsByDay: Record<string, number> = {};
    days.forEach(d => tbrsByDay[d] = 0);

    const allTbrsInRange = await fetchAllRowsWithIn<{ scanned_at: string }>(
      (chunk) => (from, to) => supabase.from("ride_tbrs").select("scanned_at").in("ride_id", chunk).range(from, to),
      allRIds
    );

    allTbrsInRange.forEach(t => {
      const d = toBrazilDateStr(t.scanned_at);
      if (tbrsByDay[d] !== undefined) tbrsByDay[d]++;
    });

    setLineData(days.map(d => ({ day: d.slice(8, 10) + "/" + d.slice(5, 7), count: tbrsByDay[d] })));

    // Driver daily average - optimized
    const finishedRides = allRidesInRange.filter(r => r.loading_status === "finished");

    if (finishedRides.length > 0) {
      const driverRideIds: Record<string, string[]> = {};
      finishedRides.forEach(r => {
        if (!driverRideIds[r.driver_id]) driverRideIds[r.driver_id] = [];
        driverRideIds[r.driver_id].push(r.id);
      });

      const driverIds = Object.keys(driverRideIds);
      const driverTotals: Record<string, number> = {};

      // CONSOLIDATED: Single query for all TBRs of all targeted rides
      const rideIdToTbrCount: Record<string, number> = {};
      const finishedRIds = finishedRides.map(r => r.id);

      const allTbrsForDrivers = await fetchAllRowsWithIn<{ ride_id: string }>(
        (chunk) => (from, to) => supabase.from("ride_tbrs").select("ride_id").in("ride_id", chunk).range(from, to),
        finishedRIds
      );

      allTbrsForDrivers.forEach(t => {
        rideIdToTbrCount[t.ride_id] = (rideIdToTbrCount[t.ride_id] ?? 0) + 1;
      });

      finishedRides.forEach(r => {
        driverTotals[r.driver_id] = (driverTotals[r.driver_id] ?? 0) + (rideIdToTbrCount[r.id] ?? 0);
      });

      const { data: drivers } = await supabase.from("drivers_public").select("id, name").in("id", driverIds);
      const driverMap = new Map((drivers ?? []).map(d => [d.id, d.name ?? "Desconhecido"]));

      const numDays = Math.max(days.length, 1);
      const avgs: DriverAvg[] = driverIds.map(id => ({
        name: driverMap.get(id) ?? "Desconhecido",
        avg: Math.round((driverTotals[id] / numDays) * 10) / 10,
      })).sort((a, b) => b.avg - a.avg);

      setDriverAvgs(avgs);
      setDriverAvgPage(0);
    } else {
      setDriverAvgs([]);
    }
    setChartLoading(false);
  }, [unitId, startDate, endDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchChartData(); }, [fetchChartData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const periodLabel = startDate && endDate
    ? `${format(startDate, "dd/MM")} a ${format(endDate, "dd/MM")}`
    : startDate
      ? `A partir de ${format(startDate, "dd/MM")}`
      : "hoje";

  const INFO_TEXTS: Record<string, string> = {
    "Carregamentos": "Total de carregamentos realizados no período. Por padrão, mostra os dados de hoje. Cada carregamento representa uma viagem de entrega iniciada por um motorista.",
    "TBRs escaneados": "Total de pacotes originalmente bipados na conferência. Por padrão, mostra os dados de hoje. Cada TBR é contado apenas uma vez.",
    "PS abertos": "PS (Problem Solve) abertos. Pacotes com problemas que precisam de resolução manual.",
    "Contestações pendentes": "Contestações abertas pelos motoristas que ainda não foram resolvidas pela unidade.",
    "Insucessos abertos": "Pacotes que retornaram ao piso da unidade sem serem entregues.",
    "Carregando agora": "Motoristas com carregamento em andamento neste momento.",
  };

  const cards = [
    { label: `Carregamentos (${periodLabel})`, value: metrics.todayRides, icon: Truck, color: "text-primary", infoKey: "Carregamentos" },
    { label: `TBRs escaneados (${periodLabel})`, value: metrics.todayTbrs, icon: ScanBarcode, color: "text-blue-500", infoKey: "TBRs escaneados" },
    { label: "PS abertos", value: metrics.openPs, icon: AlertTriangle, color: "text-destructive", infoKey: "PS abertos" },
    { label: "Contestações pendentes", value: metrics.pendingDisputes, icon: Scale, color: "text-orange-500", infoKey: "Contestações pendentes" },
    { label: "Insucessos abertos", value: metrics.openPiso, icon: PackageX, color: "text-yellow-600", infoKey: "Insucessos abertos" },
    { label: "Carregando agora", value: metrics.activeLoading, icon: Loader2, color: "text-green-500", infoKey: "Carregando agora" },
  ];

  const totalAvgPages = Math.ceil(driverAvgs.length / PAGE_SIZE);
  const avgPageData = driverAvgs.slice(driverAvgPage * PAGE_SIZE, (driverAvgPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <span className="text-2xl font-bold italic">{c.value}</span>
              <span className="text-xs text-muted-foreground leading-tight flex items-center justify-center">{c.label} <InfoButton text={INFO_TEXTS[c.infoKey]} /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic flex items-center gap-1">Carregamentos <InfoButton text="Evolução diária do número de carregamentos realizados na unidade." /></CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Carregamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic flex items-center gap-1">TBRs escaneados <InfoButton text="Evolução diária do número de TBRs escaneados na unidade." /></CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="TBRs" stroke="hsl(210, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowDriverModal(true)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic flex items-center gap-1">
              <Users className="h-4 w-4 text-primary" />
              Média diária por motorista
              <InfoButton text="Clique para ver detalhes. Média de TBRs finalizados por dia por motorista. Por padrão, considera os últimos 30 dias ou o período selecionado." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : driverAvgs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">Sem dados no período</p>
            ) : (
              <>
                <div className="space-y-2">
                  {avgPageData.map((item, i) => {
                    const globalIndex = driverAvgPage * PAGE_SIZE + i;
                    return (
                      <div key={globalIndex} className="flex items-center gap-2 text-sm">
                        <span className={`font-bold w-5 text-center ${globalIndex === 0 ? "text-yellow-500" : globalIndex === 1 ? "text-gray-400" : globalIndex === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                          {globalIndex + 1}º
                        </span>
                        <span className="flex-1 truncate">{item.name}</span>
                        <span className="font-bold text-primary">{item.avg}</span>
                        <span className="text-[10px] text-muted-foreground">TBRs/dia</span>
                      </div>
                    );
                  })}
                </div>
                {totalAvgPages > 1 && (
                  <div className="flex items-center justify-between mt-3 pt-2 border-t">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={driverAvgPage === 0} onClick={(e) => { e.stopPropagation(); setDriverAvgPage(driverAvgPage - 1); }}>
                      <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">{driverAvgPage + 1}/{totalAvgPages}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={driverAvgPage >= totalAvgPages - 1} onClick={(e) => { e.stopPropagation(); setDriverAvgPage(driverAvgPage + 1); }}>
                      Próximo <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal BI - Média diária por motorista */}
      <Dialog open={showDriverModal} onOpenChange={setShowDriverModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold italic">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Análise de Performance — Média Diária por Motorista
            </DialogTitle>
          </DialogHeader>

          {driverAvgs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">Sem dados no período selecionado.</p>
          ) : (
            <div className="space-y-5">
              {/* KPI Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Motoristas</p>
                  <p className="text-xl font-bold text-primary">{driverAvgs.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Maior Média</p>
                  <p className="text-xl font-bold text-emerald-600">{driverAvgs[0]?.avg ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Menor Média</p>
                  <p className="text-xl font-bold text-red-600">{driverAvgs[driverAvgs.length - 1]?.avg ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Média Geral</p>
                  <p className="text-xl font-bold text-blue-600">
                    {driverAvgs.length > 0 ? (driverAvgs.reduce((s, d) => s + d.avg, 0) / driverAvgs.length).toFixed(1) : 0}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div>
                <h3 className="text-sm font-bold italic flex items-center gap-1 mb-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Distribuição de Performance
                </h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={driverAvgs.slice(0, 15)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(val: number) => [`${val} TBRs/dia`, "Média"]} />
                      <Bar dataKey="avg" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Insights */}
              <div>
                <h3 className="text-sm font-bold italic flex items-center gap-1 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Insights Analíticos
                </h3>
                <div className="space-y-2 text-sm">
                  {driverAvgs.length >= 2 && (
                    <div className="p-3 rounded-lg border border-border bg-muted/20">
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">{driverAvgs[0].name}</strong> lidera com{" "}
                        <strong className="text-primary">{driverAvgs[0].avg} TBRs/dia</strong>, superando a média geral em{" "}
                        <strong className="text-emerald-600">
                          {((driverAvgs[0].avg / (driverAvgs.reduce((s, d) => s + d.avg, 0) / driverAvgs.length) - 1) * 100).toFixed(0)}%
                        </strong>.
                      </p>
                    </div>
                  )}
                  {(() => {
                    const avg = driverAvgs.reduce((s, d) => s + d.avg, 0) / driverAvgs.length;
                    const belowAvg = driverAvgs.filter(d => d.avg < avg);
                    if (belowAvg.length > 0) {
                      return (
                        <div className="p-3 rounded-lg border border-border bg-muted/20">
                          <p className="text-muted-foreground">
                            <strong className="text-amber-600">{belowAvg.length} motorista{belowAvg.length > 1 ? "s" : ""}</strong> estão abaixo da média geral ({avg.toFixed(1)} TBRs/dia). Considere acompanhar: {belowAvg.slice(0, 3).map(d => d.name).join(", ")}{belowAvg.length > 3 ? "..." : ""}.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Target className="h-4 w-4 text-primary shrink-0" />
                      A diferença entre o maior e menor desempenho é de <strong className="text-foreground">{(driverAvgs[0]?.avg - driverAvgs[driverAvgs.length - 1]?.avg).toFixed(1)} TBRs/dia</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Full ranking */}
              <div>
                <h3 className="text-sm font-bold italic mb-2">Ranking Completo</h3>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {driverAvgs.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-muted/50">
                      <span className={`font-bold w-6 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                        {i + 1}º
                      </span>
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="font-bold text-primary">{item.avg}</span>
                      <span className="text-[10px] text-muted-foreground">TBRs/dia</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardMetrics;
