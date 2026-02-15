import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Activity, Search, CalendarIcon, Truck, Package, TrendingUp, Loader2 } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MAX_TBR_LENGTH = 15;

interface DriverCard {
  ride_id: string;
  driver_id: string;
  driver_name: string;
  car_model: string;
  car_plate: string;
  car_color: string | null;
  avatar_url: string | null;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  loading_status: string | null;
  started_at: string | null;
  finished_at: string | null;
  completed_at: string;
  total_tbrs: number;
  piso_returns: number;
}

const OperacaoPage = () => {
  const { unitSession } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [cards, setCards] = useState<DriverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tbrSearch, setTbrSearch] = useState("");

  useEffect(() => {
    if (unitSession) loadData();
  }, [unitSession, selectedDate]);

  const loadData = async () => {
    if (!unitSession) return;
    setLoading(true);

    const dayStart = startOfDay(selectedDate).toISOString();
    const dayEnd = endOfDay(selectedDate).toISOString();

    const { data: rides } = await supabase
      .from("driver_rides")
      .select("*")
      .eq("unit_id", unitSession.id)
      .gte("completed_at", dayStart)
      .lte("completed_at", dayEnd)
      .order("completed_at", { ascending: false });

    if (!rides || rides.length === 0) {
      setCards([]);
      setLoading(false);
      return;
    }

    const driverIds = [...new Set(rides.map((r) => r.driver_id))];
    const confIds = [...new Set(rides.filter((r) => r.conferente_id).map((r) => r.conferente_id!))];
    const rideIds = rides.map((r) => r.id);

    const [driversRes, confsRes, tbrsRes, pisoRes, psRes, rtoRes] = await Promise.all([
      supabase.from("drivers").select("id, name, car_model, car_plate, car_color, avatar_url").in("id", driverIds),
      confIds.length > 0
        ? supabase.from("user_profiles").select("id, name").in("id", confIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabase.from("ride_tbrs").select("ride_id").in("ride_id", rideIds),
      supabase.from("piso_entries").select("ride_id").in("ride_id", rideIds).eq("status", "open"),
      supabase.from("ps_entries").select("ride_id").in("ride_id", rideIds).eq("status", "open"),
      supabase.from("rto_entries").select("ride_id").in("ride_id", rideIds).eq("status", "open"),
    ]);

    const driverMap = Object.fromEntries((driversRes.data ?? []).map((d) => [d.id, d]));
    const confMap = Object.fromEntries((confsRes.data ?? []).map((c) => [c.id, c.name]));

    // Count TBRs per ride
    const tbrCounts: Record<string, number> = {};
    (tbrsRes.data ?? []).forEach((t) => {
      tbrCounts[t.ride_id] = (tbrCounts[t.ride_id] || 0) + 1;
    });

    // Count all open issues per ride (piso + ps + rto)
    const issueCounts: Record<string, number> = {};
    [...(pisoRes.data ?? []), ...(psRes.data ?? []), ...(rtoRes.data ?? [])].forEach((p) => {
      if (p.ride_id) issueCounts[p.ride_id] = (issueCounts[p.ride_id] || 0) + 1;
    });

    const result: DriverCard[] = rides.map((r) => {
      const d = driverMap[r.driver_id];
      return {
        ride_id: r.id,
        driver_id: r.driver_id,
        driver_name: d?.name ?? "Desconhecido",
        car_model: d?.car_model ?? "",
        car_plate: d?.car_plate ?? "",
        car_color: d?.car_color ?? null,
        avatar_url: d?.avatar_url ?? null,
        route: r.route,
        login: r.login,
        conferente_name: r.conferente_id ? confMap[r.conferente_id] ?? null : null,
        loading_status: r.loading_status,
        started_at: r.started_at,
        finished_at: r.finished_at,
        completed_at: r.completed_at,
        total_tbrs: tbrCounts[r.id] ?? 0,
        piso_returns: issueCounts[r.id] ?? 0,
      };
    });

    setCards(result);
    setLoading(false);
  };

  const totalCarregamentos = cards.length;
  const totalTbrs = cards.reduce((s, c) => s + c.total_tbrs, 0);
  const totalRetornos = cards.reduce((s, c) => s + c.piso_returns, 0);
  const taxaConclusao = totalTbrs > 0 ? (((totalTbrs - totalRetornos) / totalTbrs) * 100).toFixed(1) : "0";

  const filteredCards = tbrSearch.trim()
    ? cards.filter((c) =>
        c.driver_name.toLowerCase().includes(tbrSearch.toLowerCase()) ||
        c.car_plate.toLowerCase().includes(tbrSearch.toLowerCase()) ||
        c.route?.toLowerCase().includes(tbrSearch.toLowerCase())
      )
    : cards;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <Activity className="h-5 w-5 text-primary" />
            Operação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={tbrSearch}
                onChange={(e) => { if (e.target.value.length <= MAX_TBR_LENGTH) setTbrSearch(e.target.value); }}
                placeholder="Buscar motorista, placa, rota..."
                className="pl-9"
              />
            </div>
          </div>

          {/* Indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3 text-center">
              <Truck className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{totalCarregamentos}</p>
              <p className="text-xs text-muted-foreground">Carregamentos</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <Package className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{totalTbrs}</p>
              <p className="text-xs text-muted-foreground">TBRs lidos</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-destructive mb-1" />
              <p className="text-2xl font-bold">{totalRetornos}</p>
              <p className="text-xs text-muted-foreground">Retornos piso</p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <Activity className="h-5 w-5 mx-auto text-green-600 mb-1" />
              <p className="text-2xl font-bold">{taxaConclusao}%</p>
              <p className="text-xs text-muted-foreground">Conclusão</p>
            </div>
          </div>

          {/* Cards */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredCards.length === 0 ? (
            <p className="text-center text-muted-foreground italic py-8">Nenhum carregamento encontrado</p>
          ) : (
            <div className="grid gap-3">
              {filteredCards.map((c) => {
                const concluidos = c.total_tbrs - c.piso_returns;
                return (
                  <div key={c.ride_id} className="rounded-lg border bg-card p-4 flex flex-col sm:flex-row gap-4">
                    {/* Avatar */}
                    <div className="flex items-center justify-center shrink-0">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} className="h-12 w-12 rounded-full object-cover border" alt="" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {c.driver_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{c.driver_name}</p>
                        <Badge variant="outline" className="text-[10px]">{c.loading_status ?? "—"}</Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>🚗 {[c.car_model, c.car_color].filter(Boolean).join(" • ")}</span>
                        <span>🪪 {c.car_plate}</span>
                        <span>📍 {c.route ?? "—"}</span>
                        <span>🔑 {c.login ?? "—"}</span>
                        <span>👤 {c.conferente_name ?? "—"}</span>
                        <span>🕐 {c.started_at ? format(new Date(c.started_at), "HH:mm") : "—"} → {c.finished_at ? format(new Date(c.finished_at), "HH:mm") : "—"}</span>
                      </div>
                    </div>
                    {/* Indicador */}
                    <div className="flex flex-col items-center justify-center shrink-0 min-w-[80px]">
                      <p className={cn("text-xl font-bold", c.piso_returns > 0 ? "text-destructive" : "text-green-600")}>
                        {concluidos}/{c.total_tbrs}
                      </p>
                      <p className="text-[10px] text-muted-foreground">concluídos</p>
                      {c.piso_returns > 0 && (
                        <Badge variant="destructive" className="text-[10px] mt-1">
                          {c.piso_returns} retorno{c.piso_returns > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OperacaoPage;
