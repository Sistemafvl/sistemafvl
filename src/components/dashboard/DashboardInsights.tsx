import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingDown, UserCheck, BarChart3, Percent, Clock, CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import InfoButton from "@/components/dashboard/InfoButton";
import { getBrazilDayRange } from "@/lib/utils";
import { ALL_UNITS_ID } from "@/lib/unit-filter";

interface Props {
  unitId: string;
  startDate?: Date;
  endDate?: Date;
  allUnitIds?: string[];
}

interface DriverRank {
  name: string;
  count: number;
}

interface ConferenteRank {
  name: string;
  count: number;
}

const PAGE_SIZE = 5;

const DashboardInsights = ({ unitId, startDate, endDate, allUnitIds = [] }: Props) => {
  const isAll = unitId === ALL_UNITS_ID && allUnitIds.length > 0;
  const applyFilter = useCallback((q: any): any => {
    return isAll ? q.in("unit_id", allUnitIds) : q.eq("unit_id", unitId);
  }, [isAll, allUnitIds, unitId]);
  const [topDrivers, setTopDrivers] = useState<DriverRank[]>([]);
  const [topReturns, setTopReturns] = useState<DriverRank[]>([]);
  const [topConferentes, setTopConferentes] = useState<ConferenteRank[]>([]);
  const [avgTbrs, setAvgTbrs] = useState(0);
  const [returnRate, setReturnRate] = useState(0);
  const [avgLoadTime, setAvgLoadTime] = useState("");
  const [bestDay, setBestDay] = useState("");
  const [loading, setLoading] = useState(true);

  // Pagination
  const [driverPage, setDriverPage] = useState(0);
  const [returnPage, setReturnPage] = useState(0);
  const [confPage, setConfPage] = useState(0);

  const getSince = useCallback(() => {
    if (startDate) return startDate.toISOString();
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, [startDate]);

  const getUntil = useCallback(() => {
    return endDate ? endDate.toISOString() : undefined;
  }, [endDate]);

  const fetchInsights = useCallback(async () => {
    const since = getSince();
    const until = getUntil();

    let ridesQuery = applyFilter(supabase
      .from("driver_rides")
      .select("driver_id, id, started_at, finished_at"))
      .gte("completed_at", since);
    if (until) ridesQuery = ridesQuery.lte("completed_at", until);

    const { data: rides30 } = await ridesQuery;

    if (rides30 && rides30.length > 0) {
      const withTimes = rides30.filter(r => r.started_at && r.finished_at);
      if (withTimes.length > 0) {
        const totalMins = withTimes.reduce((sum, r) => sum + (new Date(r.finished_at!).getTime() - new Date(r.started_at!).getTime()) / 60000, 0);
        const avg = Math.round(totalMins / withTimes.length);
        setAvgLoadTime(avg >= 60 ? `${Math.floor(avg / 60)}h ${avg % 60}min` : `${avg} min`);
      }

      const dayCount: Record<number, number> = {};
      rides30.forEach(r => {
        const day = new Date(r.started_at ?? r.finished_at ?? Date.now()).getDay();
        dayCount[day] = (dayCount[day] || 0) + 1;
      });
      const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      const best = Object.entries(dayCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
      if (best) setBestDay(dayNames[Number(best[0])]);

      const rideIds = rides30.map(r => r.id);
      const { count: tbrTotal } = await supabase.from("ride_tbrs").select("id", { count: "exact", head: true }).in("ride_id", rideIds);
      setAvgTbrs(tbrTotal ? Math.round((tbrTotal / rides30.length) * 10) / 10 : 0);
    }

    // Return rate
    const [pisoAll, rtoAll, psAll] = await Promise.all([
      fetchAllRows<{ tbr_code: string; reason: string | null }>((from, to) =>
        applyFilter(supabase.from("piso_entries").select("tbr_code, reason")).gte("created_at", since).order("id").range(from, to)
      ),
      fetchAllRows<{ tbr_code: string }>((from, to) =>
        applyFilter(supabase.from("rto_entries").select("tbr_code")).gte("created_at", since).order("id").range(from, to)
      ),
      fetchAllRows<{ tbr_code: string }>((from, to) =>
        applyFilter(supabase.from("ps_entries").select("tbr_code")).gte("created_at", since).order("id").range(from, to)
      ),
    ]);
    const filteredPisoAll = pisoAll.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));
    const allReturnTbrs = new Set<string>();
    [...filteredPisoAll, ...rtoAll, ...psAll].forEach(e => { if (e.tbr_code) allReturnTbrs.add(e.tbr_code); });
    
    // Get total TBRs for this unit in the period (ride_tbrs via rides)
    const rideIds = (rides30 ?? []).map(r => r.id);
    let totalTbrsInPeriod = 0;
    if (rideIds.length > 0) {
      const { count } = await supabase.from("ride_tbrs").select("id", { count: "exact", head: true }).in("ride_id", rideIds);
      totalTbrsInPeriod = count ?? 0;
    }
    const totalOriginal = totalTbrsInPeriod + allReturnTbrs.size;
    if (totalOriginal > 0) {
      setReturnRate(Math.round((allReturnTbrs.size / totalOriginal) * 1000) / 10);
    }
  }, [unitId, startDate, endDate, getSince, getUntil, applyFilter]);

  const fetchTopDrivers = useCallback(async () => {
    const since = getSince();
    const until = getUntil();

    if (isAll) {
      // RPC only supports single unit, so aggregate across all
      const allResults: any[] = [];
      for (const uid of (allUnitIds.length > 0 ? allUnitIds : [unitId])) {
        const { data } = await supabase.rpc("get_top_drivers_by_tbrs", {
          p_unit_id: uid, p_since: since, p_until: until || undefined,
        });
        if (data) allResults.push(...data);
      }
      // Merge by driver_id
      const merged: Record<string, { name: string; count: number }> = {};
      allResults.forEach((r: any) => {
        const key = r.driver_id;
        if (!merged[key]) merged[key] = { name: r.driver_name ?? "Desconhecido", count: 0 };
        merged[key].count += Number(r.tbr_count);
      });
      setTopDrivers(Object.values(merged).sort((a, b) => b.count - a.count));
    } else {
      const { data: rpcData } = await supabase.rpc("get_top_drivers_by_tbrs", {
        p_unit_id: unitId, p_since: since, p_until: until || undefined,
      });
      if (!rpcData || rpcData.length === 0) { setTopDrivers([]); return; }
      setTopDrivers(rpcData.map((r: any) => ({ name: r.driver_name ?? "Desconhecido", count: Number(r.tbr_count) })));
    }
    setDriverPage(0);
  }, [unitId, getSince, getUntil, isAll, allUnitIds]);

  const fetchTopReturns = useCallback(async () => {
    const since = getSince();

    const [pisoData, rtoData, psData] = await Promise.all([
      fetchAllRows<{ driver_name: string | null; tbr_code: string; reason: string | null }>((from, to) =>
        applyFilter(supabase.from("piso_entries").select("driver_name, tbr_code, reason")).gte("created_at", since).order("id").range(from, to)
      ),
      fetchAllRows<{ driver_name: string | null; tbr_code: string }>((from, to) =>
        applyFilter(supabase.from("rto_entries").select("driver_name, tbr_code")).gte("created_at", since).order("id").range(from, to)
      ),
      fetchAllRows<{ driver_name: string | null; tbr_code: string }>((from, to) =>
        applyFilter(supabase.from("ps_entries").select("driver_name, tbr_code")).gte("created_at", since).order("id").range(from, to)
      ),
    ]);

    const filteredPisoData = pisoData.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));
    const driverTbrSets: Record<string, Set<string>> = {};
    [...filteredPisoData, ...rtoData, ...psData].forEach(e => {
      if (!e.driver_name) return;
      const name = e.driver_name;
      if (!driverTbrSets[name]) driverTbrSets[name] = new Set();
      if (e.tbr_code) driverTbrSets[name].add(e.tbr_code);
    });
    setTopReturns(Object.entries(driverTbrSets).map(([name, set]) => ({ name, count: set.size })).sort((a, b) => b.count - a.count));
    setReturnPage(0);
  }, [unitId, getSince, getUntil, applyFilter]);

  const fetchTopConferentes = useCallback(async () => {
    const since = getSince();
    const until = getUntil();

    const confRides = await fetchAllRows<{ conferente_id: string | null }>((from, to) => {
      let q = applyFilter(supabase.from("driver_rides").select("conferente_id")).gte("completed_at", since).not("conferente_id", "is", null);
      if (until) q = q.lte("completed_at", until);
      return q.order("id").range(from, to);
    });

    if (confRides.length === 0) { setTopConferentes([]); return; }
    const confCount: Record<string, number> = {};
    confRides.forEach(r => { confCount[r.conferente_id!] = (confCount[r.conferente_id!] || 0) + 1; });
    const sorted = Object.entries(confCount).sort((a, b) => b[1] - a[1]);
    const confIds = sorted.slice(0, 50).map(([id]) => id);
    const { data: confs } = await supabase.from("user_profiles").select("id, name").in("id", confIds);
    const confMap = new Map((confs ?? []).map(c => [c.id, c.name]));
    setTopConferentes(sorted.map(([id, count]) => ({ name: confMap.get(id) ?? "Desconhecido", count })));
    setConfPage(0);
  }, [unitId, getSince, getUntil, applyFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchInsights(), fetchTopDrivers(), fetchTopReturns(), fetchTopConferentes()])
      .finally(() => setLoading(false));
  }, [fetchInsights, fetchTopDrivers, fetchTopReturns, fetchTopConferentes]);

  const PaginatedRankingCard = ({
    title, icon: Icon, data, color, page, setPage, infoText,
  }: {
    title: string; icon: any; data: DriverRank[] | ConferenteRank[]; color: string;
    page: number; setPage: (p: number) => void;
    infoText?: string;
  }) => {
    const totalPages = Math.ceil(data.length / PAGE_SIZE);
    const pageData = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold italic flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} />
            {title}
            {infoText && <InfoButton text={infoText} />}
          </CardTitle>
        </CardHeader>
        <CardContent>
        {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem dados</p>
          ) : (
            <>
              <div className="space-y-2">
                {pageData.map((item, i) => {
                  const globalIndex = page * PAGE_SIZE + i;
                  return (
                    <div key={globalIndex} className="flex items-center gap-2 text-sm">
                      <span className={`font-bold w-5 text-center ${globalIndex === 0 ? "text-yellow-500" : globalIndex === 1 ? "text-gray-400" : globalIndex === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                        {globalIndex + 1}º
                      </span>
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="font-bold text-primary">{item.count}</span>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-3 w-3 mr-1" /> Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">{page + 1}/{totalPages}</span>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                    Próximo <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };


  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PaginatedRankingCard title="Top Motoristas (Entregas)" icon={Trophy} data={topDrivers} color="text-yellow-500" page={driverPage} setPage={setDriverPage} infoText="Ranking dos motoristas com mais entregas (TBRs concluídos) no período." />
        <PaginatedRankingCard title="Maiores Ofensores de Retorno TBRs" icon={TrendingDown} data={topReturns} color="text-destructive" page={returnPage} setPage={setReturnPage} infoText="Motoristas com mais TBRs retornados (Piso, PS, RTO) no período." />
        <PaginatedRankingCard title="Conferentes mais ativos" icon={UserCheck} data={topConferentes} color="text-primary" page={confPage} setPage={setConfPage} infoText="Conferentes que mais escanearam TBRs no período." />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <span className="text-2xl font-bold italic">{avgTbrs}</span>}
            <span className="text-xs text-muted-foreground leading-tight flex items-center justify-center">Média TBRs / Carregamento <InfoButton text="Média de TBRs por carregamento no período." /></span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Percent className="h-5 w-5 text-orange-500" />
            <span className="text-2xl font-bold italic">{returnRate}%</span>
            <span className="text-xs text-muted-foreground leading-tight flex items-center justify-center">Taxa de Retorno <InfoButton text="Percentual de TBRs que retornaram em relação ao total escaneado." /></span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Clock className="h-5 w-5 text-green-500" />
            <span className="text-2xl font-bold italic">{avgLoadTime || "—"}</span>
            <span className="text-xs text-muted-foreground leading-tight flex items-center justify-center">Tempo Médio Carregamento <InfoButton text="Tempo médio entre início e fim do carregamento." /></span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <CalendarDays className="h-5 w-5 text-purple-500" />
            <span className="text-2xl font-bold italic">{bestDay || "—"}</span>
            <span className="text-xs text-muted-foreground leading-tight flex items-center justify-center">Dia Mais Movimentado <InfoButton text="Dia da semana com maior volume de carregamentos no período." /></span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardInsights;
