import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Search, CheckCircle, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";


interface TbrHistory {
  ride_id: string;
  driver_name: string;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  completed_at: string;
  loading_status: string | null;
}

interface PsEntry {
  id: string;
  tbr_code: string;
  driver_name: string | null;
  route: string | null;
  description: string;
  status: string;
  created_at: string;
  conferente_id: string | null;
  conferente_name?: string;
}

interface Conferente {
  id: string;
  name: string;
}

const PSPage = () => {
  const { unitSession } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [isLoading, setIsLoading] = useState(true);
  const [tbrInput, setTbrInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [history, setHistory] = useState<TbrHistory | null>(null);
  const [tbrCode, setTbrCode] = useState("");
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [includeMode, setIncludeMode] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedConferente, setSelectedConferente] = useState("");
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [entries, setEntries] = useState<PsEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (unitSession) {
      loadEntries();
      loadConferentes();
    }
  }, [unitSession]);

  const loadConferentes = async () => {
    if (!unitSession) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("id, name")
      .eq("unit_id", unitSession.id)
      .eq("active", true)
      .order("name");
    if (data) setConferentes(data);
  };

  const loadEntries = async () => {
    if (!unitSession) return;
    const { data } = await supabase
      .from("ps_entries")
      .select("*")
      .eq("unit_id", unitSession.id)
      .order("created_at", { ascending: false });
    if (data) {
      const confIds = [...new Set(data.filter(e => e.conferente_id).map(e => e.conferente_id!))];
      let confMap: Record<string, string> = {};
      if (confIds.length > 0) {
        const { data: confs } = await supabase.from("user_profiles").select("id, name").in("id", confIds);
        if (confs) confMap = Object.fromEntries(confs.map(c => [c.id, c.name]));
      }
      setEntries(data.map(e => ({ ...e, conferente_name: e.conferente_id ? confMap[e.conferente_id] : undefined })));
    }
    setIsLoading(false);
  };

  const handleTbrInput = (value: string) => {
    setTbrInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const code = value.trim();
      if (code.toUpperCase().startsWith("TBR") && code.length >= 5) {
        searchTbr(code);
      }
    }, 300);
  };

  const searchTbr = async (code: string) => {
    setSearching(true);
    setTbrCode(code);

    const { data: tbrData } = await supabase
      .from("ride_tbrs")
      .select("ride_id")
      .eq("code", code)
      .maybeSingle();

    if (!tbrData) {
      setSearching(false);
      setTbrInput("");
      inputRef.current?.focus();
      return;
    }

    const { data: ride } = await supabase
      .from("driver_rides")
      .select("id, route, login, loading_status, completed_at, conferente_id, driver_id")
      .eq("id", tbrData.ride_id)
      .maybeSingle();

    if (!ride) {
      setSearching(false);
      setTbrInput("");
      return;
    }

    const { data: driver } = await supabase.from("drivers").select("name").eq("id", ride.driver_id).maybeSingle();
    let confName: string | null = null;
    if (ride.conferente_id) {
      const { data: conf } = await supabase.from("user_profiles").select("name").eq("id", ride.conferente_id).maybeSingle();
      confName = conf?.name ?? null;
    }

    setHistory({
      ride_id: ride.id,
      driver_name: driver?.name ?? "Desconhecido",
      route: ride.route,
      login: ride.login,
      conferente_name: confName,
      completed_at: ride.completed_at,
      loading_status: ride.loading_status,
    });
    setHistoryModalOpen(true);
    setSearching(false);
    setTbrInput("");
  };

  const handleIncludePS = () => {
    setIncludeMode(true);
    setDescription("");
    setSelectedConferente("");
  };

  const handleSave = async () => {
    if (!unitSession || !history || !description.trim()) return;
    setSaving(true);

    const entry = {
      tbr_code: tbrCode,
      ride_id: history.ride_id,
      unit_id: unitSession.id,
      conferente_id: selectedConferente || null,
      description: description.trim(),
      driver_name: history.driver_name,
      route: history.route,
    };

    const { error } = await supabase.from("ps_entries").insert(entry);
    setSaving(false);

    if (error) return;
    setHistoryModalOpen(false);
    setIncludeMode(false);
    setHistory(null);
    loadEntries();
    inputRef.current?.focus();
  };

  const handleFinalize = async (id: string) => {
    await supabase.from("ps_entries").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: "closed" } : e));
  };

  const closeModal = () => {
    setHistoryModalOpen(false);
    setIncludeMode(false);
    setHistory(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <AlertTriangle className="h-5 w-5 text-primary" />
            PS - Problem Solve
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={tbrInput}
              onChange={(e) => handleTbrInput(e.target.value)}
              placeholder="Leia ou digite o código TBR..."
              className="pl-9 h-11"
              disabled={searching}
              autoFocus
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground italic py-8">Nenhum PS registrado</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">TBR</TableHead>
                    <TableHead className="font-bold">Motorista</TableHead>
                    <TableHead className="font-bold">Rota</TableHead>
                    <TableHead className="font-bold">Conferente</TableHead>
                    <TableHead className="font-bold">Problema</TableHead>
                     <TableHead className="font-bold">Data</TableHead>
                     <TableHead className="font-bold text-center">Status</TableHead>
                     <TableHead className="font-bold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.tbr_code}</TableCell>
                      <TableCell>{e.driver_name ?? "-"}</TableCell>
                      <TableCell>{e.route ?? "-"}</TableCell>
                      <TableCell>{e.conferente_name ?? "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{e.description}</TableCell>
                      <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                       <TableCell className="text-center">
                         {e.status === "open" ? (
                           <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-semibold">Aberto</span>
                         ) : (
                           <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-semibold">Finalizado</span>
                         )}
                       </TableCell>
                       <TableCell className="text-center">
                         {e.status === "open" && (
                           <Button variant="outline" size="sm" onClick={() => handleFinalize(e.id)}>
                             <CheckCircle className="h-3 w-3 mr-1" /> Finalizar
                           </Button>
                         )}
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={historyModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <AlertTriangle className="h-5 w-5 text-primary" /> Histórico TBR - {tbrCode}
            </DialogTitle>
            <DialogDescription>Informações do carregamento vinculado a este TBR.</DialogDescription>
          </DialogHeader>
          {history && (
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold text-muted-foreground">Motorista:</span> <span className="font-bold">{history.driver_name}</span></div>
              <div><span className="font-semibold text-muted-foreground">Rota:</span> {history.route ?? "-"}</div>
              <div><span className="font-semibold text-muted-foreground">Login:</span> {history.login ?? "-"}</div>
              <div><span className="font-semibold text-muted-foreground">Conferente:</span> {history.conferente_name ?? "-"}</div>
              <div><span className="font-semibold text-muted-foreground">Status:</span> {history.loading_status ?? "-"}</div>
              <div><span className="font-semibold text-muted-foreground">Data:</span> {new Date(history.completed_at).toLocaleString("pt-BR")}</div>

              {!includeMode ? (() => {
                const existingEntry = entries.find(e => e.tbr_code.toUpperCase() === tbrCode.toUpperCase());
                return existingEntry ? (
                  <Button className="w-full mt-2" variant="destructive" onClick={() => { handleFinalize(existingEntry.id); closeModal(); }}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Finalizar PS
                  </Button>
                ) : (
                  <Button className="w-full mt-2" onClick={handleIncludePS}>
                    <AlertTriangle className="h-4 w-4 mr-2" /> Incluir PS
                  </Button>
                );
              })() : (
                <div className="space-y-3 pt-2 border-t">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Conferente</label>
                    <Select value={selectedConferente} onValueChange={setSelectedConferente}>
                      <SelectTrigger><SelectValue placeholder="Selecione o conferente" /></SelectTrigger>
                      <SelectContent>
                        {conferentes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold">Descrição do problema</label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o problema..." rows={3} />
                  </div>
                  <Button className="w-full" onClick={handleSave} disabled={saving || !description.trim()}>
                    {saving ? "Gravando..." : "Gravar PS"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PSPage;
