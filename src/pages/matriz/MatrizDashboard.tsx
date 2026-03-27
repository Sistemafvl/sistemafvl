import { useState, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, TrendingUp, Users, Truck, Calendar as CalendarIcon, BarChart3, Loader2 } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";

const MatrizDashboard = () => {
  const { unitSession } = useAuthStore();
  const domainId = unitSession?.domain_id || "";

  const [dateStart, setDateStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: units = [] } = useQuery({
    queryKey: ["matriz-units-dashboard", domainId],
    queryFn: async () => {
      if (!domainId) return [];
      const { data } = await supabase.from("units_public").select("id, name").eq("domain_id", domainId).eq("active", true).order("name");
      return (data as any[] || []).filter(u => u.name !== "MATRIZ ADMIN");
    },
    enabled: !!domainId,
  });

  const { data: dashboardData, isLoading: loading } = useQuery({
    queryKey: ["matriz-dashboard-data", units.map(u => u.id).join(","), dateStart, dateEnd],
    queryFn: async () => {
      if (!units.length) return null;
      const unitIds = units.map(u => u.id);
      const start = startOfDay(new Date(dateStart)).toISOString();
      const end = endOfDay(new Date(dateEnd)).toISOString();

      const [ridesData] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase.from("driver_rides").select("id, unit_id, completed_at").in("unit_id", unitIds).gte("completed_at", start).lte("completed_at", end).order("id").range(from, to)
        ),
      ]);

      if (ridesData.length === 0) return { rides: [], tbrs: [] };

      const rideIds = ridesData.map(r => r.id);
      const { data: settings } = await supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds);
      
      return { rides: ridesData, tbrs: tbrData, settings: settings || [] };
    },
    enabled: units.length > 0,
  });

  const processedData = useMemo(() => {
    const { rides, tbrs, settings = [] } = dashboardData;

    // Map ride_id to tbr count
    const tbrCountsMap: Record<string, number> = {};
    tbrs.forEach((t: any) => {
      tbrCountsMap[t.ride_id] = (tbrCountsMap[t.ride_id] ?? 0) + 1;
    });

    const unitMetrics = units.map(u => {
      const uRides = rides.filter((r: any) => r.unit_id === u.id);
      const totalPackages = uRides.reduce((sum: number, r: any) => sum + (tbrCountsMap[r.id] || 0), 0);
      const tbrValue = settings.find((s: any) => s.unit_id === u.id)?.tbr_value || 0;
      const totalBRL = totalPackages * Number(tbrValue);

      return {
        id: u.id,
        name: u.name,
        rides: uRides.length,
        packages: totalPackages,
        tbrValue: Number(tbrValue),
        totalBRL,
      };
    });

    // Chart data (by day)
    const dailyData: Record<string, any> = {};
    rides.forEach((r: any) => {
      const day = format(new Date(r.completed_at), "dd/MM");
      if (!dailyData[day]) dailyData[day] = { name: day };
      const unit = units.find(u => u.id === r.unit_id);
      if (unit) {
        dailyData[day][unit.name] = (dailyData[day][unit.name] ?? 0) + (tbrCountsMap[r.id] || 0);
      }
    });

    const chartData = Object.values(dailyData).sort((a, b) => {
      const partsA = a.name.split('/');
      const partsB = b.name.split('/');
      return new Date(2026, parseInt(partsA[1])-1, parseInt(partsA[0])).getTime() - 
             new Date(2026, parseInt(partsB[1])-1, parseInt(partsB[0])).getTime();
    });

    const totalBRL = unitMetrics.reduce((a, b) => a + b.totalBRL, 0);
    const totalPackages = unitMetrics.reduce((a, b) => a + b.packages, 0);
    const avgPacoteGeral = totalPackages > 0 ? (totalBRL / totalPackages) : 0;

    return { unitMetrics, chartData, avgPacoteGeral };
  }, [units, dashboardData]);

  const totals = useMemo(() => ({
    packages: processedData.unitMetrics.reduce((a, b) => a + b.packages, 0),
    rides: processedData.unitMetrics.reduce((a, b) => a + b.rides, 0),
    avgPacoteGeral: processedData.avgPacoteGeral,
  }), [processedData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold italic flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Visão Geral Diretoria
        </h1>
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border shadow-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 border-r">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-7 w-32 border-0 p-0 focus-visible:ring-0 bg-transparent text-xs font-semibold" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground font-medium">
            Até
            <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-7 w-32 border-0 p-0 focus-visible:ring-0 bg-transparent text-xs font-semibold" />
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={Package} label="Total de Pacotes" value={totals.packages} loading={loading} />
        <StatsCard icon={Truck} label="Total Carregamentos" value={totals.rides} loading={loading} color="text-blue-500" />
        <StatsCard icon={TrendingUp} label="Média Pacote Geral" value={formatBRL(totals.avgPacoteGeral)} loading={loading} color="text-emerald-500" />
        <StatsCard icon={Users} label="Unidades Ativas" value={units.length} loading={loading} color="text-amber-500" />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-bold italic text-muted-foreground uppercase tracking-wider px-1">Performance por Unidade</h2>
        <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center w-full py-12">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
          ) : (
            processedData.unitMetrics.map(u => (
              <Card key={u.id} className="min-w-[260px] shrink-0 border-l-4 border-l-primary hover:shadow-md transition-shadow">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold truncate">{u.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Pacotes</p>
                      <p className="text-xl font-bold">{u.packages}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Média Pacote</p>
                      <p className="text-lg font-bold text-primary">{formatBRL(u.tbrValue)}</p>
                    </div>
                  </div>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, (u.packages / (totals.packages || 1)) * 400)}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic font-medium">
                    {u.rides} carregamentos realizados no período
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold italic flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Tendência de Volume por Unidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedData.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  {units.map((u, i) => (
                    <Line 
                      key={u.id} 
                      type="monotone" 
                      dataKey={u.name} 
                      stroke={`hsl(${(i * 137.5) % 360}, 70%, 50%)`} 
                      strokeWidth={2} 
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }} 
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold italic">Top Ranking (Volume)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {processedData.unitMetrics.sort((a,b) => b.packages - a.packages).slice(0, 5).map((u, i) => (
              <div key={u.id} className="flex items-center gap-3">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold">{u.name}</p>
                  <div className="h-1.5 w-full bg-muted rounded-full mt-1">
                    <div className="h-full bg-primary" style={{ width: `${(u.packages / (processedData.unitMetrics[0]?.packages || 1)) * 100}%` }} />
                  </div>
                </div>
                <p className="text-xs font-bold">{u.packages}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const StatsCard = ({ icon: Icon, label, value, loading, color = "text-primary" }: any) => (
  <Card className="overflow-hidden">
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-semibold italic truncate mb-0.5">{label}</p>
        <div className="flex items-center h-8">
          {loading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <p className="text-2xl font-black tracking-tight">{value}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default MatrizDashboard;
