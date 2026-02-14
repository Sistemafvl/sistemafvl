import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Car, MapPin, User, Hash, KeyRound } from "lucide-react";

interface RideWithDriver {
  id: string;
  route: string | null;
  login: string | null;
  password: string | null;
  sequence_number: number | null;
  driver_id: string;
  driver_name?: string;
  driver_avatar?: string;
  car_model?: string;
  car_plate?: string;
  car_color?: string;
}

const ConferenciaCarregamentoPage = () => {
  const { unitSession } = useAuthStore();
  const [rides, setRides] = useState<RideWithDriver[]>([]);
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

    setRides(
      data.map((r) => {
        const d = driverMap.get(r.driver_id);
        return {
          ...r,
          password: (r as any).password ?? null,
          driver_name: d?.name ?? "Motorista",
          driver_avatar: d?.avatar_url ?? undefined,
          car_model: d?.car_model ?? undefined,
          car_plate: d?.car_plate ?? undefined,
          car_color: d?.car_color ?? undefined,
        };
      })
    );
  }, [unitId]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("conferencia-" + unitId)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "driver_rides",
        filter: `unit_id=eq.${unitId}`,
      }, () => { fetchRides(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchRides]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold italic">Conferência Carregamento</h1>

      {rides.length === 0 ? (
        <p className="text-muted-foreground italic text-center py-12">
          Nenhum carregamento programado hoje.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rides.map((ride) => (
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConferenciaCarregamentoPage;
