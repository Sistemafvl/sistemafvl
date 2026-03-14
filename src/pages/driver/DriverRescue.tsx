import { useState, useCallback, useEffect } from "react";
import { LifeBuoy, Package, ArrowRight, User, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import TbrScanner from "@/components/ui/TbrScanner";

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

  const [rescuedTbrs, setRescuedTbrs] = useState<RescuedTbr[]>([]);

  // Date filter
  const [dateFrom, setDateFrom] = useState<Date>(startOfDay(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfDay(new Date()));
  const [showFromCal, setShowFromCal] = useState(false);
  const [showToCal, setShowToCal] = useState(false);

  const fetchRescueEntries = useCallback(async () => {
    if (!unitId || !rescuerDriverId) return;

    const { data } = await supabase
      .from("rescue_entries")
      .select("id, tbr_code, original_driver_id, original_ride_id, rescuer_ride_id, rescuer_driver_id, created_at, scanned_at")
      .eq("unit_id", unitId)
      .eq("rescuer_driver_id", rescuerDriverId)
      .gte("created_at", dateFrom.toISOString())
      .lte("created_at", dateTo.toISOString())
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      setRescuedTbrs([]);
      return;
    }

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
  }, [unitId, rescuerDriverId, dateFrom, dateTo]);

  useEffect(() => {
    fetchRescueEntries();
  }, [fetchRescueEntries]);

  const handleScan = useCallback(async (code: string): Promise<boolean> => {
    if (!unitId || !rescuerDriverId) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayRides } = await supabase
      .from("driver_rides")
      .select("id, driver_id")
      .eq("unit_id", unitId)
      .gte("completed_at", today.toISOString());

    if (!todayRides || todayRides.length === 0) {
      toast.error("Nenhum carregamento encontrado hoje.");
      return false;
    }

    const rideIds = todayRides.map((r) => r.id);
    const rideMap = new Map(todayRides.map((r) => [r.id, r.driver_id]));

    const { data: matchingTbrs } = await supabase
      .from("ride_tbrs")
      .select("id, ride_id, code, trip_number")
      .in("ride_id", rideIds)
      .ilike("code", code);

    if (!matchingTbrs || matchingTbrs.length === 0) {
      toast.error(`TBR ${code} não encontrado em nenhum carregamento de hoje.`);
      return false;
    }

    const originalTbr = matchingTbrs[0];
    const originalDriverId = rideMap.get(originalTbr.ride_id);

    if (originalDriverId === rescuerDriverId) {
      toast.error("Este TBR já está no seu carregamento.");
      return false;
    }

    const { data: rescuerRides } = await supabase
      .from("driver_rides")
      .select("id, loading_status")
      .eq("unit_id", unitId)
      .eq("driver_id", rescuerDriverId)
      .gte("completed_at", today.toISOString())
      .order("completed_at", { ascending: false });

    if (!rescuerRides || rescuerRides.length === 0) {
      toast.error("Você não tem carregamento ativo hoje. Entre na fila primeiro.");
      return false;
    }

    const activeRide =
      rescuerRides.find((r) => r.loading_status === "loading") ??
      rescuerRides.find((r) => r.loading_status === "finished") ??
      rescuerRides[0];

    await supabase.from("ride_tbrs").delete().eq("id", originalTbr.id);

    await supabase.from("ride_tbrs").insert({
      ride_id: activeRide.id,
      code: originalTbr.code,
      trip_number: originalTbr.trip_number,
      is_rescue: true,
    });

    await supabase.from("rescue_entries").insert({
      unit_id: unitId,
      rescuer_driver_id: rescuerDriverId,
      original_driver_id: originalDriverId!,
      original_ride_id: originalTbr.ride_id,
      rescuer_ride_id: activeRide.id,
      tbr_code: code,
    });

    const { data: driverData } = await supabase
      .from("drivers_public")
      .select("name")
      .eq("id", originalDriverId!)
      .single();

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
    return true;
  }, [unitId, rescuerDriverId]);

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

      {/* Date Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={showFromCal} onOpenChange={setShowFromCal}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(dateFrom, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(d) => { if (d) { setDateFrom(startOfDay(d)); setShowFromCal(false); } }}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">até</span>
        <Popover open={showToCal} onOpenChange={setShowToCal}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(dateTo, "dd/MM/yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(d) => { if (d) { setDateTo(endOfDay(d)); setShowToCal(false); } }}
              locale={ptBR}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <div className="flex gap-1 ml-auto">
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => { setDateFrom(startOfDay(new Date())); setDateTo(endOfDay(new Date())); }}>Hoje</Button>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => { setDateFrom(startOfDay(subDays(new Date(), 7))); setDateTo(endOfDay(new Date())); }}>7d</Button>
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => { setDateFrom(startOfDay(subDays(new Date(), 30))); setDateTo(endOfDay(new Date())); }}>30d</Button>
        </div>
      </div>

      {/* Scanner */}
      <Card>
        <CardContent className="p-4">
          <TbrScanner onScan={handleScan} placeholder="Digite ou bipe o TBR..." />
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
                className="flex items-center gap-3 p-2.5 rounded-lg bg-foreground text-background"
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
