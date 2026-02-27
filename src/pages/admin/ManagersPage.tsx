import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Building2, Building, Eye, Pencil, UserCog, Loader2, Crown } from "lucide-react";
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
interface ManagerPublic { id: string; name: string; cnpj: string; active: boolean; unit_id: string; created_at: string; }
interface DirectorPublic { id: string; name: string; cpf: string; active: boolean; unit_id: string; created_at: string; }

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const formatCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const ManagersPage = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [managers, setManagers] = useState<ManagerPublic[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [newManager, setNewManager] = useState({ name: "", cnpj: "", password: "", manager_password: "" });

  // Director states
  const [directors, setDirectors] = useState<DirectorPublic[]>([]);
  const [matrizUnitId, setMatrizUnitId] = useState<string | null>(null);
  const [newDirector, setNewDirector] = useState({ name: "", cpf: "", password: "" });

  // Modal states
  const [viewManager, setViewManager] = useState<ManagerPublic | null>(null);
  const [viewPasswords, setViewPasswords] = useState<{ password: string; manager_password: string | null } | null>(null);
  const [viewPasswordsLoading, setViewPasswordsLoading] = useState(false);
  const [editManager, setEditManager] = useState<ManagerPublic | null>(null);
  const [editForm, setEditForm] = useState({ name: "", cnpj: "", password: "" });
  const [credManager, setCredManager] = useState<ManagerPublic | null>(null);
  const [credForm, setCredForm] = useState({ cnpj: "", manager_password: "" });

  // Director edit modal
  const [editDirector, setEditDirector] = useState<DirectorPublic | null>(null);
  const [editDirectorForm, setEditDirectorForm] = useState({ name: "", cpf: "", password: "" });

  useEffect(() => {
    supabase.from("domains").select("id, name").eq("active", true).order("name").then(({ data }) => {
      if (data) setDomains(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedDomain) { setUnits([]); setSelectedUnit(""); setMatrizUnitId(null); setDirectors([]); return; }
    // Fetch units (excluding MATRIZ ADMIN from the unit select)
    supabase.from("units_public").select("id, name").eq("domain_id", selectedDomain).eq("active", true).order("name").then(({ data }) => {
      if (data) {
        const nonMatriz = (data as any[]).filter((u: any) => u.name !== "MATRIZ ADMIN");
        setUnits(nonMatriz);
      }
    });
    // Find Matriz unit for this domain to manage directors
    supabase.from("units").select("id").eq("domain_id", selectedDomain).eq("is_matriz", true).single().then(({ data }) => {
      if (data) {
        setMatrizUnitId(data.id);
        refreshDirectors(data.id);
      } else {
        setMatrizUnitId(null);
        setDirectors([]);
      }
    });
  }, [selectedDomain]);

  useEffect(() => {
    if (!selectedUnit) { setManagers([]); return; }
    refreshManagers();
  }, [selectedUnit]);

  const refreshManagers = () => {
    if (!selectedUnit) return;
    supabase.from("managers_public").select("*").eq("unit_id", selectedUnit).order("name").then(({ data }) => {
      if (data) setManagers(data as any);
    });
  };

  const refreshDirectors = (unitId?: string) => {
    const id = unitId || matrizUnitId;
    if (!id) return;
    supabase.from("directors_public").select("*").eq("unit_id", id).order("name").then(({ data }) => {
      if (data) setDirectors(data as any);
    });
  };

  const addDirector = async () => {
    const cleanCpf = newDirector.cpf.replace(/\D/g, "");
    if (!newDirector.name.trim() || cleanCpf.length !== 11 || !newDirector.password || !matrizUnitId) return;
    const { error } = await supabase.from("directors").insert({
      name: newDirector.name.trim().toUpperCase(),
      cpf: cleanCpf,
      password: newDirector.password,
      unit_id: matrizUnitId,
    } as any);
    if (!error) {
      setNewDirector({ name: "", cpf: "", password: "" });
      refreshDirectors();
    }
  };

  const toggleDirector = async (id: string, active: boolean) => {
    await supabase.from("directors").update({ active: !active } as any).eq("id", id);
    refreshDirectors();
  };

  const deleteDirector = async (id: string) => {
    await supabase.from("directors").delete().eq("id", id);
    refreshDirectors();
  };

  const openEditDirector = (d: DirectorPublic) => {
    setEditDirector(d);
    setEditDirectorForm({ name: d.name, cpf: formatCpf(d.cpf), password: "" });
  };

  const saveEditDirector = async () => {
    if (!editDirector) return;
    const cleanCpf = editDirectorForm.cpf.replace(/\D/g, "");
    if (!editDirectorForm.name.trim() || cleanCpf.length !== 11) return;
    const updates: any = { name: editDirectorForm.name.trim().toUpperCase(), cpf: cleanCpf };
    if (editDirectorForm.password.trim()) updates.password = editDirectorForm.password.trim();
    await supabase.from("directors").update(updates).eq("id", editDirector.id);
    setEditDirector(null);
    refreshDirectors();
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
    if (!error) {
      setNewManager({ name: "", cnpj: "", password: "", manager_password: "" });
      refreshManagers();
    }
  };

  const toggleManager = async (id: string, active: boolean) => {
    await supabase.from("managers").update({ active: !active }).eq("id", id);
    refreshManagers();
  };

  const deleteManager = async (id: string) => {
    await supabase.from("managers").delete().eq("id", id);
    refreshManagers();
  };

  const openView = async (m: ManagerPublic) => {
    setViewManager(m);
    setViewPasswords(null);
    setViewPasswordsLoading(true);
    const { data } = await supabase.functions.invoke("get-manager-details", {
      body: { manager_id: m.id },
    });
    setViewPasswords(data ?? null);
    setViewPasswordsLoading(false);
  };

  const openEdit = (m: ManagerPublic) => {
    setEditManager(m);
    setEditForm({ name: m.name, cnpj: formatCnpj(m.cnpj), password: "" });
  };

  const saveEdit = async () => {
    if (!editManager) return;
    const cleanCnpj = editForm.cnpj.replace(/\D/g, "");
    if (!editForm.name.trim() || cleanCnpj.length !== 14) return;
    const updates: any = { name: editForm.name.trim().toUpperCase(), cnpj: cleanCnpj };
    if (editForm.password.trim()) updates.password = editForm.password.trim();
    const { error } = await supabase.from("managers").update(updates).eq("id", editManager.id);
    if (!error) { setEditManager(null); refreshManagers(); }
  };

  const openCred = (m: ManagerPublic) => {
    setCredManager(m);
    setCredForm({ cnpj: formatCnpj(m.cnpj), manager_password: "" });
  };

  const saveCred = async () => {
    if (!credManager) return;
    const cleanCnpj = credForm.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14 || !credForm.manager_password) return;
    const { error } = await supabase.from("managers").update({
      cnpj: cleanCnpj,
      manager_password: credForm.manager_password,
    } as any).eq("id", credManager.id);
    if (!error) { setCredManager(null); refreshManagers(); }
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

          {/* Director section - when domain selected but no unit */}
          {selectedDomain && !selectedUnit && matrizUnitId && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-bold italic">Diretor do Domínio</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  value={newDirector.name}
                  onChange={(e) => setNewDirector(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nome"
                  className="font-medium italic h-11"
                />
                <Input
                  value={newDirector.cpf}
                  onChange={(e) => setNewDirector(p => ({ ...p, cpf: formatCpf(e.target.value) }))}
                  placeholder="000.000.000-00"
                  className="h-11"
                />
                <div className="flex gap-2">
                  <Input
                    value={newDirector.password}
                    onChange={(e) => setNewDirector(p => ({ ...p, password: e.target.value }))}
                    placeholder="Senha"
                    type="password"
                    className="h-11"
                  />
                  <Button size="sm" onClick={addDirector} className="h-11 px-4 shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {directors.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                    <div>
                      <p className="font-bold italic text-sm">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCpf(d.cpf)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDirector(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Switch checked={d.active} onCheckedChange={() => toggleDirector(d.id, d.active)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteDirector(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {directors.length === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-2">Nenhum diretor cadastrado</p>
                )}
              </div>
            </div>
          )}

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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(m)}>
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
          ) : !selectedDomain ? (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Selecione um domínio e unidade para gerenciar
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Modal Visualizar */}
      <Dialog open={!!viewManager} onOpenChange={(open) => { if (!open) { setViewManager(null); setViewPasswords(null); } }}>
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
              <div>
                <span className="font-semibold text-muted-foreground">Senha de Acesso:</span>{" "}
                {viewPasswordsLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : viewPasswords?.password ?? "—"}
              </div>
              <div>
                <span className="font-semibold text-muted-foreground">Senha Gerente:</span>{" "}
                {viewPasswordsLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : viewPasswords?.manager_password || <span className="italic text-muted-foreground">Não definida</span>}
              </div>
              <div><span className="font-semibold text-muted-foreground">Status:</span> {viewManager.active ? "Ativo" : "Inativo"}</div>
              <div><span className="font-semibold text-muted-foreground">Criado em:</span> {new Date(viewManager.created_at).toLocaleString("pt-BR")}</div>
              <div><span className="font-semibold text-muted-foreground">ID Unidade:</span> <span className="text-xs">{viewManager.unit_id}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Editar Manager */}
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
              <Label className="text-xs font-semibold">Nova Senha de Acesso (deixe vazio para manter)</Label>
              <Input value={editForm.password} onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))} type="password" className="h-11" />
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

      {/* Modal Editar Diretor */}
      <Dialog open={!!editDirector} onOpenChange={(open) => !open && setEditDirector(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Pencil className="h-5 w-5 text-amber-500" /> Editar Diretor
            </DialogTitle>
            <DialogDescription>Altere os dados do diretor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input value={editDirectorForm.name} onChange={(e) => setEditDirectorForm(p => ({ ...p, name: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CPF</Label>
              <Input value={editDirectorForm.cpf} onChange={(e) => setEditDirectorForm(p => ({ ...p, cpf: formatCpf(e.target.value) }))} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nova Senha (deixe vazio para manter)</Label>
              <Input value={editDirectorForm.password} onChange={(e) => setEditDirectorForm(p => ({ ...p, password: e.target.value }))} type="password" className="h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveEditDirector}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagersPage;
