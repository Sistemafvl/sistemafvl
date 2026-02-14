import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ClipboardCheck, Eye, Search, Plus, ArrowRightLeft, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Conferente {
  id: string;
  name: string;
  cpf: string;
  unit_id: string;
  active: boolean;
  created_at: string;
}

interface Unit {
  id: string;
  name: string;
}

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const capitalize = (v: string) =>
  v.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const ConferentesPage = () => {
  const { unitSession } = useAuthStore();
  const { toast } = useToast();
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [viewConferente, setViewConferente] = useState<Conferente | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [transferConferente, setTransferConferente] = useState<Conferente | null>(null);
  const [deleteConferente, setDeleteConferente] = useState<Conferente | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Register form
  const [regName, setRegName] = useState("");
  const [regCpf, setRegCpf] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  // Transfer
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  useEffect(() => {
    if (unitSession) loadConferentes();
  }, [unitSession]);

  const loadConferentes = async () => {
    if (!unitSession) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("unit_id", unitSession.id)
      .order("name");
    if (data) setConferentes(data);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = regCpf.replace(/\D/g, "");
    if (!regName.trim()) {
      toast({ title: "Preencha o nome", variant: "destructive" });
      return;
    }
    if (rawCpf.length !== 11) {
      toast({ title: "CPF inválido", variant: "destructive" });
      return;
    }
    if (!unitSession) return;

    setRegLoading(true);
    const { error } = await supabase.from("user_profiles").insert({
      name: regName.trim(),
      cpf: rawCpf,
      unit_id: unitSession.id,
    });
    setRegLoading(false);

    if (error) {
      const msg = error.message.includes("duplicate")
        ? "CPF já cadastrado nesta unidade"
        : "Erro ao cadastrar. Tente novamente.";
      toast({ title: msg, variant: "destructive" });
      return;
    }

    toast({ title: "Conferente cadastrado com sucesso!" });
    setRegName("");
    setRegCpf("");
    setRegisterOpen(false);
    loadConferentes();
  };

  const toggleActive = async (c: Conferente) => {
    const { error } = await supabase
      .from("user_profiles")
      .update({ active: !c.active })
      .eq("id", c.id);
    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
      return;
    }
    setConferentes((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x))
    );
  };

  const handleDelete = async () => {
    if (!deleteConferente) return;
    setDeleteLoading(true);
    const { error } = await supabase
      .from("user_profiles")
      .delete()
      .eq("id", deleteConferente.id);
    setDeleteLoading(false);

    if (error) {
      toast({ title: "Erro ao excluir conferente", variant: "destructive" });
      return;
    }

    toast({ title: "Conferente excluído com sucesso!" });
    setConferentes((prev) => prev.filter((x) => x.id !== deleteConferente.id));
    setDeleteConferente(null);
  };

  const openTransfer = async (c: Conferente) => {
    setTransferConferente(c);
    setSelectedUnit("");
    const { data } = await supabase
      .from("units")
      .select("id, name")
      .eq("active", true)
      .order("name");
    if (data) setUnits(data.filter((u) => u.id !== unitSession?.id));
  };

  const handleTransfer = async () => {
    if (!transferConferente || !selectedUnit) return;
    setTransferLoading(true);
    const { error } = await supabase
      .from("user_profiles")
      .update({ unit_id: selectedUnit })
      .eq("id", transferConferente.id);
    setTransferLoading(false);

    if (error) {
      toast({ title: "Erro ao transferir", variant: "destructive" });
      return;
    }

    toast({ title: "Conferente transferido com sucesso!" });
    setTransferConferente(null);
    loadConferentes();
  };

  const filtered = conferentes.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cpf.includes(search.replace(/\D/g, ""))
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-bold italic">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Conferentes
            </CardTitle>
            <Button size="icon" onClick={() => setRegisterOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="pl-9 h-11"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-bold">Nome</TableHead>
                  <TableHead className="font-bold">CPF</TableHead>
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="font-bold text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground italic py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground italic py-8">
                      Nenhum conferente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-semibold">{c.name}</TableCell>
                      <TableCell className="text-xs">{maskCPF(c.cpf)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={c.active ? "default" : "secondary"}>
                          {c.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConferente(c)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewConferente(c)} title="Visualizar">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Switch
                            checked={c.active}
                            onCheckedChange={() => toggleActive(c)}
                            className="scale-75"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTransfer(c)} title="Transferir unidade">
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Modal */}
      <Dialog open={!!viewConferente} onOpenChange={(open) => !open && setViewConferente(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Dados do Conferente
            </DialogTitle>
            <DialogDescription>Informações completas do conferente.</DialogDescription>
          </DialogHeader>
          {viewConferente && (
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold text-muted-foreground">Nome:</span> <span className="font-bold">{viewConferente.name}</span></div>
              <div><span className="font-semibold text-muted-foreground">CPF:</span> {maskCPF(viewConferente.cpf)}</div>
              <div><span className="font-semibold text-muted-foreground">Unidade:</span> {unitSession?.name}</div>
              <div><span className="font-semibold text-muted-foreground">Status:</span>{" "}
                <Badge variant={viewConferente.active ? "default" : "secondary"}>
                  {viewConferente.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div><span className="font-semibold text-muted-foreground">Cadastrado em:</span> {new Date(viewConferente.created_at).toLocaleString("pt-BR")}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Register Modal */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Cadastro de Conferente
            </DialogTitle>
            <DialogDescription>Cadastre um novo conferente para a unidade.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome completo *</Label>
              <Input
                value={regName}
                onChange={(e) => setRegName(capitalize(e.target.value))}
                placeholder="Nome do conferente"
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CPF *</Label>
              <Input
                value={regCpf}
                onChange={(e) => setRegCpf(maskCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="h-11"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={regLoading}>
              {regLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={!!transferConferente} onOpenChange={(open) => !open && setTransferConferente(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Transferir Unidade
            </DialogTitle>
            <DialogDescription>
              Transferir <strong>{transferConferente?.name}</strong> para outra unidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nova unidade *</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleTransfer} disabled={!selectedUnit || transferLoading}>
              {transferLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
              Transferir
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConferente} onOpenChange={(open) => !open && setDeleteConferente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conferente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteConferente?.name}</strong>? Esta ação é permanente e não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConferentesPage;
