import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Clock, CalendarCheck } from "lucide-react";

interface QueueEntry {
  id: string;
  driver_id: string;
  unit_id: string;
  status: string;
  joined_at: string;
  driver_name?: string;
}

const QueuePanel = () => {
  const { unitSession } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<QueueEntry[]>([]);

  const unitId = unitSession?.id;

  const fetchQueue = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("unit_id", unitId)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true });

    if (!data) { setEntries([]); return; }

    // Fetch driver names
    const driverIds = data.map((e) => e.driver_id);
    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, name")
      .in("id", driverIds);

    const driverMap = new Map((drivers ?? []).map((d) => [d.id, d.name]));
    setEntries(
      data.map((e) => ({ ...e, driver_name: driverMap.get(e.driver_id) ?? "Motorista" }))
    );
  }, [unitId]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  // Realtime subscription
  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("queue-panel-" + unitId)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "queue_entries",
        filter: `unit_id=eq.${unitId}`,
      }, () => { fetchQueue(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchQueue]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const handleProgramar = async (entry: QueueEntry) => {
    // Mark queue entry as completed
    await supabase
      .from("queue_entries")
      .update({ status: "completed", called_at: new Date().toISOString(), completed_at: new Date().toISOString() })
      .eq("id", entry.id);

    // Register the ride
    await supabase.from("driver_rides").insert({
      driver_id: entry.driver_id,
      unit_id: entry.unit_id,
      queue_entry_id: entry.id,
    });

    fetchQueue();
  };

  const count = entries.length;

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
      >
        <Users className="h-5 w-5" />
        <span className="font-bold italic text-sm">Fila</span>
        {count > 0 && (
          <Badge variant="secondary" className="ml-1 h-6 w-6 p-0 flex items-center justify-center rounded-full text-xs font-bold">
            {count}
          </Badge>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[380px] sm:w-[420px] p-0 flex flex-col">
          <SheetHeader className="p-4 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2 font-bold italic">
              <Users className="h-5 w-5 text-primary" />
              Fila de Motoristas
              {count > 0 && (
                <Badge variant="default" className="ml-auto">{count} na fila</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {entries.length === 0 ? (
              <div className="text-center text-muted-foreground italic py-12 text-sm">
                Nenhum motorista na fila
              </div>
            ) : (
              entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                      {(entry.driver_name ?? "M")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {idx + 1}º — {entry.driver_name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Entrada: {formatTime(entry.joined_at)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="shrink-0 font-bold italic text-xs"
                    onClick={() => handleProgramar(entry)}
                  >
                    <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                    Programar
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default QueuePanel;
