import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

const SESSION_TOKEN_KEY = "conferente_session_token";

function getOrCreateSessionToken(): string {
  let token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
  return token;
}

export function useConferenteSessionLock() {
  const { unitSession, conferenteSession, setConferenteSession } = useAuthStore();
  const tokenRef = useRef<string>(getOrCreateSessionToken());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  const kickedRef = useRef(false);

  // Claim session: upsert into conferente_sessions
  const claimSession = useCallback(async (conferenteId: string) => {
    if (!unitSession?.id) return;
    const token = tokenRef.current;
    kickedRef.current = false;

    const { error } = await supabase
      .from("conferente_sessions" as any)
      .upsert(
        {
          conferente_id: conferenteId,
          unit_id: unitSession.id,
          session_token: token,
          started_at: new Date().toISOString(),
        },
        { onConflict: "conferente_id" }
      );

    if (error) {
      console.error("Failed to claim conferente session:", error);
    }
  }, [unitSession?.id]);

  // Release session
  const releaseSession = useCallback(async (conferenteId: string) => {
    await supabase
      .from("conferente_sessions" as any)
      .delete()
      .eq("conferente_id", conferenteId)
      .eq("session_token", tokenRef.current);
  }, []);

  // Handle kick: another device took the session
  const handleKick = useCallback(() => {
    if (kickedRef.current) return;
    kickedRef.current = true;
    toast.warning("Sua sessão de conferente foi assumida por outro dispositivo.", {
      duration: 5000,
    });
    setConferenteSession(null);
  }, [setConferenteSession]);

  // Subscribe to realtime only (no polling fallback to reduce Cloud consumption)
  useEffect(() => {
    if (!unitSession?.id || !conferenteSession?.id) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const conferenteId = conferenteSession.id;
    const myToken = tokenRef.current;

    // Claim on mount/change
    claimSession(conferenteId);

    // Realtime subscription with unique channel name per tab
    const channelName = `conferente-lock-${conferenteId}-${myToken.slice(0, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conferente_sessions",
          filter: `conferente_id=eq.${conferenteId}`,
        },
        (payload: any) => {
          const newRecord = payload.new;
          if (
            newRecord &&
            newRecord.session_token &&
            newRecord.session_token !== myToken
          ) {
            handleKick();
          }
        }
      )
      .subscribe((status) => {
        console.log(`Conferente lock channel status: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [unitSession?.id, conferenteSession?.id, claimSession, handleKick]);

  // Cleanup on tab close
  useEffect(() => {
    const handleUnload = () => {
      if (conferenteSession?.id) {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/conferente_sessions?conferente_id=eq.${conferenteSession.id}&session_token=eq.${tokenRef.current}`;
        fetch(url, {
          method: "DELETE",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          keepalive: true,
        });
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [conferenteSession?.id]);

  return { claimSession, releaseSession };
}
