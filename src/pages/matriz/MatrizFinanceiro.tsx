import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { DollarSign, TrendingUp, FileWarning, Package, Wallet } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { formatBRL } from "@/lib/utils";

const MatrizFinanceiro = () => {
  const { unitSession } = useAuthStore();
  const domainId = unitSession?.domain_id || "";

  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [units, setUnits] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [tbrs, setTbrs] = useState<any[]>([]);
  const [dnrEntries, setDnrEntries] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<any[]>([]);
  const [fixedValues, setFixedValues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minPackages, setMinPackages] = useState<any[]>([]);

  useEffect(() => {
    if (!domainId) return;
    supabase.from("units_public").select("id, name").eq("domain_id", domainId).eq("active", true).order("name")
      .then(({ data }) => { if (data) setUnits((data as any[]).filter(u => u.name !== "MATRIZ ADMIN")); });
  }, [domainId]);

  useEffect(() => {
    if (!units.length) return;
    const unitIds = units.map(u => u.id);
    const start = startOfDay(new Date(dateStart)).toISOString();
    const end = endOfDay(new Date(dateEnd)).toISOString();
    setLoading(true);
    import("@/lib/supabase-helpers").then(({ fetchAllRows }) => {
      Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase.from("driver_rides").select("id, unit_id, driver_id, completed_at").in("unit_id", unitIds).gte("completed_at", start).lte("completed_at", end).order("id").range(from, to)
        ),
        fetchAllRows<any>((from, to) => supabase.from("dnr_entries").select("id, unit_id, dnr_value, status, discounted").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("driver_custom_values").select("unit_id, driver_id, custom_tbr_value").in("unit_id", unitIds).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("driver_minimum_packages" as any).select("unit_id, driver_id, min_packages").in("unit_id", unitIds).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("driver_fixed_values" as any).select("unit_id, driver_id, target_date, fixed_value").in("unit_id", unitIds).gte("target_date", dateStart).lte("target_date", dateEnd).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("reativo_entries").select("unit_id, driver_id, reativo_value").in("unit_id", unitIds).eq("status", "active").gte("activated_at", start).lte("activated_at", end).order("id").range(from, to)),
      ]).then(([ridesData, dnrData, settingsData, customData, minPkgData, fixedData, reativoData]) => {
        setRides(ridesData);
        setDnrEntries(dnrData);
        setSettings(settingsData);
        setCustomValues(customData);
        setMinPackages(minPkgData);
        setFixedValues(fixedData);
        setLoading(false);

        // Build reativo map by unit
        const reativoByUnit = new Map<string, number>();
        reativoData.forEach((r: any) => {
          reativoByUnit.set(r.unit_id, (reativoByUnit.get(r.unit_id) ?? 0) + Number(r.reativo_value));
        });
        setReativoByUnit(reativoByUnit);

        const rideIds = ridesData.map((r: any) => r.id);
        if (rideIds.length > 0) {
          fetchAllRows<{ id: string; ride_id: string }>((from, to) =>
            supabase.from("ride_tbrs").select("id, ride_id").in("ride_id", rideIds).order("id").range(from, to)
          ).then(data => setTbrs(data));
        } else setTbrs([]);
      });
    });
  }, [units, dateStart, dateEnd]);

  const unitFinancials = useMemo(() => {
    // Build fixed values map: "unitId_driverId_date" -> fixed_value
    const fvMap = new Map<string, number>();
    fixedValues.forEach((fv: any) => { fvMap.set(`${fv.unit_id}_${fv.driver_id}_${fv.target_date}`, Number(fv.fixed_value)); });

    return units.map(u => {
      const uRides = rides.filter(r => r.unit_id === u.id);
      const uRideIds = uRides.map(r => r.id);
      const uTbrs = tbrs.filter(t => uRideIds.includes(t.ride_id)).length;
      const uDnr = dnrEntries.filter(d => d.unit_id === u.id);
      const dnrTotal = uDnr.reduce((a, d) => a + Number(d.dnr_value || 0), 0);

      // Calculate total paid considering custom values, minimum packages, and fixed values
      let totalPaid = 0;
      // Group by driver+day
      const dayGroups = new Map<string, { driverId: string; day: string; tbrCount: number; tbrVal: number }>();
      uRides.forEach(ride => {
        const day = format(new Date(ride.completed_at), "yyyy-MM-dd");
        const key = `${ride.driver_id}_${day}`;
        const rideTbrCount = tbrs.filter(t => t.ride_id === ride.id).length;
        const cv = customValues.find(c => c.driver_id === ride.driver_id && c.unit_id === ride.unit_id);
        const unitVal = settings.find(s => s.unit_id === u.id)?.tbr_value || 0;
        const tbrVal = cv ? Number(cv.custom_tbr_value) : Number(unitVal);
        const existing = dayGroups.get(key);
        if (existing) { existing.tbrCount += rideTbrCount; }
        else dayGroups.set(key, { driverId: ride.driver_id, day, tbrCount: rideTbrCount, tbrVal });
      });
      dayGroups.forEach(g => {
        const fixedKey = `${u.id}_${g.driverId}_${g.day}`;
        const fixedVal = fvMap.get(fixedKey);
        if (fixedVal !== undefined) {
          totalPaid += fixedVal;
        } else {
          const minPkg = minPackages.find(mp => mp.driver_id === g.driverId && mp.unit_id === u.id);
          const effectiveTbrs = minPkg && g.tbrCount < Number(minPkg.min_packages) ? Number(minPkg.min_packages) : g.tbrCount;
          totalPaid += effectiveTbrs * g.tbrVal;
        }
      });

      return {
        id: u.id,
        name: u.name,
        rides: uRides.length,
        tbrs: uTbrs,
        tbrValue: Number(settings.find(s => s.unit_id === u.id)?.tbr_value || 0),
        totalPaid,
        dnrTotal,
      };
    }).sort((a, b) => b.totalPaid - a.totalPaid);
  }, [units, rides, tbrs, dnrEntries, settings, customValues, minPackages, fixedValues]);
  

  const totals = useMemo(() => ({
    rides: unitFinancials.reduce((a, u) => a + u.rides, 0),
    tbrs: unitFinancials.reduce((a, u) => a + u.tbrs, 0),
    totalPaid: unitFinancials.reduce((a, u) => a + u.totalPaid, 0),
    dnr: unitFinancials.reduce((a, u) => a + u.dnrTotal, 0),
  }), [unitFinancials]);

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
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={Package} label="Total Carregamentos" value={totals.rides} loading={loading} />
        <KpiCard icon={TrendingUp} label="Total TBRs" value={totals.tbrs} loading={loading} />
        <KpiCard icon={Wallet} label="Total Pago (TBRs)" value={formatBRL(totals.totalPaid)} loading={loading} color="text-emerald-600" />
        <KpiCard icon={FileWarning} label="DNR Total" value={formatBRL(totals.dnr)} loading={loading} color="text-destructive" />
      </div>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-bold italic">Detalhamento por Unidade</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Carreg.</TableHead>
                  <TableHead className="text-center">TBRs</TableHead>
                  <TableHead className="text-center">Valor TBR</TableHead>
                  <TableHead className="text-right">Total Pago TBRs</TableHead>
                  <TableHead className="text-right">DNR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitFinancials.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold italic">{u.name}</TableCell>
                    <TableCell className="text-center">{u.rides}</TableCell>
                    <TableCell className="text-center">{u.tbrs}</TableCell>
                    <TableCell className="text-center">{formatBRL(u.tbrValue)}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{formatBRL(u.totalPaid)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatBRL(u.dnrTotal)}</TableCell>
                  </TableRow>
                ))}
                {unitFinancials.length > 1 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-center">{totals.rides}</TableCell>
                    <TableCell className="text-center">{totals.tbrs}</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-emerald-600">{formatBRL(totals.totalPaid)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatBRL(totals.dnr)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, loading, color = "text-primary" }: any) => (
  <Card className="animate-slide-up">
    <CardContent className="p-4 flex items-center gap-3">
      <Icon className={`h-8 w-8 ${color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-semibold italic truncate">{label}</p>
        <p className="text-lg font-bold">{loading ? "..." : value}</p>
      </div>
    </CardContent>
  </Card>
);

export default MatrizFinanceiro;
