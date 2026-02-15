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
import { Users, Clock, CalendarCheck, Plus, Search, Loader2 } from "lucide-react";

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

const QueuePanel = () => {
  const { unitSession } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [isPulsing, setIsPulsing] = useState(false);
  const prevCountRef = useRef(0);

  // Modal states
  const [selectedEntry, setSelectedEntry] = useState<QueueEntry | null>(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [route, setRoute] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [unitLogins, setUnitLogins] = useState<{ id: string; login: string; password: string }[]>([]);

  // Add driver by CPF modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [cpfSearch, setCpfSearch] = useState("");
  const [foundDriver, setFoundDriver] = useState<FoundDriver | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [addingToQueue, setAddingToQueue] = useState(false);

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

    const driverIds = data.map((e) => e.driver_id);
    const { data: drivers } = await supabase
      .from("drivers")
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

  const openProgramModal = async (entry: QueueEntry) => {
    setSelectedEntry(entry);
    setRoute("");
    setLogin("");
    setPassword("");
    setShowProgramModal(true);
    if (unitId) {
      const { data } = await supabase.from("unit_logins").select("id, login, password").eq("unit_id", unitId).eq("active", true).order("created_at", { ascending: true });
      setUnitLogins(data ?? []);
    }
  };

  const handleOpenPanel = () => {
    setIsPulsing(false);
    setOpen(true);
  };

  const handleDefinir = async () => {
    if (!selectedEntry || !unitId) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("driver_rides")
      .select("*", { count: "exact", head: true })
      .eq("unit_id", unitId)
      .gte("completed_at", today.toISOString());

    const sequenceNumber = (count ?? 0) + 1;

    await supabase
      .from("queue_entries")
      .update({ status: "completed", called_at: new Date().toISOString(), completed_at: new Date().toISOString() })
      .eq("id", selectedEntry.id);

    await supabase.from("driver_rides").insert({
      driver_id: selectedEntry.driver_id,
      unit_id: selectedEntry.unit_id,
      queue_entry_id: selectedEntry.id,
      route,
      login,
      password,
      sequence_number: sequenceNumber,
    } as any);

    setShowProgramModal(false);
    fetchQueue();
  };

  // Search driver by CPF
  const handleSearchDriver = async () => {
    const cpf = cpfSearch.replace(/\D/g, "");
    if (cpf.length < 11) {
      setSearchError("CPF deve ter 11 dígitos.");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    setFoundDriver(null);

    const { data, error } = await supabase
      .from("drivers")
      .select("id, name, cpf, avatar_url, car_model, car_plate, car_color")
      .eq("cpf", cpf)
      .eq("active", true)
      .maybeSingle();

    if (error || !data) {
      setSearchError("Motorista não encontrado.");
    } else {
      setFoundDriver(data as FoundDriver);
    }
    setSearchLoading(false);
  };

  // Add found driver to queue
  const handleAddToQueue = async () => {
    if (!foundDriver || !unitId) return;
    setAddingToQueue(true);

    // Check if already in queue
    const { data: existing } = await supabase
      .from("queue_entries")
      .select("id")
      .eq("unit_id", unitId)
      .eq("driver_id", foundDriver.id)
      .eq("status", "waiting")
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
    setFoundDriver(null);
    setSearchError("");
    setAddingToQueue(false);
    fetchQueue();
  };

  const count = entries.length;

  return (
    <>
      {/* Floating trigger with pulse animation */}
      <button
        onClick={handleOpenPanel}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-all ${
          isPulsing ? "animate-pulse ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        }`}
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
                className="h-7 w-7 ml-auto"
                onClick={() => { setShowAddModal(true); setCpfSearch(""); setFoundDriver(null); setSearchError(""); }}
                title="Adicionar motorista na fila"
              >
                <Plus className="h-4 w-4" />
              </Button>
              {count > 0 && (
                <Badge variant="default">{count} na fila</Badge>
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
                    {entry.driver_avatar && <AvatarImage src={entry.driver_avatar} />}
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
                    onClick={() => openProgramModal(entry)}
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

      {/* Modal de Programação */}
      <Dialog open={showProgramModal} onOpenChange={setShowProgramModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic">Programar Carregamento</DialogTitle>
            <DialogDescription>
              {selectedEntry?.driver_name} — Preencha as informações abaixo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="route" className="font-semibold">Rota</Label>
              <Input id="route" placeholder="Informe a rota..." value={route} onChange={(e) => setRoute(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login" className="font-semibold">Login</Label>
              {unitLogins.length > 0 ? (
                <Select value={login} onValueChange={(val) => {
                  setLogin(val);
                  const found = unitLogins.find(l => l.login === val);
                  if (found) setPassword(found.password);
                }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecionar login..." /></SelectTrigger>
                  <SelectContent>
                    {unitLogins.map((l) => (
                      <SelectItem key={l.id} value={l.login}>{l.login}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="login" placeholder="Informe o login..." value={login} onChange={(e) => setLogin(e.target.value)} />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">Senha</Label>
              <Input id="password" placeholder="Informe a senha..." value={password} onChange={(e) => setPassword(e.target.value)} readOnly={unitLogins.length > 0 && !!login} />
            </div>
            <Button onClick={handleDefinir} className="w-full font-bold italic">
              Definir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Motorista por CPF */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Adicionar Motorista na Fila
            </DialogTitle>
            <DialogDescription>
              Busque um motorista cadastrado pelo CPF
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
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
                    <p className="text-xs text-muted-foreground">CPF: {foundDriver.cpf}</p>
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>Veículo:</strong> {foundDriver.car_model} — {foundDriver.car_color || "N/A"}</p>
                  <p><strong>Placa:</strong> {foundDriver.car_plate}</p>
                </div>
                <Button
                  onClick={handleAddToQueue}
                  disabled={addingToQueue}
                  className="w-full font-bold italic"
                >
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
