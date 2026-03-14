import { useState, useEffect, useMemo } from "react";
import { OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Car, MapPin, Clock, Calendar as CalendarIcon, User, KeyRound, Route, DollarSign, TrendingUp, Zap, Package, AlertTriangle, CheckCircle2, UserCheck } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Ride {
  id: string;
  driver_id: string;
  unit_id: string;
  conferente_id: string | null;
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
  reativoValue?: number;
  conferente_name?: string;
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
        .select("id, driver_id, unit_id, conferente_id, completed_at, started_at, finished_at, notes, route, login, password")
        .eq("driver_id", driverId)
        .eq("unit_id", unitId!)
        .gte("completed_at", startDate.toISOString())
        .lte("completed_at", new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).toISOString())
        .order("completed_at", { ascending: false });

      if (!data) { setRides([]); setLoading(false); return; }

      const unitIds = [...new Set(data.map((r) => r.unit_id))];
      const conferenteIds = [...new Set(data.map((r) => r.conferente_id).filter(Boolean))] as string[];
      const rideIds = data.map((r) => r.id);

      const { fetchAllRowsWithIn } = await import("@/lib/supabase-helpers");
      const [unitsRes, pisoRaw, psData, rtoData, settingsRes, customRes, reatRes] = await Promise.all([
        supabase.from("units").select("id, name").in("id", unitIds),
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string; reason: string | null }>(
          (ids) => (from, to) => supabase.from("piso_entries").select("id, ride_id, tbr_code, reason").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string }>(
          (ids) => (from, to) => supabase.from("ps_entries").select("id, ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<{ id: string; ride_id: string; tbr_code: string }>(
          (ids) => (from, to) => supabase.from("rto_entries").select("id, ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds),
        supabase.from("driver_custom_values").select("unit_id, custom_tbr_value").eq("driver_id", driverId),
        supabase.from("reativo_entries").select("ride_id, reativo_value").eq("driver_id", driverId).gte("activated_at", startDate.toISOString()).lte("activated_at", new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).toISOString()),
      ]);

      // Fetch TBRs with pagination + chunking (bypass 1000 limit and large .in() lists)
      const tbrsData = await fetchAllRowsWithIn<{ id: string; ride_id: string; code: string }>(
        (ids) => (from, to) => supabase.from("ride_tbrs").select("id, ride_id, code").in("ride_id", ids).order("id").range(from, to),
        rideIds
      );

      // Fetch conferente names
      const conferenteMap = new Map<string, string>();
      if (conferenteIds.length > 0) {
        const { data: confData } = await supabase.from("user_profiles").select("id, name").in("id", conferenteIds);
        (confData ?? []).forEach((c) => conferenteMap.set(c.id, c.name));
      }

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

      // Reativo values per ride
      const reativoMap = new Map<string, number>();
      (reatRes.data ?? []).forEach((re: any) => {
        if (re.ride_id) reativoMap.set(re.ride_id, (reativoMap.get(re.ride_id) ?? 0) + Number(re.reativo_value));
      });

      setRides(data.map((r) => ({
        ...r,
        unit_name: unitMap.get(r.unit_id) ?? "—",
        tbrCount: tbrCountMap.get(r.id) ?? 0,
        returnCount: returnCountMap.get(r.id) ?? 0,
        tbrValue: customMap.get(r.unit_id) ?? settingsMap.get(r.unit_id) ?? 0,
        reativoValue: reativoMap.get(r.id) ?? 0,
        conferente_name: r.conferente_id ? conferenteMap.get(r.conferente_id) ?? null : null,
      })));
      setLoading(false);
    };
    fetchRides();
  }, [driverId, startDate, endDate]);

  // Average TBRs concluded per day across all loaded rides
  const avgPerDay = useMemo(() => {
    if (rides.length === 0) return 0;
    const daySet = new Set<string>();
    let totalConcluidos = 0;
    rides.forEach((r) => {
      const day = new Date(r.completed_at).toISOString().slice(0, 10);
      daySet.add(day);
      totalConcluidos += r.tbrCount ?? 0;
    });
    return daySet.size > 0 ? Math.round(totalConcluidos / daySet.size) : 0;
  }, [rides]);


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

      {/* Conferência obrigatória alert */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-2">
          <p className="font-semibold text-amber-700 dark:text-amber-400">Atenção: Conferência obrigatória antes da saída</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Antes de iniciar sua rota, é responsabilidade do motorista parceiro conferir atentamente as seguintes informações no coletor da Amazon:
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
            <li>Login utilizado no coletor</li>
            <li>Quantidade total de pacotes carregados</li>
            <li>Dados da rota atribuída</li>
          </ul>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Essas informações devem corresponder exatamente ao que está registrado no sistema FVL.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Caso exista qualquer divergência, o motorista deve informar imediatamente o conferente responsável pelo carregamento, <strong>antes de sair para a rota</strong>.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Após a saída da base, eventuais inconsistências identificadas posteriormente terão processo de verificação mais demorado, podendo impactar análises operacionais e administrativas.
          </p>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ao iniciar a rota, o motorista declara que conferiu e concorda com as informações apresentadas.
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
              // ride_tbrs already has returns removed by trigger, so tbrCount = concluídos
              const entregues = ride.tbrCount ?? 0;
              const totalLidos = entregues + (ride.returnCount ?? 0); // volume original
              const totalGanho = entregues * (ride.tbrValue ?? 0) + (ride.reativoValue ?? 0);
              const reativoVal = ride.reativoValue ?? 0;
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
                      {ride.conferente_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <UserCheck className="h-3 w-3 text-primary" />
                          <strong>Conferente:</strong> {ride.conferente_name}
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
                    <div className="grid grid-cols-5 gap-1.5">
                     <div className="flex flex-col items-center p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                       <DollarSign className="h-3 w-3 text-emerald-600 mb-0.5" />
                       <span className="text-[10px] text-muted-foreground leading-none">Total</span>
                       <span className="text-xs font-bold text-emerald-600">R${totalGanho.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                     </div>
                     <div className="flex flex-col items-center p-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                       <Package className="h-3 w-3 text-blue-600 mb-0.5" />
                       <span className="text-[10px] text-muted-foreground leading-none">Lidos</span>
                       <span className="text-xs font-bold text-blue-600">{totalLidos}</span>
                     </div>
                     <div className="flex flex-col items-center p-1.5 rounded-md bg-green-500/10 border border-green-500/20">
                       <CheckCircle2 className="h-3 w-3 text-green-600 mb-0.5" />
                       <span className="text-[10px] text-muted-foreground leading-none">Concl.</span>
                       <span className="text-xs font-bold text-green-600">{entregues}</span>
                     </div>
                     <div className="flex flex-col items-center p-1.5 rounded-md bg-teal-500/10 border border-teal-500/20">
                       <TrendingUp className="h-3 w-3 text-teal-600 mb-0.5" />
                       <span className="text-[10px] text-muted-foreground leading-none">Méd/Dia</span>
                       <span className="text-xs font-bold text-teal-600">{avgPerDay}</span>
                     </div>
                     <div className="flex flex-col items-center p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                       <Zap className="h-3 w-3 text-amber-600 mb-0.5" />
                       <span className="text-[10px] text-muted-foreground leading-none">Reat.</span>
                       <span className="text-xs font-bold text-amber-600">R${reativoVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
