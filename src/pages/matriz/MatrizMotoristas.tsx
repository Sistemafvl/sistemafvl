import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Truck, Search } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const MatrizMotoristas = () => {
  const { unitSession } = useAuthStore();
  const domainId = unitSession?.domain_id || "";

  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [units, setUnits] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [tbrs, setTbrs] = useState<any[]>([]);
  const [dnrEntries, setDnrEntries] = useState<any[]>([]);
  const [psEntries, setPsEntries] = useState<any[]>([]);
  const [unitSettings, setUnitSettings] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minPackages, setMinPackages] = useState<any[]>([]);

  useEffect(() => {
    if (!domainId) return;
    supabase.from("units_public").select("id, name").eq("domain_id", domainId).eq("active", true).order("name")
      .then(({ data }) => { if (data) setUnits((data as any[]).filter(u => u.name !== "MATRIZ ADMIN")); });
  }, [domainId]);

  useEffect(() => {
    if (!units.length) return;
    const unitIds = filterUnit === "all" ? units.map(u => u.id) : [filterUnit];
    const start = startOfDay(new Date(dateStart)).toISOString();
    const end = endOfDay(new Date(dateEnd)).toISOString();
    setLoading(true);
    Promise.all([
      supabase.from("driver_rides").select("id, unit_id, driver_id, completed_at").in("unit_id", unitIds).gte("completed_at", start).lte("completed_at", end),
      supabase.from("drivers_public").select("id, name, cpf, car_plate, car_model, active"),
      supabase.from("dnr_entries").select("id, unit_id, driver_id, dnr_value, status").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end),
      supabase.from("ps_entries").select("id, unit_id, driver_name").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end),
      supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds),
      supabase.from("driver_custom_values").select("unit_id, driver_id, custom_tbr_value").in("unit_id", unitIds),
      supabase.from("driver_minimum_packages" as any).select("unit_id, driver_id, min_packages").in("unit_id", unitIds),
    ]).then(([ridesR, driversR, dnrR, psR, settingsR, customR, minPkgR]) => {
      setRides(ridesR.data || []);
      setDrivers(driversR.data || []);
      setDnrEntries(dnrR.data || []);
      setPsEntries(psR.data || []);
      setUnitSettings(settingsR.data || []);
      setCustomValues(customR.data || []);
      setMinPackages((minPkgR.data as any[]) || []);
      setLoading(false);
      const rideIds = (ridesR.data || []).map((r: any) => r.id);
      if (rideIds.length > 0) {
        import("@/lib/supabase-helpers").then(({ fetchAllRows }) => {
          fetchAllRows<{ id: string; ride_id: string }>((from, to) =>
            supabase.from("ride_tbrs").select("id, ride_id").in("ride_id", rideIds).range(from, to)
          ).then(data => setTbrs(data));
        });
      } else setTbrs([]);
    });
  }, [units, dateStart, dateEnd, filterUnit]);

  const ranking = useMemo(() => {
    const driverMap: Record<string, { rides: number; unitIds: Set<string>; rideIds: string[]; rideDetails: { id: string; unit_id: string; driver_id: string; completed_at: string }[] }> = {};
    rides.forEach(r => {
      if (!driverMap[r.driver_id]) driverMap[r.driver_id] = { rides: 0, unitIds: new Set(), rideIds: [], rideDetails: [] };
      driverMap[r.driver_id].rides++;
      driverMap[r.driver_id].unitIds.add(r.unit_id);
      driverMap[r.driver_id].rideIds.push(r.id);
      driverMap[r.driver_id].rideDetails.push(r);
    });

    return Object.entries(driverMap).map(([driverId, stats]) => {
      const driver = drivers.find(d => d.id === driverId);
      const driverTbrs = tbrs.filter(t => stats.rideIds.includes(t.ride_id)).length;
      const driverDnr = dnrEntries.filter(d => d.driver_id === driverId);
      const dnrValue = driverDnr.reduce((a, d) => a + Number(d.dnr_value || 0), 0);
      const unitNames = [...stats.unitIds].map(uid => units.find(u => u.id === uid)?.name || "").filter(Boolean);

      // Calculate total earned from TBRs with minimum packages logic
      let totalEarned = 0;
      // Group by unit+day for min packages
      const dayGroups = new Map<string, { unitId: string; tbrCount: number; tbrVal: number }>();
      stats.rideDetails.forEach(ride => {
        const day = format(new Date(ride.completed_at), "yyyy-MM-dd");
        const key = `${ride.unit_id}_${day}`;
        const rideTbrCount = tbrs.filter(t => t.ride_id === ride.id).length;
        const cv = customValues.find(c => c.driver_id === ride.driver_id && c.unit_id === ride.unit_id);
        const unitVal = unitSettings.find(s => s.unit_id === ride.unit_id)?.tbr_value || 0;
        const tbrVal = cv ? Number(cv.custom_tbr_value) : Number(unitVal);
        const existing = dayGroups.get(key);
        if (existing) { existing.tbrCount += rideTbrCount; }
        else dayGroups.set(key, { unitId: ride.unit_id, tbrCount: rideTbrCount, tbrVal });
      });
      dayGroups.forEach(g => {
        const minPkg = minPackages.find(mp => mp.driver_id === driverId && mp.unit_id === g.unitId);
        const effectiveTbrs = minPkg && g.tbrCount < Number(minPkg.min_packages) ? Number(minPkg.min_packages) : g.tbrCount;
        totalEarned += effectiveTbrs * g.tbrVal;
      });

      return {
        id: driverId,
        name: driver?.name || "—",
        cpf: driver?.cpf || "—",
        plate: driver?.car_plate || "—",
        model: driver?.car_model || "—",
        active: driver?.active ?? true,
        rides: stats.rides,
        tbrs: driverTbrs,
        totalEarned,
        dnr: driverDnr.length,
        dnrValue,
        units: unitNames.join(", "),
      };
    }).sort((a, b) => b.rides - a.rides);
  }, [rides, drivers, tbrs, dnrEntries, units, unitSettings, customValues, minPackages]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ranking;
    const s = search.toLowerCase();
    return ranking.filter(d =>
      d.name.toLowerCase().includes(s) || d.cpf.includes(s) || d.plate.toLowerCase().includes(s)
    );
  }, [ranking, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
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
              {units.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs font-semibold italic">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, CPF ou Placa" className="h-9 pl-9" />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-bold italic">
            <Truck className="h-5 w-5 text-primary" />
            Ranking de Motoristas ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead className="text-center">Carreg.</TableHead>
                  <TableHead className="text-center">TBRs</TableHead>
                  <TableHead className="text-right">Total Ganho</TableHead>
                  <TableHead className="text-center">DNR</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d, i) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold italic">{d.name}</TableCell>
                    <TableCell className="text-xs">{d.plate}</TableCell>
                    <TableCell className="text-center font-bold">{d.rides}</TableCell>
                    <TableCell className="text-center">{d.tbrs}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">R$ {d.totalEarned.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      {d.dnr > 0 ? (
                        <span className="text-destructive font-semibold">{d.dnr} (R$ {d.dnrValue.toFixed(2)})</span>
                      ) : "0"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{d.units}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={d.active ? "default" : "secondary"} className="text-[10px]">
                        {d.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground italic py-8">
                      Nenhum motorista encontrado
                    </TableCell>
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

export default MatrizMotoristas;
