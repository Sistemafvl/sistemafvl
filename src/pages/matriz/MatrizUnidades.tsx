import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building, Package, Users, AlertTriangle, Star, TrendingUp } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const MatrizUnidades = () => {
  const { unitSession } = useAuthStore();
  const domainId = unitSession?.domain_id || "";

  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [units, setUnits] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [tbrs, setTbrs] = useState<Record<string, number>>({});
  const [psEntries, setPsEntries] = useState<any[]>([]);
  const [rtoEntries, setRtoEntries] = useState<any[]>([]);
  const [pisoEntries, setPisoEntries] = useState<any[]>([]);
  const [dnrEntries, setDnrEntries] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!domainId) return;
    supabase.from("units_public").select("id, name, active").eq("domain_id", domainId).order("name")
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
        fetchAllRows<any>((from, to) => supabase.from("driver_rides").select("id, unit_id, driver_id, completed_at").in("unit_id", unitIds).gte("completed_at", start).lte("completed_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("ps_entries").select("id, unit_id, status").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("rto_entries").select("id, unit_id, status").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("dnr_entries").select("id, unit_id, status, dnr_value").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("piso_entries").select("id, unit_id, status").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
        fetchAllRows<any>((from, to) => supabase.from("unit_reviews").select("id, unit_id, rating").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("id").range(from, to)),
      ]).then(async ([ridesData, psData, rtoData, dnrData, pisoData, reviewsData]) => {
        setRides(ridesData);
        setPsEntries(psData);
        setRtoEntries(rtoData);
        setDnrEntries(dnrData);
        setPisoEntries(pisoData);
        setReviews(reviewsData);
        setLoading(false);
        const rideIds = ridesData.map((r: any) => r.id);
        if (rideIds.length > 0) {
          const { data: tbrCounts } = await supabase.rpc("get_ride_tbr_counts", { p_ride_ids: rideIds });
          const countsMap: Record<string, number> = {};
          if (tbrCounts) tbrCounts.forEach((r: any) => { countsMap[r.ride_id] = Number(r.tbr_count); });
          setTbrs(countsMap);
        } else setTbrs({});
      });
    });
  }, [units, dateStart, dateEnd]);

  const unitStats = useMemo(() => {
    return units.map(u => {
      const uRides = rides.filter(r => r.unit_id === u.id);
      const uDrivers = new Set(uRides.map(r => r.driver_id)).size;
      const uTbrs = uRides.reduce((sum, r) => sum + (tbrs[r.id] || 0), 0);
      const uPs = psEntries.filter(p => p.unit_id === u.id).length;
      const uRto = rtoEntries.filter(r => r.unit_id === u.id).length;
      const uPiso = pisoEntries.filter(p => p.unit_id === u.id).length;
      const uDnr = dnrEntries.filter(d => d.unit_id === u.id);
      const dnrValue = uDnr.reduce((a, d) => a + Number(d.dnr_value || 0), 0);
      const uReviews = reviews.filter(r => r.unit_id === u.id);
      const avgRating = uReviews.length ? (uReviews.reduce((a, r) => a + r.rating, 0) / uReviews.length).toFixed(1) : "—";
      const avgTbrs = uRides.length ? (uTbrs / uRides.length).toFixed(1) : "0";

      return {
        ...u,
        rides: uRides.length,
        drivers: uDrivers,
        tbrs: uTbrs,
        avgTbrs,
        ps: uPs,
        rto: uRto,
        piso: uPiso,
        dnr: uDnr.length,
        dnrValue,
        avgRating,
        occurrences: uPs + uRto + uPiso,
      };
    }).sort((a, b) => b.rides - a.rides);
  }, [units, rides, tbrs, psEntries, rtoEntries, pisoEntries, dnrEntries, reviews]);

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

      {loading ? (
        <p className="text-sm text-muted-foreground italic text-center py-8">Carregando dados...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {unitStats.map((u, idx) => (
            <Card key={u.id} className="animate-slide-up">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-bold italic">
                  <Building className="h-5 w-5 text-primary" />
                  <span>{u.name}</span>
                  <Badge variant={u.active ? "default" : "secondary"} className="text-[10px] ml-auto">
                    {u.active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  <Stat icon={Package} label="Carregamentos" value={u.rides} color="text-primary" />
                  <Stat icon={Users} label="Motoristas" value={u.drivers} color="text-emerald-500" />
                  <Stat icon={TrendingUp} label="TBRs" value={`${u.tbrs} (${u.avgTbrs}/carreg.)`} color="text-violet-500" />
                  <Stat icon={AlertTriangle} label="Ocorrências" value={`${u.ps} PS · ${u.rto} RTO · ${u.piso} Piso`} color="text-amber-500" />
                  <Stat icon={Star} label="Avaliação" value={u.avgRating} color="text-amber-400" />
                </div>
                {u.dnr > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground italic">
                    DNR: {u.dnr} ocorrência(s) — R$ {u.dnrValue.toFixed(2)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {unitStats.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma unidade encontrada</p>
          )}
        </div>
      )}
    </div>
  );
};

const Stat = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) => (
  <div className="flex items-center gap-2">
    <Icon className={`h-4 w-4 ${color} shrink-0`} />
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground font-semibold italic truncate">{label}</p>
      <p className="text-sm font-bold truncate">{value}</p>
    </div>
  </div>
);

export default MatrizUnidades;
