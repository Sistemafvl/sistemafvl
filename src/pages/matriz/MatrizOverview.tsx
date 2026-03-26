import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Package, Truck, Users, ShieldCheck, AlertTriangle, FileWarning, RotateCcw,
  DollarSign, Star, Building, TrendingUp, ClipboardList, Wallet,
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { translateStatus } from "@/lib/status-labels";
import { useQuery } from "@tanstack/react-query";
import { fetchAllRows, fetchAllRowsWithIn } from "@/lib/supabase-helpers";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--accent))",
  "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4",
];

const MatrizOverview = () => {
  const { unitSession } = useAuthStore();
  const domainId = unitSession?.domain_id || "";

  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 15), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterUnit, setFilterUnit] = useState("all");

  const { data: domainUnits = [] } = useQuery({
    queryKey: ["matriz-units", domainId],
    queryFn: async () => {
      if (!domainId) return [];
      const { data } = await supabase.from("units_public").select("id, name").eq("domain_id", domainId).eq("active", true).order("name");
      return (data as any[] || []).filter(u => u.name !== "MATRIZ ADMIN");
    },
    enabled: !!domainId,
    staleTime: 300_000,
  });

  const { data: overviewData, isLoading: loading } = useQuery({
    queryKey: ["matriz-overview", filterUnit, domainUnits.map(u => u.id).join(","), dateStart, dateEnd],
    queryFn: async () => {
      if (!domainUnits.length) return null;
      const unitIds = filterUnit === "all" ? domainUnits.map(u => u.id) : [filterUnit];
      const start = startOfDay(new Date(dateStart)).toISOString();
      const end = endOfDay(new Date(dateEnd)).toISOString();

      const [ridesData, psData, rtoData, dnrData, pisoData, reviewsData, settingsData, customData, minPkgData] = await Promise.all([
        fetchAllRows<any>((from, to) => supabase.from("driver_rides").select("id, unit_id, driver_id, completed_at, finished_at, loading_status").in("unit_id", unitIds).gte("completed_at", start).lte("completed_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("ps_entries").select("id, unit_id, status, created_at, driver_name").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("rto_entries").select("id, unit_id, status, created_at, driver_name").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("dnr_entries").select("id, unit_id, status, dnr_value, created_at, driver_name").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("piso_entries").select("id, unit_id, status, created_at").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("unit_reviews").select("id, unit_id, rating, created_at").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("driver_custom_values").select("unit_id, driver_id, custom_tbr_value").in("unit_id", unitIds).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("driver_minimum_packages" as any).select("unit_id, driver_id, min_packages, period_start, period_end").in("unit_id", unitIds).order("id").range(from, to)),
      ]);

      // Fetch drivers only for those with rides
      const driverIdsFromRides = [...new Set(ridesData.map((r: any) => r.driver_id))];
      let driversData: any[] = [];
      if (driverIdsFromRides.length > 0) {
        driversData = await fetchAllRowsWithIn<any>(
          (ids) => (from, to) => supabase.from("drivers_public").select("id, name").in("id", ids).order("id").range(from, to),
          driverIdsFromRides
        );
      }

      // Fetch TBRs with pagination
      const rideIds = ridesData.map((r: any) => r.id);
      let tbrsData: any[] = [];
      if (rideIds.length > 0) {
        tbrsData = await fetchAllRowsWithIn<{ ride_id: string }>((ids) => (from, to) =>
          supabase.from("ride_tbrs").select("ride_id").in("ride_id", ids).order("id").range(from, to),
          rideIds
        );
      }

      return {
        rides: ridesData,
        psEntries: psData,
        rtoEntries: rtoData,
        dnrEntries: dnrData,
        pisoEntries: pisoData,
        reviews: reviewsData,
        drivers: driversData,
        unitSettings: settingsData,
        customValues: customData,
        minPackages: minPkgData,
        tbrs: tbrsData
      };
    },
    enabled: domainUnits.length > 0,
    staleTime: 300_000,
  });

  const {
    rides = [],
    psEntries = [],
    rtoEntries = [],
    dnrEntries = [],
    pisoEntries = [],
    reviews = [],
    drivers = [],
    unitSettings = [],
    customValues = [],
    minPackages = [],
    tbrs = []
  } = overviewData || {};

  // Helper: calculate total paid for TBRs
  const calcTotalPaid = (ridesArr: any[], tbrsArr: any[]) => {
    // Group rides by driver+unit+day for minimum packages logic
    const dayGroups = new Map<string, { driverId: string; unitId: string; tbrCount: number; tbrVal: number }>();
    ridesArr.forEach(ride => {
      const day = format(new Date(ride.completed_at), "yyyy-MM-dd");
      const key = `${ride.driver_id}_${ride.unit_id}_${day}`;
      const rideTbrCount = tbrsArr.filter(t => t.ride_id === ride.id).length;
      const cv = customValues.find(c => c.driver_id === ride.driver_id && c.unit_id === ride.unit_id);
      const unitVal = unitSettings.find(s => s.unit_id === ride.unit_id)?.tbr_value || 0;
      const tbrVal = cv ? Number(cv.custom_tbr_value) : Number(unitVal);
      const existing = dayGroups.get(key);
      if (existing) { existing.tbrCount += rideTbrCount; }
      else dayGroups.set(key, { driverId: ride.driver_id, unitId: ride.unit_id, tbrCount: rideTbrCount, tbrVal });
    });
    let total = 0;
    dayGroups.forEach((g, key) => {
      const minPkg = minPackages.find(mp => mp.driver_id === g.driverId && mp.unit_id === g.unitId);
      const effectiveTbrs = minPkg && g.tbrCount < Number(minPkg.min_packages) ? Number(minPkg.min_packages) : g.tbrCount;
      total += effectiveTbrs * g.tbrVal;
    });
    return total;
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const uniqueDrivers = new Set(rides.map(r => r.driver_id));
    const psOpen = psEntries.filter(p => p.status === "open").length;
    const psClosed = psEntries.filter(p => p.status !== "open").length;
    const rtoOpen = rtoEntries.filter(r => r.status === "open").length;
    const rtoClosed = rtoEntries.filter(r => r.status !== "open").length;
    const pisoOpen = pisoEntries.filter(p => p.status === "open").length;
    const pisoClosed = pisoEntries.filter(p => p.status !== "open").length;
    const dnrOpen = dnrEntries.filter(d => d.status === "open");
    const dnrAnalysis = dnrEntries.filter(d => d.status === "analysis");
    const dnrClosed = dnrEntries.filter(d => d.status === "closed" || d.status === "approved");
    const totalPaid = calcTotalPaid(rides, tbrs);
    const activeUnits = filterUnit === "all" ? domainUnits.length : 1;

    return [
      { label: "Total Carregamentos", value: rides.length, icon: Package, color: "text-primary" },
      { label: "Total TBRs", value: tbrs.length, icon: ClipboardList, color: "text-primary" },
      { label: "Motoristas Ativos", value: uniqueDrivers.size, icon: Truck, color: "text-emerald-500" },
      { label: "PS Abertos / Fechados", value: `${psOpen} / ${psClosed}`, icon: ShieldCheck, color: "text-amber-500" },
      { label: "RTO Abertos / Fechados", value: `${rtoOpen} / ${rtoClosed}`, icon: AlertTriangle, color: "text-orange-500" },
      { label: "Retorno Piso Ab. / Fech.", value: `${pisoOpen} / ${pisoClosed}`, icon: RotateCcw, color: "text-violet-500" },
      { label: "DNR Abertos", value: `${dnrOpen.length} (${dnrOpen.reduce((a, d) => a + Number(d.dnr_value || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`, icon: FileWarning, color: "text-red-500" },
      { label: "DNR Em Análise", value: `${dnrAnalysis.length} (${dnrAnalysis.reduce((a, d) => a + Number(d.dnr_value || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`, icon: FileWarning, color: "text-yellow-500" },
      { label: "DNR Finalizados", value: dnrClosed.length, icon: DollarSign, color: "text-green-500" },
      { label: "Total Pago (TBRs)", value: totalPaid.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), icon: Wallet, color: "text-emerald-600" },
      { label: "Unidades Ativas", value: activeUnits, icon: Building, color: "text-primary" },
      { label: "TBRs / Carregamento", value: rides.length ? (tbrs.length / rides.length).toFixed(1) : "0", icon: TrendingUp, color: "text-emerald-500" },
    ];
  }, [rides, tbrs, psEntries, rtoEntries, dnrEntries, pisoEntries, reviews, domainUnits, filterUnit, unitSettings, customValues, minPackages]);

  // Chart 1: Carregamentos por unidade (barras)
  const chartRidesByUnit = useMemo(() => {
    const map: Record<string, number> = {};
    rides.forEach(r => { map[r.unit_id] = (map[r.unit_id] || 0) + 1; });
    return domainUnits.map(u => ({ name: u.name, carregamentos: map[u.id] || 0 }));
  }, [rides, domainUnits]);

  // Chart 2: Evolução diária (linha)
  const chartDailyRides = useMemo(() => {
    const map: Record<string, number> = {};
    rides.forEach(r => {
      const day = format(new Date(r.completed_at), "dd/MM");
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).sort().map(([d, v]) => ({ dia: d, carregamentos: v }));
  }, [rides]);

  // Chart 3: Status carregamentos (pizza) — translated to PT-BR
  const chartStatusPie = useMemo(() => {
    const statusMap: Record<string, number> = {};
    rides.forEach(r => {
      const s = r.loading_status || "pending";
      const translated = translateStatus(s);
      statusMap[translated] = (statusMap[translated] || 0) + 1;
    });
    return Object.entries(statusMap).map(([name, value]) => ({ name, value }));
  }, [rides]);

  // Chart 4: Top 10 motoristas — using real driver names
  const chartTopDrivers = useMemo(() => {
    const map: Record<string, number> = {};
    rides.forEach(r => {
      map[r.driver_id] = (map[r.driver_id] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([driverId, count]) => {
        const driver = drivers.find(d => d.id === driverId);
        return { name: driver?.name || driverId.slice(0, 8), viagens: count };
      });
  }, [rides, drivers]);

  // Chart 5: Ocorrências por unidade (barras empilhadas)
  const chartOccurrencesByUnit = useMemo(() => {
    return domainUnits.map(u => ({
      name: u.name,
      PS: psEntries.filter(p => p.unit_id === u.id).length,
      RTO: rtoEntries.filter(r => r.unit_id === u.id).length,
      Piso: pisoEntries.filter(p => p.unit_id === u.id).length,
    }));
  }, [domainUnits, psEntries, rtoEntries, pisoEntries]);

  // Chart 6: TBRs diários (linha)
  const chartDailyTbrs = useMemo(() => {
    const map: Record<string, number> = {};
    const rideDates: Record<string, string> = {};
    rides.forEach(r => { rideDates[r.id] = format(new Date(r.completed_at), "dd/MM"); });

    tbrs.forEach(t => {
      const day = rideDates[t.ride_id] || (t.scanned_at ? format(new Date(t.scanned_at), "dd/MM") : null);
      if (day) {
        map[day] = (map[day] || 0) + 1;
      }
    });
    return Object.entries(map).sort().map(([d, v]) => ({ dia: d, tbrs: v }));
  }, [tbrs, rides]);

  // Chart 7: Média TBRs por carregamento por unidade (barras)
  const chartAvgTbrsByUnit = useMemo(() => {
    const ridesByUnit: Record<string, string[]> = {};
    rides.forEach(r => {
      if (!ridesByUnit[r.unit_id]) ridesByUnit[r.unit_id] = [];
      ridesByUnit[r.unit_id].push(r.id);
    });
    return domainUnits.map(u => {
      const unitRideIds = ridesByUnit[u.id] || [];
      const unitTbrs = tbrs.filter(t => unitRideIds.includes(t.ride_id)).length;
      return { name: u.name, media: unitRideIds.length ? +(unitTbrs / unitRideIds.length).toFixed(1) : 0 };
    });
  }, [rides, tbrs, domainUnits]);

  // Chart 8: DNR tendência (área)
  const chartDnrTrend = useMemo(() => {
    const mapOpen: Record<string, number> = {};
    const mapClosed: Record<string, number> = {};
    dnrEntries.forEach(d => {
      const day = format(new Date(d.created_at), "dd/MM");
      if (d.status === "open" || d.status === "analysis") mapOpen[day] = (mapOpen[day] || 0) + 1;
      else mapClosed[day] = (mapClosed[day] || 0) + 1;
    });
    const allDays = [...new Set([...Object.keys(mapOpen), ...Object.keys(mapClosed)])].sort();
    return allDays.map(d => ({ dia: d, abertos: mapOpen[d] || 0, finalizados: mapClosed[d] || 0 }));
  }, [dnrEntries]);

  // Insights
  const insights = useMemo(() => {
    const unitRideCounts = domainUnits.map(u => ({
      name: u.name,
      count: rides.filter(r => r.unit_id === u.id).length,
      occurrences: psEntries.filter(p => p.unit_id === u.id).length + rtoEntries.filter(r => r.unit_id === u.id).length,
      avgRating: (() => {
        const unitReviews = reviews.filter(r => r.unit_id === u.id);
        return unitReviews.length ? (unitReviews.reduce((a, r) => a + r.rating, 0) / unitReviews.length).toFixed(1) : null;
      })(),
    }));

    const mostProductive = unitRideCounts.sort((a, b) => b.count - a.count)[0];
    const mostOccurrences = [...unitRideCounts].sort((a, b) => b.occurrences - a.occurrences)[0];
    const bestRated = unitRideCounts.filter(u => u.avgRating).sort((a, b) => Number(b.avgRating) - Number(a.avgRating))[0];

    const psTbrsRate = tbrs.length ? ((psEntries.length / tbrs.length) * 100).toFixed(2) : "0";
    const rtoTbrsRate = tbrs.length ? ((rtoEntries.length / tbrs.length) * 100).toFixed(2) : "0";

    return [
      mostProductive?.count ? `🏆 Unidade mais produtiva: ${mostProductive.name} (${mostProductive.count} carreg.)` : null,
      mostOccurrences?.occurrences ? `⚠️ Mais ocorrências: ${mostOccurrences.name} (${mostOccurrences.occurrences} PS+RTO)` : null,
      `📊 Taxa PS/TBRs: ${psTbrsRate}%`,
      `📊 Taxa RTO/TBRs: ${rtoTbrsRate}%`,
      bestRated?.avgRating ? `⭐ Melhor avaliação: ${bestRated.name} (${bestRated.avgRating})` : null,
    ].filter(Boolean);
  }, [rides, psEntries, rtoEntries, tbrs, reviews, domainUnits]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs font-semibold italic">Data Início</Label>
          <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold italic">Data Fim</Label>
          <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold italic">Unidade</Label>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {domainUnits.filter(u => !u.name?.includes("MATRIZ")).map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <Card key={i} className="animate-slide-up">
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={`h-8 w-8 ${kpi.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-semibold italic truncate">{kpi.label}</p>
                <p className="text-lg font-bold">{loading ? "..." : kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">📌 Insights</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {insights.map((ins, i) => (
              <div key={i} className="text-sm p-2 rounded bg-muted/50">{ins}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1 */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">Carregamentos por Unidade</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartRidesByUnit}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="carregamentos" fill="hsl(var(--primary))" radius={[4,4,0,0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 2 */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">Evolução Diária de Carregamentos</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartDailyRides}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="carregamentos" stroke="hsl(var(--primary))" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 3 - Status traduzidos */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">Status dos Carregamentos</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart><Pie data={chartStatusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {chartStatusPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 4 - Nomes reais dos motoristas */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">Top 10 Motoristas (Viagens)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartTopDrivers} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="viagens" fill="#10b981" radius={[0,4,4,0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 5 */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">Ocorrências por Unidade</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartOccurrencesByUnit}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="PS" stackId="a" fill="#f59e0b" /><Bar dataKey="RTO" stackId="a" fill="#ef4444" /><Bar dataKey="Piso" stackId="a" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 6 */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">TBRs Escaneados por Dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartDailyTbrs}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line type="monotone" dataKey="tbrs" stroke="#8b5cf6" strokeWidth={2} /></LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 7 */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">Média TBRs por Carregamento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartAvgTbrsByUnit}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="media" fill="#06b6d4" radius={[4,4,0,0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Chart 8 */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">DNR: Abertos vs Finalizados</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartDnrTrend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend />
                <Area type="monotone" dataKey="abertos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} /><Area type="monotone" dataKey="finalizados" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MatrizOverview;
