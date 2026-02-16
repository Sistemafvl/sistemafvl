import { useAuthStore } from "@/stores/auth-store";
import { Clock, Search, Loader2, X, Star, MessageSquare, CalendarIcon } from "lucide-react";
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
        setTbrNotFound(true);
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

      // Parallel: driver, unit, conferente, ps, rto
      const [driverRes, unitRes, confRes, psRes, rtoRes] = await Promise.all([
        supabase.from("drivers_public").select("name, car_model, car_plate, car_color").eq("id", ride.driver_id).maybeSingle(),
        supabase.from("units").select("name").eq("id", ride.unit_id).maybeSingle(),
        ride.conferente_id
          ? supabase.from("user_profiles").select("name").eq("id", ride.conferente_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("ps_entries").select("description, status").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("rto_entries").select("description, status").eq("tbr_code", code).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={tbrSearch}
          onChange={(e) => { if (e.target.value.length <= MAX_TBR_LENGTH) setTbrSearch(e.target.value); }}
          onKeyDown={handleTbrKeyDown}
          placeholder="Buscar TBR..."
          className="pl-10 h-12 text-base"
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

      {/* Métricas e Gráficos BI */}
      <DashboardMetrics unitId={unitSession.id} startDate={filterStart} endDate={filterEnd} />
      <DashboardInsights unitId={unitSession.id} startDate={filterStart} endDate={filterEnd} />

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
                   {/* Badges PS / RTO */}
                   {(tbrResult.ps_status || tbrResult.rto_status) && (
                     <div className="flex flex-wrap gap-2">
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
                    <div><strong>Status:</strong> {tbrResult.loading_status || "—"}</div>
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
