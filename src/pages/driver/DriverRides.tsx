import { useState, useEffect } from "react";
import { OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Car, MapPin, Clock, Calendar as CalendarIcon, User, KeyRound, Route, DollarSign, TrendingUp, Target, Package, AlertTriangle } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Ride {
  id: string;
  driver_id: string;
  unit_id: string;
  completed_at: string;
  started_at: string | null;
  finished_at: string | null;
  notes: string | null;
  route: string | null;
  login: string | null;
  password: string | null;
  unit_name?: string;
  tbrCount?: number;
  returnCount?: number;
  tbrValue?: number;
}

const DriverRides = () => {
  const { unitSession } = useAuthStore();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(() => subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  const driverId = unitSession?.user_profile_id;

  useEffect(() => {
    if (!driverId) return;
    const fetchRides = async () => {
      setLoading(true);
      const unitId = unitSession?.id;
      const { data } = await supabase
        .from("driver_rides")
        .select("*")
        .eq("driver_id", driverId)
        .eq("unit_id", unitId!)
        .gte("completed_at", startDate.toISOString())
        .lte("completed_at", new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).toISOString())
        .order("completed_at", { ascending: false });

      if (!data) { setRides([]); setLoading(false); return; }

      const unitIds = [...new Set(data.map((r) => r.unit_id))];
      const rideIds = data.map((r) => r.id);

      const { fetchAllRowsWithIn } = await import("@/lib/supabase-helpers");
      const [unitsRes, pisoRaw, psData, rtoData, settingsRes, customRes] = await Promise.all([
        supabase.from("units").select("id, name").in("id", unitIds),
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string; reason: string | null }>(
          (ids) => (from, to) => supabase.from("piso_entries").select("id, ride_id, tbr_code, reason").in("ride_id", ids).range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string }>(
          (ids) => (from, to) => supabase.from("ps_entries").select("id, ride_id, tbr_code").in("ride_id", ids).range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string }>(
          (ids) => (from, to) => supabase.from("rto_entries").select("id, ride_id, tbr_code").in("ride_id", ids).range(from, to),
          rideIds
        ),
        supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds),
        supabase.from("driver_custom_values").select("unit_id, custom_tbr_value").eq("driver_id", driverId),
      ]);

      // Fetch TBRs with pagination + chunking (bypass 1000 limit and large .in() lists)
      const tbrsData = await fetchAllRowsWithIn<{ id: string; ride_id: string; code: string }>(
        (ids) => (from, to) => supabase.from("ride_tbrs").select("id, ride_id, code").in("ride_id", ids).range(from, to),
        rideIds
      );

      const unitMap = new Map((unitsRes.data ?? []).map((u) => [u.id, u.name]));
      const pisoData = pisoRaw.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));
      const settingsMap = new Map((settingsRes.data ?? []).map((s) => [s.unit_id, Number(s.tbr_value)]));
      const customMap = new Map((customRes.data ?? []).map((cv) => [cv.unit_id, Number(cv.custom_tbr_value)]));

      const tbrCountMap = new Map<string, number>();
      tbrsData.forEach((t) => tbrCountMap.set(t.ride_id, (tbrCountMap.get(t.ride_id) ?? 0) + 1));

      // Count ALL unique return tbr_codes per ride (regardless of whether TBR still in ride)
      const returnTbrSets = new Map<string, Set<string>>();
      [...pisoData, ...psData, ...rtoData].forEach((r: any) => {
        if (r.ride_id && r.tbr_code) {
          if (!returnTbrSets.has(r.ride_id)) returnTbrSets.set(r.ride_id, new Set());
          returnTbrSets.get(r.ride_id)!.add(String(r.tbr_code).toUpperCase());
        }
      });
      const returnCountMap = new Map<string, number>();
      returnTbrSets.forEach((set, rideId) => returnCountMap.set(rideId, set.size));

      setRides(data.map((r) => ({
        ...r,
        unit_name: unitMap.get(r.unit_id) ?? "—",
        tbrCount: tbrCountMap.get(r.id) ?? 0,
        returnCount: returnCountMap.get(r.id) ?? 0,
        tbrValue: customMap.get(r.unit_id) ?? settingsMap.get(r.unit_id) ?? 0,
      })));
      setLoading(false);
    };
    fetchRides();
  }, [driverId, startDate, endDate]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const calcDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff <= 0) return "—";
    const mins = Math.floor(diff / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold italic flex items-center gap-2">
        <Car className="h-5 w-5 text-primary" />
        Corridas
      </h1>

      {/* Login verification alert */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-amber-700 dark:text-amber-400">Atenção: Verifique seu login antes de cada operação</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Certifique-se de que o login utilizado no coletor da Amazon corresponde exatamente ao que consta na sua programação no sistema FVL. 
            Divergências entre os logins podem causar inconsistências operacionais, administrativas e impactar diretamente no cálculo do seu pagamento.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
              {startDate ? format(startDate, "dd/MM/yyyy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[9999] bg-popover" align="start">
            <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">até</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
              {endDate ? format(endDate, "dd/MM/yyyy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[9999] bg-popover" align="start">
            <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Total de corridas no período: <span className="text-primary font-bold">{rides.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-center text-muted-foreground italic py-8 text-sm">Carregando...</p>
          ) : rides.length === 0 ? (
            <p className="text-center text-muted-foreground italic py-8 text-sm">
              Nenhuma corrida finalizada ainda
            </p>
          ) : (
            rides.map((ride, idx) => {
              const totalOriginal = (ride.tbrCount ?? 0) + (ride.returnCount ?? 0);
              const concluidos = totalOriginal - (ride.returnCount ?? 0);
              const totalGanho = concluidos * (ride.tbrValue ?? 0);
              const mediaTbr = totalOriginal > 0 ? totalGanho / totalOriginal : 0;
              const performance = totalOriginal > 0 ? (concluidos / totalOriginal) * 100 : 0;
              const tempo = calcDuration(ride.started_at, ride.finished_at);

              return (
                <div
                  key={ride.id}
                  className="p-3 rounded-lg border border-border bg-card space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                      {rides.length - idx}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        {ride.unit_name}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {formatDate(ride.completed_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(ride.completed_at)}
                        </span>
                      </p>
                      {ride.route && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Route className="h-3 w-3 text-primary" />
                          <strong>Rota:</strong> {ride.route}
                        </p>
                      )}
                      {ride.login && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3 text-primary" />
                          <strong>Login:</strong> {ride.login}
                        </p>
                      )}
                      {ride.password && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <KeyRound className="h-3 w-3 text-primary" />
                          <strong>Senha:</strong> {ride.password}
                        </p>
                      )}
                      {ride.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic truncate">{ride.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Mini-cards de métricas */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="flex flex-col items-center p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                      <DollarSign className="h-3 w-3 text-emerald-600 mb-0.5" />
                      <span className="text-[10px] text-muted-foreground leading-none">Total</span>
                      <span className="text-xs font-bold text-emerald-600">R${totalGanho.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col items-center p-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                      <TrendingUp className="h-3 w-3 text-blue-600 mb-0.5" />
                      <span className="text-[10px] text-muted-foreground leading-none">Valor TBR</span>
                      <span className="text-xs font-bold text-blue-600">R${(ride.tbrValue ?? 0).toFixed(2).replace(".", ",")}</span>
                    </div>
                    <div className="flex flex-col items-center p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                      <Target className="h-3 w-3 text-amber-600 mb-0.5" />
                      <span className="text-[10px] text-muted-foreground leading-none">Perf.</span>
                      <span className="text-xs font-bold text-amber-600">{performance.toFixed(0)}%</span>
                    </div>
                    <div className="flex flex-col items-center p-1.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                      <Package className="h-3 w-3 text-purple-600 mb-0.5" />
                      <span className="text-[10px] text-muted-foreground leading-none">TBRs</span>
                      <span className="text-xs font-bold text-purple-600">{concluidos}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverRides;
