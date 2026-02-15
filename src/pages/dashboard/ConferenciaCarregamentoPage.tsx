import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Car, MapPin, User, Hash, KeyRound, Play, Square, RotateCcw, ScanBarcode, UserCheck, Clock, Search, X, CalendarIcon, Timer } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RideWithDriver {
  id: string;
  route: string | null;
  login: string | null;
  password: string | null;
  sequence_number: number | null;
  driver_id: string;
  conferente_id: string | null;
  loading_status: string | null;
  driver_name?: string;
  driver_avatar?: string;
  car_model?: string;
  car_plate?: string;
  car_color?: string;
  started_at?: string | null;
  finished_at?: string | null;
}

interface Conferente {
  id: string;
  name: string;
}

interface Tbr {
  id: string;
  code: string;
  scanned_at: string;
}

const formatDuration = (startedAt: string, finishedAt: string) => {
  const mins = differenceInMinutes(new Date(finishedAt), new Date(startedAt));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}min`;
  }
  return `${mins} min`;
};

const playErrorBeep = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 400;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
};

const ConferenciaCarregamentoPage = () => {
  const { unitSession } = useAuthStore();
  const [rides, setRides] = useState<RideWithDriver[]>([]);
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [tbrs, setTbrs] = useState<Record<string, Tbr[]>>({});
  const [tbrInputs, setTbrInputs] = useState<Record<string, string>>({});
  const [tbrSearch, setTbrSearch] = useState("");
  const [startDate, setStartDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [endDate, setEndDate] = useState<Date>(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const unitId = unitSession?.id;

  const fetchRides = useCallback(async () => {
    if (!unitId) return;

    const { data } = await supabase
      .from("driver_rides")
      .select("*")
      .eq("unit_id", unitId)
      .gte("completed_at", startDate.toISOString())
      .lte("completed_at", endDate.toISOString())
      .order("sequence_number", { ascending: true });

    if (!data) { setRides([]); return; }

    const driverIds = [...new Set(data.map((r) => r.driver_id))];
    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, name, avatar_url, car_model, car_plate, car_color")
      .in("id", driverIds);

    const driverMap = new Map((drivers ?? []).map((d) => [d.id, d]));

    const mapped = data.map((r) => {
      const d = driverMap.get(r.driver_id);
      return {
        ...r,
        conferente_id: r.conferente_id ?? null,
        loading_status: r.loading_status ?? "pending",
        password: r.password ?? null,
        driver_name: d?.name ?? "Motorista",
        driver_avatar: d?.avatar_url ?? undefined,
        car_model: d?.car_model ?? undefined,
        car_plate: d?.car_plate ?? undefined,
        car_color: d?.car_color ?? undefined,
      };
    });

    setRides(mapped);

    const rideIds = mapped.map((r) => r.id);
    if (rideIds.length > 0) {
      const { data: tbrData } = await supabase
        .from("ride_tbrs")
        .select("*")
        .in("ride_id", rideIds)
        .order("scanned_at", { ascending: true });

      const grouped: Record<string, Tbr[]> = {};
      (tbrData ?? []).forEach((t: any) => {
        if (!grouped[t.ride_id]) grouped[t.ride_id] = [];
        grouped[t.ride_id].push(t);
      });
      setTbrs(grouped);
    } else {
      setTbrs({});
    }
  }, [unitId, startDate, endDate]);

  useEffect(() => {
    if (!unitId) return;
    supabase
      .from("user_profiles")
      .select("id, name")
      .eq("unit_id", unitId)
      .eq("active", true)
      .then(({ data }) => { if (data) setConferentes(data); });
  }, [unitId]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("conferencia-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_rides", filter: `unit_id=eq.${unitId}` }, () => { fetchRides(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_tbrs" }, () => { fetchRides(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchRides]);

  const handleSelectConferente = async (rideId: string, conferenteId: string) => {
    await supabase.from("driver_rides").update({ conferente_id: conferenteId } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleIniciar = async (rideId: string) => {
    await supabase.from("driver_rides").update({ loading_status: "loading", started_at: new Date().toISOString() } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleFinalizar = async (rideId: string) => {
    await supabase.from("driver_rides").update({ loading_status: "finished", finished_at: new Date().toISOString() } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleRetornar = async (rideId: string) => {
    await supabase.from("driver_rides").update({ loading_status: "loading", finished_at: null } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleDeleteTbr = async (tbrId: string) => {
    await supabase.from("ride_tbrs").delete().eq("id", tbrId);
    await fetchRides();
  };

  // Auto-save TBR with debounce
  const handleTbrInputChange = (rideId: string, value: string) => {
    setTbrInputs((prev) => ({ ...prev, [rideId]: value }));

    if (debounceTimers.current[rideId]) {
      clearTimeout(debounceTimers.current[rideId]);
    }

    if (!value.trim()) return;

    debounceTimers.current[rideId] = setTimeout(async () => {
      const code = value.trim();
      if (code.toUpperCase().startsWith("TBR")) {
        await supabase.from("ride_tbrs").insert({ ride_id: rideId, code } as any);
        setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
        await fetchRides();
        // Re-focus input
        setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
      } else {
        playErrorBeep();
        toast.error("Código inválido! Deve iniciar com TBR");
        setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
        setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
      }
    }, 300);
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Filter rides by TBR search
  const filteredRides = tbrSearch.trim()
    ? rides.filter((ride) => {
        const rideTbrs = tbrs[ride.id] ?? [];
        return rideTbrs.some((t) => t.code.toLowerCase().includes(tbrSearch.trim().toLowerCase()));
      })
    : rides;

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      date.setHours(0, 0, 0, 0);
      setStartDate(date);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999);
      setEndDate(date);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold italic">Conferência Carregamento</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-10"
            placeholder="Buscar TBR..."
            value={tbrSearch}
            onChange={(e) => setTbrSearch(e.target.value)}
          />
          {tbrSearch && (
            <button onClick={() => setTbrSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 justify-start">
              <CalendarIcon className="h-4 w-4" />
              {format(startDate, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={handleStartDateSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 justify-start">
              <CalendarIcon className="h-4 w-4" />
              {format(endDate, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={handleEndDateSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      {filteredRides.length === 0 ? (
        <p className="text-muted-foreground italic text-center py-12">
          {tbrSearch.trim() ? "Nenhum resultado encontrado." : "Nenhum carregamento programado hoje."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRides.map((ride) => {
            const status = ride.loading_status ?? "pending";
            const rideTbrs = tbrs[ride.id] ?? [];
            const isLoading = status === "loading";
            const isFinished = status === "finished";

            return (
              <Card key={ride.id} className="relative overflow-hidden">
                <CardContent className="p-4 flex flex-col items-center gap-3">
                  <Badge variant="default" className="absolute top-3 right-3 text-sm px-3 py-0.5 font-bold">
                    <Hash className="h-3.5 w-3.5 mr-0.5" />
                    {ride.sequence_number}º
                  </Badge>

                  <Avatar className="h-16 w-16">
                    {ride.driver_avatar && <AvatarImage src={ride.driver_avatar} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                      {(ride.driver_name ?? "M")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <h3 className="text-lg font-bold text-center">{ride.driver_name}</h3>

                  <div className="w-full space-y-1.5 text-sm">
                    {(ride.car_model || ride.car_color) && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Car className="h-4 w-4 shrink-0" />
                        <span>{[ride.car_model, ride.car_color].filter(Boolean).join(" — ")}</span>
                      </div>
                    )}
                    {ride.car_plate && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{ride.car_plate}</span>
                      </div>
                    )}
                    {ride.started_at && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0 text-green-600" />
                        <span className="text-xs"><strong>Início:</strong> {format(new Date(ride.started_at), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    )}
                    {ride.finished_at && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0 text-red-600" />
                        <span className="text-xs"><strong>Término:</strong> {format(new Date(ride.finished_at), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    )}
                    {ride.started_at && ride.finished_at && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Timer className="h-4 w-4 shrink-0 text-blue-600" />
                        <span className="text-xs"><strong>Duração:</strong> {formatDuration(ride.started_at, ride.finished_at)}</span>
                      </div>
                    )}
                    {ride.route && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-primary" />
                        <span><strong>Rota:</strong> {ride.route}</span>
                      </div>
                    )}
                    {ride.login && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-primary" />
                        <span><strong>Login:</strong> {ride.login}</span>
                      </div>
                    )}
                    {ride.password && (
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 shrink-0 text-primary" />
                        <span><strong>Senha:</strong> {ride.password}</span>
                      </div>
                    )}
                  </div>

                  {/* Conferente Select */}
                  <div className="w-full">
                    <Select
                      value={ride.conferente_id ?? ""}
                      onValueChange={(val) => handleSelectConferente(ride.id, val)}
                    >
                      <SelectTrigger className="w-full h-9 text-sm">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                          <SelectValue placeholder="Selecionar Conferente" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {conferentes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Action Buttons */}
                  <div className="w-full flex gap-2">
                    {!isLoading && !isFinished && (
                      <Button size="sm" className="flex-1 gap-1" onClick={() => handleIniciar(ride.id)}>
                        <Play className="h-3.5 w-3.5" /> Iniciar
                      </Button>
                    )}
                    {isLoading && (
                      <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => handleFinalizar(ride.id)}>
                        <Square className="h-3.5 w-3.5" /> Finalizar
                      </Button>
                    )}
                    {isFinished && (
                      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleRetornar(ride.id)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Retornar
                      </Button>
                    )}
                  </div>

                  {/* TBR Area */}
                  {(isLoading || isFinished) && (
                    <div className="w-full space-y-2 border-t pt-3">
                      <p className="text-xs font-bold italic flex items-center gap-1">
                        <ScanBarcode className="h-3.5 w-3.5 text-primary" />
                        TBRs Lidos ({rideTbrs.length})
                      </p>
                      {rideTbrs.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {rideTbrs.map((t, i) => (
                            <div key={t.id} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                              <span className="font-bold text-primary">{i + 1}.</span>
                              <span className="font-mono flex-1">{t.code}</span>
                              <button
                                onClick={() => handleDeleteTbr(t.id)}
                                className="text-destructive hover:text-destructive/80 shrink-0"
                                title="Excluir TBR"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {isLoading && (
                        <div className="flex gap-2">
                          <Input
                            ref={(el) => { inputRefs.current[ride.id] = el; }}
                            className="h-8 text-sm font-mono"
                            placeholder="Escanear TBR..."
                            value={tbrInputs[ride.id] ?? ""}
                            onChange={(e) => handleTbrInputChange(ride.id, e.target.value)}
                            autoFocus
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConferenciaCarregamentoPage;
