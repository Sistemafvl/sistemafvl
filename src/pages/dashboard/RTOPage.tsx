import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isValidTbrCode } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface TbrHistory {
  ride_id: string;
  driver_name: string;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  completed_at: string;
  loading_status: string | null;
}

interface RtoEntry {
  id: string;
  tbr_code: string;
  driver_name: string | null;
  route: string | null;
  description: string;
  status: string;
  created_at: string;
  conferente_id: string | null;
  conferente_name?: string;
  cep: string | null;
}

interface Conferente {
  id: string;
  name: string;
}

const ITEMS_PER_PAGE = 30;

const RTOPage = () => {
  const { unitSession } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [tbrInput, setTbrInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [history, setHistory] = useState<TbrHistory | null>(null);
  const [tbrCode, setTbrCode] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [cepInput, setCepInput] = useState("");
  const [selectedConferente, setSelectedConferente] = useState("");
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [entries, setEntries] = useState<RtoEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

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
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const data = await fetchAllRows<any>((from, to) =>
      supabase.from("rto_entries").select("*").eq("unit_id", unitSession.id).order("created_at", { ascending: false }).range(from, to)
    );
    {
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

  const handleTbrKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !tbrInput.trim()) return;
    const code = tbrInput.trim();

    if (!isValidTbrCode(code)) {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "TBR inválido", description: "O código TBR deve conter apenas 'TBR' seguido de números.", variant: "destructive" });
      setTbrInput("");
      return;
    }

    setSearching(true);
    setTbrCode(code);

    // Optionally fetch history for informational display
    const { data: tbrData } = await supabase
      .from("ride_tbrs")
      .select("ride_id")
      .eq("code", code)
      .order("scanned_at", { ascending: false })
      .limit(1);

    let historyData: TbrHistory | null = null;

    if (tbrData && tbrData.length > 0) {
      const { data: ride } = await supabase
        .from("driver_rides")
        .select("id, route, login, loading_status, completed_at, conferente_id, driver_id")
        .eq("id", tbrData[0].ride_id)
        .maybeSingle();

      if (ride) {
        const { data: driver } = await supabase.from("drivers_public").select("name").eq("id", ride.driver_id).maybeSingle();
        let confName: string | null = null;
        if (ride.conferente_id) {
          const { data: conf } = await supabase.from("user_profiles").select("name").eq("id", ride.conferente_id).maybeSingle();
          confName = conf?.name ?? null;
        }
        historyData = {
          ride_id: ride.id,
          driver_name: driver?.name ?? "Desconhecido",
          route: ride.route,
          login: ride.login,
          conferente_name: confName,
          completed_at: ride.completed_at,
          loading_status: ride.loading_status,
        };
      }
    }

    setHistory(historyData);
    setDescription("");
    setCepInput("");
    setSelectedConferente("");
    setModalOpen(true);
    setSearching(false);
    setTbrInput("");
  };

  const handleSave = async () => {
    if (!unitSession || !description.trim()) return;
    setSaving(true);

    const entry = {
      tbr_code: tbrCode,
      ride_id: history?.ride_id ?? null,
      unit_id: unitSession.id,
      conferente_id: selectedConferente || null,
      description: description.trim(),
      driver_name: history?.driver_name ?? null,
      route: history?.route ?? null,
      cep: cepInput.trim() || null,
    };

    const { error } = await supabase.from("rto_entries").insert(entry);
    setSaving(false);

    if (error) return;
    setModalOpen(false);
    setHistory(null);
    loadEntries();
    inputRef.current?.focus();
  };

  const closeModal = () => {
    setModalOpen(false);
    setHistory(null);
    inputRef.current?.focus();
  };

  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE);
  const paginatedEntries = entries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <RotateCcw className="h-5 w-5 text-primary" />
            RTO - Retornos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={tbrInput}
              onChange={(e) => setTbrInput(e.target.value)}
              onKeyDown={handleTbrKeyDown}
              placeholder="Leia ou digite o código TBR e pressione Enter..."
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
            <p className="text-center text-muted-foreground italic py-8">Nenhum RTO registrado</p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                       <TableHead className="font-bold">TBR</TableHead>
                       <TableHead className="font-bold">Rota</TableHead>
                      <TableHead className="font-bold">CEP</TableHead>
                      <TableHead className="font-bold">Conferente</TableHead>
                      <TableHead className="font-bold">Problema</TableHead>
                      <TableHead className="font-bold">Data</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.tbr_code}</TableCell>
                         <TableCell>{e.route ?? "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{e.cep ?? "-"}</TableCell>
                        <TableCell>{e.conferente_name ?? "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{e.description}</TableCell>
                        <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-center">
                          {e.status === "open" ? (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-600 bg-yellow-50">Pendente</Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">Finalizado</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">Página {page} de {totalPages} ({entries.length} registros)</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      Próxima <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <RotateCcw className="h-5 w-5 text-primary" /> Novo RTO — {tbrCode}
            </DialogTitle>
            <DialogDescription>Registre o RTO para devolução ao vendedor.</DialogDescription>
          </DialogHeader>

          {history && (
            <div className="space-y-2 text-sm border rounded-md p-3 bg-muted/30">
              <p className="text-xs font-bold text-muted-foreground uppercase">Histórico (informativo)</p>
              <div className="grid grid-cols-2 gap-1">
                <div><span className="font-semibold">Motorista:</span> {history.driver_name}</div>
                <div><span className="font-semibold">Rota:</span> {history.route ?? "-"}</div>
                <div><span className="font-semibold">Login:</span> {history.login ?? "-"}</div>
                <div><span className="font-semibold">Data:</span> {new Date(history.completed_at).toLocaleString("pt-BR")}</div>
              </div>
            </div>
          )}

          {!history && (
            <p className="text-sm text-muted-foreground italic">TBR sem histórico de carregamento vinculado.</p>
          )}

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
              <label className="text-xs font-semibold">CEP do destino</label>
              <Input value={cepInput} onChange={(e) => setCepInput(e.target.value)} placeholder="Ex: 08141180" maxLength={9} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Descrição do problema</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o problema..." rows={3} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving || !description.trim()}>
              {saving ? "Gravando..." : "Gravar RTO"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RTOPage;
