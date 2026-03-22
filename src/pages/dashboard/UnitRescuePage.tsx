import { useState, useCallback, useEffect, useRef } from "react";
import { LifeBuoy, Package, ArrowRight, User, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn, getBrazilDayRange } from "@/lib/utils";

interface DriverRideInfo {
  rideId: string;
  driverId: string;
  driverName: string;
  loadingStatus: string | null;
}

interface TbrItem {
  id: string;
  code: string;
  tripNumber: number;
}

const UnitRescuePage = () => {
  const { unitSession, conferenteSession } = useAuthStore();
  const unitId = unitSession?.id;

  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [activeRides, setActiveRides] = useState<DriverRideInfo[]>([]);
  
  const [sourceDriverId, setSourceDriverId] = useState<string>("");
  const [targetDriverId, setTargetDriverId] = useState<string>("");
  
  const [sourceTbrs, setSourceTbrs] = useState<TbrItem[]>([]);
  const [loadingTbrs, setLoadingTbrs] = useState(false);
  const [selectedTbrIds, setSelectedTbrIds] = useState<Set<string>>(new Set());
  const [transferring, setTransferring] = useState(false);

  const [searchActive, setSearchActive] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const tbrRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Fetch today's active rides/drivers
  const fetchDrivers = useCallback(async () => {
    if (!unitId) return;
    setLoadingDrivers(true);
    const { start: todayStart } = getBrazilDayRange();

    const { data: rides, error } = await supabase
      .from("driver_rides")
      .select(`
        id, driver_id, loading_status, completed_at,
        drivers_public(name)
      `)
      .eq("unit_id", unitId)
      .gte("completed_at", todayStart)
      .neq("loading_status", "cancelled")
      .order("completed_at", { ascending: false });

    if (error) {
      console.error("Error fetching drivers:", error);
      setLoadingDrivers(false);
      return;
    }

    if (rides) {
      const driverMap = new Map<string, DriverRideInfo>();
      const activeFirst = (a: any, b: any) => {
        // Prioritize loading/pending over finished
        const isAActive = ["loading", "pending"].includes(a.loading_status);
        const isBActive = ["loading", "pending"].includes(b.loading_status);
        if (isAActive && !isBActive) return -1;
        if (!isAActive && isBActive) return 1;
        return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
      };

      [...rides].sort(activeFirst).forEach((r: any) => {
        if (!driverMap.has(r.driver_id)) {
          driverMap.set(r.driver_id, {
            rideId: r.id,
            driverId: r.driver_id,
            driverName: r.drivers_public?.name ?? "Desconhecido",
            loadingStatus: r.loading_status,
          });
        }
      });
      setActiveRides(Array.from(driverMap.values()));
    }
    setLoadingDrivers(false);
  }, [unitId]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Auto-refresh drivers list every 30 seconds to avoid stale rideIds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchDrivers();
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchDrivers]);

  // Fetch TBRs for source driver
  useEffect(() => {
    if (!sourceDriverId || !unitId) {
      setSourceTbrs([]);
      setSelectedTbrIds(new Set());
      return;
    }

    const fetchTbrs = async () => {
      setLoadingTbrs(true);
      const sourceInfo = activeRides.find(r => r.driverId === sourceDriverId);
      if (!sourceInfo) return;

      const { data } = await supabase
        .from("ride_tbrs")
        .select("id, code, trip_number")
        .eq("ride_id", sourceInfo.rideId)
        .order("trip_number", { ascending: true });

      setSourceTbrs(data?.map(t => ({ id: t.id, code: t.code, tripNumber: t.trip_number ?? 1 })) ?? []);
      setSelectedTbrIds(new Set());
      setLoadingTbrs(false);
    };
    fetchTbrs();
  }, [sourceDriverId, activeRides, unitId]);

  const toggleAll = () => {
    if (selectedTbrIds.size === sourceTbrs.length) {
      setSelectedTbrIds(new Set());
    } else {
      setSelectedTbrIds(new Set(sourceTbrs.map(t => t.id)));
    }
  };

  const toggleTbr = (id: string) => {
    const newSelected = new Set(selectedTbrIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedTbrIds(newSelected);
  };

  const handleTransfer = async () => {
    if (!unitId || !sourceDriverId || !targetDriverId || selectedTbrIds.size === 0) return;
    if (sourceDriverId === targetDriverId) {
      toast.error("O motorista socorrido e o socorrista não podem ser o mesmo.");
      return;
    }

    const sourceInfo = activeRides.find(r => r.driverId === sourceDriverId);
    const targetInfo = activeRides.find(r => r.driverId === targetDriverId);
    if (!sourceInfo || !targetInfo) {
      toast.error("Erro ao identificar os carregamentos dos motoristas.");
      return;
    }

    setTransferring(true);
    try {
      const selectedTbrsData = sourceTbrs.filter(t => selectedTbrIds.has(t.id));
      const tbrIds = selectedTbrsData.map(t => t.id);

      // ATOMIC UPDATE: Move TBRs to target ride and mark as rescue
      // This preserves metadata like scanned_at and avoids data loss risks from delete+insert
      console.log(`[Socorrendo] Moving ${tbrIds.length} TBRs from ride ${sourceInfo.rideId} to ${targetInfo.rideId}`);
      
      const { error: moveError } = await supabase
        .from("ride_tbrs")
        .update({ 
          ride_id: targetInfo.rideId,
          is_rescue: true,
          // Optional: we could update scanned_at to now() to reflect transfer time
          // scanned_at: new Date().toISOString() 
        })
        .in("id", tbrIds);

      if (moveError) throw moveError;

      // 2. Log into rescue_entries
      const rescueLogs = selectedTbrsData.map(t => ({
        unit_id: unitId,
        rescuer_driver_id: targetInfo.driverId,
        original_driver_id: sourceInfo.driverId,
        original_ride_id: sourceInfo.rideId,
        rescuer_ride_id: targetInfo.rideId,
        tbr_code: t.code,
      }));
      
      const { error: logError } = await supabase.from("rescue_entries").insert(rescueLogs);
      if (logError) {
        console.warn("Rescue logged but entry failed:", logError);
        // We don't throw here because packages are already moved
      }

      // 3. Update target ride to "loading" if it was "pending"
      if (targetInfo.loadingStatus === "pending") {
        const updateData: any = { 
          loading_status: "loading",
          started_at: new Date().toISOString()
        };
        if (conferenteSession?.id) {
          updateData.conferente_id = conferenteSession.id;
        }
        const { error: rideError } = await supabase.from("driver_rides").update(updateData).eq("id", targetInfo.rideId);
        if (rideError) console.warn("Failed to update target ride status:", rideError);
      }

      toast.success(`${selectedTbrIds.size} TBR(s) transferido(s) com sucesso!`);
      // Update local state and refresh to ensure consistency
      setSourceTbrs(prev => prev.filter(t => !selectedTbrIds.has(t.id)));
      setSelectedTbrIds(new Set());
      fetchDrivers(); // Refresh drivers list to get latest status
      
    } catch (err: any) {
      console.error("[Socorrendo] Transfer error:", err);
      toast.error(`Erro ao transferir os pacotes: ${err.message || "Erro desconhecido"}`);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <LifeBuoy className="h-6 w-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black italic tracking-tight text-foreground">Socorrendo</h1>
          <p className="text-sm text-muted-foreground font-medium">Transfira pacotes de um motorista para outro</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Configuration */}
        <Card className="border-orange-500/20 shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-orange-600" />
              Motorista Socorrido (Origem)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Select disabled={loadingDrivers} value={sourceDriverId} onValueChange={setSourceDriverId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingDrivers ? "Carregando motoristas..." : "Selecione o motorista"} />
              </SelectTrigger>
              <SelectContent>
                {activeRides.map(r => (
                  <SelectItem key={r.driverId} value={r.driverId}>
                    {r.driverName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Selecione o motorista que <strong>repassou</strong> os pacotes.
            </p>
          </CardContent>
        </Card>

        {/* Target Configuration */}
        <Card className="border-green-500/20 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-6 opacity-10">
            <ArrowRight className="h-32 w-32" />
          </div>
          <CardHeader className="pb-3 border-b bg-green-50/50 dark:bg-green-900/10 z-10 relative">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-green-600" />
              Motorista Socorrista (Destino)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 z-10 relative">
            <Select disabled={loadingDrivers} value={targetDriverId} onValueChange={setTargetDriverId}>
              <SelectTrigger className="border-green-200 focus-visible:ring-green-500">
                <SelectValue placeholder={loadingDrivers ? "Carregando motoristas..." : "Selecione o motorista"} />
              </SelectTrigger>
              <SelectContent>
                {activeRides.map(r => (
                  <SelectItem key={r.driverId} value={r.driverId} disabled={r.driverId === sourceDriverId}>
                    {r.driverName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Selecione o motorista que <strong>recebeu</strong> os pacotes.
            </p>
          </CardContent>
        </Card>
      </div>

      {sourceDriverId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Selecione os TBRs para transferir
              </CardTitle>
              <p className="text-xs text-muted-foreground">Pacotes atualmente carregados no motorista origem.</p>
            </div>
            <div className="flex gap-2 items-center">
              {searchActive && (
                <Input
                  className="h-8 text-xs font-mono w-48 sm:w-64"
                  placeholder="Bipar ou digitar TBR..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = searchInput.trim().toUpperCase();
                      const found = sourceTbrs.find(t => t.code.toUpperCase() === val);
                      if (found) {
                        setSelectedTbrIds(prev => {
                          const current = new Set(prev);
                          current.add(found.id);
                          return current;
                        });
                        const rowEl = tbrRowRefs.current[found.id];
                        if (rowEl) {
                          rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                        setSearchInput("");
                      }
                    }
                  }}
                  autoFocus
                />
              )}
              <button
                onClick={() => {
                  setSearchActive(prev => !prev);
                  setSearchInput("");
                }}
                className={cn("h-8 w-8 flex items-center justify-center rounded transition-colors", searchActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground")}
                title="Buscar TBR"
              >
                <Search className="h-4 w-4" />
              </button>
              <Badge variant="secondary" className="font-bold h-8 flex items-center">
                {sourceTbrs.length} pacotes
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTbrs ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sourceTbrs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Nenhum pacote encontrado.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md overflow-hidden max-h-[400px] overflow-y-auto relative">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          <Checkbox
                            checked={selectedTbrIds.size === sourceTbrs.length && sourceTbrs.length > 0}
                            onCheckedChange={toggleAll}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <TableHead className="font-bold">Ciclo</TableHead>
                        <TableHead className="font-bold">Código TBR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourceTbrs
                        .filter(tbr => !searchActive || !searchInput.trim() || tbr.code.toUpperCase().includes(searchInput.trim().toUpperCase()))
                        .map((tbr) => (
                        <TableRow 
                          key={tbr.id} 
                          ref={(el) => { tbrRowRefs.current[tbr.id] = el; }}
                          className={cn("transition-colors", selectedTbrIds.has(tbr.id) ? "bg-primary/5" : "hover:bg-muted/50")}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={selectedTbrIds.has(tbr.id)}
                              onCheckedChange={() => toggleTbr(tbr.id)}
                              aria-label={`Selecionar ${tbr.code}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground text-xs">{tbr.tripNumber}</TableCell>
                          <TableCell className="font-mono font-bold">{tbr.code}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm font-medium text-muted-foreground">
                    <strong className="text-foreground">{selectedTbrIds.size}</strong> pacotes selecionados
                  </p>
                  <Button 
                    onClick={handleTransfer} 
                    disabled={selectedTbrIds.size === 0 || !targetDriverId || transferring}
                    className="gap-2 font-bold px-8 shadow-md hover:shadow-lg transition-all"
                  >
                    {transferring ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Transferindo...</>
                    ) : (
                      <><ArrowRight className="h-4 w-4" /> Transferir Selecionados</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UnitRescuePage;
