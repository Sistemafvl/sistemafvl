import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, ScanBarcode, AlertTriangle, RotateCcw, PackageX, Loader2, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import InfoButton from "@/components/dashboard/InfoButton";
import { format } from "date-fns";
import { getBrazilDayRange, getBrazilTodayStr, toBrazilDateStr } from "@/lib/utils";
import { fetchAllRows } from "@/lib/supabase-helpers";

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
    todayRides: 0, todayTbrs: 0, openPs: 0, openRto: 0, openPiso: 0, activeLoading: 0,
  });
  const [barData, setBarData] = useState<{ day: string; count: number }[]>([]);
  const [lineData, setLineData] = useState<{ day: string; count: number }[]>([]);
  const [driverAvgs, setDriverAvgs] = useState<DriverAvg[]>([]);
  const [driverAvgPage, setDriverAvgPage] = useState(0);

  const fetchAll = useCallback(async () => {
    const globalStart = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
    const globalEnd = endDate ? format(endDate, "yyyy-MM-dd") : undefined;

    const { start: todayStart, end: todayEnd } = globalStart
      ? getBrazilDayRange(globalStart)
      : getBrazilDayRange();
    const effectiveTodayEnd = globalEnd ? getBrazilDayRange(globalEnd).end : todayEnd;

    const [ridesRes, psRes, rtoRes, pisoRes, loadingRes] = await Promise.all([
      supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("unit_id", unitId).gte("completed_at", todayStart).lte("completed_at", effectiveTodayEnd).neq("loading_status", "cancelled"),
      supabase.from("ps_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("rto_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("piso_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("loading_status", "loading"),
    ]);

    // Use RPC for accurate TBR count (no 1000 limit)
    let todayTbrCount = 0;
    const { data: rpcCount } = await supabase.rpc("get_unit_tbr_count", {
      p_unit_id: unitId,
      p_start: todayStart,
      p_end: effectiveTodayEnd,
    });
    todayTbrCount = Number(rpcCount ?? 0);

    // Count unique TBRs from PS and RTO that are NOT already in ride_tbrs
    const [psExtra, rtoExtra] = await Promise.all([
      supabase.from("ps_entries").select("tbr_code").eq("unit_id", unitId).gte("created_at", todayStart).lte("created_at", effectiveTodayEnd),
      supabase.from("rto_entries").select("tbr_code").eq("unit_id", unitId).gte("created_at", todayStart).lte("created_at", effectiveTodayEnd),
    ]);

    const { data: tbrCodes } = await supabase.from("ride_tbrs").select("code")
      .gte("scanned_at", todayStart).lte("scanned_at", effectiveTodayEnd);
    const tbrCodesSet = new Set<string>();
    (tbrCodes ?? []).forEach(t => tbrCodesSet.add(t.code));

    const extraCodes = new Set<string>();
    (psExtra.data ?? []).forEach(e => { if (!tbrCodesSet.has(e.tbr_code)) extraCodes.add(e.tbr_code); });
    (rtoExtra.data ?? []).forEach(e => { if (!tbrCodesSet.has(e.tbr_code)) extraCodes.add(e.tbr_code); });
    todayTbrCount += extraCodes.size;

    setMetrics({
      todayRides: ridesRes.count ?? 0,
      todayTbrs: todayTbrCount,
      openPs: psRes.count ?? 0,
      openRto: rtoRes.count ?? 0,
      openPiso: pisoRes.count ?? 0,
      activeLoading: loadingRes.count ?? 0,
    });
    setLoading(false);
  }, [unitId, startDate, endDate]);

  // Fetch chart data using global dates only
  const fetchChartData = useCallback(async () => {
    const todayStr = getBrazilTodayStr();
    const todayDate = new Date(todayStr);

    const effectiveEnd = endDate ? endDate : todayDate;
    const effectiveStart = startDate ? startDate : new Date(new Date(effectiveEnd).setDate(effectiveEnd.getDate() - 6));

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

    // Bar chart - rides per day
    const { data: rides7 } = await supabase.from("driver_rides").select("completed_at").eq("unit_id", unitId).gte("completed_at", rangeStart).lte("completed_at", rangeEnd);
    const ridesByDay: Record<string, number> = {};
    days.forEach(d => ridesByDay[d] = 0);
    (rides7 ?? []).forEach(r => {
      const d = toBrazilDateStr(r.completed_at);
      if (ridesByDay[d] !== undefined) ridesByDay[d]++;
    });
    setBarData(days.map(d => ({ day: d.slice(8, 10) + "/" + d.slice(5, 7), count: ridesByDay[d] })));

    // Line chart - TBRs per day
    const { data: unitRides7 } = await supabase.from("driver_rides").select("id").eq("unit_id", unitId);
    const unitRideSet = new Set((unitRides7 ?? []).map(r => r.id));

    const allTbrs = await fetchAllRows<{ scanned_at: string | null; ride_id: string; code: string }>((from, to) =>
      supabase.from("ride_tbrs").select("scanned_at, ride_id, code")
        .gte("scanned_at", rangeStart).lte("scanned_at", rangeEnd)
        .range(from, to)
    );

    const filtered = allTbrs.filter(t => unitRideSet.has(t.ride_id));
    const allTbrCodes = new Set<string>(filtered.map(t => t.code));
    const tbrsByDay: Record<string, number> = {};
    days.forEach(d => tbrsByDay[d] = 0);
    filtered.forEach(t => {
      if (!t.scanned_at) return;
      const d = toBrazilDateStr(t.scanned_at);
      if (tbrsByDay[d] !== undefined) tbrsByDay[d]++;
    });

    const [psChart, rtoChart] = await Promise.all([
      supabase.from("ps_entries").select("tbr_code, created_at").eq("unit_id", unitId).gte("created_at", rangeStart).lte("created_at", rangeEnd),
      supabase.from("rto_entries").select("tbr_code, created_at").eq("unit_id", unitId).gte("created_at", rangeStart).lte("created_at", rangeEnd),
    ]);
    const countedExtra = new Set<string>();
    [...(psChart.data ?? []), ...(rtoChart.data ?? [])].forEach(e => {
      if (!allTbrCodes.has(e.tbr_code) && !countedExtra.has(e.tbr_code)) {
        countedExtra.add(e.tbr_code);
        const d = toBrazilDateStr(e.created_at);
        if (tbrsByDay[d] !== undefined) tbrsByDay[d]++;
      }
    });

    setLineData(days.map(d => ({ day: d.slice(8, 10) + "/" + d.slice(5, 7), count: tbrsByDay[d] })));

    // Driver daily average
    const finishedRides = await fetchAllRows<{ driver_id: string; completed_at: string }>((from, to) =>
      supabase.from("driver_rides").select("driver_id, completed_at")
        .eq("unit_id", unitId)
        .eq("loading_status", "finished")
        .gte("completed_at", rangeStart)
        .lte("completed_at", rangeEnd)
        .range(from, to)
    );

    if (finishedRides.length > 0) {
      const rideIds = finishedRides.map(r => r.driver_id + "_placeholder");
      // Get TBR counts per ride
      const rideIdsList = await fetchAllRows<{ id: string; driver_id: string }>((from, to) =>
        supabase.from("driver_rides").select("id, driver_id")
          .eq("unit_id", unitId)
          .eq("loading_status", "finished")
          .gte("completed_at", rangeStart)
          .lte("completed_at", rangeEnd)
          .range(from, to)
      );
      
      const driverRideIds: Record<string, string[]> = {};
      rideIdsList.forEach(r => {
        if (!driverRideIds[r.driver_id]) driverRideIds[r.driver_id] = [];
        driverRideIds[r.driver_id].push(r.id);
      });

      const allRideIds = rideIdsList.map(r => r.id);
      // Count TBRs per ride using batch
      const tbrCounts = await fetchAllRows<{ ride_id: string }>((from, to) =>
        supabase.from("ride_tbrs").select("ride_id").in("ride_id", allRideIds).range(from, to)
      );

      const tbrCountByRide: Record<string, number> = {};
      tbrCounts.forEach(t => {
        tbrCountByRide[t.ride_id] = (tbrCountByRide[t.ride_id] || 0) + 1;
      });

      // Calc per driver
      const driverTotals: Record<string, number> = {};
      Object.entries(driverRideIds).forEach(([driverId, rIds]) => {
        driverTotals[driverId] = rIds.reduce((sum, rid) => sum + (tbrCountByRide[rid] || 0), 0);
      });

      const driverIds = Object.keys(driverTotals);
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
    "Carregamentos": "Total de carregamentos realizados no período. Cada carregamento representa uma viagem de entrega iniciada por um motorista.",
    "TBRs escaneados": "Total de pacotes (TBRs) escaneados no período. Cada TBR é um pacote individual conferido antes do carregamento.",
    "PS abertos": "PS (Problem Solve) abertos. Pacotes com problemas que precisam de resolução manual.",
    "RTO abertos": "RTO (Return to Origin) abertos. Pacotes que precisam ser devolvidos ao centro de distribuição.",
    "Insucessos abertos": "Pacotes que retornaram ao piso da unidade sem serem entregues.",
    "Carregando agora": "Motoristas com carregamento em andamento neste momento.",
  };

  const cards = [
    { label: `Carregamentos (${periodLabel})`, value: metrics.todayRides, icon: Truck, color: "text-primary", infoKey: "Carregamentos" },
    { label: `TBRs escaneados (${periodLabel})`, value: metrics.todayTbrs, icon: ScanBarcode, color: "text-blue-500", infoKey: "TBRs escaneados" },
    { label: "PS abertos", value: metrics.openPs, icon: AlertTriangle, color: "text-destructive", infoKey: "PS abertos" },
    { label: "RTO abertos", value: metrics.openRto, icon: RotateCcw, color: "text-orange-500", infoKey: "RTO abertos" },
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Carregamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic flex items-center gap-1">TBRs escaneados <InfoButton text="Evolução diária do número de TBRs escaneados na unidade." /></CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="TBRs" stroke="hsl(210, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic flex items-center gap-1">
              <Users className="h-4 w-4 text-primary" />
              Média diária por motorista
              <InfoButton text="Média de TBRs finalizados por dia por motorista no período selecionado." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driverAvgs.length === 0 ? (
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
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={driverAvgPage === 0} onClick={() => setDriverAvgPage(driverAvgPage - 1)}>
                      <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">{driverAvgPage + 1}/{totalAvgPages}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={driverAvgPage >= totalAvgPages - 1} onClick={() => setDriverAvgPage(driverAvgPage + 1)}>
                      Próximo <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardMetrics;
