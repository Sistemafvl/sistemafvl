import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, Package, DollarSign, Target, CalendarDays, RotateCcw, TrendingUp, MapPin, Lightbulb } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getBrazilTodayStr, getBrazilDayRange, toBrazilDateStr } from "@/lib/utils";

const COLORS = ["#f59e0b", "#3b82f6", "#ef4444"];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DriverHome = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;

  const [startDate, setStartDate] = useState(() => getBrazilTodayStr());
  const [endDate, setEndDate] = useState(() => getBrazilTodayStr());
  const [rides, setRides] = useState<any[]>([]);
  const [tbrs, setTbrs] = useState<any[]>([]);
  const [pisoEntries, setPisoEntries] = useState<any[]>([]);
  const [psEntries, setPsEntries] = useState<any[]>([]);
  const [rtoEntries, setRtoEntries] = useState<any[]>([]);
  const [unitSettings, setUnitSettings] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;
    const fetch = async () => {
      setLoading(true);
      const { start } = getBrazilDayRange(startDate);
      const { end } = getBrazilDayRange(endDate);

      const { data: ridesData } = await supabase
        .from("driver_rides")
        .select("*")
        .eq("driver_id", driverId)
        .gte("completed_at", start)
        .lte("completed_at", end)
        .order("completed_at", { ascending: true });

      const r = ridesData ?? [];
      setRides(r);

      if (r.length === 0) {
        setTbrs([]); setPisoEntries([]); setPsEntries([]); setRtoEntries([]); setUnitSettings([]); setUnits([]);
        setLoading(false);
        return;
      }

      const rideIds = r.map((x) => x.id);
      const unitIds = [...new Set(r.map((x) => x.unit_id))];

      const [t, pi, ps, rto, us, un] = await Promise.all([
        supabase.from("ride_tbrs").select("id, ride_id").in("ride_id", rideIds),
        supabase.from("piso_entries").select("id, ride_id, tbr_code").in("ride_id", rideIds),
        supabase.from("ps_entries").select("id, ride_id, tbr_code").in("ride_id", rideIds),
        supabase.from("rto_entries").select("id, ride_id, tbr_code").in("ride_id", rideIds),
        supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds),
        supabase.from("units").select("id, name").in("id", unitIds),
      ]);

      setTbrs(t.data ?? []);
      setPisoEntries(pi.data ?? []);
      setPsEntries(ps.data ?? []);
      setRtoEntries(rto.data ?? []);
      setUnitSettings(us.data ?? []);
      setUnits(un.data ?? []);
      setLoading(false);
    };
    fetch();
  }, [driverId, startDate, endDate]);

  const metrics = useMemo(() => {
    const totalRides = rides.length;
    const totalTbrs = tbrs.length;

    // Count unique tbr_codes per ride for returns
    const returnTbrSets = new Map<string, Set<string>>();
    [...pisoEntries, ...psEntries, ...rtoEntries].forEach((r: any) => {
      if (r.ride_id && r.tbr_code) {
        if (!returnTbrSets.has(r.ride_id)) returnTbrSets.set(r.ride_id, new Set());
        returnTbrSets.get(r.ride_id)!.add(r.tbr_code);
      }
    });
    const returnsByRide = new Map<string, number>();
    returnTbrSets.forEach((set, rideId) => returnsByRide.set(rideId, set.size));

    const totalReturns = Array.from(returnsByRide.values()).reduce((s, v) => s + v, 0);
    const concluidos = Math.max(0, totalTbrs - totalReturns);

    const settingsMap = new Map(unitSettings.map((s: any) => [s.unit_id, Number(s.tbr_value)]));
    let totalGanho = 0;
    const tbrsByRide = new Map<string, number>();
    tbrs.forEach((t: any) => tbrsByRide.set(t.ride_id, (tbrsByRide.get(t.ride_id) ?? 0) + 1));

    rides.forEach((ride: any) => {
      const rTbrs = tbrsByRide.get(ride.id) ?? 0;
      const rReturns = returnsByRide.get(ride.id) ?? 0;
      const rConcluidos = Math.max(0, rTbrs - rReturns);
      totalGanho += rConcluidos * (settingsMap.get(ride.unit_id) ?? 0);
    });

    const taxaConclusao = totalTbrs > 0 ? (concluidos / totalTbrs) * 100 : 0;
    const startD = parseISO(startDate);
    const endD = parseISO(endDate);
    const days = eachDayOfInterval({ start: startD, end: endD });
    const workedDays = new Set(rides.map((r: any) => format(parseISO(r.completed_at), "yyyy-MM-dd"))).size;
    const mediaTbrsDia = workedDays > 0 ? totalTbrs / workedDays : 0;

    return { totalRides, totalTbrs, totalGanho, taxaConclusao, mediaTbrsDia, totalReturns, workedDays, days };
  }, [rides, tbrs, pisoEntries, psEntries, rtoEntries, unitSettings, startDate, endDate]);

  const chartData = useMemo(() => {
    const ridesByDay = new Map<string, number>();
    const tbrsByDay = new Map<string, number>();
    const tbrRideMap = new Map<string, string>();
    rides.forEach((r: any) => {
      const day = format(parseISO(r.completed_at), "dd/MM");
      ridesByDay.set(day, (ridesByDay.get(day) ?? 0) + 1);
    });
    // Map tbrs to days via ride
    const rideIdToDayMap = new Map<string, string>();
    rides.forEach((r: any) => rideIdToDayMap.set(r.id, format(parseISO(r.completed_at), "dd/MM")));
    tbrs.forEach((t: any) => {
      const day = rideIdToDayMap.get(t.ride_id);
      if (day) tbrsByDay.set(day, (tbrsByDay.get(day) ?? 0) + 1);
    });

    const startD = parseISO(startDate);
    const endD = parseISO(endDate);
    const allDays = eachDayOfInterval({ start: startD, end: endD });
    const lineData = allDays.map((d) => {
      const key = format(d, "dd/MM");
      return { day: key, corridas: ridesByDay.get(key) ?? 0 };
    });
    const barData = allDays.map((d) => {
      const key = format(d, "dd/MM");
      return { day: key, tbrs: tbrsByDay.get(key) ?? 0 };
    });

    const pieData = [
      { name: "Piso", value: pisoEntries.length },
      { name: "PS", value: psEntries.length },
      { name: "RTO", value: rtoEntries.length },
    ].filter((d) => d.value > 0);

    const unitMap = new Map(units.map((u: any) => [u.id, u.name]));
    const unitCount = new Map<string, number>();
    rides.forEach((r: any) => {
      const name = unitMap.get(r.unit_id) ?? "—";
      unitCount.set(name, (unitCount.get(name) ?? 0) + 1);
    });
    const topUnits = [...unitCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, corridas: count }));

    return { lineData, barData, pieData, topUnits };
  }, [rides, tbrs, pisoEntries, psEntries, rtoEntries, units, startDate, endDate]);

  const insights = useMemo(() => {
    if (rides.length === 0) return null;
    // Best day of week
    const dayCount = [0, 0, 0, 0, 0, 0, 0];
    rides.forEach((r: any) => dayCount[parseISO(r.completed_at).getDay()]++);
    const bestDayIdx = dayCount.indexOf(Math.max(...dayCount));
    const bestDay = DAY_NAMES[bestDayIdx];

    const mediaGanhoDia = metrics.workedDays > 0 ? metrics.totalGanho / metrics.workedDays : 0;
    const taxaRetorno = metrics.totalTbrs > 0 ? (metrics.totalReturns / metrics.totalTbrs) * 100 : 0;

    const unitMap = new Map(units.map((u: any) => [u.id, u.name]));
    const unitCount = new Map<string, number>();
    rides.forEach((r: any) => {
      const name = unitMap.get(r.unit_id) ?? "—";
      unitCount.set(name, (unitCount.get(name) ?? 0) + 1);
    });
    const topUnit = [...unitCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    return { bestDay, mediaGanhoDia, taxaRetorno, topUnit };
  }, [rides, metrics, units]);

  const summaryCards = [
    { label: "Total Corridas", value: metrics.totalRides, icon: Car, color: "text-primary" },
    { label: "Total TBRs", value: metrics.totalTbrs, icon: Package, color: "text-blue-600" },
    { label: "Total Ganho", value: `R$${metrics.totalGanho.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600" },
    { label: "Conclusão", value: `${metrics.taxaConclusao.toFixed(1)}%`, icon: Target, color: "text-amber-600" },
    { label: "Média TBRs/Dia", value: metrics.mediaTbrsDia.toFixed(1), icon: CalendarDays, color: "text-purple-600" },
    { label: "Total Retornos", value: metrics.totalReturns, icon: RotateCcw, color: "text-red-600" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold italic flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        Visão Geral
      </h1>

      {/* Date filter */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">De</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-[150px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Até</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-[150px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center text-muted-foreground italic py-8">Carregando...</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {summaryCards.map((c) => (
              <Card key={c.label}>
                <CardContent className="p-3 flex items-center gap-2">
                  <c.icon className={`h-5 w-5 ${c.color} shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">{c.label}</p>
                    <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Insights */}
          {insights && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-muted-foreground">Melhor dia</p>
                  <p className="font-bold text-primary">{insights.bestDay}</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-muted-foreground">Média ganho/dia</p>
                  <p className="font-bold text-emerald-600">R${insights.mediaGanhoDia.toFixed(2)}</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-muted-foreground">Taxa retorno</p>
                  <p className="font-bold text-red-600">{insights.taxaRetorno.toFixed(1)}%</p>
                </div>
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-muted-foreground">Unidade frequente</p>
                  <p className="font-bold text-primary truncate">{insights.topUnit}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts */}
          {rides.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Line - Rides per day */}
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold text-muted-foreground">Corridas por dia</CardTitle>
                </CardHeader>
                <CardContent className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.lineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="corridas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Bar - TBRs per day */}
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-semibold text-muted-foreground">TBRs por dia</CardTitle>
                </CardHeader>
                <CardContent className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="tbrs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pie - Returns distribution */}
              {chartData.pieData.length > 0 && (
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold text-muted-foreground">Distribuição de retornos</CardTitle>
                  </CardHeader>
                  <CardContent className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData.pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {chartData.pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Horizontal bar - Top units */}
              {chartData.topUnits.length > 0 && (
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs font-semibold text-muted-foreground">Top Unidades</CardTitle>
                  </CardHeader>
                  <CardContent className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.topUnits} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="corridas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DriverHome;
