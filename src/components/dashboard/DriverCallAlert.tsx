import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

// --------------- Continuous siren via Web Audio API ---------------
let globalAudioCtx: AudioContext | null = null;

const ensureAudioCtx = (): AudioContext => {
  if (!globalAudioCtx) globalAudioCtx = new AudioContext();
  if (globalAudioCtx.state === "suspended") globalAudioCtx.resume();
  return globalAudioCtx;
};

// Unlock AudioContext on first user gesture
if (typeof document !== "undefined") {
  const unlock = () => {
    try { ensureAudioCtx(); } catch {}
    document.removeEventListener("click", unlock);
    document.removeEventListener("touchstart", unlock);
  };
  document.addEventListener("click", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true });
}

/** Starts a continuous alternating siren (800Hz ↔ 1200Hz) and returns a stop function */
const startSiren = (): (() => void) => {
  try {
    const ctx = ensureAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 800;
    gain.gain.value = 0.45;
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Alternate between 800Hz and 1200Hz every 0.4s for siren effect
    const interval = setInterval(() => {
      osc.frequency.value = osc.frequency.value === 800 ? 1200 : 800;
    }, 400);

    osc.start();

    return () => {
      clearInterval(interval);
      try { osc.stop(); } catch {}
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };
  } catch {
    // Fallback: HTML5 Audio loop with generated WAV
    const audio = createFallbackAudio();
    audio.loop = true;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }
};

/** Generate a short WAV beep for fallback */
const createFallbackAudio = (): HTMLAudioElement => {
  const sampleRate = 8000;
  const duration = 0.8;
  const numSamples = Math.floor(sampleRate * duration);
  const fileSize = 44 + numSamples;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); view.setUint32(4, fileSize - 8, true); w(8, "WAVE");
  w(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  w(36, "data"); view.setUint32(40, numSamples, true);
  for (let i = 0; i < numSamples; i++) {
    const freq = i < numSamples / 2 ? 800 : 1200;
    view.setUint8(44 + i, 128 + Math.round(80 * Math.sin(2 * Math.PI * freq * i / sampleRate)));
  }
  const bytes = new Uint8Array(buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return new Audio("data:audio/wav;base64," + btoa(bin));
};

// --------------- Component ---------------
const DriverCallAlert = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;
  const unitId = unitSession?.id;

  const [isAlerting, setIsAlerting] = useState(false);
  const [calledByName, setCalledByName] = useState<string | null>(null);

  const initialLoadDoneRef = useRef(false);
  const lastCalledAtRef = useRef<string | null>(null);
  const stopSirenRef = useRef<(() => void) | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAlert = useCallback((callerName: string | null) => {
    setIsAlerting(true);

    // Trigger native Web Notification if allowed
    if ("Notification" in window && Notification.permission === "granted") {
      const title = "🔔 SUA VEZ!";
      const options: any = {
        body: callerName ? `Conferente ${callerName} te chamou. Dirija-se ao local de carregamento.` : "Dirija-se ao local de carregamento.",
        icon: "/icon-192x192.png", // PWA default icon naming
        vibrate: [500, 200, 500, 200, 500],
        requireInteraction: true,
      };

      // Always show notification, even if app is active
      try {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, options);
          });
        } else {
          new Notification(title, options as any); // fallback for non-SW browsers
        }
      } catch (e) {
        new Notification(title, options as any); // extreme fallback
      }
    }

    // Start continuous siren
    if (!stopSirenRef.current) {
      stopSirenRef.current = startSiren();
    }

    // Start continuous vibration
    if (!vibrationIntervalRef.current) {
      try { navigator.vibrate?.([500, 200, 500, 200, 500]); } catch {}
      vibrationIntervalRef.current = setInterval(() => {
        try { navigator.vibrate?.([500, 200, 500, 200, 500]); } catch {}
      }, 2000);
    }
  }, []);

  const stopAlert = useCallback(() => {
    setIsAlerting(false);
    if (stopSirenRef.current) {
      stopSirenRef.current();
      stopSirenRef.current = null;
    }
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    try { navigator.vibrate?.(0); } catch {}
  }, []);

  const checkCalledAt = useCallback(async () => {
    if (!driverId || !unitId) return;

    let calledAt: string | null = null;
    let callerName: string | null = null;

    // 1) Check active queue entry (waiting/approved)
    const { data: queueEntry } = await supabase
      .from("queue_entries")
      .select("called_at, called_by_name")
      .eq("driver_id", driverId)
      .eq("unit_id", unitId)
      .in("status", ["waiting", "approved"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    calledAt = queueEntry?.called_at ?? null;
    callerName = queueEntry?.called_by_name ?? null;

    // 2) Also check via active ride's queue_entry
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

    // GUARD: Only valid call if BOTH called_at AND called_by_name exist
    const isValidCall = !!calledAt && !!callerName;

    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      lastCalledAtRef.current = calledAt;
      return;
    }

    if (isValidCall && calledAt !== lastCalledAtRef.current) {
      lastCalledAtRef.current = calledAt;
      setCalledByName(callerName);
      startAlert(callerName);
    } else if (!calledAt) {
      lastCalledAtRef.current = null;
    }
  }, [driverId, unitId, startAlert]);

  // Initial check
  useEffect(() => {
    checkCalledAt();
  }, [checkCalledAt]);

  // Realtime: queue_entries
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

  // Realtime: driver_rides
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
      if (stopSirenRef.current) stopSirenRef.current();
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
