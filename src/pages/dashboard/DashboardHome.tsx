import { useAuthStore } from "@/stores/auth-store";
import { translateStatus } from "@/lib/status-labels";
import { Clock, Search, Loader2, X, Star, MessageSquare, CalendarIcon, FileWarning, CheckCircle, AlertTriangle, DollarSign, Eye, Zap, LifeBuoy, Play, Flag } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, isValidTbrCode } from "@/lib/utils";
import DashboardMetrics from "@/components/dashboard/DashboardMetrics";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import SystemUpdates from "@/components/dashboard/SystemUpdates";
import InfoButton from "@/components/dashboard/InfoButton";
import { ALL_UNITS_ID } from "@/lib/unit-filter";

const MAX_TBR_LENGTH = 15;

interface TbrResult {
  code: string;
  scanned_at: string;
  ride_id: string;
  driver_name: string;
  route: string | null;
  login: string | null;
  unit_name: string;
  conferente_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  loading_status: string | null;
  sequence_number: number | null;
  car_model: string | null;
  car_plate: string | null;
  car_color: string | null;
  composite_status: string;
  entry_date: string | null;
  entry_source: string | null;
  timeline: TimelineEvent[];
}

interface TimelineEvent {
  timestamp: string;
  conferente: string | null;
  action: string;
  detail: string;
  type: "origin" | "removal" | "loaded" | "ps" | "rto" | "dnr" | "piso" | "started" | "finished" | "rescue" | "reativo";
  photo_url?: string | null;
  reason?: string | null;
  observations?: string | null;
  is_seller?: boolean;
}

