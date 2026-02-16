import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Truck, Package, Users, AlertTriangle, RotateCcw, Star, ClipboardCheck, BarChart3 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, parseISO, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#8884d8", "#82ca9d", "#ffc658"];

const AdminOverviewPage = () => {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [domains, setDomains] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [rides, setRides] = useState<any[]>([]);
  const [tbrs, setTbrs] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [psEntries, setPsEntries] = useState<any[]>([]);
  const [rtoEntries, setRtoEntries] = useState<any[]>([]);
  const [pisoEntries, setPisoEntries] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [conferentes, setConferentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFilters = async () => {
      const [{ data: d }, { data: u }] = await Promise.all([
        supabase.from("domains").select("id, name, active"),
        supabase.from("units_public").select("id, name, domain_id, active"),
      ]);
      setDomains(d || []);
      setUnits(u || []);
    };
    fetchFilters();
  }, []);

  const filteredUnits = useMemo(() => {
    if (selectedDomain === "all") return units;
    return units.filter((u) => u.domain_id === selectedDomain);
  }, [units, selectedDomain]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const start = startOfDay(parseISO(startDate)).toISOString();
      const end = endOfDay(parseISO(endDate)).toISOString();

      let ridesQuery = supabase.from("driver_rides").select("id, unit_id, driver_id, completed_at, loading_status, started_at, finished_at").gte("completed_at", start).lte("completed_at", end);
      let psQuery = supabase.from("ps_entries").select("id, unit_id, status, created_at").gte("created_at", start).lte("created_at", end);
      let rtoQuery = supabase.from("rto_entries").select("id, unit_id, status, created_at").gte("created_at", start).lte("created_at", end);
      let pisoQuery = supabase.from("piso_entries").select("id, unit_id, status, created_at").gte("created_at", start).lte("created_at", end);
      let reviewsQuery = supabase.from("unit_reviews").select("id, unit_id, rating, created_at").gte("created_at", start).lte("created_at", end);

      if (selectedUnit !== "all") {
        ridesQuery = ridesQuery.eq("unit_id", selectedUnit);
        psQuery = psQuery.eq("unit_id", selectedUnit);
        rtoQuery = rtoQuery.eq("unit_id", selectedUnit);
        pisoQuery = pisoQuery.eq("unit_id", selectedUnit);
        reviewsQuery = reviewsQuery.eq("unit_id", selectedUnit);
      } else if (selectedDomain !== "all") {
        const unitIds = filteredUnits.map((u) => u.id);
        if (unitIds.length > 0) {
          ridesQuery = ridesQuery.in("unit_id", unitIds);
          psQuery = psQuery.in("unit_id", unitIds);
          rtoQuery = rtoQuery.in("unit_id", unitIds);
          pisoQuery = pisoQuery.in("unit_id", unitIds);
          reviewsQuery = reviewsQuery.in("unit_id", unitIds);
        }
      }

      const [ridesRes, psRes, rtoRes, pisoRes, reviewsRes, driversRes, conferentesRes, tbrsRes] = await Promise.all([
        ridesQuery, psQuery, rtoQuery, pisoQuery, reviewsQuery,
        supabase.from("drivers_public").select("id, name, active"),
        supabase.from("user_profiles").select("id, name, active, unit_id"),
        supabase.from("ride_tbrs").select("id, ride_id"),
      ]);

      setRides(ridesRes.data || []);
      setPsEntries(psRes.data || []);
      setRtoEntries(rtoRes.data || []);
      setPisoEntries(pisoRes.data || []);
      setReviews(reviewsRes.data || []);
      setDrivers(driversRes.data || []);
      setConferentes(conferentesRes.data || []);
      setTbrs(tbrsRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [startDate, endDate, selectedDomain, selectedUnit, filteredUnits]);

  // Metrics
  const totalRides = rides.length;
  const rideIds = new Set(rides.map((r) => r.id));
  const totalTbrs = tbrs.filter((t) => rideIds.has(t.ride_id)).length;
  const activeDrivers = drivers.filter((d) => d.active).length;
  const psOpen = psEntries.filter((p) => p.status === "open").length;
  const psClosed = psEntries.filter((p) => p.status === "closed").length;
  const rtoOpen = rtoEntries.filter((r) => r.status === "open").length;
  const rtoClosed = rtoEntries.filter((r) => r.status === "closed").length;
  const pisoOpen = pisoEntries.filter((p) => p.status === "open").length;
  const pisoClosed = pisoEntries.filter((p) => p.status === "closed").length;
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "N/A";
  const activeConferentes = conferentes.filter((c) => c.active).length;

  // Charts data
  const ridesByUnit = useMemo(() => {
    const map: Record<string, number> = {};
    rides.forEach((r) => { map[r.unit_id] = (map[r.unit_id] || 0) + 1; });
    return Object.entries(map).map(([uid, count]) => ({
      name: units.find((u) => u.id === uid)?.name || uid.slice(0, 8),
      carregamentos: count,
    })).sort((a, b) => b.carregamentos - a.carregamentos).slice(0, 10);
  }, [rides, units]);

  const dailyRides = useMemo(() => {
    const map: Record<string, number> = {};
    rides.forEach((r) => {
      const day = format(parseISO(r.completed_at), "dd/MM");
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).map(([day, count]) => ({ day, carregamentos: count }));
  }, [rides]);

  const statusDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    rides.forEach((r) => {
      const status = r.loading_status || "pending";
      map[status] = (map[status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [rides]);

  const topDrivers = useMemo(() => {
    const map: Record<string, number> = {};
    rides.forEach((r) => { map[r.driver_id] = (map[r.driver_id] || 0) + 1; });
    return Object.entries(map)
      .map(([did, count]) => ({
        name: drivers.find((d) => d.id === did)?.name || did.slice(0, 8),
        viagens: count,
      }))
      .sort((a, b) => b.viagens - a.viagens)
      .slice(0, 10);
  }, [rides, drivers]);

  // Insights
  const topUnit = ridesByUnit[0];
  const topDriver = topDrivers[0];
  const psRate = totalTbrs > 0 ? ((psEntries.length / totalTbrs) * 100).toFixed(1) : "0";
  const rtoRate = totalTbrs > 0 ? ((rtoEntries.length / totalTbrs) * 100).toFixed(1) : "0";

  const cards = [
    { label: "Carregamentos", value: totalRides, icon: Truck, color: "text-blue-500" },
    { label: "TBRs Escaneados", value: totalTbrs, icon: Package, color: "text-green-500" },
    { label: "Motoristas Ativos", value: activeDrivers, icon: Users, color: "text-purple-500" },
    { label: "PS Abertos / Fechados", value: `${psOpen} / ${psClosed}`, icon: AlertTriangle, color: "text-orange-500" },
    { label: "RTO Abertos / Fechados", value: `${rtoOpen} / ${rtoClosed}`, icon: AlertTriangle, color: "text-red-500" },
    { label: "Retorno Piso", value: `${pisoOpen} / ${pisoClosed}`, icon: RotateCcw, color: "text-amber-500" },
    { label: "Média Avaliações", value: avgRating, icon: Star, color: "text-yellow-500" },
    { label: "Conferentes Ativos", value: activeConferentes, icon: ClipboardCheck, color: "text-teal-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold italic">Visão Geral</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Data Início</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Data Fim</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Domínio</label>
              <Select value={selectedDomain} onValueChange={(v) => { setSelectedDomain(v); setSelectedUnit("all"); }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os domínios</SelectItem>
                  {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Unidade</label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades</SelectItem>
                  {filteredUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando dados...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <c.icon className={`h-8 w-8 ${c.color}`} />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
                      <p className="text-2xl font-bold">{c.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Insights */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Insights</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Unidade com mais carregamentos</p>
                  <p className="font-bold">{topUnit?.name || "N/A"}</p>
                  {topUnit && <Badge variant="secondary">{topUnit.carregamentos} viagens</Badge>}
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Motorista mais ativo</p>
                  <p className="font-bold">{topDriver?.name || "N/A"}</p>
                  {topDriver && <Badge variant="secondary">{topDriver.viagens} viagens</Badge>}
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Taxa de PS / TBRs</p>
                  <p className="font-bold">{psRate}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Taxa de RTO / TBRs</p>
                  <p className="font-bold">{rtoRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Carregamentos por Unidade</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ridesByUnit}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="carregamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Evolução Diária</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyRides}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="carregamentos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Status dos Carregamentos</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusDistribution} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {statusDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Top 10 Motoristas</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topDrivers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="viagens" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminOverviewPage;
