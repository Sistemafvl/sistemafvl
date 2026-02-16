import { useState, useEffect, useCallback } from "react";
import { Users, Clock, Hash, Timer, Truck, MapPin, LogIn, KeyRound, ScanBarcode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

interface QueueEntry {
  id: string;
  driver_id: string;
  unit_id: string;
  status: string;
  joined_at: string;
  called_at: string | null;
  completed_at: string | null;
}

interface ActiveRide {
  id: string;
  route: string | null;
  login: string | null;
  password: string | null;
  sequence_number: number | null;
  loading_status: string | null;
}

const formatElapsed = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const DriverQueue = () => {
  const { unitSession } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [myEntry, setMyEntry] = useState<QueueEntry | null>(null);
  const [position, setPosition] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [avgWaitMinutes, setAvgWaitMinutes] = useState(0);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [tbrCount, setTbrCount] = useState(0);

  const driverId = unitSession?.user_profile_id;
  const unitId = unitSession?.id;
  const domainName = unitSession?.domain_name ?? "—";
  const unitName = unitSession?.name ?? "—";

  const inQueue = !!myEntry;
  const isApproved = myEntry?.status === "approved";

  // Fetch TBR count for active ride
  useEffect(() => {
    if (!activeRide?.id) { setTbrCount(0); return; }

    const fetchTbrCount = async () => {
      const { count } = await supabase
        .from("ride_tbrs")
        .select("*", { count: "exact", head: true })
        .eq("ride_id", activeRide.id);
      setTbrCount(count ?? 0);
    };

    fetchTbrCount();

    const channel = supabase
      .channel(`tbr-count-${activeRide.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_tbrs", filter: `ride_id=eq.${activeRide.id}` }, () => {
        fetchTbrCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRide?.id]);

  const fetchActiveRide = useCallback(async () => {
    if (!driverId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("driver_rides")
      .select("id, route, login, password, sequence_number, loading_status")
      .eq("driver_id", driverId)
      .in("loading_status", ["pending", "loading"])
      .gte("completed_at", today.toISOString())
      .order("completed_at", { ascending: false })
      .limit(1);

    setActiveRide(data && data.length > 0 ? data[0] as ActiveRide : null);
  }, [driverId]);

  const fetchQueue = useCallback(async () => {
    if (!unitId || !driverId) return;

    // Fetch both waiting and approved entries
    const { data: allEntries } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("unit_id", unitId)
      .in("status", ["waiting", "approved"])
      .order("joined_at", { ascending: true });

    const entries = (allEntries ?? []) as QueueEntry[];
    
    // Count only approved for queue display
    const approvedEntries = entries.filter((e) => e.status === "approved");
    setQueueCount(approvedEntries.length);

    const mine = entries.find((e) => e.driver_id === driverId);
    setMyEntry(mine ?? null);

    if (mine && mine.status === "approved") {
      const pos = approvedEntries.filter((e) => e.joined_at <= mine.joined_at).length;
      setPosition(pos);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: completed } = await supabase
      .from("queue_entries")
      .select("joined_at, completed_at")
      .eq("unit_id", unitId)
      .eq("status", "completed")
      .gte("completed_at", since);

    if (completed && completed.length > 0) {
      const totalMs = completed.reduce((sum, e) => {
        return sum + (new Date(e.completed_at!).getTime() - new Date(e.joined_at).getTime());
      }, 0);
      setAvgWaitMinutes(Math.round(totalMs / completed.length / 60000));
    } else {
      setAvgWaitMinutes(5);
    }
  }, [unitId, driverId]);

  useEffect(() => {
    fetchQueue();
    fetchActiveRide();
  }, [fetchQueue, fetchActiveRide]);

  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel(`queue-${unitId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `unit_id=eq.${unitId}` }, () => {
        fetchQueue();
        fetchActiveRide();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchQueue, fetchActiveRide]);

  useEffect(() => {
    if (!driverId) return;
    const channel = supabase
      .channel(`driver-rides-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_rides", filter: `driver_id=eq.${driverId}` }, () => {
        fetchActiveRide();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId, fetchActiveRide]);

  useEffect(() => {
    if (!myEntry || myEntry.status !== "approved") { setElapsedSeconds(0); return; }
    const joinedAt = new Date(myEntry.joined_at).getTime();
    const update = () => setElapsedSeconds(Math.floor((Date.now() - joinedAt) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [myEntry]);

  const joinQueue = async () => {
    if (!unitId || !driverId) return;
    setLoading(true);
    const { data, error } = await supabase.from("queue_entries").insert({
      driver_id: driverId,
      unit_id: unitId,
      status: "waiting",
    }).select().single();
    setLoading(false);
    if (error) return;
    // Optimistic update
    setMyEntry(data as QueueEntry);
    // Refresh full queue
    fetchQueue();
  };

  const leaveQueue = async () => {
    if (!myEntry) return;
    setLoading(true);
    const { error } = await supabase.from("queue_entries").update({ status: "cancelled" }).eq("id", myEntry.id);
    setLoading(false);
    if (!error) {
      setMyEntry(null);
    }
  };

  const estimatedMinutes = position * avgWaitMinutes;
  const statusLabel = activeRide?.loading_status === "loading" ? "Carregando" : "Aguardando Carregamento";

  if (activeRide) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Truck className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Em Carregamento</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Domínio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{domainName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unidade</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{unitName}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-primary flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Carregamento Ativo
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <ScanBarcode className="h-3 w-3" />
                  TBRs: {tbrCount}
                </Badge>
                <Badge variant={activeRide.loading_status === "loading" ? "default" : "secondary"}>
                  {statusLabel}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeRide.sequence_number && (
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Sequência</p>
                  <p className="text-2xl font-bold">{activeRide.sequence_number}º</p>
                </div>
              </div>
            )}
            {activeRide.route && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Rota</p>
                  <p className="text-lg font-semibold">{activeRide.route}</p>
                </div>
              </div>
            )}
            {activeRide.login && (
              <div className="flex items-center gap-3">
                <LogIn className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Login</p>
                  <p className="text-lg font-semibold">{activeRide.login}</p>
                </div>
              </div>
            )}
            {activeRide.password && (
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Senha</p>
                  <p className="text-lg font-semibold">{activeRide.password}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Entrar na Fila</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Domínio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{domainName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unidade</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{unitName}</p>
          </CardContent>
        </Card>
      </div>

      {!inQueue ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Motoristas na fila</p>
                  <p className="text-2xl font-bold">{queueCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tempo médio de espera</p>
                  <p className="text-2xl font-bold">~{queueCount * avgWaitMinutes} min</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Button
            onClick={joinQueue}
            disabled={loading}
            className="w-full h-14 text-lg font-bold"
            size="lg"
          >
            {loading ? "Entrando..." : "ENTRAR NA FILA"}
          </Button>
        </>
      ) : !isApproved ? (
        <>
          <Button
            disabled
            variant="outline"
            className="w-full h-14 text-lg font-bold border-yellow-500 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20"
            size="lg"
          >
            AGUARDANDO APROVAÇÃO
          </Button>

          <Button
            onClick={leaveQueue}
            disabled={loading}
            variant="destructive"
            className="w-full h-14 text-lg font-bold"
            size="lg"
          >
            {loading ? "Saindo..." : "SAIR DA FILA"}
          </Button>
        </>
      ) : (
        <>
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="text-primary">Você está na fila!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Sua posição</p>
                  <p className="text-3xl font-bold">{position}º</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tempo estimado</p>
                  <p className="text-2xl font-bold">~{estimatedMinutes} min</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Timer className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Tempo na fila</p>
                  <p className="text-2xl font-bold font-mono">{formatElapsed(elapsedSeconds)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={leaveQueue}
            disabled={loading}
            variant="destructive"
            className="w-full h-14 text-lg font-bold"
            size="lg"
          >
            {loading ? "Saindo..." : "SAIR DA FILA"}
          </Button>
        </>
      )}
    </div>
  );
};

export default DriverQueue;
