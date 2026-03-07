import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, X } from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";

interface InsucessoItem {
  id: string;
  tbr_code: string;
  route: string | null;
  driver_name: string | null;
  created_at: string;
  reason: string;
}

const InsucessoBalloon = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;
  const [items, setItems] = useState<InsucessoItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prevCount, setPrevCount] = useState(0);

  const fetchInsucessos = useCallback(async () => {
    if (!unitId) return;

    const todayStart = startOfDay(new Date()).toISOString();
    const yesterdayEnd = todayStart;

    // Get piso entries from before today with operational reasons and open status
    const { data: pisoData } = await supabase
      .from("piso_entries")
      .select("id, tbr_code, route, driver_name, created_at, reason")
      .eq("unit_id", unitId)
      .eq("status", "open")
      .lt("created_at", yesterdayEnd)
      .order("created_at", { ascending: false });

    if (!pisoData || pisoData.length === 0) {
      setItems([]);
      return;
    }

    // Check which TBRs have already been scanned today
    const tbrCodes = pisoData.map(p => p.tbr_code.toUpperCase());
    const { data: scannedToday } = await supabase
      .from("ride_tbrs")
      .select("code")
      .gte("scanned_at", todayStart)
      .in("code", tbrCodes);

    const scannedSet = new Set((scannedToday ?? []).map(s => s.code.toUpperCase()));
    const pending = pisoData.filter(p => !scannedSet.has(p.tbr_code.toUpperCase()));

    setItems(pending);
  }, [unitId]);

  useEffect(() => {
    fetchInsucessos();
    const interval = setInterval(fetchInsucessos, 60000);
    return () => clearInterval(interval);
  }, [fetchInsucessos]);

  // Realtime: when a ride_tbr is inserted, refetch
  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("insucesso-balloon")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ride_tbrs" }, () => {
        fetchInsucessos();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchInsucessos]);

  // If count changes after dismiss, re-show
  useEffect(() => {
    if (items.length !== prevCount && dismissed) {
      setDismissed(false);
    }
    setPrevCount(items.length);
  }, [items.length]);

  if (items.length === 0 || dismissed) return null;

  // Group by route
  const grouped = items.reduce<Record<string, InsucessoItem[]>>((acc, item) => {
    const key = item.route || "Sem rota";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <>
      {/* Floating balloon */}
      <div className="fixed bottom-[120px] right-6 z-50 flex items-center gap-1">
        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-white shadow-lg hover:bg-amber-600 transition-all text-sm font-bold"
        >
          <AlertTriangle className="h-4 w-4" />
          {items.length} Insucesso{items.length !== 1 ? "s" : ""}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          className="rounded-full bg-muted p-1 shadow hover:bg-muted-foreground/20 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Detail sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-bold italic flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Insucessos Pendentes ({items.length})
            </SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            TBRs de dias anteriores que ainda precisam retornar à rua. Conforme são lidos no carregamento, saem desta lista.
          </p>
          <div className="space-y-4">
            {Object.entries(grouped).sort((a, b) => b[1].length - a[1].length).map(([route, entries]) => (
              <div key={route} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-bold">{route}</Badge>
                  <span className="text-xs text-muted-foreground">{entries.length} TBR{entries.length !== 1 ? "s" : ""}</span>
                </div>
                {entries.map((item) => (
                  <div key={item.id} className="pl-3 border-l-2 border-amber-400 py-1 space-y-0.5">
                    <p className="text-sm font-mono font-bold">{item.tbr_code}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {item.driver_name && <span>{item.driver_name}</span>}
                      <span>{format(new Date(item.created_at), "dd/MM HH:mm")}</span>
                    </div>
                    <p className="text-xs text-amber-600">{item.reason}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default InsucessoBalloon;
