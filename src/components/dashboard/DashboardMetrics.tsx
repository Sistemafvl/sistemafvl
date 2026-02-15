import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, ScanBarcode, AlertTriangle, RotateCcw, PackageX, Loader2 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface Props {
  unitId: string;
}

const COLORS = ["hsl(var(--primary))", "hsl(210, 70%, 55%)", "hsl(140, 60%, 45%)", "hsl(45, 90%, 50%)", "hsl(0, 70%, 55%)"];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  loading: "Em carregamento",
  finished: "Finalizado",
};

const DashboardMetrics = ({ unitId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todayRides: 0,
    todayTbrs: 0,
    openPs: 0,
    openRto: 0,
    openPiso: 0,
    activeLoading: 0,
  });
  const [barData, setBarData] = useState<{ day: string; count: number }[]>([]);
  const [lineData, setLineData] = useState<{ day: string; count: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);

  const fetchAll = useCallback(async () => {
    const today = new Date();
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();

    const [ridesRes, tbrsRes, psRes, rtoRes, pisoRes, loadingRes] = await Promise.all([
      supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("unit_id", unitId).gte("completed_at", todayStart).lte("completed_at", todayEnd),
      supabase.from("ride_tbrs").select("id, ride_id", { count: "exact" }).gte("scanned_at", todayStart).lte("scanned_at", todayEnd),
      supabase.from("ps_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("rto_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("piso_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("loading_status", "loading"),
    ]);

    // Filter TBRs by unit rides
    let todayTbrCount = 0;
    if (tbrsRes.data) {
      const { data: unitRideIds } = await supabase.from("driver_rides").select("id").eq("unit_id", unitId);
      const rideIdSet = new Set((unitRideIds ?? []).map(r => r.id));
      todayTbrCount = tbrsRes.data.filter(t => rideIdSet.has(t.ride_id)).length;
    }

    setMetrics({
      todayRides: ridesRes.count ?? 0,
      todayTbrs: todayTbrCount,
      openPs: psRes.count ?? 0,
      openRto: rtoRes.count ?? 0,
      openPiso: pisoRes.count ?? 0,
      activeLoading: loadingRes.count ?? 0,
    });

    // Last 7 days charts
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) days.push(format(subDays(today, i), "yyyy-MM-dd"));

    const sevenDaysAgo = startOfDay(subDays(today, 6)).toISOString();

    const [rides7, tbrs7, statusRes] = await Promise.all([
      supabase.from("driver_rides").select("completed_at").eq("unit_id", unitId).gte("completed_at", sevenDaysAgo),
      supabase.from("ride_tbrs").select("scanned_at, ride_id").gte("scanned_at", sevenDaysAgo),
      supabase.from("driver_rides").select("loading_status").eq("unit_id", unitId).gte("completed_at", sevenDaysAgo),
    ]);

    // Bar: rides per day
    const ridesByDay: Record<string, number> = {};
    days.forEach(d => ridesByDay[d] = 0);
    (rides7.data ?? []).forEach(r => {
      const d = format(new Date(r.completed_at), "yyyy-MM-dd");
      if (ridesByDay[d] !== undefined) ridesByDay[d]++;
    });
    setBarData(days.map(d => ({ day: format(new Date(d), "dd/MM"), count: ridesByDay[d] })));

    // Filter tbrs by unit
    const { data: unitRides7 } = await supabase.from("driver_rides").select("id").eq("unit_id", unitId);
    const unitRideSet = new Set((unitRides7 ?? []).map(r => r.id));
    const filteredTbrs = (tbrs7.data ?? []).filter(t => unitRideSet.has(t.ride_id));

    // Line: tbrs per day
    const tbrsByDay: Record<string, number> = {};
    days.forEach(d => tbrsByDay[d] = 0);
    filteredTbrs.forEach(t => {
      if (!t.scanned_at) return;
      const d = format(new Date(t.scanned_at), "yyyy-MM-dd");
      if (tbrsByDay[d] !== undefined) tbrsByDay[d]++;
    });
    setLineData(days.map(d => ({ day: format(new Date(d), "dd/MM"), count: tbrsByDay[d] })));

    // Pie: status distribution
    const statusCount: Record<string, number> = { pending: 0, loading: 0, finished: 0 };
    (statusRes.data ?? []).forEach(r => {
      const s = r.loading_status ?? "pending";
      if (statusCount[s] !== undefined) statusCount[s]++;
    });
    setPieData(Object.entries(statusCount).filter(([, v]) => v > 0).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v })));

    setLoading(false);
  }, [unitId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const cards = [
    { label: "Carregamentos hoje", value: metrics.todayRides, icon: Truck, color: "text-primary" },
    { label: "TBRs escaneados hoje", value: metrics.todayTbrs, icon: ScanBarcode, color: "text-blue-500" },
    { label: "PS abertos", value: metrics.openPs, icon: AlertTriangle, color: "text-destructive" },
    { label: "RTO abertos", value: metrics.openRto, icon: RotateCcw, color: "text-orange-500" },
    { label: "Retornos Piso abertos", value: metrics.openPiso, icon: PackageX, color: "text-yellow-600" },
    { label: "Carregando agora", value: metrics.activeLoading, icon: Loader2, color: "text-green-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <c.icon className={`h-5 w-5 ${c.color}`} />
              <span className="text-2xl font-bold italic">{c.value}</span>
              <span className="text-xs text-muted-foreground leading-tight">{c.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic">Carregamentos (7 dias)</CardTitle>
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

        {/* Line Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic">TBRs escaneados (7 dias)</CardTitle>
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

        {/* Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic">Status dos carregamentos</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardMetrics;
