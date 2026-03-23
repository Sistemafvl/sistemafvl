import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";

interface CallData {
  id: string;
  driver_name: string;
  driver_avatar: string | null;
  called_at: string | null;
  called_by_name: string | null;
  sequence_number?: number;
  route?: string;
  parking_spot?: string;
}

// --------------- Web Audio API Siren (6 seconds) ---------------
const playSiren = (): (() => void) => {
  try {
    const ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 800;
    gain.gain.value = 0.7;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const interval = setInterval(() => {
      osc.frequency.value = osc.frequency.value === 800 ? 1200 : 800;
    }, 400);

    osc.start();

    // Auto-stop after 6 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval);
      try { osc.stop(); } catch {}
      try { osc.disconnect(); gain.disconnect(); ctx.close(); } catch {}
    }, 6000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      try { osc.stop(); } catch {}
      try { osc.disconnect(); gain.disconnect(); ctx.close(); } catch {}
    };
  } catch {
    return () => {};
  }
};

const CallingPanelPage = () => {
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get("unit_id");
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [showCall, setShowCall] = useState(false);
  const stopSirenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!unitId) return;

    const fetchRecentCall = async () => {
      const { data } = await supabase
        .from("queue_entries")
        .select(`
          id,
          called_at,
          called_by_name,
          parking_spot,
          driver:driver_id (name, avatar_url),
          rides:driver_rides (sequence_number, route)
        `)
        .eq("unit_id", unitId)
        .not("called_at", "is", null)
        .order("called_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const entry = data[0] as any;
        if (new Date(entry.called_at!).getTime() > Date.now() - 10000) {
          triggerCall(entry);
        }
      }
    };

    fetchRecentCall();

    const channel = supabase
      .channel("calling-panel")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "queue_entries",
          filter: `unit_id=eq.${unitId}`,
        },
        async (payload) => {
          const newEntry = payload.new as any;
          if (newEntry.called_at && newEntry.called_at !== (payload.old as any).called_at) {
            const { data } = await supabase
              .from("queue_entries")
              .select(`
                id,
                called_at,
                called_by_name,
                parking_spot,
                driver:driver_id (name, avatar_url),
                rides:driver_rides (sequence_number, route)
              `)
              .eq("id", newEntry.id)
              .single();

            if (data) triggerCall(data as any);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId]);

  const triggerCall = useCallback((data: any) => {
    const formatted: CallData = {
      id: data.id,
      driver_name: data.driver?.name || "Motorista",
      driver_avatar: data.driver?.avatar_url,
      called_at: data.called_at,
      called_by_name: data.called_by_name,
      parking_spot: data.parking_spot,
      sequence_number: data.rides?.[0]?.sequence_number,
      route: data.rides?.[0]?.route,
    };

    setCurrentCall(formatted);
    setShowCall(true);

    // Stop previous siren if any
    if (stopSirenRef.current) stopSirenRef.current();
    stopSirenRef.current = playSiren();

    // Hide after 7 seconds
    setTimeout(() => setShowCall(false), 7000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stopSirenRef.current) stopSirenRef.current();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#001529] text-white flex overflow-hidden font-sans select-none">
      <div className="flex-1 relative flex items-center justify-center p-12">
        <AnimatePresence mode="wait">
          {showCall && currentCall ? (
            <motion.div
              key="call"
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1, y: -50 }}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
              className="w-full max-w-4xl flex flex-col items-center text-center gap-8"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -top-4 -left-4 w-20 h-20 bg-red-600 rounded-full flex items-center justify-center text-4xl font-black border-4 border-white shadow-xl z-10"
                >
                  {currentCall.sequence_number || "—"}
                </motion.div>

                <div className="w-64 h-64 rounded-full border-8 border-[#0095ff] p-2 shadow-[0_0_50px_rgba(0,149,255,0.3)] bg-[#001529]">
                  <Avatar className="w-full h-full">
                    {currentCall.driver_avatar && <AvatarImage src={currentCall.driver_avatar} className="object-cover" />}
                    <AvatarFallback className="bg-primary/20 text-primary text-7xl font-bold">
                      {currentCall.driver_name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <div className="space-y-4">
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-8xl font-black italic tracking-tighter"
                >
                  SUA VEZ!
                </motion.h1>

                <div className="space-y-2">
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-5xl font-bold text-white uppercase"
                  >
                    {currentCall.driver_name}
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col gap-1 text-2xl text-[#0095ff] font-medium uppercase tracking-widest"
                  >
                    <span>CONFERENTE: {currentCall.called_by_name || "—"}</span>
                    <span>VAGA: {currentCall.parking_spot || currentCall.sequence_number || "—"}</span>
                    <span className="text-white bg-[#0095ff]/20 px-4 py-1 rounded-lg self-center mt-2 border border-[#0095ff]/30">
                      ROTA: {currentCall.route || "NAO DEFINIDA"}
                    </span>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center"
            >
              <motion.img
                src="/logos/fvl_panel_bg.png"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1 }}
                className="max-h-[70vh] max-w-[85vw] object-contain filter drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showCall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-transparent animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CallingPanelPage;
