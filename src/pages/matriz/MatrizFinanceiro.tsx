import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { DollarSign, TrendingUp, FileWarning, Package, Wallet } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

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
  const [loading, setLoading] = useState(true);

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
    Promise.all([
      supabase.from("driver_rides").select("id, unit_id, driver_id, completed_at").in("unit_id", unitIds).gte("completed_at", start).lte("completed_at", end),
      supabase.from("dnr_entries").select("id, unit_id, dnr_value, status, discounted").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end),
      supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds),
      supabase.from("driver_custom_values").select("unit_id, driver_id, custom_tbr_value").in("unit_id", unitIds),
    ]).then(([ridesR, dnrR, settingsR, customR]) => {
      setRides(ridesR.data || []);
      setDnrEntries(dnrR.data || []);
      setSettings(settingsR.data || []);
      setCustomValues(customR.data || []);
      setLoading(false);
      const rideIds = (ridesR.data || []).map((r: any) => r.id);
      if (rideIds.length > 0) {
        supabase.from("ride_tbrs").select("id, ride_id").in("ride_id", rideIds)
          .then(({ data }) => setTbrs(data || []));
      } else setTbrs([]);
    });
  }, [units, dateStart, dateEnd]);

  const unitFinancials = useMemo(() => {
    return units.map(u => {
      const uRides = rides.filter(r => r.unit_id === u.id);
      const uRideIds = uRides.map(r => r.id);
      const uTbrs = tbrs.filter(t => uRideIds.includes(t.ride_id)).length;
      const uDnr = dnrEntries.filter(d => d.unit_id === u.id);
      const dnrTotal = uDnr.reduce((a, d) => a + Number(d.dnr_value || 0), 0);

      // Calculate total paid considering custom values
      let totalPaid = 0;
      uRides.forEach(ride => {
        const rideTbrCount = tbrs.filter(t => t.ride_id === ride.id).length;
        const cv = customValues.find(c => c.driver_id === ride.driver_id && c.unit_id === ride.unit_id);
        const unitVal = settings.find(s => s.unit_id === u.id)?.tbr_value || 0;
        const tbrVal = cv ? Number(cv.custom_tbr_value) : Number(unitVal);
        totalPaid += rideTbrCount * tbrVal;
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
  }, [units, rides, tbrs, dnrEntries, settings, customValues]);

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
        <KpiCard icon={Wallet} label="Total Pago (TBRs)" value={`R$ ${totals.totalPaid.toFixed(2)}`} loading={loading} color="text-emerald-600" />
        <KpiCard icon={FileWarning} label="DNR Total" value={`R$ ${totals.dnr.toFixed(2)}`} loading={loading} color="text-destructive" />
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
                    <TableCell className="text-center">R$ {u.tbrValue.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">R$ {u.totalPaid.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-destructive">R$ {u.dnrTotal.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {unitFinancials.length > 1 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-center">{totals.rides}</TableCell>
                    <TableCell className="text-center">{totals.tbrs}</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-emerald-600">R$ {totals.totalPaid.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-destructive">R$ {totals.dnr.toFixed(2)}</TableCell>
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
