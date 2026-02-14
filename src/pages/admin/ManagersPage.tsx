import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Users, Building2, Building, Eye, Pencil, UserCog } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface Domain { id: string; name: string; }
interface Unit { id: string; name: string; }
interface Manager { id: string; name: string; cnpj: string; password: string; manager_password: string | null; active: boolean; unit_id: string; created_at: string; }

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const ManagersPage = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [newManager, setNewManager] = useState({ name: "", cnpj: "", password: "", manager_password: "" });
  const { toast } = useToast();

  // Modal states
  const [viewManager, setViewManager] = useState<Manager | null>(null);
  const [editManager, setEditManager] = useState<Manager | null>(null);
  const [editForm, setEditForm] = useState({ name: "", cnpj: "", password: "" });
  const [credManager, setCredManager] = useState<Manager | null>(null);
  const [credForm, setCredForm] = useState({ cnpj: "", manager_password: "" });

  useEffect(() => {
    supabase.from("domains").select("id, name").eq("active", true).order("name").then(({ data }) => {
      if (data) setDomains(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedDomain) { setUnits([]); setSelectedUnit(""); return; }
    supabase.from("units").select("id, name").eq("domain_id", selectedDomain).eq("active", true).order("name").then(({ data }) => {
      if (data) setUnits(data);
    });
  }, [selectedDomain]);

  useEffect(() => {
    if (!selectedUnit) { setManagers([]); return; }
    refreshManagers();
  }, [selectedUnit]);

  const refreshManagers = () => {
    if (!selectedUnit) return;
    supabase.from("managers").select("*").eq("unit_id", selectedUnit).order("name").then(({ data }) => {
      if (data) setManagers(data);
    });
  };

  const addManager = async () => {
    const cleanCnpj = newManager.cnpj.replace(/\D/g, "");
    if (!newManager.name.trim() || cleanCnpj.length !== 14 || !newManager.password || !selectedUnit) return;
    const { error } = await supabase.from("managers").insert({
      name: newManager.name.trim().toUpperCase(),
      cnpj: cleanCnpj,
      password: newManager.password,
      manager_password: newManager.manager_password || null,
      unit_id: selectedUnit,
    } as any);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewManager({ name: "", cnpj: "", password: "", manager_password: "" });
      refreshManagers();
      toast({ title: "Gerenciador criado" });
    }
  };

  const toggleManager = async (id: string, active: boolean) => {
    await supabase.from("managers").update({ active: !active }).eq("id", id);
    refreshManagers();
  };

  const deleteManager = async (id: string) => {
    await supabase.from("managers").delete().eq("id", id);
    refreshManagers();
    toast({ title: "Gerenciador excluído" });
  };

  const openEdit = (m: Manager) => {
    setEditManager(m);
    setEditForm({ name: m.name, cnpj: formatCnpj(m.cnpj), password: m.password });
  };

  const saveEdit = async () => {
    if (!editManager) return;
    const cleanCnpj = editForm.cnpj.replace(/\D/g, "");
    if (!editForm.name.trim() || cleanCnpj.length !== 14 || !editForm.password) return;
    const { error } = await supabase.from("managers").update({
      name: editForm.name.trim().toUpperCase(),
      cnpj: cleanCnpj,
      password: editForm.password,
    }).eq("id", editManager.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setEditManager(null);
      refreshManagers();
      toast({ title: "Gerenciador atualizado" });
    }
  };

  const openCred = (m: Manager) => {
    setCredManager(m);
    setCredForm({ cnpj: formatCnpj(m.cnpj), manager_password: (m as any).manager_password || "" });
  };

  const saveCred = async () => {
    if (!credManager) return;
    const cleanCnpj = credForm.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14 || !credForm.manager_password) return;
    const { error } = await supabase.from("managers").update({
      cnpj: cleanCnpj,
      manager_password: credForm.manager_password,
    } as any).eq("id", credManager.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setCredManager(null);
      refreshManagers();
      toast({ title: "Credenciais atualizadas" });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <Users className="h-5 w-5 text-primary" />
            Gerenciadores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-semibold italic text-xs flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Domínio
              </Label>
              <Select value={selectedDomain} onValueChange={(v) => { setSelectedDomain(v); setSelectedUnit(""); }}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-semibold italic text-xs flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-primary" /> Unidade
              </Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit} disabled={!selectedDomain}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedUnit ? (
            <>
              {/* Add form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border">
                <Input
                  value={newManager.name}
                  onChange={(e) => setNewManager((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome"
                  className="font-medium italic h-11"
                />
                <Input
                  value={newManager.cnpj}
                  onChange={(e) => setNewManager((p) => ({ ...p, cnpj: formatCnpj(e.target.value) }))}
                  placeholder="00.000.000/0000-00"
                  className="h-11"
                />
                <div className="flex gap-2">
                  <Input
                    value={newManager.password}
                    onChange={(e) => setNewManager((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Senha Acesso"
                    type="password"
                    className="h-11"
                  />
                  <Input
                    value={newManager.manager_password}
                    onChange={(e) => setNewManager((p) => ({ ...p, manager_password: e.target.value }))}
                    placeholder="Senha Gerente"
                    type="password"
                    className="h-11"
                  />
                  <Button size="sm" onClick={addManager} className="h-11 px-4 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* List */}
              <div className="space-y-2">
                {managers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                    <div>
                      <p className="font-bold italic text-sm">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCnpj(m.cnpj)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewManager(m)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCred(m)}>
                        <UserCog className="h-3.5 w-3.5" />
                      </Button>
                      <Switch checked={m.active} onCheckedChange={() => toggleManager(m.id, m.active)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteManager(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {managers.length === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum gerenciador cadastrado</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Selecione um domínio e unidade para gerenciar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal Visualizar */}
      <Dialog open={!!viewManager} onOpenChange={(open) => !open && setViewManager(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Eye className="h-5 w-5 text-primary" /> Detalhes do Gerenciador
            </DialogTitle>
            <DialogDescription>Informações completas do gerenciador.</DialogDescription>
          </DialogHeader>
          {viewManager && (
            <div className="space-y-3 text-sm">
              <div><span className="font-semibold text-muted-foreground">Nome:</span> <span className="font-bold">{viewManager.name}</span></div>
              <div><span className="font-semibold text-muted-foreground">CNPJ:</span> {formatCnpj(viewManager.cnpj)}</div>
              <div><span className="font-semibold text-muted-foreground">Senha de Acesso:</span> {viewManager.password}</div>
              <div><span className="font-semibold text-muted-foreground">Senha Gerente:</span> {(viewManager as any).manager_password || <span className="italic text-muted-foreground">Não definida</span>}</div>
              <div><span className="font-semibold text-muted-foreground">Status:</span> {viewManager.active ? "Ativo" : "Inativo"}</div>
              <div><span className="font-semibold text-muted-foreground">Criado em:</span> {new Date(viewManager.created_at).toLocaleString("pt-BR")}</div>
              <div><span className="font-semibold text-muted-foreground">ID Unidade:</span> <span className="text-xs">{viewManager.unit_id}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editManager} onOpenChange={(open) => !open && setEditManager(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Pencil className="h-5 w-5 text-primary" /> Editar Gerenciador
            </DialogTitle>
            <DialogDescription>Altere os dados do gerenciador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CNPJ</Label>
              <Input value={editForm.cnpj} onChange={(e) => setEditForm((p) => ({ ...p, cnpj: formatCnpj(e.target.value) }))} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha de Acesso</Label>
              <Input value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Credenciais Gerente */}
      <Dialog open={!!credManager} onOpenChange={(open) => !open && setCredManager(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <UserCog className="h-5 w-5 text-primary" /> Credenciais do Gerente
            </DialogTitle>
            <DialogDescription>CNPJ e senha pessoal do gerente (usada no painel).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Login (CNPJ)</Label>
              <Input value={credForm.cnpj} onChange={(e) => setCredForm((p) => ({ ...p, cnpj: formatCnpj(e.target.value) }))} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha Gerente</Label>
              <Input value={credForm.manager_password} onChange={(e) => setCredForm((p) => ({ ...p, manager_password: e.target.value }))} className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveCred}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagersPage;
