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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock, CalendarCheck, Plus, Search, Loader2, Check, ChevronUp, ChevronDown, X } from "lucide-react";

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

const QueuePanel = () => {
  const { unitSession } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [isPulsing, setIsPulsing] = useState(false);
  const prevCountRef = useRef(0);

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

  // Name search states
  const [nameSearch, setNameSearch] = useState("");
  const [nameResults, setNameResults] = useState<FoundDriver[]>([]);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unitId = unitSession?.id;

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

  const openProgramModal = async (entry: QueueEntry) => {
    setSelectedEntry(entry);
    setRoute("");
    setSelectedLoginId("");
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
    }
  };

  const handleOpenPanel = () => {
    setIsPulsing(false);
    setOpen(true);
  };

  const handleDefinir = async () => {
    if (!selectedEntry || !unitId) return;

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
  };

  const handleMoveEntry = async (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= entries.length) return;

    const current = entries[idx];
    const neighbor = entries[targetIdx];

    await Promise.all([
      supabase.from("queue_entries").update({ joined_at: neighbor.joined_at }).eq("id", current.id),
      supabase.from("queue_entries").update({ joined_at: current.joined_at }).eq("id", neighbor.id),
    ]);
    fetchQueue();
  };

  const handleSearchDriver = async () => {
    const cpf = cpfSearch.replace(/\D/g, "");
    if (cpf.length < 11) { setSearchError("CPF deve ter 11 dígitos."); return; }
    setSearchLoading(true);
    setSearchError("");
    setFoundDriver(null);

    const { data, error } = await supabase
      .from("drivers_public")
      .select("id, name, cpf, avatar_url, car_model, car_plate, car_color")
      .eq("cpf", cpf)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) { setSearchError("Motorista não encontrado."); }
    else { setFoundDriver(data as FoundDriver); }
    setSearchLoading(false);
  };

  // Name search with debounce
  useEffect(() => {
    if (!nameSearch.trim()) { setNameResults([]); return; }
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(async () => {
      setNameSearchLoading(true);
      const { data } = await supabase
        .from("drivers_public")
        .select("id, name, cpf, avatar_url, car_model, car_plate, car_color")
        .ilike("name", `%${nameSearch.trim()}%`)
        .eq("active", true)
        .limit(10);
      setNameResults((data ?? []) as FoundDriver[]);
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

  return (
    <>
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

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {entries.length === 0 ? (
              <div className="text-center text-muted-foreground italic py-12 text-sm">
                Nenhum motorista na fila
              </div>
            ) : (
              entries.map((entry, idx) => (
                <div key={entry.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
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
                    <Button size="sm" variant="default" className="shrink-0 font-bold italic text-xs h-7 px-2" onClick={() => openProgramModal(entry)}>
                      <CalendarCheck className="h-3 w-3 mr-1" /> Programar
                    </Button>
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
              <Label htmlFor="route" className="font-semibold">Rota</Label>
              <Input id="route" placeholder="Informe a rota..." value={route} onChange={(e) => setRoute(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login" className="font-semibold">Login</Label>
              {unitLogins.length > 0 ? (
                <Select value={selectedLoginId} onValueChange={setSelectedLoginId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecionar login..." /></SelectTrigger>
                  <SelectContent>
                    {unitLogins.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        <span className="flex items-center gap-2">
                          {l.login}
                          {usedLoginsToday.has(l.login) && <Check className="h-3.5 w-3.5 text-emerald-500" />}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum login cadastrado. Cadastre em Configurações.</p>
              )}
            </div>
            <Button onClick={handleDefinir} className="w-full font-bold italic">Definir</Button>
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
                      onClick={() => { setFoundDriver(d); setNameResults([]); }}
                      className="w-full text-left p-2 rounded hover:bg-muted text-xs space-y-0.5"
                    >
                      <p className="font-bold">{d.name}</p>
                      <p className="text-muted-foreground">
                        CPF: {maskCPF(d.cpf)} · {d.car_model} {d.car_color || ""} · {d.car_plate}
                      </p>
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
