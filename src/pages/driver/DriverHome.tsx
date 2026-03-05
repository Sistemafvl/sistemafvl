import { useState, useEffect, useMemo } from "react";
import { OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, Package, DollarSign, Target, CalendarDays, RotateCcw, TrendingUp, MapPin, Lightbulb, FileWarning, CheckCircle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getBrazilTodayStr, getBrazilDayRange, toBrazilDateStr } from "@/lib/utils";
import SystemUpdates from "@/components/dashboard/SystemUpdates";

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
  const [allPisoEntries, setAllPisoEntries] = useState<any[]>([]);
  const [psEntries, setPsEntries] = useState<any[]>([]);
  const [rtoEntries, setRtoEntries] = useState<any[]>([]);
  const [unitSettings, setUnitSettings] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // DNR stats
  const [dnrOpen, setDnrOpen] = useState({ count: 0, value: 0 });
  const [dnrClosed, setDnrClosed] = useState(0);
  useEffect(() => {
    if (!driverId) return;
    const fetch = async () => {
      setLoading(true);
      const { start } = getBrazilDayRange(startDate);
      const { end } = getBrazilDayRange(endDate);

      const unitId = unitSession?.id;
      const { data: ridesData } = await supabase
        .from("driver_rides")
        .select("*")
        .eq("driver_id", driverId)
        .eq("unit_id", unitId!)
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

      const { fetchAllRowsWithIn } = await import("@/lib/supabase-helpers");
      const [piRaw, psData, rtoData, us, un, cv, bn] = await Promise.all([
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string; reason: string | null }>(
          (ids) => (from, to) => supabase.from("piso_entries").select("id, ride_id, tbr_code, reason").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string }>(
          (ids) => (from, to) => supabase.from("ps_entries").select("id, ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string }>(
          (ids) => (from, to) => supabase.from("rto_entries").select("id, ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds),
        supabase.from("units").select("id, name").in("id", unitIds),
        supabase.from("driver_custom_values").select("unit_id, custom_tbr_value").eq("driver_id", driverId),
        supabase.from("driver_bonus").select("amount, period_start")
          .eq("driver_id", driverId)
          .gte("period_start", startDate)
          .lte("period_start", endDate),
      ]);
      const tbrData = await fetchAllRowsWithIn<{ id: string; ride_id: string; code: string }>(
        (ids) => (from, to) => supabase.from("ride_tbrs").select("id, ride_id, code").in("ride_id", ids).order("id").range(from, to),
        rideIds
      );

      setTbrs(tbrData);
      setAllPisoEntries(piRaw);
      const piData = piRaw.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));
      setPisoEntries(piData);
      setPsEntries(psData);
      setRtoEntries(rtoData);
      setUnitSettings(us.data ?? []);
      setUnits(un.data ?? []);
      setCustomValues(cv.data ?? []);
      setBonuses(bn.data ?? []);
      setLoading(false);
    };
    fetch();
  }, [driverId, startDate, endDate]);

  // Fetch DNR stats
  useEffect(() => {
    if (!driverId) return;
    const fetchDnr = async () => {
      const unitId = unitSession?.id;
      const { data } = await supabase
        .from("dnr_entries")
        .select("status, dnr_value")
        .eq("driver_id", driverId)
        .eq("unit_id", unitId!);
      const all = (data ?? []) as any[];
      const open = all.filter(e => e.status === "analyzing");
      const closed = all.filter(e => e.status === "closed");
      setDnrOpen({ count: open.length, value: open.reduce((s: number, e: any) => s + Number(e.dnr_value), 0) });
      setDnrClosed(closed.length);
    };
    fetchDnr();
  }, [driverId]);

  const metrics = useMemo(() => {
    const totalRides = rides.length;

    // Group rides by day
    const ridesByDay = new Map<string, string[]>();
    rides.forEach((r: any) => {
      const day = format(parseISO(r.completed_at), "yyyy-MM-dd");
      if (!ridesByDay.has(day)) ridesByDay.set(day, []);
      ridesByDay.get(day)!.push(r.id);
    });

    // Calculate per-day with deduplication and net returns (same as payroll)
    let totalTbrs = 0;
    let totalReturns = 0;
    let totalGanho = 0;

    const settingsMap = new Map(unitSettings.map((s: any) => [s.unit_id, Number(s.tbr_value)]));
    const customMap = new Map(customValues.map((cv: any) => [cv.unit_id, Number(cv.custom_tbr_value)]));

    ridesByDay.forEach((rideIds, day) => {
      const dayTbrs = tbrs.filter((t: any) => rideIds.includes(t.ride_id));

      // 1. TBRs unicos por codigo
      const uniqueCodes = new Set(dayTbrs.map((t: any) => t.code));

      // 2. Codigos que retornaram
      const returnCodes = new Set<string>();
      [...pisoEntries, ...psEntries, ...rtoEntries].forEach((p: any) => {
        if (p.ride_id && rideIds.includes(p.ride_id) && p.tbr_code) {
          returnCodes.add(p.tbr_code);
        }
      });

      // 3. Retornos liquidos (verificar ultima corrida do dia)
      const sortedDayRides = rides
        .filter((r: any) => rideIds.includes(r.id))
        .sort((a: any, b: any) =>
          new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
        );

      const netReturns = new Set<string>();
      returnCodes.forEach(code => {
        let lastRideId: string | null = null;
        for (const ride of sortedDayRides) {
          if (dayTbrs.some((t: any) => t.ride_id === ride.id && t.code === code)) {
            lastRideId = ride.id;
          }
        }
        if (lastRideId) {
          const hasReturnInLast = [...pisoEntries, ...psEntries, ...rtoEntries].some(
            (p: any) => p.ride_id === lastRideId && p.tbr_code === code
          );
          if (hasReturnInLast) netReturns.add(code);
        }
      });

      const dayTbrCount = uniqueCodes.size;
      const dayReturnCount = netReturns.size;
      totalTbrs += dayTbrCount;
      totalReturns += dayReturnCount;

      // Valor do dia
      const firstRide = rides.find((r: any) => r.id === rideIds[0]);
      const unitId = firstRide?.unit_id;
      const tbrVal = (unitId && customMap.get(unitId)) ?? (unitId && settingsMap.get(unitId)) ?? 0;
      totalGanho += Math.max(0, dayTbrCount - dayReturnCount) * tbrVal;
    });

    // Add bonuses
    const totalBonus = bonuses.reduce((s: number, b: any) => s + Number(b.amount), 0);
    totalGanho += totalBonus;

    // Count ALL removed TBRs for totalLidos (including operational)
    let totalAllRemoved = 0;
    ridesByDay.forEach((rideIds) => {
      const dayTbrs = tbrs.filter((t: any) => rideIds.includes(t.ride_id));
      const rideTbrCodes = new Set(dayTbrs.map((t: any) => String(t.code).toUpperCase()));
      const removedCodes = new Set<string>();
      [...allPisoEntries, ...psEntries, ...rtoEntries].forEach((p: any) => {
        if (p.ride_id && rideIds.includes(p.ride_id) && p.tbr_code) {
          const upper = String(p.tbr_code).toUpperCase();
          if (!rideTbrCodes.has(upper)) removedCodes.add(upper);
        }
      });
      totalAllRemoved += removedCodes.size;
    });

    const totalLidos = totalTbrs + totalAllRemoved;
    const concluidos = Math.max(0, totalTbrs - totalReturns);
    const taxaConclusao = totalLidos > 0 ? (concluidos / totalLidos) * 100 : 0;
    const workedDays = ridesByDay.size;
    const mediaTbrsDia = workedDays > 0 ? concluidos / workedDays : 0;
    const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });

    return { totalRides, totalTbrs, totalLidos, concluidos, totalGanho, taxaConclusao, mediaTbrsDia, totalReturns, workedDays, days };
  }, [rides, tbrs, pisoEntries, allPisoEntries, psEntries, rtoEntries, unitSettings, customValues, bonuses, startDate, endDate]);

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
    { label: "TBRs Lidos", value: metrics.totalLidos, icon: Package, color: "text-blue-600" },
    { label: "Total Ganho", value: `R$${metrics.totalGanho.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600" },
    { label: "Entregues", value: metrics.concluidos, icon: Target, color: "text-emerald-600" },
    { label: "Insucessos", value: metrics.totalReturns, icon: RotateCcw, color: "text-red-600" },
    { label: "Dias Trabalhados", value: metrics.workedDays, icon: CalendarDays, color: "text-purple-600" },
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

      {/* Banking reminder */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex gap-3 items-start">
        <FileWarning className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-amber-700 dark:text-amber-400">Não esqueça de cadastrar seus dados bancários!</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Para receber seus pagamentos corretamente, siga os passos:
          </p>
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
            <li>Acesse <strong>Documentos</strong> no menu lateral</li>
            <li>Role até o final da página, na seção <strong>Dados Bancários / Pix</strong></li>
            <li>Preencha o tipo de chave, chave Pix e nome do titular</li>
            <li>Clique em <strong>Salvar</strong></li>
          </ol>
        </div>
      </div>

      {/* System test notice */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex gap-3 items-start">
        <Lightbulb className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-blue-700 dark:text-blue-400">Sistema em fase de testes desde 28/02</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            As informações estão sendo ajustadas. Fiquem tranquilos — como o sistema começou a operar com dados reais a partir dessa data, alguns valores podem aparecer diferentes do esperado. Tudo será corrigido em breve!
          </p>
        </div>
      </div>

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

           {/* DNR Cards */}
           <div className="grid grid-cols-2 gap-2">
             <Card>
               <CardContent className="p-3 flex items-center gap-2">
                 <FileWarning className="h-5 w-5 text-amber-500 shrink-0" />
                 <div className="min-w-0">
                   <p className="text-[10px] text-muted-foreground uppercase font-semibold">DNRs Abertos</p>
                   <p className="text-lg font-bold text-amber-500">{dnrOpen.count}</p>
                   <p className="text-xs text-muted-foreground">R${dnrOpen.value.toFixed(2)}</p>
                 </div>
               </CardContent>
             </Card>
             <Card>
               <CardContent className="p-3 flex items-center gap-2">
                 <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                 <div className="min-w-0">
                   <p className="text-[10px] text-muted-foreground uppercase font-semibold">DNRs Finalizados</p>
                   <p className="text-lg font-bold text-emerald-500">{dnrClosed}</p>
                 </div>
               </CardContent>
             </Card>
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

      <SystemUpdates />
    </div>
  );
};

export default DriverHome;
