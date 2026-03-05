import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

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
  try {
    globalAudioCtx = new AudioContext();
    if (globalAudioCtx.state === "suspended") globalAudioCtx.resume();
  } catch {}
};

const DriverCallAlert = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;
  const unitId = unitSession?.id;

  const [isAlerting, setIsAlerting] = useState(false);
  const [calledByName, setCalledByName] = useState<string | null>(null);

  const initialLoadDoneRef = useRef(false);
  const lastCalledAtRef = useRef<string | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const beepWithWebAudio = useCallback(async () => {
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
      try {
        const audio = new Audio(BEEP_DATA_URI);
        audio.volume = 0.8;
        await audio.play().catch(() => {});
      } catch {}
    }
  }, []);

  const startAlert = useCallback(() => {
    setIsAlerting(true);
    initAudioContext();

    // Start beep loop
    beepWithWebAudio();
    if (!beepIntervalRef.current) {
      beepIntervalRef.current = setInterval(beepWithWebAudio, 1500);
    }

    // Start vibration loop
    if (!vibrationIntervalRef.current) {
      try { navigator.vibrate?.([500, 200, 500, 200, 500]); } catch {}
      vibrationIntervalRef.current = setInterval(() => {
        try { navigator.vibrate?.([500, 200, 500, 200, 500]); } catch {}
      }, 2000);
    }
  }, [beepWithWebAudio]);

  const stopAlert = useCallback(() => {
    setIsAlerting(false);
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    try { navigator.vibrate?.(0); } catch {}
  }, []);

  const checkCalledAt = useCallback(async () => {
    if (!driverId || !unitId) return;

    // Check queue entry
    const { data: queueEntry } = await supabase
      .from("queue_entries")
      .select("called_at, called_by_name")
      .eq("driver_id", driverId)
      .eq("unit_id", unitId)
      .in("status", ["waiting", "approved"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Also check via active ride's queue_entry
    let calledAt = queueEntry?.called_at ?? null;
    let callerName = queueEntry?.called_by_name ?? null;

    if (!calledAt) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: ride } = await supabase
        .from("driver_rides")
        .select("queue_entry_id")
        .eq("driver_id", driverId)
        .in("loading_status", ["pending", "loading"])
        .gte("completed_at", today.toISOString())
        .limit(1)
        .maybeSingle();

      if (ride?.queue_entry_id) {
        const { data: qe } = await supabase
          .from("queue_entries")
          .select("called_at, called_by_name")
          .eq("id", ride.queue_entry_id)
          .single();
        calledAt = qe?.called_at ?? null;
        callerName = qe?.called_by_name ?? null;
      }
    }

    if (!initialLoadDoneRef.current) {
      // First load: just store current value, don't alert
      initialLoadDoneRef.current = true;
      lastCalledAtRef.current = calledAt;
      return;
    }

    if (calledAt && calledAt !== lastCalledAtRef.current) {
      lastCalledAtRef.current = calledAt;
      setCalledByName(callerName);
      startAlert();
    } else if (!calledAt) {
      lastCalledAtRef.current = null;
    }
  }, [driverId, unitId, startAlert]);

  // Initial check
  useEffect(() => {
    checkCalledAt();
  }, [checkCalledAt]);

  // Realtime subscription
  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel(`driver-call-alert-${unitId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `unit_id=eq.${unitId}` }, () => {
        checkCalledAt();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, checkCalledAt]);

  // Also listen to driver_rides changes
  useEffect(() => {
    if (!driverId) return;
    const channel = supabase
      .channel(`driver-call-rides-${driverId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_rides", filter: `driver_id=eq.${driverId}` }, () => {
        checkCalledAt();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId, checkCalledAt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
      try { navigator.vibrate?.(0); } catch {}
    };
  }, []);

  if (!isAlerting) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 animate-in fade-in-0">
      <div className="bg-background border-2 border-destructive rounded-2xl p-8 mx-4 max-w-sm w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95">
        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
          <Bell className="h-10 w-10 text-destructive animate-bounce" />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-black text-destructive animate-pulse">
            🔔 SUA VEZ!
          </h2>
          <p className="text-muted-foreground text-sm">
            Dirija-se ao local de carregamento
          </p>
        </div>

        {calledByName && (
          <div className="rounded-lg bg-muted/50 border border-border p-3">
            <p className="text-sm text-muted-foreground">
              Conferente: <span className="font-bold text-foreground">{calledByName}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              vai carregar seu veículo.
            </p>
          </div>
        )}

        <Button
          onClick={stopAlert}
          size="lg"
          className="w-full h-14 text-lg font-bold gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
        >
          <CheckCircle className="h-6 w-6" />
          CIENTE
        </Button>
      </div>
    </div>
  );
};

export default DriverCallAlert;
