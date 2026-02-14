import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, MapPin, Clock, Calendar, User, KeyRound, Route } from "lucide-react";

interface Ride {
  id: string;
  driver_id: string;
  unit_id: string;
  completed_at: string;
  notes: string | null;
  route: string | null;
  login: string | null;
  password: string | null;
  unit_name?: string;
}

const DriverRides = () => {
  const { unitSession } = useAuthStore();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const driverId = unitSession?.user_profile_id;

  useEffect(() => {
    if (!driverId) return;
    const fetchRides = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("driver_rides")
        .select("*")
        .eq("driver_id", driverId)
        .order("completed_at", { ascending: false });

      if (!data) { setRides([]); setLoading(false); return; }

      // Fetch unit names
      const unitIds = [...new Set(data.map((r) => r.unit_id))];
      const { data: units } = await supabase
        .from("units")
        .select("id, name")
        .in("id", unitIds);
      const unitMap = new Map((units ?? []).map((u) => [u.id, u.name]));

      setRides(data.map((r) => ({ ...r, unit_name: unitMap.get(r.unit_id) ?? "—" })));
      setLoading(false);
    };
    fetchRides();
  }, [driverId]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold italic flex items-center gap-2">
        <Car className="h-5 w-5 text-primary" />
        Corridas
      </h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            Total de corridas: <span className="text-primary font-bold">{rides.length}</span>
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
            rides.map((ride, idx) => (
              <div
                key={ride.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
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
                      <Calendar className="h-3 w-3" />
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
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverRides;
