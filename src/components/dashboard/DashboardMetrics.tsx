import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, ScanBarcode, AlertTriangle, RotateCcw, PackageX, Loader2, CalendarIcon } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getBrazilDayRange, getBrazilTodayStr, toBrazilDateStr } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  unitId: string;
  startDate?: Date;
  endDate?: Date;
}

const COLORS = ["hsl(var(--primary))", "hsl(210, 70%, 55%)", "hsl(140, 60%, 45%)", "hsl(45, 90%, 50%)", "hsl(0, 70%, 55%)"];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  loading: "Em carregamento",
  finished: "Finalizado",
};

interface CardDateRange {
  start?: Date;
  end?: Date;
}

const DateRangeFilter = ({ value, onChange }: { value: CardDateRange; onChange: (v: CardDateRange) => void }) => {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  
  return (
    <div className="flex items-center gap-1">
      <Popover open={startOpen} onOpenChange={setStartOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-muted-foreground">
            <CalendarIcon className="h-3 w-3 mr-1" />
            {value.start ? format(value.start, "dd/MM") : "De"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Calendar mode="single" selected={value.start} onSelect={(d) => { onChange({ ...value, start: d ?? undefined }); setStartOpen(false); }} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
      <Popover open={endOpen} onOpenChange={setEndOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-muted-foreground">
            {value.end ? format(value.end, "dd/MM") : "Até"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="end" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Calendar mode="single" selected={value.end} onSelect={(d) => { onChange({ ...value, end: d ?? undefined }); setEndOpen(false); }} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
        </PopoverContent>
      </Popover>
    </div>
  );
};

const DashboardMetrics = ({ unitId, startDate, endDate }: Props) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todayRides: 0, todayTbrs: 0, openPs: 0, openRto: 0, openPiso: 0, activeLoading: 0,
  });
  const [barData, setBarData] = useState<{ day: string; count: number }[]>([]);
  const [lineData, setLineData] = useState<{ day: string; count: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);

  // Per-card date overrides
  const [barDates, setBarDates] = useState<CardDateRange>({});
  const [lineDates, setLineDates] = useState<CardDateRange>({});
  const [pieDates, setPieDates] = useState<CardDateRange>({});

  const fetchAll = useCallback(async () => {
    // Determine the "today" range from global filter or default
    const globalStart = startDate ? format(startDate, "yyyy-MM-dd") : undefined;
    const globalEnd = endDate ? format(endDate, "yyyy-MM-dd") : undefined;

    const { start: todayStart, end: todayEnd } = globalStart
      ? getBrazilDayRange(globalStart)
      : getBrazilDayRange();
    const effectiveTodayEnd = globalEnd ? getBrazilDayRange(globalEnd).end : todayEnd;

    const [ridesRes, tbrsRes, psRes, rtoRes, pisoRes, loadingRes] = await Promise.all([
      supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("unit_id", unitId).gte("completed_at", todayStart).lte("completed_at", effectiveTodayEnd).neq("loading_status", "cancelled"),
      supabase.from("ride_tbrs").select("id, ride_id", { count: "exact" }).gte("scanned_at", todayStart).lte("scanned_at", effectiveTodayEnd),
      supabase.from("ps_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("rto_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("piso_entries").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("status", "open"),
      supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("unit_id", unitId).eq("loading_status", "loading"),
    ]);

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
    setLoading(false);
  }, [unitId, startDate, endDate]);

  // Fetch chart data with per-card date overrides
  const fetchChartData = useCallback(async (type: "bar" | "line" | "pie", cardDates: CardDateRange) => {
    const todayStr = getBrazilTodayStr();
    const todayDate = new Date(todayStr);

    const effectiveEnd = cardDates.end || (endDate ? endDate : todayDate);
    const effectiveStart = cardDates.start || (startDate ? startDate : new Date(new Date(effectiveEnd).setDate(effectiveEnd.getDate() - 6)));

    // Build days array
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

    if (type === "bar") {
      const { data: rides7 } = await supabase.from("driver_rides").select("completed_at").eq("unit_id", unitId).gte("completed_at", rangeStart).lte("completed_at", rangeEnd);
      const ridesByDay: Record<string, number> = {};
      days.forEach(d => ridesByDay[d] = 0);
      (rides7 ?? []).forEach(r => {
        const d = toBrazilDateStr(r.completed_at);
        if (ridesByDay[d] !== undefined) ridesByDay[d]++;
      });
      setBarData(days.map(d => ({ day: d.slice(8, 10) + "/" + d.slice(5, 7), count: ridesByDay[d] })));
    } else if (type === "line") {
      const { data: tbrs7 } = await supabase.from("ride_tbrs").select("scanned_at, ride_id").gte("scanned_at", rangeStart).lte("scanned_at", rangeEnd);
      const { data: unitRides7 } = await supabase.from("driver_rides").select("id").eq("unit_id", unitId);
      const unitRideSet = new Set((unitRides7 ?? []).map(r => r.id));
      const filtered = (tbrs7 ?? []).filter(t => unitRideSet.has(t.ride_id));
      const tbrsByDay: Record<string, number> = {};
      days.forEach(d => tbrsByDay[d] = 0);
      filtered.forEach(t => {
        if (!t.scanned_at) return;
        const d = toBrazilDateStr(t.scanned_at);
        if (tbrsByDay[d] !== undefined) tbrsByDay[d]++;
      });
      setLineData(days.map(d => ({ day: d.slice(8, 10) + "/" + d.slice(5, 7), count: tbrsByDay[d] })));
    } else {
      const { data: statusRes } = await supabase.from("driver_rides").select("loading_status").eq("unit_id", unitId).gte("completed_at", rangeStart).lte("completed_at", rangeEnd);
      const statusCount: Record<string, number> = { pending: 0, loading: 0, finished: 0 };
      (statusRes ?? []).forEach(r => {
        const s = r.loading_status ?? "pending";
        if (statusCount[s] !== undefined) statusCount[s]++;
      });
      setPieData(Object.entries(statusCount).filter(([, v]) => v > 0).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v })));
    }
  }, [unitId, startDate, endDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchChartData("bar", barDates); }, [fetchChartData, barDates]);
  useEffect(() => { fetchChartData("line", lineDates); }, [fetchChartData, lineDates]);
  useEffect(() => { fetchChartData("pie", pieDates); }, [fetchChartData, pieDates]);

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

  const cards = [
    { label: `Carregamentos (${periodLabel})`, value: metrics.todayRides, icon: Truck, color: "text-primary" },
    { label: `TBRs escaneados (${periodLabel})`, value: metrics.todayTbrs, icon: ScanBarcode, color: "text-blue-500" },
    { label: "PS abertos", value: metrics.openPs, icon: AlertTriangle, color: "text-destructive" },
    { label: "RTO abertos", value: metrics.openRto, icon: RotateCcw, color: "text-orange-500" },
    { label: "Retornos Piso abertos", value: metrics.openPiso, icon: PackageX, color: "text-yellow-600" },
    { label: "Carregando agora", value: metrics.activeLoading, icon: Loader2, color: "text-green-500" },
  ];

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold italic">Carregamentos</CardTitle>
            <DateRangeFilter value={barDates} onChange={setBarDates} />
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
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold italic">TBRs escaneados</CardTitle>
            <DateRangeFilter value={lineDates} onChange={setLineDates} />
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
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold italic">Status dos carregamentos</CardTitle>
            <DateRangeFilter value={pieDates} onChange={setPieDates} />
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
