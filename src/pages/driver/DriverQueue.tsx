import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Clock, Hash, Timer, Truck, MapPin, LogIn, KeyRound, ScanBarcode, Bell, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";

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

// Generate a valid PCM WAV beep programmatically
const generateBeepWav = (): string => {
  const sampleRate = 8000;
  const duration = 0.3;
  const frequency = 1000;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples;
  const fileSize = 44 + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  // RIFF header
  const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
  writeString(0, "RIFF"); view.setUint32(4, fileSize - 8, true); writeString(8, "WAVE");
  writeString(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  writeString(36, "data"); view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) {
    const sample = 128 + Math.round(80 * Math.sin(2 * Math.PI * frequency * i / sampleRate));
    view.setUint8(44 + i, sample);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
};

const BEEP_DATA_URI = generateBeepWav();

// Global AudioContext - initialized on first user interaction
let globalAudioCtx: AudioContext | null = null;
let audioCtxInitialized = false;

const initAudioContext = () => {
  if (audioCtxInitialized) return;
  audioCtxInitialized = true;
  const handler = () => {
    try {
      if (!globalAudioCtx) globalAudioCtx = new AudioContext();
      if (globalAudioCtx.state === "suspended") globalAudioCtx.resume();
    } catch {}
    document.removeEventListener("click", handler);
    document.removeEventListener("touchstart", handler);
  };
  document.addEventListener("click", handler, { once: true });
  document.addEventListener("touchstart", handler, { once: true });
  // Try immediately in case we're already in an interaction
  try {
    globalAudioCtx = new AudioContext();
    if (globalAudioCtx.state === "suspended") globalAudioCtx.resume();
  } catch {}
};

// Generate alert beep using Web Audio API with fallback
const createAlertAudio = () => {
  let isPlaying = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const beepWithWebAudio = async () => {
    try {
      if (!globalAudioCtx) globalAudioCtx = new AudioContext();
      if (globalAudioCtx.state === "suspended") await globalAudioCtx.resume();
      const osc = globalAudioCtx.createOscillator();
      const gain = globalAudioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = 1000;
      gain.gain.value = 0.5;
      osc.connect(gain);
      gain.connect(globalAudioCtx.destination);
      osc.start();
      osc.stop(globalAudioCtx.currentTime + 0.3);
    } catch {
      // Fallback: use Audio element with valid WAV
      try {
        const audio = new Audio(BEEP_DATA_URI);
        audio.volume = 0.8;
        await audio.play().catch(() => {});
      } catch {}
    }
  };

  const startBeeping = () => {
    if (isPlaying) return;
    isPlaying = true;
    initAudioContext();
    beepWithWebAudio();
    intervalId = setInterval(beepWithWebAudio, 1500);
  };

  const stopBeeping = () => {
    isPlaying = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return { startBeeping, stopBeeping };
};

const DriverQueue = () => {
  const { unitSession } = useAuthStore();
  const { toast, dismiss } = useToast();
  const [loading, setLoading] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [myEntry, setMyEntry] = useState<QueueEntry | null>(null);
  const [position, setPosition] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [avgWaitMinutes, setAvgWaitMinutes] = useState(0);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [tbrCount, setTbrCount] = useState(0);

  const alertAudioRef = useRef(createAlertAudio());
  const lastCalledAtRef = useRef<string | null>(null);
  const alertToastIdRef = useRef<string | null>(null);

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

    const { data: allEntries } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("unit_id", unitId)
      .in("status", ["waiting", "approved"])
      .order("joined_at", { ascending: true });

    const entries = (allEntries ?? []) as QueueEntry[];
    
    const approvedEntries = entries.filter((e) => e.status === "approved");
    setQueueCount(approvedEntries.length);

    const mine = entries.find((e) => e.driver_id === driverId);
    setMyEntry(mine ?? null);

    // Check if driver was called
    if (mine && mine.called_at && mine.called_at !== lastCalledAtRef.current) {
      lastCalledAtRef.current = mine.called_at;
      triggerCallAlert();
    }

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

  const triggerCallAlert = () => {
    // Start beeping sound
    alertAudioRef.current.startBeeping();

    // Show persistent toast
    const { id } = toast({
      title: "🔔 É a sua vez!",
      description: "Dirija-se ao local de carregamento. Estamos chamando você!",
      variant: "destructive",
      duration: Infinity,
      onOpenChange: (open) => {
        if (!open) {
          alertAudioRef.current.stopBeeping();
          alertToastIdRef.current = null;
        }
      },
    });
    alertToastIdRef.current = id;
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      alertAudioRef.current.stopBeeping();
      if (alertToastIdRef.current) {
        dismiss(alertToastIdRef.current);
      }
    };
  }, [dismiss]);

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
    setMyEntry(data as QueueEntry);
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
          {/* Called alert banner */}
          {myEntry?.called_at && (
            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 animate-pulse">
              <CardContent className="flex items-center gap-3 pt-6 pb-6">
                <Bell className="h-8 w-8 text-yellow-600 animate-bounce" />
                <div>
                  <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">É a sua vez!</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">Dirija-se ao local de carregamento.</p>
                </div>
              </CardContent>
            </Card>
          )}

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
