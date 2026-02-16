import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingDown, UserCheck, BarChart3, Percent, Clock, CalendarDays } from "lucide-react";
import { getBrazilDayRange } from "@/lib/utils";

interface Props {
  unitId: string;
}

interface DriverRank {
  name: string;
  count: number;
}

interface ConferenteRank {
  name: string;
  count: number;
}

const DashboardInsights = ({ unitId }: Props) => {
  const [topDrivers, setTopDrivers] = useState<DriverRank[]>([]);
  const [topReturns, setTopReturns] = useState<DriverRank[]>([]);
  const [topConferentes, setTopConferentes] = useState<ConferenteRank[]>([]);
  const [avgTbrs, setAvgTbrs] = useState(0);
  const [returnRate, setReturnRate] = useState(0);
  const [avgLoadTime, setAvgLoadTime] = useState("");
  const [bestDay, setBestDay] = useState("");

  const fetchInsights = useCallback(async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString();

    // Top 5 drivers by deliveries
    const { data: rides30 } = await supabase
      .from("driver_rides")
      .select("driver_id, id, started_at, finished_at")
      .eq("unit_id", unitId)
      .gte("completed_at", since);

    if (rides30 && rides30.length > 0) {
      // Count by driver
      const driverCount: Record<string, number> = {};
      rides30.forEach(r => { driverCount[r.driver_id] = (driverCount[r.driver_id] || 0) + 1; });
      const sortedDriverIds = Object.entries(driverCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const driverIds = sortedDriverIds.map(([id]) => id);
      const { data: drivers } = await supabase.from("drivers").select("id, name").in("id", driverIds);
      const driverMap = new Map((drivers ?? []).map(d => [d.id, d.name]));
      setTopDrivers(sortedDriverIds.map(([id, count]) => ({ name: driverMap.get(id) ?? "Desconhecido", count })));

      // Avg load time
      const withTimes = rides30.filter(r => r.started_at && r.finished_at);
      if (withTimes.length > 0) {
        const totalMins = withTimes.reduce((sum, r) => {
          return sum + (new Date(r.finished_at!).getTime() - new Date(r.started_at!).getTime()) / 60000;
        }, 0);
        const avg = Math.round(totalMins / withTimes.length);
        if (avg >= 60) {
          setAvgLoadTime(`${Math.floor(avg / 60)}h ${avg % 60}min`);
        } else {
          setAvgLoadTime(`${avg} min`);
        }
      }

      // Best day of week
      const dayCount: Record<number, number> = {};
      rides30.forEach(r => {
        const day = new Date(r.started_at ?? r.finished_at ?? Date.now()).getDay();
        dayCount[day] = (dayCount[day] || 0) + 1;
      });
      const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      const best = Object.entries(dayCount).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
      if (best) setBestDay(dayNames[Number(best[0])]);

      // Avg TBRs per ride
      const rideIds = rides30.map(r => r.id);
      const { count: tbrTotal } = await supabase.from("ride_tbrs").select("id", { count: "exact", head: true }).in("ride_id", rideIds);
      setAvgTbrs(tbrTotal ? Math.round((tbrTotal / rides30.length) * 10) / 10 : 0);
    }

    // Top 5 returns (unique tbr_code by driver_name)
    const [{ data: pisoData }, { data: rtoData }, { data: psData }] = await Promise.all([
      supabase.from("piso_entries").select("driver_name, tbr_code").eq("unit_id", unitId).gte("created_at", since),
      supabase.from("rto_entries").select("driver_name, tbr_code").eq("unit_id", unitId).gte("created_at", since),
      supabase.from("ps_entries").select("driver_name, tbr_code").eq("unit_id", unitId).gte("created_at", since),
    ]);

    // Deduplicate by tbr_code per driver
    const driverTbrSets: Record<string, Set<string>> = {};
    [...(pisoData ?? []), ...(rtoData ?? []), ...(psData ?? [])].forEach(e => {
      const name = e.driver_name ?? "Desconhecido";
      if (!driverTbrSets[name]) driverTbrSets[name] = new Set();
      if (e.tbr_code) driverTbrSets[name].add(e.tbr_code);
    });
    setTopReturns(Object.entries(driverTbrSets).map(([name, set]) => ({ name, count: set.size })).sort((a, b) => b.count - a.count).slice(0, 5));

    // Return rate (unique tbr_codes)
    const allReturnTbrs = new Set<string>();
    [...(pisoData ?? []), ...(rtoData ?? []), ...(psData ?? [])].forEach(e => { if (e.tbr_code) allReturnTbrs.add(e.tbr_code); });
    const totalReturns = allReturnTbrs.size;
    const { count: totalTbrs30 } = await supabase
      .from("ride_tbrs")
      .select("id", { count: "exact", head: true });
    if (totalTbrs30 && totalTbrs30 > 0) {
      setReturnRate(Math.round((totalReturns / totalTbrs30) * 1000) / 10);
    }

    // Top conferentes
    const { data: confRides } = await supabase
      .from("driver_rides")
      .select("conferente_id")
      .eq("unit_id", unitId)
      .gte("completed_at", since)
      .not("conferente_id", "is", null);

    if (confRides && confRides.length > 0) {
      const confCount: Record<string, number> = {};
      confRides.forEach(r => { confCount[r.conferente_id!] = (confCount[r.conferente_id!] || 0) + 1; });
      const sorted = Object.entries(confCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const confIds = sorted.map(([id]) => id);
      const { data: confs } = await supabase.from("user_profiles").select("id, name").in("id", confIds);
      const confMap = new Map((confs ?? []).map(c => [c.id, c.name]));
      setTopConferentes(sorted.map(([id, count]) => ({ name: confMap.get(id) ?? "Desconhecido", count })));
    }
  }, [unitId]);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  const RankingCard = ({ title, icon: Icon, data, color }: { title: string; icon: any; data: DriverRank[] | ConferenteRank[]; color: string }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold italic flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sem dados</p>
        ) : (
          <div className="space-y-2">
            {data.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`font-bold w-5 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                  {i + 1}º
                </span>
                <span className="flex-1 truncate">{item.name}</span>
                <span className="font-bold text-primary">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RankingCard title="Top Motoristas (Entregas)" icon={Trophy} data={topDrivers} color="text-yellow-500" />
        <RankingCard title="Top Retornos (Piso + RTO)" icon={TrendingDown} data={topReturns} color="text-destructive" />
        <RankingCard title="Conferentes mais ativos" icon={UserCheck} data={topConferentes} color="text-primary" />
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <span className="text-2xl font-bold italic">{avgTbrs}</span>
            <span className="text-xs text-muted-foreground leading-tight">Média TBRs / Carregamento</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Percent className="h-5 w-5 text-orange-500" />
            <span className="text-2xl font-bold italic">{returnRate}%</span>
            <span className="text-xs text-muted-foreground leading-tight">Taxa de Retorno</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Clock className="h-5 w-5 text-green-500" />
            <span className="text-2xl font-bold italic">{avgLoadTime || "—"}</span>
            <span className="text-xs text-muted-foreground leading-tight">Tempo Médio Carregamento</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <CalendarDays className="h-5 w-5 text-purple-500" />
            <span className="text-2xl font-bold italic">{bestDay || "—"}</span>
            <span className="text-xs text-muted-foreground leading-tight">Dia Mais Movimentado</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardInsights;
