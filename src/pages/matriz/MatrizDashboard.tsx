import { useState, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, TrendingUp, Users, Truck, Calendar as CalendarIcon, BarChart3, Loader2 } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, parseISO, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchAllRows, fetchAllRowsWithIn } from "@/lib/supabase-helpers";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
      const start = startOfDay(parseISO(dateStart)).toISOString();
      const end = endOfDay(parseISO(dateEnd)).toISOString();
      const startDay = format(parseISO(dateStart), "yyyy-MM-dd");
      const endDay = format(parseISO(dateEnd), "yyyy-MM-dd");

      const [ridesData, settingsData, customData, minPkgData, fixedData, reativoData, dnrData, bonusData] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase.from("driver_rides")
            .select("id, unit_id, driver_id, completed_at, login")
            .in("unit_id", unitIds)
            .gte("completed_at", start)
            .lte("completed_at", end)
            .order("id")
            .range(from, to)
        ),
        supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds),
        supabase.from("driver_custom_values").select("unit_id, driver_id, custom_tbr_value").in("unit_id", unitIds),
        supabase.from("driver_minimum_packages" as any).select("unit_id, driver_id, min_packages, period_start, period_end").in("unit_id", unitIds),
        supabase.from("driver_fixed_values" as any).select("unit_id, driver_id, target_date, fixed_value").in("unit_id", unitIds).gte("target_date", startDay).lte("target_date", endDay),
        supabase.from("reativo_entries").select("unit_id, driver_id, reativo_value, activated_at, tbr_code").in("unit_id", unitIds).eq("status", "active").gte("activated_at", start).lte("activated_at", end),
        supabase.from("dnr_entries").select("unit_id, driver_id, dnr_value, closed_at").in("unit_id", unitIds).eq("status", "closed").eq("discounted", true).gte("closed_at", start).lte("closed_at", end),
        supabase.from("driver_bonus").select("unit_id, driver_id, amount, period_start").in("unit_id", unitIds).gte("period_start", startDay).lte("period_start", endDay)
      ]);

      if ((ridesData || []).length === 0 && (reativoData.data || []).length === 0 && (bonusData.data || []).length === 0) {
        return { 
          rides: ridesData || [], 
          tbrs: [], 
          settings: settingsData.data || [], 
          customValues: customData.data || [], 
          minPackages: minPkgData.data || [], 
          fixedValues: fixedData.data || [], 
          reatives: reativoData.data || [], 
          dnrs: dnrData.data || [], 
          bonuses: bonusData.data || [] 
        };
      }

      const rideIds = ridesData.map(r => r.id);
      
      const [tbrData, pisoData, psData, rtoData] = await Promise.all([
        fetchAllRowsWithIn<any>(
          (ids) => (from, to) => supabase.from("ride_tbrs").select("id, code, ride_id").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<any>(
          (ids) => (from, to) => supabase.from("piso_entries").select("ride_id, tbr_code, reason").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<any>(
          (ids) => (from, to) => supabase.from("ps_entries").select("ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<any>(
          (ids) => (from, to) => supabase.from("rto_entries").select("ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
          rideIds
        )
      ]);
      
      return { 
        rides: ridesData, 
        tbrs: tbrData, 
        settings: settingsData.data || [],
        customValues: customData.data || [],
        minPackages: minPkgData.data || [],
        fixedValues: fixedData.data || [],
        reatives: reativoData.data || [],
        dnrs: dnrData.data || [],
        bonuses: bonusData.data || [],
        returns: { piso: pisoData, ps: psData, rto: rtoData }
      };
    },
    enabled: units.length > 0,
  });

  const processedData = useMemo(() => {
    if (!dashboardData) return { unitMetrics: [], chartData: [], avgPacoteGeral: 0 };
    const { 
      rides = [], 
      tbrs = [], 
      settings = [], 
      customValues = [], 
      minPackages = [], 
      fixedValues = [], 
      reatives = [], 
      dnrs = [], 
      bonuses = [],
      returns = { piso: [], ps: [], rto: [] }
    } = dashboardData;

    // Group returns by ride_id and tbr_code for faster lookup
    const returnsByRide = new Map<string, Set<string>>();
    [...returns.piso, ...returns.ps, ...returns.rto].forEach((p: any) => {
      if (p.ride_id && p.tbr_code) {
        if (!returnsByRide.has(p.ride_id)) returnsByRide.set(p.ride_id, new Set());
        returnsByRide.get(p.ride_id)!.add(p.tbr_code.toString().toUpperCase());
      }
    });

    // Map ride_id to tbr list
    const tbrsByRide = new Map<string, string[]>();
    tbrs.forEach((t: any) => {
      if (!tbrsByRide.has(t.ride_id)) tbrsByRide.set(t.ride_id, []);
      tbrsByRide.get(t.ride_id)!.push(t.code?.toString().toUpperCase() || "");
    });

    const unitMetrics = units.map(u => {
      const uRides = rides.filter((r: any) => r.unit_id === u.id);
      const unitBaseVal = Number(settings.find((s: any) => s.unit_id === u.id)?.tbr_value || 0);
      
      // Calculate total paid and total packages for this unit
      let unitTotalPaid = 0;
      let unitTotalPackages = 0;
      let unitTotalRides = uRides.length;

      // Group rides by driver and day for min package / fixed value logic
      const driverDayGroups = new Map<string, { driverId: string; date: string; rides: any[] }>();
      uRides.forEach((r: any) => {
        const day = format(new Date(r.completed_at), "yyyy-MM-dd");
        const key = `${r.driver_id}_${day}`;
        if (!driverDayGroups.has(key)) driverDayGroups.set(key, { driverId: r.driver_id, date: day, rides: [] });
        driverDayGroups.get(key)!.rides.push(r);
      });

      driverDayGroups.forEach(group => {
        const tbrVal = Number(customValues.find((cv: any) => cv.driver_id === group.driverId && cv.unit_id === u.id)?.custom_tbr_value ?? unitBaseVal);
        const fixedVal = (fixedValues as any[]).find((fv: any) => fv.driver_id === group.driverId && fv.unit_id === u.id && fv.target_date === group.date)?.fixed_value;
        
        let dayTbrCount = 0;
        let dayReturnsCount = 0;

        group.rides.forEach(ride => {
          const rideTbrs = tbrsByRide.get(ride.id) || [];
          const rideReturns = returnsByRide.get(ride.id) || new Set();
          
          dayTbrCount += rideTbrs.length;
          
          const allDayActiveCodes = new Set<string>();
          group.rides.forEach(r => (tbrsByRide.get(r.id) || []).forEach(c => allDayActiveCodes.add(c)));
          
          rideReturns.forEach(code => {
            if (!allDayActiveCodes.has(code)) {
              dayReturnsCount++;
            }
          });
        });

        const minPkg = (minPackages as any[]).find((mp: any) => {
          if (mp.driver_id !== group.driverId || mp.unit_id !== u.id) return false;
          if (!mp.period_start && !mp.period_end) return true;
          return (!mp.period_start || group.date >= mp.period_start) && (!mp.period_end || group.date <= mp.period_end);
        })?.min_packages || 0;

        const effectivePackages = Math.max(dayTbrCount, Number(minPkg));
        const dayCompleted = effectivePackages - dayReturnsCount;
        
        if (fixedVal !== undefined) {
          unitTotalPaid += Number(fixedVal);
        } else {
          unitTotalPaid += dayCompleted * tbrVal;
        }
        unitTotalPackages += dayTbrCount - dayReturnsCount;
      });

      const unitBonuses = bonuses.filter((b: any) => b.unit_id === u.id).reduce((sum: number, b: any) => sum + Number(b.amount), 0);
      const unitReatives = reatives.filter((r: any) => r.unit_id === u.id).reduce((sum: number, r: any) => sum + Number(r.reativo_value), 0);
      const unitDnrs = dnrs.filter((d: any) => d.unit_id === u.id).reduce((sum: number, d: any) => sum + Number(d.dnr_value), 0);

      const finalUnitTotalPaid = unitTotalPaid + unitBonuses + unitReatives - unitDnrs;
      const avgPacote = unitTotalPackages > 0 ? (finalUnitTotalPaid / unitTotalPackages) : 0;

      return {
        id: u.id,
        name: u.name,
        rides: unitTotalRides,
        packages: unitTotalPackages,
        tbrValue: avgPacote,
        totalBRL: finalUnitTotalPaid,
      };
    });

    const dailyData: Record<string, any> = {};
    const avgDailyData: Record<string, any> = {};

    // To calculate daily averages per unit, we need to process groups day by day
    const allDays = new Set<string>();
    rides.forEach((r: any) => allDays.add(format(new Date(r.completed_at), "yyyy-MM-dd")));
    const sortedDays = Array.from(allDays).sort();

    sortedDays.forEach(dayStr => {
      const displayDay = format(parseISO(dayStr), "dd/MM");
      if (!dailyData[displayDay]) dailyData[displayDay] = { name: displayDay };
      if (!avgDailyData[displayDay]) avgDailyData[displayDay] = { name: displayDay };

      unitMetrics.forEach(u => {
        // Find rides for this unit on this day
        const uRidesOnDay = rides.filter((r: any) => r.unit_id === u.id && format(new Date(r.completed_at), "yyyy-MM-dd") === dayStr);
        if (uRidesOnDay.length === 0) return;

        const unitBaseVal = Number(settings.find((s: any) => s.unit_id === u.id)?.tbr_value || 0);
        let dayPaid = 0;
        let dayPackages = 0;

        // Group by driver for min package logic
        const driverGroups = new Map<string, any[]>();
        uRidesOnDay.forEach((r: any) => {
          if (!driverGroups.has(r.driver_id)) driverGroups.set(r.driver_id, []);
          driverGroups.get(r.driver_id)!.push(r);
        });

        driverGroups.forEach((groupRides, driverId) => {
          const tbrVal = Number(customValues.find((cv: any) => cv.driver_id === driverId && cv.unit_id === u.id)?.custom_tbr_value ?? unitBaseVal);
          const fixedVal = (fixedValues as any[]).find((fv: any) => fv.driver_id === driverId && fv.unit_id === u.id && fv.target_date === dayStr)?.fixed_value;
          
          let tbrCount = 0;
          let returnsCount = 0;

          groupRides.forEach(ride => {
            const rTbrs = tbrsByRide.get(ride.id) || [];
            const rReturns = returnsByRide.get(ride.id) || new Set();
            tbrCount += rTbrs.length;

            const allDayActiveCodes = new Set<string>();
            groupRides.forEach(rr => (tbrsByRide.get(rr.id) || []).forEach(c => allDayActiveCodes.add(c)));
            rReturns.forEach(code => { if (!allDayActiveCodes.has(code)) returnsCount++; });
          });

          const minPkg = (minPackages as any[]).find((mp: any) => {
            if (mp.driver_id !== driverId || mp.unit_id !== u.id) return false;
            if (!mp.period_start && !mp.period_end) return true;
            return (!mp.period_start || dayStr >= mp.period_start) && (!mp.period_end || dayStr <= mp.period_end);
          })?.min_packages || 0;

          const effectivePackages = Math.max(tbrCount, Number(minPkg));
          const completed = effectivePackages - returnsCount;

          if (fixedVal !== undefined) dayPaid += Number(fixedVal);
          else dayPaid += completed * tbrVal;
          
          dayPackages += (tbrCount - returnsCount);
        });

        // Add daily proportional bonuses/reatives? Usually they are per day in the DB anyway
        const dayBonuses = bonuses.filter((b: any) => b.unit_id === u.id && b.period_start === dayStr).reduce((s: number, b: any) => s + Number(b.amount), 0);
        // Activated_at is ISO, so we check day
        const dayReatives = reatives.filter((r: any) => r.unit_id === u.id && format(new Date(r.activated_at), "yyyy-MM-dd") === dayStr).reduce((s: number, r: any) => s + Number(r.reativo_value), 0);
        const dayDnrs = dnrs.filter((d: any) => d.unit_id === u.id && format(new Date(d.closed_at), "yyyy-MM-dd") === dayStr).reduce((s: number, d: any) => s + Number(d.dnr_value), 0);

        const finalDayPaid = dayPaid + dayBonuses + dayReatives - dayDnrs;
        
        dailyData[displayDay][u.name] = (dailyData[displayDay][u.name] ?? 0) + dayPackages;
        avgDailyData[displayDay][u.name] = dayPackages > 0 ? (finalDayPaid / dayPackages) : 0;
      });
    });

    const chartData = Object.values(dailyData);
    const avgChartData = Object.values(avgDailyData);

    const totalBRL = unitMetrics.reduce((a, b) => a + b.totalBRL, 0);
    const totalPackages = unitMetrics.reduce((a, b) => a + b.packages, 0);
    const avgPacoteGeral = totalPackages > 0 ? (totalBRL / totalPackages) : 0;

    return { unitMetrics, chartData, avgChartData, avgPacoteGeral };
  }, [units, dashboardData]);


  const totals = useMemo(() => ({
    packages: (processedData.unitMetrics as any[]).reduce((a: number, b: any) => a + (b.packages || 0), 0),
    rides: (processedData.unitMetrics as any[]).reduce((a: number, b: any) => a + (b.rides || 0), 0),
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

      {/* New Average Trend Chart */}
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold italic flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Tendência de Média Pacote por Unidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedData.avgChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val) => `R$ ${val}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(val: any) => formatBRL(Number(val))}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold italic flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Tendência de TBR's por Unidade
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
            <CardTitle className="text-sm font-bold italic">Top Ranking (TBR's)</CardTitle>
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
