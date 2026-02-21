import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPendingOps, removePendingOp, getPendingOpsCount, addPendingOp, type PendingOp } from "@/lib/offline-store";
import { toast } from "@/hooks/use-toast";

export function useOfflineSync(onSyncComplete?: () => void) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try { setPendingCount(await getPendingOpsCount()); } catch {}
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const syncPendingOps = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const ops = await getPendingOps();
      if (ops.length === 0) { setIsSyncing(false); syncingRef.current = false; return; }

      let synced = 0;
      for (const op of ops) {
        try {
          if (op.type === "insert") {
            await supabase.from(op.table as any).insert(op.data as any);
          } else if (op.type === "update") {
            const { id, ...rest } = op.data;
            await supabase.from(op.table as any).update(rest as any).eq("id", id);
          } else if (op.type === "delete") {
            await supabase.from(op.table as any).delete().eq("id", op.data.id);
          }
          if (op.id !== undefined) await removePendingOp(op.id);
          synced++;
        } catch (err) {
          console.error("Sync op failed:", err);
        }
      }

      if (synced > 0) {
        toast({ title: "Sincronizado", description: `${synced} operação(ões) sincronizada(s) com sucesso.` });
        onSyncComplete?.();
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      await refreshCount();
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [onSyncComplete, refreshCount]);

  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); syncPendingOps(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [syncPendingOps]);

  const queueOp = useCallback(async (op: Omit<PendingOp, "id">) => {
    await addPendingOp(op);
    await refreshCount();
  }, [refreshCount]);

  return { isOnline, pendingCount, isSyncing, queueOp, syncPendingOps, refreshCount };
}
