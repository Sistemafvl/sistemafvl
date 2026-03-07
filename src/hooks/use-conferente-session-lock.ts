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

  // Claim session: upsert into conferente_sessions
  const claimSession = useCallback(async (conferenteId: string) => {
    if (!unitSession?.id) return;
    const token = tokenRef.current;

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

  // Subscribe to realtime changes
  useEffect(() => {
    if (!unitSession?.id || !conferenteSession?.id) return;

    // Claim on mount/change
    claimSession(conferenteSession.id);

    const channel = supabase
      .channel(`conferente-lock-${unitSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conferente_sessions",
          filter: `conferente_id=eq.${conferenteSession.id}`,
        },
        (payload: any) => {
          const newRecord = payload.new;
          if (
            newRecord &&
            newRecord.session_token &&
            newRecord.session_token !== tokenRef.current
          ) {
            // Another tab/device took over
            toast.warning("Sua sessão de conferente foi assumida por outro dispositivo.", {
              duration: 5000,
            });
            setConferenteSession(null);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [unitSession?.id, conferenteSession?.id, claimSession, setConferenteSession]);

  // Cleanup on tab close
  useEffect(() => {
    const handleUnload = () => {
      if (conferenteSession?.id) {
        // Best-effort sync delete via sendBeacon
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
