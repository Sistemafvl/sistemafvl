import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Zap, Search, Loader2, CheckCircle, AlertTriangle, Truck, MapPin, User, Clock, DollarSign, Package } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatBRL, getBrazilDayRange, getBrazilTodayStr, isValidTbrCode } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TbrHistory {
  ride_id: string;
  driver_id: string;
  driver_name: string;
  car_model: string | null;
  car_plate: string | null;
  car_color: string | null;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  loading_status: string | null;
  scanned_at: string | null;
  completed_at: string;
  finished_at: string | null;
  // Occurrences
  piso: { reason: string; status: string; created_at: string }[];
  ps: { description: string; status: string; created_at: string }[];
  rto: { description: string; status: string; created_at: string }[];
}

interface ReativoEntry {
  id: string;
  tbr_code: string;
  driver_name: string | null;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  manager_name: string | null;
  reativo_value: number;
  activated_at: string;
  status: string;
  observations: string | null;
}

const ReativoPage = () => {
  const { unitSession, managerSession, conferenteSession } = useAuthStore();
  const { toast } = useToast();
  const unitId = unitSession?.id;

  const [tbrCode, setTbrCode] = useState("");
  const [tbrHistory, setTbrHistory] = useState<TbrHistory | null>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [activating, setActivating] = useState(false);
  const [alreadyActive, setAlreadyActive] = useState(false);

  const [entries, setEntries] = useState<ReativoEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const dateStr = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : getBrazilTodayStr();

  const fetchEntries = useCallback(async () => {
    if (!unitId) return;
    const { start, end } = getBrazilDayRange(dateStr);
    const { data } = await supabase
      .from("reativo_entries")
      .select("id, tbr_code, driver_name, route, login, conferente_name, manager_name, reativo_value, activated_at, status, observations")
      .eq("unit_id", unitId)
      .gte("activated_at", start)
      .lte("activated_at", end)
      .order("activated_at", { ascending: false });
    setEntries((data as ReativoEntry[]) ?? []);
    setLoadingEntries(false);
  }, [unitId, dateStr]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("reativo-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "reativo_entries", filter: `unit_id=eq.${unitId}` }, () => fetchEntries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchEntries]);

  const searchTbr = async () => {
    const code = tbrCode.trim().toUpperCase();
    if (!code) return;
    setSearching(true);
    setTbrHistory(null);
    setNotFound(false);
    setAlreadyActive(false);

    // Check if already activated
    if (unitId) {
      const { data: existing } = await supabase
        .from("reativo_entries")
        .select("id")
        .eq("unit_id", unitId)
        .eq("tbr_code", code)
        .maybeSingle();
      if (existing) {
        setAlreadyActive(true);
      }
    }

    // Find TBR in ride_tbrs
    const { data: tbrData } = await supabase
      .from("ride_tbrs")
      .select("ride_id, scanned_at")
      .ilike("code", code)
      .order("scanned_at", { ascending: false })
      .limit(1);

    if (!tbrData || tbrData.length === 0) {
      // Also check in piso/ps/rto for removed TBRs
      const [pisoRes, psRes, rtoRes] = await Promise.all([
        supabase.from("piso_entries").select("ride_id").ilike("tbr_code", code).limit(1),
        supabase.from("ps_entries").select("ride_id").ilike("tbr_code", code).limit(1),
        supabase.from("rto_entries").select("ride_id").ilike("tbr_code", code).limit(1),
      ]);

      const rideId = pisoRes.data?.[0]?.ride_id || psRes.data?.[0]?.ride_id || rtoRes.data?.[0]?.ride_id;
      if (!rideId) {
        setNotFound(true);
        setSearching(false);
        return;
      }

      await loadRideHistory(rideId, null, code);
      return;
    }

    await loadRideHistory(tbrData[0].ride_id, tbrData[0].scanned_at, code);
  };

  const loadRideHistory = async (rideId: string, scannedAt: string | null, code: string) => {
    const { data: ride } = await supabase.from("driver_rides").select("id, driver_id, route, login, conferente_id, loading_status, completed_at, finished_at").eq("id", rideId).maybeSingle();
    if (!ride) { setNotFound(true); setSearching(false); return; }

    const [driverRes, confRes, pisoRes, psRes, rtoRes] = await Promise.all([
      supabase.from("drivers_public").select("name, car_model, car_plate, car_color, id").eq("id", ride.driver_id).maybeSingle(),
      ride.conferente_id
        ? supabase.from("user_profiles").select("name").eq("id", ride.conferente_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("piso_entries").select("reason, status, created_at").ilike("tbr_code", code),
      supabase.from("ps_entries").select("description, status, created_at").ilike("tbr_code", code),
      supabase.from("rto_entries").select("description, status, created_at").ilike("tbr_code", code),
    ]);

    setTbrHistory({
      ride_id: rideId,
      driver_id: ride.driver_id,
      driver_name: driverRes.data?.name ?? "Desconhecido",
      car_model: driverRes.data?.car_model ?? null,
      car_plate: driverRes.data?.car_plate ?? null,
      car_color: driverRes.data?.car_color ?? null,
      route: ride.route,
      login: ride.login,
      conferente_name: confRes.data?.name ?? null,
      loading_status: ride.loading_status,
      scanned_at: scannedAt,
      completed_at: ride.completed_at,
      finished_at: ride.finished_at,
      piso: (pisoRes.data as any[]) ?? [],
      ps: (psRes.data as any[]) ?? [],
      rto: (rtoRes.data as any[]) ?? [],
    });
    setSearching(false);
  };

  const activateReativo = async () => {
    if (!unitId || !tbrHistory) return;
    setActivating(true);

    const code = tbrCode.trim().toUpperCase();
    const { error } = await supabase.from("reativo_entries").insert({
      unit_id: unitId,
      tbr_code: code,
      driver_id: tbrHistory.driver_id,
      driver_name: tbrHistory.driver_name,
      ride_id: tbrHistory.ride_id,
      route: tbrHistory.route,
      login: tbrHistory.login,
      conferente_name: conferenteSession?.name ?? null,
      manager_name: managerSession?.name ?? null,
      reativo_value: 20.00,
    });

    setActivating(false);
    if (error) {
      if (error.code === "23505") {
        toast({ title: "TBR já ativado", description: "Este TBR já foi registrado como reativo.", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      }
      return;
    }

    toast({ title: "Reativo ativado!", description: `${code} registrado como reativo — ${formatBRL(20)}` });
    setTbrCode("");
    setTbrHistory(null);
    setAlreadyActive(false);
    fetchEntries();
  };

  const totalReativos = entries.length;
  const totalValor = totalReativos * 20;

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return format(new Date(iso), "dd/MM/yyyy HH:mm");
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Zap className="h-6 w-6 text-amber-500" />
        <h1 className="text-xl font-bold italic">Reativo</h1>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reativos do dia</p>
              <p className="text-2xl font-bold">{totalReativos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="text-2xl font-bold">{formatBRL(totalValor)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold italic flex items-center gap-2">
            <Search className="h-4 w-4" />
            Buscar TBR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); searchTbr(); }}
            className="flex gap-2"
          >
            <Input
              value={tbrCode}
              onChange={(e) => setTbrCode(e.target.value.toUpperCase())}
              placeholder="Digite ou escaneie o código TBR"
              className="flex-1 font-mono uppercase"
            />
            <Button type="submit" disabled={searching || !tbrCode.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>

          {notFound && (
            <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              TBR não encontrado no sistema.
            </div>
          )}

          {alreadyActive && !tbrHistory && (
            <div className="mt-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-sm text-amber-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Este TBR já foi ativado como reativo.
            </div>
          )}

          {tbrHistory && (
            <div className="mt-4 space-y-3">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <h3 className="font-bold italic text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" /> Histórico do TBR
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Motorista:</span>
                    <span className="font-semibold">{tbrHistory.driver_name}</span>
                  </div>
                  {tbrHistory.car_plate && (
                    <div className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Veículo:</span>
                      <span className="font-semibold">{tbrHistory.car_model} • {tbrHistory.car_plate} {tbrHistory.car_color && `(${tbrHistory.car_color})`}</span>
                    </div>
                  )}
                  {tbrHistory.route && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Rota:</span>
                      <span className="font-semibold">{tbrHistory.route}</span>
                    </div>
                  )}
                  {tbrHistory.login && (
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Login:</span>
                      <span className="font-semibold">{tbrHistory.login}</span>
                    </div>
                  )}
                  {tbrHistory.conferente_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Conferente:</span>
                      <span className="font-semibold">{tbrHistory.conferente_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Escaneado:</span>
                    <span className="font-semibold">{formatTime(tbrHistory.scanned_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Status carga:</span>
                    <Badge variant={tbrHistory.loading_status === "finished" ? "default" : "secondary"} className="text-xs">
                      {tbrHistory.loading_status ?? "—"}
                    </Badge>
                  </div>
                </div>

                {/* Occurrences */}
                {(tbrHistory.piso.length > 0 || tbrHistory.ps.length > 0 || tbrHistory.rto.length > 0) && (
                  <div className="pt-2 border-t space-y-1.5">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">Ocorrências</h4>
                    {tbrHistory.piso.map((p, i) => (
                      <div key={`piso-${i}`} className="text-xs flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">Piso</Badge>
                        <span>{p.reason}</span>
                        <Badge variant={p.status === "open" ? "destructive" : "secondary"} className="text-[10px]">{p.status}</Badge>
                        <span className="text-muted-foreground">{formatTime(p.created_at)}</span>
                      </div>
                    ))}
                    {tbrHistory.ps.map((p, i) => (
                      <div key={`ps-${i}`} className="text-xs flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">PS</Badge>
                        <span>{p.description}</span>
                        <Badge variant={p.status === "open" ? "destructive" : "secondary"} className="text-[10px]">{p.status}</Badge>
                        <span className="text-muted-foreground">{formatTime(p.created_at)}</span>
                      </div>
                    ))}
                    {tbrHistory.rto.map((r, i) => (
                      <div key={`rto-${i}`} className="text-xs flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">RTO</Badge>
                        <span>{r.description}</span>
                        <Badge variant={r.status === "open" ? "destructive" : "secondary"} className="text-[10px]">{r.status}</Badge>
                        <span className="text-muted-foreground">{formatTime(r.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activate Button */}
              <Button
                className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                size="lg"
                disabled={activating || alreadyActive}
                onClick={activateReativo}
              >
                {activating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : alreadyActive ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {alreadyActive ? "Já ativado como reativo" : `Ativar Reativo — ${formatBRL(20)}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold italic">Reativos Registrados</CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingEntries ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground p-8">
              Nenhum reativo registrado nesta data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">TBR</TableHead>
                    <TableHead className="text-xs">Motorista</TableHead>
                    <TableHead className="text-xs">Rota</TableHead>
                    <TableHead className="text-xs">Conferente</TableHead>
                    <TableHead className="text-xs">Gerente</TableHead>
                    <TableHead className="text-xs">Hora</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs font-semibold">{e.tbr_code}</TableCell>
                      <TableCell className="text-xs">{e.driver_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{e.route ?? "—"}</TableCell>
                      <TableCell className="text-xs">{e.conferente_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{e.manager_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{formatTime(e.activated_at)}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-amber-600">{formatBRL(e.reativo_value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReativoPage;
