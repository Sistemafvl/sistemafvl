import { useAuthStore } from "@/stores/auth-store";
import { translateStatus } from "@/lib/status-labels";
import { Clock, Search, Loader2, X, Star, MessageSquare, CalendarIcon, FileWarning, CheckCircle, AlertTriangle, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import DashboardMetrics from "@/components/dashboard/DashboardMetrics";
import DashboardInsights from "@/components/dashboard/DashboardInsights";
import SystemUpdates from "@/components/dashboard/SystemUpdates";
import InfoButton from "@/components/dashboard/InfoButton";

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
  ps_status: { open: boolean; description: string } | null;
  rto_status: { open: boolean; description: string } | null;
  dnr_status: { status: string; value: number } | null;
  piso_status: { status: string; reason: string } | null;
  composite_status: string;
}

const DashboardHome = () => {
  const { unitSession } = useAuthStore();
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(new Date());
  const [filterStart, setFilterStart] = useState<Date | undefined>(undefined);
  const [filterEnd, setFilterEnd] = useState<Date | undefined>(undefined);
  const [tbrSearch, setTbrSearch] = useState("");
  const [feedbackAvg, setFeedbackAvg] = useState(0);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [showTbrModal, setShowTbrModal] = useState(false);
  const [searchedTbr, setSearchedTbr] = useState("");
  const [tbrResult, setTbrResult] = useState<TbrResult | null>(null);
  const [tbrLoading, setTbrLoading] = useState(false);
  const [tbrNotFound, setTbrNotFound] = useState(false);
  const [tbrError, setTbrError] = useState("");

  // DNR stats
  const [dnrOpen, setDnrOpen] = useState({ count: 0, value: 0 });
  const [dnrAnalyzing, setDnrAnalyzing] = useState({ count: 0, value: 0 });
  const [dnrClosed, setDnrClosed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch feedback summary
  useEffect(() => {
    if (!unitSession?.id) return;
    const fetchFeedback = async () => {
      const { data } = await supabase
        .from("unit_reviews")
        .select("rating")
        .eq("unit_id", unitSession.id);
      const revs = data ?? [];
      setFeedbackTotal(revs.length);
      setFeedbackAvg(revs.length > 0 ? revs.reduce((s, r) => s + r.rating, 0) / revs.length : 0);
    };
    fetchFeedback();
  }, [unitSession?.id]);

  // Fetch DNR stats
  useEffect(() => {
    if (!unitSession?.id) return;
    const fetchDnr = async () => {
      const { data } = await supabase
        .from("dnr_entries")
        .select("status, dnr_value")
        .eq("unit_id", unitSession.id);
      const all = (data ?? []) as any[];
      const open = all.filter(e => e.status === "open");
      const analyzing = all.filter(e => e.status === "analyzing");
      const closed = all.filter(e => e.status === "closed");
      setDnrOpen({ count: open.length, value: open.reduce((s: number, e: any) => s + Number(e.dnr_value), 0) });
      setDnrAnalyzing({ count: analyzing.length, value: analyzing.reduce((s: number, e: any) => s + Number(e.dnr_value), 0) });
      setDnrClosed(closed.length);
    };
    fetchDnr();
  }, [unitSession?.id]);

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

      setTbrError("");
      setSearchedTbr(code);
      setShowTbrModal(true);
      setTbrLoading(true);
      setTbrResult(null);
      setTbrNotFound(false);

      const { data: tbrData } = await supabase
        .from("ride_tbrs")
        .select("*")
        .eq("code", code)
        .limit(1);

      if (!tbrData || tbrData.length === 0) {
        // Fallback: buscar nas tabelas de ocorrências
        const [psCheck, rtoCheck, dnrCheck, pisoCheck] = await Promise.all([
          supabase.from("ps_entries").select("*").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("rto_entries").select("*").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("dnr_entries").select("*").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("piso_entries").select("*").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);

        const foundEntry = dnrCheck.data || psCheck.data || rtoCheck.data || pisoCheck.data;

        if (!foundEntry) {
          setTbrNotFound(true);
          setTbrLoading(false);
          return;
        }

        // Get unit name
        const unitId = (foundEntry as any).unit_id;
        const unitRes = unitId
          ? await supabase.from("units").select("name").eq("id", unitId).maybeSingle()
          : { data: null };

        // Get conferente name if available
        const confId = (foundEntry as any).conferente_id;
        const confRes = confId
          ? await supabase.from("user_profiles").select("name").eq("id", confId).maybeSingle()
          : { data: null };

        const driverName = dnrCheck.data?.driver_name || psCheck.data?.driver_name || rtoCheck.data?.driver_name || pisoCheck.data?.driver_name || null;
        const route = dnrCheck.data?.route || psCheck.data?.route || rtoCheck.data?.route || pisoCheck.data?.route || null;

        const computeFallbackStatus = (): string => {
          if (dnrCheck.data) {
            if (dnrCheck.data.status === "open") return "DNR Aberto";
            if (dnrCheck.data.status === "analyzing") return "Em Análise DNR";
            if (dnrCheck.data.status === "closed") return "DNR Finalizado";
          }
          if (psCheck.data && psCheck.data.status === "open") return "PS Aberto";
          if (rtoCheck.data && rtoCheck.data.status === "open") return "RTO Aberto";
          if (pisoCheck.data && pisoCheck.data.status === "open") return "Retorno Piso";
          return "Sem carregamento";
        };

        setTbrResult({
          code,
          scanned_at: (foundEntry as any).created_at ?? "",
          ride_id: (foundEntry as any).ride_id ?? "",
          driver_name: driverName ?? "Desconhecido",
          route,
          login: dnrCheck.data?.login ?? null,
          unit_name: unitRes.data?.name ?? "—",
          conferente_name: confRes.data?.name ?? dnrCheck.data?.conferente_name ?? null,
          started_at: null,
          finished_at: null,
          loading_status: null,
          sequence_number: null,
          car_model: dnrCheck.data?.car_model ?? null,
          car_plate: dnrCheck.data?.car_plate ?? null,
          car_color: dnrCheck.data?.car_color ?? null,
          ps_status: psCheck.data ? { open: psCheck.data.status === "open", description: psCheck.data.description } : null,
          rto_status: rtoCheck.data ? { open: rtoCheck.data.status === "open", description: rtoCheck.data.description } : null,
          dnr_status: dnrCheck.data ? { status: dnrCheck.data.status, value: Number(dnrCheck.data.dnr_value) } : null,
          piso_status: pisoCheck.data ? { status: pisoCheck.data.status, reason: pisoCheck.data.reason } : null,
          composite_status: computeFallbackStatus(),
        });
        setTbrLoading(false);
        return;
      }

      const tbr = tbrData[0];
      const rideId = tbr.ride_id;

      // Fetch ride
      const rideRes = await supabase.from("driver_rides").select("*").eq("id", rideId).maybeSingle();

      const ride = rideRes.data;
      if (!ride) {
        setTbrNotFound(true);
        setTbrLoading(false);
        return;
      }

      // Parallel: driver, unit, conferente, ps, rto, dnr, piso
      const [driverRes, unitRes, confRes, psRes, rtoRes, dnrRes, pisoRes] = await Promise.all([
        supabase.from("drivers_public").select("name, car_model, car_plate, car_color").eq("id", ride.driver_id).maybeSingle(),
        supabase.from("units").select("name").eq("id", ride.unit_id).maybeSingle(),
        ride.conferente_id
          ? supabase.from("user_profiles").select("name").eq("id", ride.conferente_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("ps_entries").select("description, status").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("rto_entries").select("description, status").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("dnr_entries").select("status, dnr_value").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("piso_entries").select("status, reason").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      // Compute composite status
      const computeCompositeStatus = (): string => {
        const dnr = dnrRes.data;
        const ps = psRes.data;
        const rto = rtoRes.data;
        const piso = pisoRes.data;

        // DNR takes priority if open/analyzing
        if (dnr) {
          if (dnr.status === "open") return "DNR Aberto";
          if (dnr.status === "analyzing") return "Em Análise DNR";
        }
        // PS open
        if (ps && ps.status === "open") return "PS Aberto";
        // RTO open
        if (rto && rto.status === "open") return "RTO Aberto";
        // Piso open
        if (piso && piso.status === "open") return "Retorno Piso";
        // Fallback to ride loading_status translated
        return translateStatus(ride.loading_status);
      };

      setTbrResult({
        code: tbr.code,
        scanned_at: tbr.scanned_at ?? "",
        ride_id: rideId,
        driver_name: driverRes.data?.name ?? "Desconhecido",
        route: ride.route,
        login: ride.login,
        unit_name: unitRes.data?.name ?? "—",
        conferente_name: confRes.data?.name ?? null,
        started_at: ride.started_at,
        finished_at: ride.finished_at,
        loading_status: ride.loading_status,
        sequence_number: ride.sequence_number,
        car_model: driverRes.data?.car_model ?? null,
        car_plate: driverRes.data?.car_plate ?? null,
        car_color: driverRes.data?.car_color ?? null,
        ps_status: psRes.data ? { open: psRes.data.status === "open", description: psRes.data.description } : null,
        rto_status: rtoRes.data ? { open: rtoRes.data.status === "open", description: rtoRes.data.description } : null,
        dnr_status: dnrRes.data ? { status: dnrRes.data.status, value: Number(dnrRes.data.dnr_value) } : null,
        piso_status: pisoRes.data ? { status: pisoRes.data.status, reason: pisoRes.data.reason } : null,
        composite_status: computeCompositeStatus(),
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
              <span className="text-2xl font-bold text-amber-500">{feedbackAvg > 0 ? feedbackAvg.toFixed(1) : "—"}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {feedbackTotal} feedbacks
              </span>
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
      <DashboardMetrics unitId={unitSession.id} startDate={filterStart} endDate={filterEnd} />
      <DashboardInsights unitId={unitSession.id} startDate={filterStart} endDate={filterEnd} />

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
                   {/* Badges PS / RTO / DNR / Piso */}
                   {(tbrResult.ps_status || tbrResult.rto_status || tbrResult.dnr_status || tbrResult.piso_status) && (
                     <div className="flex flex-wrap gap-2">
                       {tbrResult.dnr_status && (
                         tbrResult.dnr_status.status === "open" ? (
                           <Badge variant="destructive" className="text-xs">
                             DNR Aberto — R${tbrResult.dnr_status.value.toFixed(2)}
                           </Badge>
                         ) : tbrResult.dnr_status.status === "analyzing" ? (
                           <Badge className="bg-amber-600 text-white text-xs">
                             DNR Em Análise — R${tbrResult.dnr_status.value.toFixed(2)}
                           </Badge>
                         ) : (
                           <Badge variant="outline" className="text-xs border-muted-foreground text-muted-foreground">
                             DNR Finalizado — R${tbrResult.dnr_status.value.toFixed(2)}
                           </Badge>
                         )
                       )}
                       {tbrResult.piso_status && (
                         tbrResult.piso_status.status === "open" ? (
                           <Badge className="bg-purple-600 text-white text-xs">
                             Retorno Piso — {tbrResult.piso_status.reason}
                           </Badge>
                         ) : (
                           <Badge variant="outline" className="text-xs border-muted-foreground text-muted-foreground">
                             Piso Finalizado — {tbrResult.piso_status.reason}
                           </Badge>
                         )
                       )}
                       {tbrResult.ps_status && (
                         tbrResult.ps_status.open ? (
                           <Badge variant="destructive" className="text-xs">
                             PS Aberto — {tbrResult.ps_status.description}
                           </Badge>
                         ) : (
                           <Badge variant="outline" className="text-xs border-muted-foreground text-muted-foreground">
                             PS Finalizado — {tbrResult.ps_status.description}
                           </Badge>
                         )
                       )}
                       {tbrResult.rto_status && (
                         tbrResult.rto_status.open ? (
                           <Badge className="bg-orange-600 text-white text-xs">
                             RTO Aberto — {tbrResult.rto_status.description}
                           </Badge>
                         ) : (
                           <Badge variant="outline" className="text-xs border-muted-foreground text-muted-foreground">
                             RTO Finalizado — {tbrResult.rto_status.description}
                           </Badge>
                         )
                       )}
                     </div>
                   )}
                  <div className="grid grid-cols-2 gap-2">
                    <div><strong>Motorista:</strong> {tbrResult.driver_name}</div>
                    <div><strong>Rota:</strong> {tbrResult.route || "—"}</div>
                    <div><strong>Carro:</strong> {[tbrResult.car_model, tbrResult.car_color].filter(Boolean).join(" • ") || "—"}</div>
                    <div><strong>Placa:</strong> {tbrResult.car_plate || "—"}</div>
                    <div><strong>Login:</strong> {tbrResult.login || "—"}</div>
                    <div><strong>Unidade:</strong> {tbrResult.unit_name}</div>
                    <div><strong>Conferente:</strong> {tbrResult.conferente_name || "—"}</div>
                    <div><strong>Sequência:</strong> {tbrResult.sequence_number ?? "—"}º</div>
                    <div><strong>Status:</strong> <span className="font-semibold">{tbrResult.composite_status}</span></div>
                    <div><strong>Início:</strong> {tbrResult.started_at ? format(new Date(tbrResult.started_at), "dd/MM/yyyy HH:mm") : "—"}</div>
                    <div><strong>Término:</strong> {tbrResult.finished_at ? format(new Date(tbrResult.finished_at), "dd/MM/yyyy HH:mm") : "—"}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
