import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, Clock, Hash, Timer, Truck, MapPin, LogIn, KeyRound, ScanBarcode, Info, RotateCcw, QrCode, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import QrViewfinder from "@/components/ui/QrViewfinder";

interface QueueEntry {
  id: string;
  driver_id: string;
  unit_id: string;
  status: string;
  joined_at: string;
  called_at: string | null;
  completed_at: string | null;
  called_by_name: string | null;
}

interface ActiveRide {
  id: string;
  route: string | null;
  login: string | null;
  password: string | null;
  sequence_number: number | null;
  loading_status: string | null;
  queue_entry_id?: string | null;
  completed_at?: string | null;
  unit_id?: string;
  conferente_id?: string | null;
  conferente_name?: string | null;
}

const formatElapsed = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};


const QrCameraOverlay = ({ onDetect, onClose }: { onDetect: (code: string) => void; onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        await new Promise(r => setTimeout(r, 100));
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          await videoRef.current.play();
        }

        if (!("BarcodeDetector" in window)) return;

        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || detectedRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length === 0) return;

            const vw = videoRef.current.videoWidth;
            const vh = videoRef.current.videoHeight;
            const inset = 0.2;

            const inside = barcodes.filter((b: any) => {
              const bb = b.boundingBox;
              if (!bb) return false;
              return bb.x >= vw * inset && bb.y >= vh * inset &&
                bb.x + bb.width <= vw * (1 - inset) && bb.y + bb.height <= vh * (1 - inset);
            });

            if (inside.length > 0 && inside[0].rawValue) {
              detectedRef.current = true;
              onDetect(inside[0].rawValue.trim());
            }
          } catch {}
        }, 150);
      } catch {
        onClose();
      }
    };

    start();

    return () => {
      cancelled = true;
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [onDetect, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <span className="text-white font-semibold text-sm">Escanear QR Code da Fila</span>
        <button onClick={onClose} className="text-white/80 hover:text-white p-1">
          <X className="h-6 w-6" />
        </button>
      </div>
      {/* Camera */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
        <QrViewfinder />
      </div>
    </div>
  );
};

const DriverQueue = () => {
  const { unitSession } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [myEntry, setMyEntry] = useState<QueueEntry | null>(null);
  const [position, setPosition] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [avgWaitMinutes, setAvgWaitMinutes] = useState(0);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [lastCompletedRide, setLastCompletedRide] = useState<ActiveRide | null>(null);
  const [tbrCount, setTbrCount] = useState(0);
  const [lastTbrCount, setLastTbrCount] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [activeConferente, setActiveConferente] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const qrProcessedRef = useRef(false);

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
      .select("id, route, login, password, sequence_number, loading_status, completed_at, unit_id, queue_entry_id, conferente_id")
      .eq("driver_id", driverId)
      .in("loading_status", ["pending", "loading"])
      .gte("completed_at", today.toISOString())
      .order("completed_at", { ascending: false })
      .limit(1);

    const ride = data && data.length > 0 ? data[0] : null;
    setActiveRide(ride as ActiveRide | null);

    // Buscar nome do conferente do carregamento ativo
    if (ride?.conferente_id) {
      const { data: confData } = await supabase
        .from("user_profiles")
        .select("name")
        .eq("id", ride.conferente_id)
        .maybeSingle();
      setActiveConferente(confData?.name ?? null);
    } else {
      setActiveConferente(null);
    }

    // Fetch last completed ride if no active ride
    if (!ride) {
      const { data: lastData } = await supabase
        .from("driver_rides")
        .select("id, route, login, password, sequence_number, loading_status, completed_at, unit_id, conferente_id")
        .eq("driver_id", driverId)
        .eq("loading_status", "finished")
        .order("completed_at", { ascending: false })
        .limit(1);

      if (lastData && lastData.length > 0) {
        const lastRide = lastData[0] as ActiveRide;

        // Buscar nome do conferente do último carregamento
        if (lastRide.conferente_id) {
          const { data: lastConfData } = await supabase
            .from("user_profiles")
            .select("name")
            .eq("id", lastRide.conferente_id)
            .maybeSingle();
          lastRide.conferente_name = lastConfData?.name ?? null;
        }

        setLastCompletedRide(lastRide);
        
        // Fetch TBR count for last ride
        const { count: lastCount } = await supabase
          .from("ride_tbrs")
          .select("*", { count: "exact", head: true })
          .eq("ride_id", lastData[0].id);
        setLastTbrCount(lastCount ?? 0);
      } else {
        setLastCompletedRide(null);
        setLastTbrCount(0);
      }
    } else {
      setLastCompletedRide(null);
      setLastTbrCount(0);
    }

    // Calculate queue position using sequence_number
    if (ride && ride.sequence_number) {
      const { count } = await supabase
        .from("driver_rides")
        .select("*", { count: "exact", head: true })
        .eq("unit_id", ride.unit_id)
        .in("loading_status", ["pending", "loading"])
        .gte("completed_at", today.toISOString())
        .lte("sequence_number", ride.sequence_number);
      setQueuePosition(count ?? null);
    } else {
      setQueuePosition(null);
    }
  }, [driverId]);

  const fetchQueue = useCallback(async () => {
    if (!unitId || !driverId) return;

    const { data: allEntries } = await supabase
      .from("queue_entries")
      .select("id, driver_id, unit_id, status, joined_at, called_at, completed_at, called_by_name")
      .eq("unit_id", unitId)
      .in("status", ["waiting", "approved"])
      .order("joined_at", { ascending: true });

    const entries = (allEntries ?? []) as QueueEntry[];
    
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
    setMyEntry(data as QueueEntry);
    fetchQueue();
  };

  const validateQrAndJoin = useCallback((qrUrl: string) => {
    try {
      const url = new URL(qrUrl);
      const turno = url.searchParams.get("qr_turno");
      const qrUnit = url.searchParams.get("qr_unit");
      const qrDate = url.searchParams.get("qr_date");
      if (!turno || !qrUnit || !qrDate) { toast.error("QR Code inválido"); return; }
      const now = new Date();
      const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayStr = brt.toISOString().slice(0, 10);
      if (qrDate !== todayStr) { toast.error("QR Code expirado"); return; }
      if (qrUnit !== unitId) { toast.error("QR Code de outra unidade"); return; }
      const totalMin = brt.getUTCHours() * 60 + brt.getUTCMinutes();
      if (turno === "madrugada" && totalMin > 300) { toast.error("QR Madrugada válido somente de 00:00 às 05:00"); return; }
      if (turno === "diurno" && totalMin <= 300) { toast.error("QR Diurno válido somente a partir das 05:01"); return; }
      if (myEntry) { toast.info("Você já está na fila!"); return; }
      toast.success("QR válido! Entrando na fila...");
      joinQueue();
    } catch { toast.error("QR Code inválido"); }
  }, [unitId, myEntry, joinQueue]);

  useEffect(() => {
    if (qrProcessedRef.current) return;
    const turno = searchParams.get("qr_turno");
    if (!turno || !unitId || !driverId) return;
    qrProcessedRef.current = true;
    const fullUrl = window.location.href;
    searchParams.delete("qr_turno");
    searchParams.delete("qr_unit");
    searchParams.delete("qr_date");
    setSearchParams(searchParams, { replace: true });
    setTimeout(() => validateQrAndJoin(fullUrl), 1500);
  }, [searchParams, unitId, driverId, validateQrAndJoin, setSearchParams]);

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
      <div className="space-y-4 px-0">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary flex-shrink-0" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Em Carregamento</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Domínio</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-base font-semibold">{domainName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Unidade</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-base font-semibold">{unitName}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary relative overflow-hidden">
          <CardHeader className="pb-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-primary flex items-center gap-2 text-base">
                <Truck className="h-5 w-5 flex-shrink-0" />
                Carregamento Ativo
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <ScanBarcode className="h-3 w-3" />
                  TBRs: {tbrCount}
                </Badge>
                <Badge variant={activeRide.loading_status === "loading" ? "default" : "secondary"} className="text-xs whitespace-nowrap">
                  {statusLabel}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4">
            {/* Banner do conferente bipando */}
            {activeRide.loading_status === "loading" && activeConferente && (
              <div className="flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
                <ScanBarcode className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-sm font-semibold text-primary">
                  Conferente <span className="font-bold">{activeConferente}</span> está bipando você
                </p>
              </div>
            )}
            {activeRide.sequence_number && (
              <div className="flex items-center gap-3">
                <Hash className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Sequência</p>
                  <p className="text-2xl font-bold">{activeRide.sequence_number}º</p>
                </div>
              </div>
            )}
            {activeRide.route && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Rota</p>
                  <p className="text-base sm:text-lg font-semibold break-words">{activeRide.route}</p>
                </div>
              </div>
            )}

            {/* Amazon Flex info text */}
            {(activeRide.login || activeRide.password) && (
              <div className="flex items-start gap-2 rounded-md bg-muted/50 border border-border p-3">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  O login e senha abaixo são para acessar o <span className="font-semibold">Amazon Flex</span>. Após finalizar o carregamento, você pode consultá-los em <span className="font-semibold">Corridas</span> no menu.
                </p>
              </div>
            )}

            {activeRide.login && (
              <div className="flex items-center gap-3">
                <LogIn className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Login</p>
                  <p className="text-base sm:text-lg font-semibold break-words">{activeRide.login}</p>
                </div>
              </div>
            )}
            {activeRide.password && (
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Senha</p>
                  <p className="text-base sm:text-lg font-semibold">{activeRide.password}</p>
                </div>
              </div>
            )}

            {queuePosition !== null && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="flex flex-col gap-3 py-4 px-4">
                  <div className="flex items-center gap-3">
                    <Hash className="h-6 w-6 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-sm text-muted-foreground">Posição na Fila</p>
                      <p className="text-3xl font-bold text-primary">
                        {queuePosition}º
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
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
          <Button
            onClick={() => setShowQrScanner(true)}
            disabled={loading}
            variant="outline"
            className="w-full h-12 text-base font-semibold gap-2"
            size="lg"
          >
            <QrCode className="h-5 w-5" />
            ENTRAR VIA QR CODE
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

      {/* Histórico do último carregamento concluído */}
      {!activeRide && lastCompletedRide && (
        <Card className="border-muted relative overflow-hidden mt-6 opacity-80 hover:opacity-100 transition-opacity">
          <CardHeader className="pb-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-muted-foreground flex items-center gap-2 text-base">
                <RotateCcw className="h-5 w-5 flex-shrink-0" />
                Último Histórico do Carregamento
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1 text-xs">
                  <ScanBarcode className="h-3 w-3" />
                  TBRs: {lastTbrCount}
                </Badge>
                <Badge variant="outline" className="text-xs whitespace-nowrap">
                  Finalizado em {new Date(lastCompletedRide.completed_at!).toLocaleDateString('pt-BR')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4">
            {lastCompletedRide.route && (
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Rota</p>
                  <p className="text-base font-semibold break-words">{lastCompletedRide.route}</p>
                </div>
              </div>
            )}
            {lastCompletedRide.conferente_name && (
              <div className="flex items-center gap-3">
                <ScanBarcode className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Conferente</p>
                  <p className="text-base font-semibold break-words">{lastCompletedRide.conferente_name}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
              {lastCompletedRide.login && (
                <div className="flex items-center gap-3">
                  <LogIn className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Login</p>
                    <p className="text-sm font-semibold break-words">{lastCompletedRide.login}</p>
                  </div>
                </div>
              )}
              {lastCompletedRide.password && (
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Senha</p>
                    <p className="text-sm font-semibold">{lastCompletedRide.password}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>

      {/* QR Scanner Fullscreen Overlay */}
      {showQrScanner && (
        <QrCameraOverlay
          onDetect={(code) => {
            setShowQrScanner(false);
            validateQrAndJoin(code);
          }}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </>
  );
};

export default DriverQueue;
