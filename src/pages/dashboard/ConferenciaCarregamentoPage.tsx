import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, MapPin, User, Hash, KeyRound, Play, Square, RotateCcw, ScanBarcode, UserCheck, Clock } from "lucide-react";
import { format } from "date-fns";

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

const ConferenciaCarregamentoPage = () => {
  const { unitSession } = useAuthStore();
  const [rides, setRides] = useState<RideWithDriver[]>([]);
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [tbrs, setTbrs] = useState<Record<string, Tbr[]>>({});
  const [tbrInputs, setTbrInputs] = useState<Record<string, string>>({});
  const unitId = unitSession?.id;

  const fetchRides = useCallback(async () => {
    if (!unitId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("driver_rides")
      .select("*")
      .eq("unit_id", unitId)
      .gte("completed_at", today.toISOString())
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
        conferente_id: (r as any).conferente_id ?? null,
        loading_status: (r as any).loading_status ?? "pending",
        password: (r as any).password ?? null,
        driver_name: d?.name ?? "Motorista",
        driver_avatar: d?.avatar_url ?? undefined,
        car_model: d?.car_model ?? undefined,
        car_plate: d?.car_plate ?? undefined,
        car_color: d?.car_color ?? undefined,
      };
    });

    setRides(mapped);

    // Fetch TBRs for all rides
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
    }
  }, [unitId]);

  // Fetch conferentes
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

  // Realtime for rides and tbrs
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

  const handleTbrSubmit = async (rideId: string) => {
    const code = (tbrInputs[rideId] ?? "").trim();
    if (!code) return;
    await supabase.from("ride_tbrs").insert({ ride_id: rideId, code } as any);
    setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
    await fetchRides();
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold italic">Conferência Carregamento</h1>

      {rides.length === 0 ? (
        <p className="text-muted-foreground italic text-center py-12">
          Nenhum carregamento programado hoje.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rides.map((ride) => {
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
                    {(ride as any).started_at && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0 text-green-600" />
                        <span className="text-xs"><strong>Início:</strong> {format(new Date((ride as any).started_at), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    )}
                    {(ride as any).finished_at && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0 text-red-600" />
                        <span className="text-xs"><strong>Término:</strong> {format(new Date((ride as any).finished_at), "dd/MM/yyyy HH:mm")}</span>
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
                              <span className="font-mono">{t.code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isLoading && (
                        <div className="flex gap-2">
                          <Input
                            className="h-8 text-sm font-mono"
                            placeholder="Escanear TBR..."
                            value={tbrInputs[ride.id] ?? ""}
                            onChange={(e) => setTbrInputs((prev) => ({ ...prev, [ride.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleTbrSubmit(ride.id); }}
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
