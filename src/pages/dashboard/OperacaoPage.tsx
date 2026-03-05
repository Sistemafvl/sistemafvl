import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Activity, Search, CalendarIcon, Truck, Package, TrendingUp, Loader2, DollarSign, BarChart3, Clock as ClockIcon, Car, MapPin, KeyRound, User, X } from "lucide-react";
import InfoButton from "@/components/dashboard/InfoButton";
import { format, differenceInMinutes } from "date-fns";
import { OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import { getBrazilDayRange, getBrazilNow } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { translateStatus } from "@/lib/status-labels";

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
  all_returns: number;
}

interface TbrDetail {
  code: string;
  scanned_at: string;
  hasReturn: boolean;
}

const OperacaoPage = () => {
  const { unitSession } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState<Date>(() => getBrazilNow());
  const [cards, setCards] = useState<DriverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tbrSearch, setTbrSearch] = useState("");
  const [tbrValue, setTbrValue] = useState(0);
  const [tbrModalOpen, setTbrModalOpen] = useState(false);
  const [tbrModalCard, setTbrModalCard] = useState<DriverCard | null>(null);
  const [tbrModalList, setTbrModalList] = useState<TbrDetail[]>([]);
  const [tbrModalLoading, setTbrModalLoading] = useState(false);
  const [customValueMap, setCustomValueMap] = useState<Map<string, number>>(new Map());
  
  useEffect(() => {
    if (unitSession) loadData();
  }, [unitSession, selectedDate]);

  const loadData = async () => {
    if (!unitSession) return;
    setLoading(true);

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { start: dayStart, end: dayEnd } = getBrazilDayRange(dateStr);

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

    const { fetchAllRowsWithIn } = await import("@/lib/supabase-helpers");
    const [driversRes, confsRes, settingsRes, customValuesRes] = await Promise.all([
      supabase.from("drivers_public").select("id, name, car_model, car_plate, car_color, avatar_url").in("id", driverIds),
      confIds.length > 0
        ? supabase.from("user_profiles").select("id, name").in("id", confIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabase.from("unit_settings").select("tbr_value").eq("unit_id", unitSession.id).maybeSingle(),
      supabase.from("driver_custom_values").select("driver_id, custom_tbr_value").eq("unit_id", unitSession.id),
    ]);

    // Fetch TBRs/retornos with pagination + chunking (bypass 1000 limit and large .in() lists)
    const [tbrsData, pisoRaw, psData, rtoData] = await Promise.all([
      fetchAllRowsWithIn<{ ride_id: string; code: string }>(
        (ids) => (from, to) => supabase.from("ride_tbrs").select("ride_id, code").in("ride_id", ids).order("id").range(from, to),
        rideIds
      ),
      fetchAllRowsWithIn<{ ride_id: string; tbr_code: string; reason: string | null }>(
        (ids) => (from, to) => supabase.from("piso_entries").select("ride_id, tbr_code, reason").in("ride_id", ids).order("id").range(from, to),
        rideIds
      ),
      fetchAllRowsWithIn<{ ride_id: string; tbr_code: string }>(
        (ids) => (from, to) => supabase.from("ps_entries").select("ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
        rideIds
      ),
      fetchAllRowsWithIn<{ ride_id: string; tbr_code: string }>(
        (ids) => (from, to) => supabase.from("rto_entries").select("ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
        rideIds
      ),
    ]);

    const baseTbrValue = Number(settingsRes.data?.tbr_value ?? 0);
    setTbrValue(baseTbrValue);

    const cvMap = new Map<string, number>();
    ((customValuesRes.data as any[]) ?? []).forEach((cv: any) => {
      cvMap.set(cv.driver_id, Number(cv.custom_tbr_value));
    });
    setCustomValueMap(cvMap);

    const driverMap = Object.fromEntries((driversRes.data ?? []).map((d) => [d.id, d]));
    const confMap = Object.fromEntries((confsRes.data ?? []).map((c) => [c.id, c.name]));

    // Build set of TBR codes per ride (normalized to uppercase for case-insensitive comparison)
    const tbrCodesByRide: Record<string, Set<string>> = {};
    tbrsData.forEach((t) => {
      if (!tbrCodesByRide[t.ride_id]) tbrCodesByRide[t.ride_id] = new Set();
      tbrCodesByRide[t.ride_id].add(t.code.toUpperCase());
    });

    // Count TBRs per ride
    const tbrCounts: Record<string, number> = {};
    tbrsData.forEach((t) => {
      tbrCounts[t.ride_id] = (tbrCounts[t.ride_id] || 0) + 1;
    });

    // Count unique tbr_codes per ride for returns (only if TBR still in ride — for loading list display)
    const pisoData = pisoRaw.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));
    const returnTbrSets: Record<string, Set<string>> = {};
    [...pisoData, ...psData, ...rtoData].forEach((p: any) => {
      const upperCode = p.tbr_code?.toUpperCase();
      if (p.ride_id && upperCode && tbrCodesByRide[p.ride_id]?.has(upperCode)) {
        if (!returnTbrSets[p.ride_id]) returnTbrSets[p.ride_id] = new Set();
        returnTbrSets[p.ride_id].add(upperCode);
      }
    });
    const issueCounts: Record<string, number> = {};
    Object.entries(returnTbrSets).forEach(([rideId, set]) => { issueCounts[rideId] = set.size; });

    // Count ALL returns per ride (including removed TBRs) — for performance calculation
    const allReturnTbrSets: Record<string, Set<string>> = {};
    [...pisoData, ...psData, ...rtoData].forEach((p: any) => {
      const upperCode = p.tbr_code?.toUpperCase();
      if (p.ride_id && upperCode) {
        if (!allReturnTbrSets[p.ride_id]) allReturnTbrSets[p.ride_id] = new Set();
        allReturnTbrSets[p.ride_id].add(upperCode);
      }
    });
    const allReturnCounts: Record<string, number> = {};
    Object.entries(allReturnTbrSets).forEach(([rideId, set]) => { allReturnCounts[rideId] = set.size; });

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
        all_returns: allReturnCounts[r.id] ?? 0,
      };
    });

    setCards(result);
    setLoading(false);
  };

  const totalCarregamentos = cards.length;
  const totalTbrsAtual = cards.reduce((s, c) => s + c.total_tbrs, 0);
  const totalAllReturns = cards.reduce((s, c) => s + c.all_returns, 0);
  const totalLidos = totalTbrsAtual + totalAllReturns;

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
              {loading ? <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" /> : <p className="text-2xl font-bold">{totalCarregamentos}</p>}
              <p className="text-xs text-muted-foreground flex items-center justify-center">Carregamentos <InfoButton text="Total de carregamentos realizados no dia selecionado." /></p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <Package className="h-5 w-5 mx-auto text-primary mb-1" />
              {loading ? <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" /> : <p className="text-2xl font-bold">{totalLidos}</p>}
              <p className="text-xs text-muted-foreground flex items-center justify-center">TBRs Lidos <InfoButton text="Total de pacotes (TBRs) escaneados na conferência, incluindo os que foram para insucesso." /></p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-destructive mb-1" />
              {loading ? <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" /> : <p className="text-2xl font-bold">{totalAllReturns}</p>}
              <p className="text-xs text-muted-foreground flex items-center justify-center">Insucessos <InfoButton text="Total de pacotes com insucesso (Piso, PS, RTO)." /></p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-center">
              <Activity className="h-5 w-5 mx-auto text-green-600 mb-1" />
              {loading ? <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" /> : <p className="text-2xl font-bold">{totalLidos - totalAllReturns}</p>}
              <p className="text-xs text-muted-foreground flex items-center justify-center">Entregues <InfoButton text="TBRs entregues com sucesso (lidos menos insucessos)." /></p>
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
                  const totalLidosCard = c.total_tbrs + c.all_returns;
                  const entregues = c.total_tbrs;
                  const driverTbrValue = customValueMap.get(c.driver_id) ?? tbrValue;
                  const totalGanho = entregues * driverTbrValue;
                  const mediaTbr = totalLidosCard > 0 ? totalGanho / totalLidosCard : 0;
                  const performance = totalLidosCard > 0 ? (entregues / totalLidosCard) * 100 : 0;
                  const tempoMin = c.started_at && c.finished_at
                    ? differenceInMinutes(new Date(c.finished_at), new Date(c.started_at))
                    : null;
                  const tempoStr = tempoMin != null
                    ? `${String(Math.floor(tempoMin / 60)).padStart(2, "0")}:${String(tempoMin % 60).padStart(2, "0")}`
                    : "—";

                  return (
                    <div key={c.ride_id} className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row gap-4">
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
                            <Badge variant="outline" className="text-[10px]">{translateStatus(c.loading_status)}</Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {[c.car_model, c.car_color].filter(Boolean).join(" • ")}</span>
                            <span className="flex items-center gap-1"><Car className="h-3 w-3" /> {c.car_plate}</span>
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {c.route ?? "—"}</span>
                            <span className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> {c.login ?? "—"}</span>
                            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {c.conferente_name ?? "—"}</span>
                            <span className="flex items-center gap-1"><ClockIcon className="h-3 w-3" /> {c.started_at ? format(new Date(c.started_at), "HH:mm") : "—"} → {c.finished_at ? format(new Date(c.finished_at), "HH:mm") : "—"}</span>
                          </div>
                        </div>
                        {/* Indicador - clicável */}
                        <div
                          className="flex flex-col items-center justify-center shrink-0 min-w-[80px] cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={async () => {
                            setTbrModalCard(c);
                            setTbrModalOpen(true);
                            setTbrModalLoading(true);
                            // Fetch TBRs for this ride
                            const { data: rideTbrs } = await supabase
                              .from("ride_tbrs")
                              .select("code, scanned_at")
                              .eq("ride_id", c.ride_id)
                              .order("scanned_at", { ascending: false });
                            // Fetch returns for this ride
                            const [pisoR, psR, rtoR] = await Promise.all([
                              supabase.from("piso_entries").select("tbr_code, reason").eq("ride_id", c.ride_id),
                              supabase.from("ps_entries").select("tbr_code").eq("ride_id", c.ride_id),
                              supabase.from("rto_entries").select("tbr_code").eq("ride_id", c.ride_id),
                            ]);
                            const returnSet = new Set<string>();
                            const filteredPiso = (pisoR.data ?? []).filter((e: any) => !OPERATIONAL_PISO_REASONS.includes(e.reason ?? ""));
                            [...filteredPiso, ...(psR.data ?? []), ...(rtoR.data ?? [])].forEach((e: any) => {
                              if (e.tbr_code) returnSet.add(e.tbr_code.toUpperCase());
                            });
                            setTbrModalList((rideTbrs ?? []).map(t => ({
                              code: t.code,
                              scanned_at: t.scanned_at ?? "",
                              hasReturn: returnSet.has(t.code.toUpperCase()),
                            })));
                            setTbrModalLoading(false);
                          }}
                        >
                          <p className={cn("text-xl font-bold", c.all_returns > 0 ? "text-amber-600" : "text-green-600")}>
                            {totalLidosCard} <span className="text-xs font-normal">lidos</span>
                          </p>
                          {c.all_returns > 0 && (
                            <Badge variant="destructive" className="text-[10px] mt-1">
                              {c.all_returns} insucesso{c.all_returns > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {/* Mini-cards de métricas */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="rounded-md border bg-muted/40 p-2 text-center">
                          <DollarSign className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
                          <p className="text-sm font-bold">R$ {totalGanho.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-[10px] text-muted-foreground">Total Ganho</p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-2 text-center">
                          <BarChart3 className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
                          <p className="text-sm font-bold">R$ {mediaTbr.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-[10px] text-muted-foreground">Média/TBR</p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-2 text-center">
                          <TrendingUp className={cn("h-3.5 w-3.5 mx-auto mb-0.5", performance >= 90 ? "text-green-600" : performance >= 70 ? "text-yellow-500" : "text-destructive")} />
                          <p className="text-sm font-bold">{performance.toFixed(0)}%</p>
                          <p className="text-[10px] text-muted-foreground">Performance</p>
                        </div>
                        <div className="rounded-md border bg-muted/40 p-2 text-center">
                          <ClockIcon className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
                          <p className="text-sm font-bold">{tempoStr}</p>
                          <p className="text-[10px] text-muted-foreground">Tempo</p>
                        </div>
                      </div>
                    </div>
                  );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* TBR Detail Modal */}
      {tbrModalOpen && tbrModalCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={() => setTbrModalOpen(false)} />
          <div className="relative z-50 w-full max-w-lg border bg-background p-6 shadow-lg sm:rounded-lg animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setTbrModalOpen(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 z-10"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold italic mb-4">Detalhes do Carregamento</h2>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4">
              <div><strong>Motorista:</strong> {tbrModalCard.driver_name}</div>
              <div><strong>Placa:</strong> {tbrModalCard.car_plate}</div>
              <div><strong>Carro:</strong> {[tbrModalCard.car_model, tbrModalCard.car_color].filter(Boolean).join(" • ")}</div>
              <div><strong>Rota:</strong> {tbrModalCard.route ?? "—"}</div>
              <div><strong>Login:</strong> {tbrModalCard.login ?? "—"}</div>
              <div><strong>Conferente:</strong> {tbrModalCard.conferente_name ?? "—"}</div>
              <div><strong>Início:</strong> {tbrModalCard.started_at ? format(new Date(tbrModalCard.started_at), "HH:mm") : "—"}</div>
              <div><strong>Término:</strong> {tbrModalCard.finished_at ? format(new Date(tbrModalCard.finished_at), "HH:mm") : "—"}</div>
            </div>
            <h3 className="text-sm font-bold italic mb-2">TBRs ({tbrModalList.length})</h3>
            {tbrModalLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : tbrModalList.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nenhum TBR escaneado</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {tbrModalList.map((t, i) => (
                  <div key={i} className={cn(
                    "flex items-center justify-between rounded-md px-3 py-1.5 text-sm font-mono",
                    t.hasReturn ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700 dark:text-green-400"
                  )}>
                    <span>{t.code}</span>
                    <span className="text-xs opacity-70">{t.scanned_at ? format(new Date(t.scanned_at), "HH:mm") : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OperacaoPage;