const DashboardHome = () => {
  const { unitSession, domainUnits } = useAuthStore();
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(new Date());
  const [filterStart, setFilterStart] = useState<Date | undefined>(undefined);
  const [filterEnd, setFilterEnd] = useState<Date | undefined>(undefined);
  const [tbrSearch, setTbrSearch] = useState("");
  const [feedbackAvg, setFeedbackAvg] = useState<number | null>(null);
  const [feedbackTotal, setFeedbackTotal] = useState<number | null>(null);
  const [showTbrModal, setShowTbrModal] = useState(false);
  const [searchedTbr, setSearchedTbr] = useState("");
  const [tbrResult, setTbrResult] = useState<TbrResult | null>(null);
  const [tbrLoading, setTbrLoading] = useState(false);
  const [tbrNotFound, setTbrNotFound] = useState(false);
  const [psDetailEvent, setPsDetailEvent] = useState<TimelineEvent | null>(null);
  const [tbrError, setTbrError] = useState("");

  // DNR stats
  const [dnrOpen, setDnrOpen] = useState({ count: 0, value: 0 });
  const [dnrAnalyzing, setDnrAnalyzing] = useState({ count: 0, value: 0 });
  const [dnrClosed, setDnrClosed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const allUnitIds = useMemo(() => domainUnits.map(u => u.id), [domainUnits]);
  const isAllUnits = unitSession?.id === ALL_UNITS_ID;

  // Fetch feedback summary
  useEffect(() => {
    if (!unitSession?.id) return;
    const fetchFeedback = async () => {
      const { fetchAllRows } = await import("@/lib/supabase-helpers");
      let q = supabase.from("unit_reviews").select("rating").order("id");
      if (isAllUnits && allUnitIds.length > 0) {
        q = q.in("unit_id", allUnitIds);
      } else {
        q = q.eq("unit_id", unitSession.id);
      }
      const revs = await fetchAllRows<{ rating: number }>((from, to) =>
        q.range(from, to)
      );
      setFeedbackTotal(revs.length);
      setFeedbackAvg(revs.length > 0 ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : 0);
    };
    fetchFeedback();
  }, [unitSession?.id, isAllUnits, allUnitIds]);

  // Fetch DNR stats
  useEffect(() => {
    if (!unitSession?.id) return;
    const fetchDnr = async () => {
      const { fetchAllRows } = await import("@/lib/supabase-helpers");
      let q = supabase.from("dnr_entries").select("status, dnr_value").order("id");
      if (isAllUnits && allUnitIds.length > 0) {
        q = q.in("unit_id", allUnitIds);
      } else {
        q = q.eq("unit_id", unitSession.id);
      }
      const all = await fetchAllRows<{ status: string; dnr_value: number }>((from, to) =>
        q.range(from, to)
      );
      const open = all.filter(e => e.status === "open");
      const analyzing = all.filter(e => e.status === "analyzing");
      const closed = all.filter(e => e.status === "closed");
      setDnrOpen({ count: open.length, value: open.reduce((s: number, e: any) => s + Number(e.dnr_value), 0) });
      setDnrAnalyzing({ count: analyzing.length, value: analyzing.reduce((s: number, e: any) => s + Number(e.dnr_value), 0) });
      setDnrClosed(closed.length);
    };
    fetchDnr();
  }, [unitSession?.id, isAllUnits, allUnitIds]);

  const handleTbrKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tbrSearch.trim()) {
      const code = tbrSearch.trim();

      if (code.length > MAX_TBR_LENGTH) {
        setTbrError(`TBR deve ter no máximo ${MAX_TBR_LENGTH} caracteres.`);
        setShowTbrModal(true);
        setSearchedTbr(code);
        setTbrLoading(false);
        setTbrResult(null);
        setTbrNotFound(false);
        return;
      }

      if (!isValidTbrCode(code)) {
        setTbrError("TBR inválido. O código deve conter apenas 'TBR' seguido de números.");
        setShowTbrModal(true);
        setSearchedTbr(code);
        setTbrLoading(false);
        setTbrResult(null);
        setTbrNotFound(false);
        return;
      }

      setTbrError("");
      setSearchedTbr(code);
      setShowTbrModal(true);
      setTbrLoading(true);
      setTbrResult(null);
      setTbrNotFound(false);

      // Build timeline by querying ALL tables for this TBR code
      const [allRideTbrs, allPiso, allPs, allRto, allDnr, allRescue, allReativo] = await Promise.all([
        supabase.from("ride_tbrs").select("*, driver_rides!inner(id, driver_id, conferente_id, route, login, loading_status, started_at, finished_at, completed_at, sequence_number, unit_id)").ilike("code", code),
        supabase.from("piso_entries").select("*").ilike("tbr_code", code),
        supabase.from("ps_entries").select("*").ilike("tbr_code", code),
        supabase.from("rto_entries").select("*").ilike("tbr_code", code),
        supabase.from("dnr_entries").select("*").ilike("tbr_code", code),
        supabase.from("rescue_entries").select("*").ilike("tbr_code", code),
        supabase.from("reativo_entries").select("*").ilike("tbr_code", code),
      ]);

      const rideTbrs = allRideTbrs.data ?? [];
      const pisoEntries = allPiso.data ?? [];
      const psEntries = allPs.data ?? [];
      const rtoEntries = allRto.data ?? [];
      const dnrEntries = allDnr.data ?? [];
      const rescueEntries = allRescue.data ?? [];
      const reativoEntries = allReativo.data ?? [];

      if (rideTbrs.length === 0 && pisoEntries.length === 0 && psEntries.length === 0 && rtoEntries.length === 0 && dnrEntries.length === 0 && rescueEntries.length === 0 && reativoEntries.length === 0) {
        setTbrNotFound(true);
        setTbrLoading(false);
        return;
      }

      // Collect all ride_ids from return entries to reconstruct deleted ride_tbrs
      const returnRideIds = new Set<string>();
      [...pisoEntries, ...psEntries, ...rtoEntries].forEach((e: any) => {
        if (e.ride_id) returnRideIds.add(e.ride_id);
      });
      // Identify ride_ids that have return entries but NO ride_tbr record (deleted by trigger)
      const rideTbrRideIds = new Set(rideTbrs.map((rt: any) => rt.ride_id));
      const missingRideIds = [...returnRideIds].filter(rid => !rideTbrRideIds.has(rid));

      // Fetch the driver_rides for missing ride_ids to reconstruct loading events
      let missingRidesData: any[] = [];
      if (missingRideIds.length > 0) {
        const { data } = await supabase
          .from("driver_rides")
          .select("id, driver_id, conferente_id, route, login, loading_status, started_at, finished_at, completed_at, sequence_number, unit_id")
          .in("id", missingRideIds);
        missingRidesData = data ?? [];
      }

      // Collect conferente IDs to fetch names
      const confIds = new Set<string>();
      rideTbrs.forEach((rt: any) => { if (rt.driver_rides?.conferente_id) confIds.add(rt.driver_rides.conferente_id); });
      [...pisoEntries, ...psEntries, ...rtoEntries].forEach((e: any) => { if (e.conferente_id) confIds.add(e.conferente_id); });
      missingRidesData.forEach((r: any) => { if (r.conferente_id) confIds.add(r.conferente_id); });

      // Fetch conferente names and driver names
      const confIdsArr = [...confIds];
      const driverIds = [...new Set([
        ...rideTbrs.map((rt: any) => rt.driver_rides?.driver_id).filter(Boolean),
        ...missingRidesData.map((r: any) => r.driver_id).filter(Boolean),
        ...rescueEntries.map((r: any) => r.original_driver_id).filter(Boolean),
        ...rescueEntries.map((r: any) => r.rescuer_driver_id).filter(Boolean),
      ])];

      const firstUnitId = rideTbrs.length > 0
        ? (rideTbrs[0] as any).driver_rides?.unit_id
        : missingRidesData.length > 0 ? missingRidesData[0].unit_id : null;

      const [confRes, driverRes, unitRes] = await Promise.all([
        confIdsArr.length > 0 ? supabase.from("user_profiles").select("id, name").in("id", confIdsArr) : Promise.resolve({ data: [] as any[] }),
        driverIds.length > 0 ? supabase.from("drivers_public").select("id, name, car_model, car_plate, car_color").in("id", driverIds) : Promise.resolve({ data: [] as any[] }),
        firstUnitId ? supabase.from("units").select("id, name").eq("id", firstUnitId).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      const confMap = new Map((confRes.data ?? []).map((c: any) => [c.id, c.name]));
      const driverMap = new Map((driverRes.data ?? []).map((d: any) => [d.id, d]));
      const missingRidesMap = new Map(missingRidesData.map((r: any) => [r.id, r]));

      // Build timeline events
      const timeline: TimelineEvent[] = [];

      // Combine real ride_tbrs + synthetic events from missing rides
      interface LoadEvent { timestamp: string; ride: any; isReal: boolean; }
      const loadEvents: LoadEvent[] = [];

      // Real ride_tbrs
      rideTbrs.forEach((rt: any) => {
        loadEvents.push({
          timestamp: rt.scanned_at ?? rt.driver_rides?.completed_at ?? "",
          ride: rt.driver_rides,
          isReal: true,
        });
      });

      // Synthetic loading events from return entries whose ride_tbr was deleted
      missingRideIds.forEach(rideId => {
        const ride = missingRidesMap.get(rideId);
        if (!ride) return;
        // Find the earliest return entry for this ride to place loading event before it
        // Use ride.completed_at as the loading timestamp (when the ride was created/assigned)
        const syntheticTimestamp = ride.completed_at;
        loadEvents.push({
          timestamp: syntheticTimestamp,
          ride,
          isReal: false,
        });
      });

      // Sort all load events chronologically
      loadEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      loadEvents.forEach((evt, index) => {
        const ride = evt.ride;
        const driver = driverMap.get(ride?.driver_id);
        const confName = ride?.conferente_id ? confMap.get(ride.conferente_id) ?? null : null;
        const driverDetail = `Motorista: ${driver?.name ?? "—"} • Rota: ${ride?.route ?? "—"}`;

        // Carregamento Iniciado — apenas para o primeiro evento (primeiro motorista)
        if (index === 0) {
          const ts = evt.isReal && ride?.started_at ? ride.started_at : evt.timestamp;
          timeline.push({
            timestamp: ts,
            conferente: confName,
            action: "Carregamento Iniciado",
            detail: driverDetail,
            type: "started",
          });
        }

        // Evento: TBR Lido (primeiro) ou TBR Re-carregado (subsequentes)
        timeline.push({
          timestamp: evt.timestamp,
          conferente: confName,
          action: index === 0 ? "TBR Lido" : "TBR Re-carregado",
          detail: driverDetail,
          type: index === 0 ? "origin" : "loaded",
        });

        // Carregamento Finalizado — apenas para ride real com finished_at
        if (evt.isReal && ride?.finished_at) {
          timeline.push({
            timestamp: ride.finished_at,
            conferente: confName,
            action: "Carregamento Finalizado",
            detail: driverDetail,
            type: "finished",
          });
        }
      });

      pisoEntries.forEach((p: any) => {
        const confName = p.conferente_id ? confMap.get(p.conferente_id) ?? null : null;
        const isRemoval = p.reason === "Removido do carregamento" || p.reason === "Carregamento resetado" || p.reason === "Carregamento cancelado";
        timeline.push({
          timestamp: p.created_at,
          conferente: confName,
          action: isRemoval ? "Status: Insucesso" : "Status: Retorno Piso",
          detail: `${p.reason}${p.driver_name ? ` • ${p.driver_name}` : ""}`,
          type: isRemoval ? "removal" : "piso",
        });
      });

      // PS — always open event + optional close event
      psEntries.forEach((ps: any) => {
        const confName = ps.conferente_id ? confMap.get(ps.conferente_id) ?? null : null;
        timeline.push({
          timestamp: ps.created_at,
          conferente: confName,
          action: "Status: PS Aberto",
          detail: ps.description,
          type: "ps",
          photo_url: ps.photo_url,
          reason: ps.reason,
          observations: ps.observations,
          is_seller: ps.is_seller,
        });
        if (ps.closed_at) {
          timeline.push({
            timestamp: ps.closed_at,
            conferente: confName,
            action: "Status: PS Fechado",
            detail: ps.description,
            type: "ps",
            photo_url: ps.photo_url,
            reason: ps.reason,
            observations: ps.observations,
            is_seller: ps.is_seller,
          });
        }
      });

      // RTO — always open event + optional close event
      rtoEntries.forEach((rto: any) => {
        const confName = rto.conferente_id ? confMap.get(rto.conferente_id) ?? null : null;
        timeline.push({
          timestamp: rto.created_at,
          conferente: confName,
          action: "Status: RTO Aberto",
          detail: rto.description,
          type: "rto",
        });
        if (rto.closed_at) {
          timeline.push({
            timestamp: rto.closed_at,
            conferente: confName,
            action: "Status: RTO Fechado",
            detail: rto.description,
            type: "rto",
          });
        }
      });

      // DNR — always open event + optional analysis/close events
      dnrEntries.forEach((dnr: any) => {
        const dnrValue = Number(dnr.dnr_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        timeline.push({
          timestamp: dnr.created_at,
          conferente: dnr.conferente_name ?? null,
          action: "Status: DNR Aberto",
          detail: `${dnrValue}${dnr.observations ? ` — ${dnr.observations}` : ""}`,
          type: "dnr",
        });
        if (dnr.approved_at) {
          timeline.push({
            timestamp: dnr.approved_at,
            conferente: dnr.conferente_name ?? null,
            action: "Status: DNR Em Análise",
            detail: dnrValue,
            type: "dnr",
          });
        }
        if (dnr.closed_at) {
          timeline.push({
            timestamp: dnr.closed_at,
            conferente: dnr.conferente_name ?? null,
            action: dnr.discounted ? "Status: DNR Fechado (com desconto)" : "Status: DNR Fechado (sem desconto)",
            detail: dnrValue,
            type: "dnr",
          });
        }
      });

      // Rescue entries
      rescueEntries.forEach((r: any) => {
        const originalDriver = driverMap.get(r.original_driver_id);
        const rescuerDriver = driverMap.get(r.rescuer_driver_id);
        timeline.push({
          timestamp: r.scanned_at ?? r.created_at,
          conferente: null,
          action: "Status: Resgate",
          detail: `De: ${originalDriver?.name ?? "—"} → Para: ${rescuerDriver?.name ?? "—"}`,
          type: "rescue",
        });
      });

      // Reativo entries
      reativoEntries.forEach((r: any) => {
        const value = Number(r.reativo_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        timeline.push({
          timestamp: r.activated_at ?? r.created_at,
          conferente: r.conferente_name ?? r.manager_name ?? null,
          action: "Status: Reativo Ativado",
          detail: `${value} • ${r.driver_name ?? "—"} • Rota: ${r.route ?? "—"}`,
          type: "reativo",
        });
      });

      // Sort chronologically with tie-breaker by event priority
      const typePriority: Record<string, number> = { started: 1, origin: 2, loaded: 3, piso: 4, removal: 5, ps: 6, rto: 7, dnr: 8, rescue: 9, reativo: 10, finished: 11 };
      timeline.sort((a, b) => {
        const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (diff !== 0) return diff;
        return (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99);
      });

      // Build result from most recent ride (last loadEvent) for header
      const realLoadEvents = loadEvents.filter(e => e.isReal);
      const lastLoadEvent = realLoadEvents.length > 0 ? realLoadEvents[realLoadEvents.length - 1] : (loadEvents.length > 0 ? loadEvents[loadEvents.length - 1] : null);
      const firstRide = lastLoadEvent?.ride ?? (missingRidesData.length > 0 ? missingRidesData[0] : null);
      const firstDriver = firstRide ? driverMap.get(firstRide.driver_id) : null;

      // Compute composite status
      const computeStatus = (): string => {
        const lastDnr = dnrEntries.find((d: any) => d.status === "open");
        if (lastDnr) return "DNR Aberto";
        const lastPs = psEntries.find((p: any) => p.status === "open");
        if (lastPs) return "PS Aberto";
        const lastRto = rtoEntries.find((r: any) => r.status === "open");
        if (lastRto) return "RTO Aberto";
        const lastPiso = pisoEntries.find((p: any) => p.status === "open");
        if (lastPiso) return "Insucessos";
        if (firstRide) return translateStatus(firstRide.loading_status);
        return "Sem carregamento";
      };

      setTbrResult({
        code,
        scanned_at: rideTbrs[0]?.scanned_at ?? pisoEntries[0]?.created_at ?? "",
        ride_id: firstRide?.id ?? "",
        driver_name: firstDriver?.name ?? dnrEntries[0]?.driver_name ?? pisoEntries[0]?.driver_name ?? "Desconhecido",
        route: firstRide?.route ?? pisoEntries[0]?.route ?? null,
        login: firstRide?.login ?? dnrEntries[0]?.login ?? null,
        unit_name: unitRes.data?.name ?? "—",
        conferente_name: firstRide?.conferente_id ? confMap.get(firstRide.conferente_id) ?? null : null,
        started_at: firstRide?.started_at ?? null,
        finished_at: firstRide?.finished_at ?? null,
        loading_status: firstRide?.loading_status ?? null,
        sequence_number: firstRide?.sequence_number ?? null,
        car_model: firstDriver?.car_model ?? null,
        car_plate: firstDriver?.car_plate ?? null,
        car_color: firstDriver?.car_color ?? null,
        composite_status: computeStatus(),
        entry_date: rideTbrs[0]?.scanned_at ?? pisoEntries[0]?.created_at ?? null,
        entry_source: rideTbrs.length > 0 ? "Conferência Carregamento" : pisoEntries.length > 0 ? "Insucessos" : psEntries.length > 0 ? "PS" : rtoEntries.length > 0 ? "RTO" : "DNR",
        timeline,
      });
      setTbrLoading(false);
    }
  };

  const closeModal = () => {
    setShowTbrModal(false);
    setTbrSearch("");
    setTbrError("");
  };

  if (!unitSession) return null;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold italic text-foreground">Bem-vindo</h1>
          <p className="text-muted-foreground italic text-sm mt-1">
            {unitSession.domain_name} — {unitSession.name}
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-3 shrink-0">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-bold italic text-foreground">
              {dateTime.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="text-lg font-bold italic text-primary">
              {dateTime.toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>
      </div>

      <div className="relative tbr-search-glow shadow-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-pulse" />
        <Input
          value={tbrSearch}
          onChange={(e) => { if (e.target.value.length <= MAX_TBR_LENGTH) setTbrSearch(e.target.value); }}
          onKeyDown={handleTbrKeyDown}
          placeholder="Buscar TBR..."
          className="pl-10 h-12 text-base border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          maxLength={MAX_TBR_LENGTH}
        />
      </div>

      {/* Feedback indicator card */}
      <Card
        className="cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => navigate("/dashboard/feedbacks")}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <Star className="h-6 w-6 text-amber-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-muted-foreground">Avaliação da Unidade</p>
            <div className="flex items-center gap-3 mt-0.5">
              {feedbackAvg === null ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <span className="text-2xl font-bold text-amber-500">{feedbackAvg > 0 ? feedbackAvg.toFixed(1) : "—"}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {feedbackTotal} feedbacks
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`h-4 w-4 ${i <= Math.round(feedbackAvg) ? "text-amber-500 fill-amber-500" : "text-muted-foreground/20"}`} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtro de período */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm", !filterStart && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filterStart ? format(filterStart, "dd/MM/yyyy") : "Data início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterStart} onSelect={setFilterStart} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm", !filterEnd && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filterEnd ? format(filterEnd, "dd/MM/yyyy") : "Data fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterEnd} onSelect={setFilterEnd} locale={ptBR} className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {(filterStart || filterEnd) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStart(undefined); setFilterEnd(undefined); }}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* DNR Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/dashboard/dnr")}>
          <CardContent className="p-3 flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center">DNRs Abertos <InfoButton text="Total de DNRs (Did Not Receive) abertos na unidade. Representam pacotes que o cliente declarou não ter recebido e estão pendentes de análise." /></p>
              <p className="text-lg font-bold text-destructive">{dnrOpen.count}</p>
              <p className="text-xs text-muted-foreground">R${dnrOpen.value.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/dashboard/dnr")}>
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center">DNRs Analisando <InfoButton text="DNRs em processo de análise pela equipe. Esses pacotes estão sendo investigados para confirmar ou negar a entrega." /></p>
              <p className="text-lg font-bold text-amber-500">{dnrAnalyzing.count}</p>
              <p className="text-xs text-muted-foreground">R${dnrAnalyzing.value.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/dashboard/dnr")}>
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center">DNRs Finalizados <InfoButton text="DNRs finalizados no período. Inclui casos confirmados e descartados." /></p>
              <p className="text-lg font-bold text-emerald-500">{dnrClosed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas e Gráficos BI */}
      <DashboardMetrics unitId={unitSession.id} startDate={filterStart} endDate={filterEnd} allUnitIds={allUnitIds} />
      <DashboardInsights unitId={unitSession.id} startDate={filterStart} endDate={filterEnd} allUnitIds={allUnitIds} />

      <SystemUpdates />

      {showTbrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={closeModal} />
          <div className="relative z-50 w-full max-w-lg border bg-background p-6 shadow-lg sm:rounded-lg animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none z-10"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </button>
            <div className="flex flex-col space-y-1.5 text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight font-bold italic">Rastreamento TBR</h2>
              <p className="text-sm text-muted-foreground">
                Código pesquisado: <span className="font-semibold text-foreground">{searchedTbr}</span>
              </p>
            </div>
            <div className="space-y-4 py-4">
              {tbrError ? (
                <p className="text-sm text-destructive italic text-center py-4">{tbrError}</p>
              ) : tbrLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : tbrNotFound ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">TBR não encontrado.</p>
              ) : tbrResult ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><strong>Motorista:</strong> {tbrResult.driver_name}</div>
                    <div><strong>Rota:</strong> {tbrResult.route || "—"}</div>
                    <div><strong>Unidade:</strong> {tbrResult.unit_name}</div>
                    <div><strong>Status:</strong> <span className="font-semibold">{tbrResult.composite_status}</span></div>
                  </div>

                  {/* Timeline */}
                  {tbrResult.timeline.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-bold italic text-xs mb-3 text-muted-foreground uppercase tracking-wide">Linha do Tempo</h4>
                      <div className="relative pl-4 space-y-0">
                        {tbrResult.timeline.map((evt, i) => {
                          const colorMap: Record<string, string> = { origin: "text-primary", loaded: "text-primary", removal: "text-destructive", ps: "text-destructive", rto: "text-amber-600", dnr: "text-destructive", piso: "text-muted-foreground", started: "text-emerald-600", finished: "text-emerald-700", rescue: "text-blue-600", reativo: "text-purple-600" };
                          const dotMap: Record<string, string> = { origin: "bg-primary", loaded: "bg-primary", removal: "bg-destructive", ps: "bg-destructive", rto: "bg-amber-600", dnr: "bg-destructive", piso: "bg-muted-foreground", started: "bg-emerald-600", finished: "bg-emerald-700", rescue: "bg-blue-600", reativo: "bg-purple-600" };
                          const color = colorMap[evt.type] ?? "text-muted-foreground";
                          const dotColor = dotMap[evt.type] ?? "bg-muted-foreground";
                          return (
                            <div key={i} className="relative pb-4">
                              {/* Vertical line */}
                              {i < tbrResult.timeline.length - 1 && (
                                <div className="absolute left-[-12px] top-3 bottom-0 w-px border-l-2 border-dashed border-muted-foreground/30" />
                              )}
                              {/* Dot */}
                              <div className={`absolute left-[-15px] top-1.5 h-2 w-2 rounded-full ${dotColor}`} />
                              <div className="text-xs space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground font-mono">
                                    {evt.timestamp ? format(new Date(evt.timestamp), "dd/MM HH:mm:ss") : "—"}
                                  </span>
                                  {evt.conferente && (
                                    <span className="text-muted-foreground">[{evt.conferente}]</span>
                                  )}
                                  {evt.type === "ps" && (evt.photo_url || evt.reason || evt.observations) && (
                                    <button
                                      onClick={() => setPsDetailEvent(evt)}
                                      className="text-muted-foreground hover:text-primary transition-colors"
                                      title="Ver detalhes do PS"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                                <p className={`font-semibold ${color}`}>{evt.action}</p>
                                <p className="text-muted-foreground">{evt.detail}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* PS Detail Modal */}
      {psDetailEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPsDetailEvent(null)}>
          <div className="bg-background rounded-lg shadow-xl max-w-sm w-full p-4 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Detalhes do PS</h3>
              <button onClick={() => setPsDetailEvent(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {psDetailEvent.photo_url && (
              <img src={psDetailEvent.photo_url} alt="Foto PS" className="w-full rounded-md object-cover max-h-48" />
            )}
            {psDetailEvent.reason && (
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Motivo:</span>
                <p className="text-sm">{psDetailEvent.reason}</p>
              </div>
            )}
            {psDetailEvent.observations && (
              <div>
                <span className="text-xs text-muted-foreground font-semibold">Observações:</span>
                <p className="text-sm">{psDetailEvent.observations}</p>
              </div>
            )}
            {psDetailEvent.is_seller && (
              <Badge variant="secondary" className="text-xs">Seller</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
