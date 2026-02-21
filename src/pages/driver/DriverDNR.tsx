import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileWarning, Clock, DollarSign, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface DnrEntry {
  id: string;
  conferente_name: string | null;
  loaded_at: string | null;
  dnr_value: number;
  status: string;
  created_at: string;
  route: string | null;
}

const DriverDNR = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;
  const [entries, setEntries] = useState<DnrEntry[]>([]);

  const fetchEntries = useCallback(async () => {
    if (!driverId) return;
    const { data } = await supabase
      .from("dnr_entries")
      .select("id, conferente_name, loaded_at, dnr_value, status, created_at, route")
      .eq("driver_id", driverId)
      .eq("status", "analyzing")
      .order("created_at", { ascending: false });
    setEntries((data ?? []) as DnrEntry[]);
  }, [driverId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    if (!driverId) return;
    const channel = supabase
      .channel("driver-dnr-" + driverId)
      .on("postgres_changes", { event: "*", schema: "public", table: "dnr_entries", filter: `driver_id=eq.${driverId}` }, () => fetchEntries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [driverId, fetchEntries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileWarning className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold italic">DNR</h1>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-12">Nenhum DNR pendente.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id} className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className="bg-amber-500 text-white text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" /> Tratar com urgência
                  </Badge>
                  <span className="text-lg font-bold text-destructive">R${Number(entry.dnr_value).toFixed(2)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <div><strong>Carregado em:</strong> {entry.loaded_at ? format(new Date(entry.loaded_at), "dd/MM/yyyy") : "—"}</div>
                  <div><strong>Dia:</strong> {entry.loaded_at ? format(new Date(entry.loaded_at), "EEEE", { locale: undefined }) : "—"}</div>
                  <div><strong>Conferente:</strong> {entry.conferente_name || "—"}</div>
                  <div><strong>Rota:</strong> {entry.route || "—"}</div>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold italic mt-2">
                  ⚠️ Procure o gerente para tratar este DNR antes que seja descontado.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverDNR;
