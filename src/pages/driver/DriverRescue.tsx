import { useState, useRef, useEffect, useCallback } from "react";
import { LifeBuoy, Camera, X, Package, ArrowRight, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { isValidTbrCode } from "@/lib/utils";
import { isBarcodeInsideViewfinder } from "@/lib/scanner-utils";
import { format } from "date-fns";

interface RescuedTbr {
  id: string;
  tbrCode: string;
  originalDriverName: string;
  scannedAt: string;
}

const DriverRescue = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;
  const rescuerDriverId = unitSession?.user_profile_id;
  const rescuerName = unitSession?.user_name ?? "Motorista";

  const [tbrInput, setTbrInput] = useState("");
  const [rescuedTbrs, setRescuedTbrs] = useState<RescuedTbr[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedCodesRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const processTbrRef = useRef<(code: string) => Promise<void>>();

  // Load existing rescue entries for today
  useEffect(() => {
    if (!unitId || !rescuerDriverId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    supabase
      .from("rescue_entries")
      .select("*")
      .eq("unit_id", unitId)
      .eq("rescuer_driver_id", rescuerDriverId)
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false })
      .then(async ({ data }) => {
        if (!data || data.length === 0) return;
        // Get original driver names
        const driverIds = [...new Set(data.map((r: any) => r.original_driver_id))];
        const { data: drivers } = await supabase
          .from("drivers_public")
          .select("id, name")
          .in("id", driverIds);
        const driverMap = new Map((drivers ?? []).map((d: any) => [d.id, d.name ?? "Desconhecido"]));

        setRescuedTbrs(
          data.map((r: any) => ({
            id: r.id,
            tbrCode: r.tbr_code,
            originalDriverName: driverMap.get(r.original_driver_id) ?? "Desconhecido",
            scannedAt: r.scanned_at ?? r.created_at,
          }))
        );
      });
  }, [unitId, rescuerDriverId]);

  const playSuccessBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  const playErrorBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 300;
      osc.type = "square";
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const processTbr = useCallback(async (rawCode: string) => {
    if (!unitId || !rescuerDriverId) return;
    const code = rawCode.toUpperCase().trim();
    if (!isValidTbrCode(code)) {
      playErrorBeep();
      toast.error("Código inválido. Use formato TBR...");
      return;
    }
    if (processedCodesRef.current.has(code)) {
      toast.info("TBR já processado nesta sessão.");
      return;
    }

    setIsProcessing(true);
    try {
      // Find this TBR in ride_tbrs for today's rides in this unit
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayRides } = await supabase
        .from("driver_rides")
        .select("id, driver_id")
        .eq("unit_id", unitId)
        .gte("completed_at", today.toISOString());

      if (!todayRides || todayRides.length === 0) {
        playErrorBeep();
        toast.error("Nenhum carregamento encontrado hoje.");
        return;
      }

      const rideIds = todayRides.map((r) => r.id);
      const rideMap = new Map(todayRides.map((r) => [r.id, r.driver_id]));

      // Find the TBR
      const { data: matchingTbrs } = await supabase
        .from("ride_tbrs")
        .select("id, ride_id, code, trip_number")
        .in("ride_id", rideIds)
        .ilike("code", code);

      if (!matchingTbrs || matchingTbrs.length === 0) {
        playErrorBeep();
        toast.error(`TBR ${code} não encontrado em nenhum carregamento de hoje.`);
        return;
      }

      const originalTbr = matchingTbrs[0];
      const originalDriverId = rideMap.get(originalTbr.ride_id);

      if (originalDriverId === rescuerDriverId) {
        playErrorBeep();
        toast.error("Este TBR já está no seu carregamento.");
        return;
      }

      // Find rescuer's active ride (loading or most recent finished)
      const { data: rescuerRides } = await supabase
        .from("driver_rides")
        .select("id, loading_status")
        .eq("unit_id", unitId)
        .eq("driver_id", rescuerDriverId)
        .gte("completed_at", today.toISOString())
        .order("completed_at", { ascending: false });

      if (!rescuerRides || rescuerRides.length === 0) {
        playErrorBeep();
        toast.error("Você não tem carregamento ativo hoje. Entre na fila primeiro.");
        return;
      }

      const activeRide =
        rescuerRides.find((r) => r.loading_status === "loading") ??
        rescuerRides.find((r) => r.loading_status === "finished") ??
        rescuerRides[0];

      // Delete from original ride
      await supabase.from("ride_tbrs").delete().eq("id", originalTbr.id);

      // Insert into rescuer's ride with is_rescue = true
      await supabase.from("ride_tbrs").insert({
        ride_id: activeRide.id,
        code: originalTbr.code,
        trip_number: originalTbr.trip_number,
        is_rescue: true,
      });

      // Record in rescue_entries
      await supabase.from("rescue_entries").insert({
        unit_id: unitId,
        rescuer_driver_id: rescuerDriverId,
        original_driver_id: originalDriverId!,
        original_ride_id: originalTbr.ride_id,
        rescuer_ride_id: activeRide.id,
        tbr_code: code,
      });

      // Get original driver name
      const { data: driverData } = await supabase
        .from("drivers_public")
        .select("name")
        .eq("id", originalDriverId!)
        .single();

      processedCodesRef.current.add(code);
      playSuccessBeep();

      setRescuedTbrs((prev) => [
        {
          id: crypto.randomUUID(),
          tbrCode: code,
          originalDriverName: driverData?.name ?? "Desconhecido",
          scannedAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      toast.success(`TBR ${code} transferido com sucesso!`);
    } catch (err: any) {
      playErrorBeep();
      toast.error("Erro ao processar TBR: " + (err?.message ?? ""));
    } finally {
      setIsProcessing(false);
      setTbrInput("");
      inputRef.current?.focus();
    }
  }, [unitId, rescuerDriverId]);

  processTbrRef.current = processTbr;

  // Handle input submit (keyboard/external scanner)
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tbrInput.trim()) {
      e.preventDefault();
      processTbr(tbrInput.trim());
    }
  };

  // Camera scanner
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setShowCamera(true);

      if (!("BarcodeDetector" in window)) {
        toast.error("Scanner não suportado neste navegador.");
        return;
      }

      const detector = new (window as any).BarcodeDetector({
        formats: ["data_matrix", "qr_code", "code_128", "code_39", "pdf417", "ean_13", "ean_8"],
      });

      const recentCodes = new Set<string>();

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length === 0) return;

          const tbrBarcodes = barcodes.filter(
            (b: any) =>
              b.rawValue.toUpperCase().startsWith("TBR") &&
              isBarcodeInsideViewfinder(b, videoRef.current!, 0.2)
          );

          if (tbrBarcodes.length !== 1) return;

          const code = tbrBarcodes[0].rawValue.toUpperCase();
          if (recentCodes.has(code)) return;
          recentCodes.add(code);
          setTimeout(() => recentCodes.delete(code), 5000);

          setLastScannedCode(code);
          await processTbrRef.current?.(code);
        } catch {}
      }, 100);
    } catch {
      toast.error("Não foi possível acessar a câmera.");
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
    setLastScannedCode("");
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="space-y-4 p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <LifeBuoy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold italic">Socorrendo</h1>
          <p className="text-xs text-muted-foreground">
            Bipe os TBRs do motorista que precisa de socorro
          </p>
        </div>
      </div>

      {/* Input + Camera */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder="Digite ou bipe o TBR..."
              value={tbrInput}
              onChange={(e) => setTbrInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={isProcessing}
              className="font-mono uppercase"
              autoFocus
            />
            <Button
              size="icon"
              variant={showCamera ? "destructive" : "outline"}
              onClick={showCamera ? stopCamera : startCamera}
            >
              {showCamera ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            </Button>
          </div>

          {showCamera && (
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video ref={videoRef} className="w-full" playsInline muted />
              {/* Viewfinder overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-[20%] border-2 border-white/60 rounded-lg" />
              </div>
              {lastScannedCode && (
                <div className="absolute bottom-2 left-2 right-2 text-center">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {lastScannedCode}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {isProcessing && (
            <p className="text-xs text-muted-foreground text-center animate-pulse">
              Processando...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-bold">
          <Package className="h-3 w-3 mr-1" />
          {rescuedTbrs.length} TBR{rescuedTbrs.length !== 1 ? "s" : ""} transferido{rescuedTbrs.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* List of rescued TBRs */}
      {rescuedTbrs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic">TBRs Socorridos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            {rescuedTbrs.map((tbr) => (
              <div
                key={tbr.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-black text-white"
              >
                <Package className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-bold">{tbr.tbrCode}</p>
                  <div className="flex items-center gap-1 text-xs opacity-75">
                    <User className="h-3 w-3" />
                    <span className="truncate">{tbr.originalDriverName}</span>
                    <ArrowRight className="h-3 w-3 mx-0.5" />
                    <span className="truncate">{rescuerName}</span>
                  </div>
                </div>
                <span className="text-[10px] opacity-60 shrink-0">
                  {format(new Date(tbr.scannedAt), "HH:mm")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {rescuedTbrs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <LifeBuoy className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium italic">Nenhum TBR socorrido ainda</p>
          <p className="text-xs mt-1">Bipe um TBR de outro motorista para começar</p>
        </div>
      )}
    </div>
  );
};

export default DriverRescue;
