import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Clock, CalendarCheck, Plus, Search, Loader2, Check, ChevronUp, ChevronDown, X, ChevronsUpDown } from "lucide-react";

interface QueueEntry {
  id: string;
  driver_id: string;
  unit_id: string;
  status: string;
  joined_at: string;
  driver_name?: string;
  driver_avatar?: string;
  car_model?: string;
  car_plate?: string;
  car_color?: string;
}

interface FoundDriver {
  id: string;
  name: string;
  cpf: string;
  avatar_url: string | null;
  car_model: string;
  car_plate: string;
  car_color: string | null;
}

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const LoginCombobox = ({ logins, usedLoginsToday, value, onSelect }: { logins: { id: string; login: string }[]; usedLoginsToday: Set<string>; value: string; onSelect: (val: string) => void }) => {
  const [open, setOpen] = useState(false);
  const selected = logins.find(l => l.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full h-10 justify-between text-sm font-normal">
          <span className="truncate">{selected ? selected.login : "Selecionar login..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar login..." className="h-9" />
          <CommandList>
            <CommandEmpty>Nenhum login encontrado.</CommandEmpty>
            <CommandGroup>
              {logins.map((l) => (
                <CommandItem key={l.id} value={l.login} onSelect={() => { onSelect(l.id); setOpen(false); }}>
                  <span className="flex items-center gap-2 flex-1">
                    {l.login}
                    {usedLoginsToday.has(l.login) && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Toast notification for new queue entries
interface QueueToastItem {
  id: string;
  driverName: string;
  createdAt: number;
}

const QueuePanel = () => {
  const { unitSession } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [isPulsing, setIsPulsing] = useState(false);
  const prevCountRef = useRef(0);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const initialFetchDoneRef = useRef(false);
  const [queueToasts, setQueueToasts] = useState<QueueToastItem[]>([]);
  const [queueSearch, setQueueSearch] = useState("");
  const [animating, setAnimating] = useState<{ idx: number; direction: "up" | "down" } | null>(null);

  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [route, setRoute] = useState("");
  const [selectedLoginId, setSelectedLoginId] = useState("");
  const [unitLogins, setUnitLogins] = useState<{ id: string; login: string }[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [cpfSearch, setCpfSearch] = useState("");
  const [foundDriver, setFoundDriver] = useState<FoundDriver | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [driverFreqUnit, setDriverFreqUnit] = useState<string | null>(null);
  const [nameFreqUnits, setNameFreqUnits] = useState<Record<string, string>>({});

  // Name search states
  const [nameSearch, setNameSearch] = useState("");
  const [nameResults, setNameResults] = useState<FoundDriver[]>([]);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unitId = unitSession?.id;

  // Auto-dismiss toasts after 5s
  useEffect(() => {
    if (queueToasts.length === 0) return;
    const timer = setTimeout(() => {
      setQueueToasts(prev => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [queueToasts]);

  const fetchQueue = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase
      .from("queue_entries")
      .select("*")
      .eq("unit_id", unitId)
      .in("status", ["waiting", "approved"])
      .order("joined_at", { ascending: true });

    if (!data) { setEntries([]); return; }

    const driverIds = data.map((e) => e.driver_id);
    const { data: drivers } = await supabase
      .from("drivers_public")
      .select("id, name, avatar_url, car_model, car_plate, car_color")
      .in("id", driverIds);

    const driverMap = new Map((drivers ?? []).map((d) => [d.id, d]));
    const newEntries = data.map((e) => {
      const d = driverMap.get(e.driver_id);
      return {
        ...e,
        driver_name: d?.name ?? "Motorista",
        driver_avatar: d?.avatar_url ?? undefined,
        car_model: d?.car_model ?? undefined,
        car_plate: d?.car_plate ?? undefined,
        car_color: d?.car_color ?? undefined,
      };
    });

    // Detect new drivers that just joined (skip only the very first fetch)
    const currentIds = new Set(newEntries.map(e => e.id));
    if (initialFetchDoneRef.current) {
      const newOnes = newEntries.filter(e => !prevIdsRef.current.has(e.id));
      if (newOnes.length > 0) {
        setQueueToasts(prev => [
          ...prev,
          ...newOnes.map(e => ({
            id: e.id,
            driverName: e.driver_name ?? "Motorista",
            createdAt: Date.now(),
          })),
        ]);
      }
    }
    initialFetchDoneRef.current = true;
    prevIdsRef.current = currentIds;

    if (newEntries.length > prevCountRef.current && prevCountRef.current >= 0) {
      setIsPulsing(true);
    }
    prevCountRef.current = newEntries.length;
    setEntries(newEntries);
  }, [unitId]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("queue-panel-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `unit_id=eq.${unitId}` }, () => { fetchQueue(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchQueue]);


  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const handleApprove = async (entry: QueueEntry) => {
    await supabase.from("queue_entries").update({ status: "approved" }).eq("id", entry.id);
    fetchQueue();
  };

  const handleReject = async (entry: QueueEntry) => {
    await supabase.from("queue_entries").update({ status: "rejected", completed_at: new Date().toISOString() }).eq("id", entry.id);
    fetchQueue();
  };

  const [usedLoginsToday, setUsedLoginsToday] = useState<Set<string>>(new Set());
  const [routeHistory, setRouteHistory] = useState<string[]>([]);
  const [loginHistory, setLoginHistory] = useState<string[]>([]);

  const openProgramModal = async (entry: QueueEntry) => {
    setSelectedEntry(entry);
    setRoute("");
    setSelectedLoginId("");
    setRouteHistory([]);
    setLoginHistory([]);
    setShowProgramModal(true);
    if (unitId) {
      const { data } = await supabase.from("unit_logins").select("id, login").eq("unit_id", unitId).eq("active", true).order("created_at", { ascending: true });
      setUnitLogins(data ?? []);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: ridesData } = await supabase
        .from("driver_rides")
        .select("login")
        .eq("unit_id", unitId)
        .gte("completed_at", today.toISOString())
        .not("login", "is", null);
      const used = new Set<string>((ridesData ?? []).map((r: any) => r.login).filter(Boolean));
      setUsedLoginsToday(used);

      // Fetch route and login history for this driver at this unit
      const { data: historyData } = await supabase
        .from("driver_rides")
        .select("route, login")
        .eq("driver_id", entry.driver_id)
        .eq("unit_id", unitId);
      const uniqueRoutes = [...new Set((historyData ?? []).map((r: any) => r.route).filter(Boolean))].sort();
      setRouteHistory(uniqueRoutes as string[]);
      const uniqueLogins = [...new Set((historyData ?? []).map((r: any) => r.login).filter(Boolean))].sort();
      setLoginHistory(uniqueLogins as string[]);
    }
  };

  const handleOpenPanel = () => {
    setIsPulsing(false);
    setOpen(true);
  };

  const [definingRide, setDefiningRide] = useState(false);

  const handleDefinir = async () => {
    if (!selectedEntry || !unitId) return;
    setDefiningRide(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-ride-with-login", {
        body: {
          driver_id: selectedEntry.driver_id,
          unit_id: selectedEntry.unit_id,
          queue_entry_id: selectedEntry.id,
          route,
          unit_login_id: selectedLoginId || null,
        },
      });

      if (error) { console.error("Error creating ride:", error); return; }

      setShowProgramModal(false);
      fetchQueue();
    } finally {
      setDefiningRide(false);
    }
  };

  const handleMoveEntry = async (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= entries.length) return;
    if (animating) return;

    setAnimating({ idx, direction });

    // Wait for animation
    await new Promise(r => setTimeout(r, 300));

    // Capture references before local swap
    const current = entries[idx];
    const neighbor = entries[targetIdx];

    // Optimistic local swap BEFORE resetting animation
    setEntries(prev => {
      const newArr = [...prev];
      [newArr[idx], newArr[targetIdx]] = [newArr[targetIdx], newArr[idx]];
      return newArr;
    });

    // Now reset animation — local state already has correct order
    setAnimating(null);

    // DB update + background sync
    await Promise.all([
      supabase.from("queue_entries").update({ joined_at: neighbor.joined_at }).eq("id", current.id),
      supabase.from("queue_entries").update({ joined_at: current.joined_at }).eq("id", neighbor.id),
    ]);
    fetchQueue();
  };

  const fetchDriverFreqUnit = async (driverId: string) => {
    const { data } = await supabase
      .from("driver_rides")
      .select("unit_id")
      .eq("driver_id", driverId)
      .order("completed_at", { ascending: false })
      .limit(100);
    if (!data || data.length === 0) return null;
    const counts: Record<string, number> = {};
    data.forEach(r => { counts[r.unit_id] = (counts[r.unit_id] || 0) + 1; });
    const topUnitId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const { data: unitData } = await supabase.from("units_public").select("name").eq("id", topUnitId).maybeSingle();
    return unitData?.name ?? null;
  };

  const handleSearchDriver = async () => {
    const cpf = cpfSearch.replace(/\D/g, "");
    if (cpf.length < 11) { setSearchError("CPF deve ter 11 dígitos."); return; }
    setSearchLoading(true);
    setSearchError("");
    setFoundDriver(null);
    setDriverFreqUnit(null);

    const { data, error } = await supabase
      .from("drivers_public")
      .select("id, name, cpf, avatar_url, car_model, car_plate, car_color")
      .eq("cpf", cpf)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) { setSearchError("Motorista não encontrado."); }
    else {
      setFoundDriver(data as FoundDriver);
      fetchDriverFreqUnit(data.id).then(u => setDriverFreqUnit(u));
    }
    setSearchLoading(false);
  };

  // Name search with debounce
  useEffect(() => {
    if (!nameSearch.trim()) { setNameResults([]); setNameFreqUnits({}); return; }
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(async () => {
      setNameSearchLoading(true);
      const { data } = await supabase
        .from("drivers_public")
        .select("id, name, cpf, avatar_url, car_model, car_plate, car_color")
        .ilike("name", `%${nameSearch.trim()}%`)
        .eq("active", true)
        .limit(10);
      const results = (data ?? []) as FoundDriver[];
      setNameResults(results);
      // Fetch freq units for all results
      const freqMap: Record<string, string> = {};
      await Promise.all(results.map(async (d) => {
        const u = await fetchDriverFreqUnit(d.id);
        if (u) freqMap[d.id] = u;
      }));
      setNameFreqUnits(freqMap);
      setNameSearchLoading(false);
    }, 400);
    return () => { if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current); };
  }, [nameSearch]);

  const handleAddToQueue = async () => {
    if (!foundDriver || !unitId) return;
    setAddingToQueue(true);

    const { data: existing } = await supabase
      .from("queue_entries")
      .select("id")
      .eq("unit_id", unitId)
      .eq("driver_id", foundDriver.id)
      .in("status", ["waiting", "approved"])
      .maybeSingle();

    if (existing) {
      setSearchError("Este motorista já está na fila.");
      setAddingToQueue(false);
      return;
    }

    await supabase.from("queue_entries").insert({
      unit_id: unitId,
      driver_id: foundDriver.id,
      status: "waiting",
    } as any);

    setShowAddModal(false);
    setCpfSearch("");
    setNameSearch("");
    setNameResults([]);
    setFoundDriver(null);
    setSearchError("");
    setAddingToQueue(false);
    fetchQueue();
  };

  const count = entries.length;
  const filteredEntries = queueSearch.trim()
    ? entries.filter(e => e.driver_name?.toLowerCase().includes(queueSearch.toLowerCase()))
    : entries;

  return (
    <>
      {/* Animated toasts above the Fila button */}
      <div className="fixed bottom-[76px] right-6 z-50 flex flex-col-reverse gap-2 pointer-events-none">
        {queueToasts.map((t, i) => (
          <div
            key={t.id}
            className="pointer-events-auto animate-in slide-in-from-bottom-4 fade-in duration-500 bg-primary text-primary-foreground rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 text-sm font-medium"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate max-w-[200px]">{t.driverName}</span>
            <span className="text-primary-foreground/70 text-xs">entrou na fila</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleOpenPanel}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all ${
          isPulsing ? "animate-pulse ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        } ${count > 0 ? "ring-2 ring-red-500 ring-offset-2 ring-offset-background" : ""}`}
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
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7"
                onClick={() => { setShowAddModal(true); setCpfSearch(""); setNameSearch(""); setNameResults([]); setFoundDriver(null); setSearchError(""); }}
                title="Adicionar motorista na fila"
              >
                <Plus className="h-4 w-4" />
              </Button>
              {count > 0 && (
                <Badge variant="default" className="ml-auto">{count} na fila</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Search filter */}
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar motorista na fila..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
              {queueSearch && (
                <button onClick={() => setQueueSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredEntries.length === 0 ? (
              <div className="text-center text-muted-foreground italic py-12 text-sm">
                {entries.length === 0 ? "Nenhum motorista na fila" : "Nenhum resultado encontrado"}
              </div>
            ) : (
              filteredEntries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card"
                  style={{
                    transition: animating ? "transform 0.3s ease-in-out, z-index 0s" : "none",
                    position: "relative",
                    zIndex:
                      animating?.idx === idx ? 10 :
                      (animating && ((animating.direction === "up" && idx === animating.idx - 1) || (animating.direction === "down" && idx === animating.idx + 1))) ? 5 : 1,
                    transform:
                      animating?.idx === idx
                        ? `translateY(${animating.direction === "up" ? "-100%" : "100%"})`
                        : animating && animating.direction === "up" && idx === animating.idx - 1
                          ? "translateY(100%)"
                          : animating && animating.direction === "down" && idx === animating.idx + 1
                            ? "translateY(-100%)"
                            : "translateY(0)",
                  }}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {entry.driver_avatar && <AvatarImage src={entry.driver_avatar} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {(entry.driver_name ?? "M")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs truncate">
                      {idx + 1}º — {entry.driver_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(entry.joined_at)}
                    </p>
                  </div>
                  {entry.status === "waiting" ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="default" className="shrink-0 font-bold italic text-xs h-7 px-2" onClick={() => handleApprove(entry)}>
                        <Check className="h-3 w-3 mr-1" /> Aprovar
                      </Button>
                      <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleReject(entry)} title="Recusar">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="default" className="shrink-0 font-bold italic text-xs h-7 px-2" onClick={() => openProgramModal(entry)}>
                        <CalendarCheck className="h-3 w-3 mr-1" /> Programar
                      </Button>
                      <Button size="icon" variant="ghost" className="shrink-0 h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleReject(entry)} title="Remover da fila">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => handleMoveEntry(idx, "up")}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === entries.length - 1} onClick={() => handleMoveEntry(idx, "down")}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de Programação */}
      <Dialog open={showProgramModal} onOpenChange={setShowProgramModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic">Programar Carregamento</DialogTitle>
            <DialogDescription>{selectedEntry?.driver_name} — Preencha as informações abaixo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="font-semibold">Rotas anteriores</Label>
              <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 p-2 border rounded-md bg-muted/30">
                {routeHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhuma rota anterior.</p>
                ) : (
                  routeHistory.map(r => (
                    <Button key={r} type="button" variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => setRoute(r)}>{r}</Button>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="route" className="font-semibold">Rota</Label>
              <Input id="route" placeholder="Informe a rota..." value={route} onChange={(e) => setRoute(e.target.value)} />
            </div>
            {loginHistory.length > 0 && (
              <div className="space-y-2">
                <Label className="font-semibold">Logins anteriores</Label>
                <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 p-2 border rounded-md bg-muted/30">
                  {loginHistory.map(l => {
                    const matchingLogin = unitLogins.find(ul => ul.login === l);
                    return (
                      <Button key={l} type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => { if (matchingLogin) setSelectedLoginId(matchingLogin.id); }}>
                        {l}
                        {usedLoginsToday.has(l) && <Check className="h-3 w-3 text-emerald-500" />}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="login" className="font-semibold">Login</Label>
              {unitLogins.length > 0 ? (
                <LoginCombobox
                  logins={unitLogins}
                  usedLoginsToday={usedLoginsToday}
                  value={selectedLoginId}
                  onSelect={setSelectedLoginId}
                />
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum login cadastrado. Cadastre em Configurações.</p>
              )}
            </div>
            <Button onClick={handleDefinir} className="w-full font-bold italic" disabled={definingRide}>
              {definingRide ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Definindo...</> : "Definir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Motorista */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Adicionar Motorista na Fila
            </DialogTitle>
            <DialogDescription>
              Busque um motorista cadastrado pelo nome ou CPF
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Name search */}
            <div className="space-y-2">
              <Label className="font-semibold">Buscar por Nome</Label>
              <Input
                placeholder="Digite o nome..."
                value={nameSearch}
                onChange={(e) => { setNameSearch(e.target.value); setFoundDriver(null); }}
              />
              {nameSearchLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {nameResults.length > 0 && !foundDriver && (
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-1">
                  {nameResults.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setFoundDriver(d); setNameResults([]); setDriverFreqUnit(null); fetchDriverFreqUnit(d.id).then(u => setDriverFreqUnit(u)); }}
                      className="w-full text-left p-2 rounded hover:bg-muted text-xs flex items-center gap-2"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        {d.avatar_url && <AvatarImage src={d.avatar_url} />}
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {d.name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold">{d.name}</p>
                        <p className="text-muted-foreground">
                          CPF: {maskCPF(d.cpf)} · {d.car_model} {d.car_color || ""} · {d.car_plate}
                        </p>
                        {nameFreqUnits[d.id] && (
                          <p className="text-muted-foreground">📍 Unidade frequente: {nameFreqUnits[d.id]}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CPF search */}
            <div className="space-y-2">
              <Label className="font-semibold">Buscar por CPF</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o CPF..."
                  value={cpfSearch}
                  onChange={(e) => setCpfSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearchDriver(); }}
                  maxLength={14}
                />
                <Button onClick={handleSearchDriver} disabled={searchLoading} size="icon">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {searchError && (
              <p className="text-sm text-destructive font-semibold">{searchError}</p>
            )}

            {foundDriver && (
              <div className="p-4 rounded-lg border border-border bg-card space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {foundDriver.avatar_url && <AvatarImage src={foundDriver.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {foundDriver.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold">{foundDriver.name}</p>
                    <p className="text-xs text-muted-foreground">CPF: {maskCPF(foundDriver.cpf)}</p>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Veículo:</strong> {foundDriver.car_model} — {foundDriver.car_color || "N/A"}</p>
                  <p><strong>Placa:</strong> {foundDriver.car_plate}</p>
                  {driverFreqUnit && (
                    <p className="text-xs text-muted-foreground">📍 Unidade mais frequente: <strong>{driverFreqUnit}</strong></p>
                  )}
                </div>
                <Button onClick={handleAddToQueue} disabled={addingToQueue} className="w-full font-bold italic">
                  {addingToQueue && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Adicionar na Fila
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QueuePanel;
