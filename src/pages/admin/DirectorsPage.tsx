import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Crown, Eye, EyeOff, Pencil } from "lucide-react";
import { toast } from "sonner";

const formatCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const DirectorsPage = () => {
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [matrizUnitId, setMatrizUnitId] = useState("");
  const [directors, setDirectors] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cpf: "", password: "" });

  // Detail/edit modal
  const [detailDirector, setDetailDirector] = useState<any | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", cpf: "", password: "" });

  useEffect(() => {
    supabase.from("domains").select("id, name").eq("active", true).order("name").then(({ data }) => { if (data) setDomains(data); });
  }, []);

  const fetchDirectors = () => {
    if (!matrizUnitId) return;
    supabase.from("directors").select("id, unit_id, name, cpf, password, active, created_at").eq("unit_id", matrizUnitId).order("name").then(({ data }) => { if (data) setDirectors(data); });
  };

  useEffect(() => {
    if (!selectedDomain) { setDirectors([]); return; }
    supabase.from("units").select("id").eq("domain_id", selectedDomain).eq("is_matriz", true).maybeSingle().then(({ data }) => {
      if (data) {
        setMatrizUnitId(data.id);
      }
    });
  }, [selectedDomain]);

  useEffect(() => { if (matrizUnitId) fetchDirectors(); }, [matrizUnitId]);

  const handleCreate = async () => {
    if (!form.name || !form.cpf || !form.password || !matrizUnitId) return;
    const { error } = await supabase.from("directors").insert({
      unit_id: matrizUnitId,
      name: form.name.trim(),
      cpf: form.cpf.replace(/\D/g, ""),
      password: form.password,
    });
    if (error) { 
      toast.error(`Erro ao criar diretor: ${error.message || JSON.stringify(error)}`); 
      return; 
    }
    toast.success("Diretor criado");
    setForm({ name: "", cpf: "", password: "" });
    setModalOpen(false);
    fetchDirectors();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover diretor ${name}?`)) return;
    await supabase.from("directors").delete().eq("id", id);
    toast.success("Diretor removido");
    setDirectors((prev) => prev.filter((d) => d.id !== id));
  };

  const openDetail = (d: any) => {
    setDetailDirector(d);
    setEditForm({ name: d.name, cpf: formatCpf(d.cpf), password: d.password });
    setShowPassword(false);
    setEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!detailDirector) return;
    const { error } = await supabase.from("directors").update({
      name: editForm.name.trim(),
      cpf: editForm.cpf.replace(/\D/g, ""),
      password: editForm.password,
    }).eq("id", detailDirector.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Diretor atualizado");
    setEditMode(false);
    setDetailDirector(null);
    fetchDirectors();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold italic">Diretores</h1>
        {selectedDomain && matrizUnitId && (
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Diretor
          </Button>
        )}
      </div>

      <Select value={selectedDomain} onValueChange={setSelectedDomain}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Selecionar Domínio" /></SelectTrigger>
        <SelectContent>{domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
      </Select>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {directors.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold italic">{d.name}</p>
                  <p className="text-[10px] text-muted-foreground">{d.cpf}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openDetail(d)}>
                  <Eye className="h-3.5 w-3.5 text-primary" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id, d.name)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold italic">Novo Diretor</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCpf(e.target.value) })} placeholder="000.000.000-00" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha</Label>
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11" />
            </div>
            <Button className="w-full" type="submit">Criar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail/Edit modal */}
      <Dialog open={!!detailDirector} onOpenChange={(open) => { if (!open) setDetailDirector(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600" />
              {editMode ? "Editar Diretor" : "Detalhes do Diretor"}
            </DialogTitle>
          </DialogHeader>
          {detailDirector && (
            <div className="space-y-4">
              {editMode ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nome</Label>
                    <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">CPF</Label>
                    <Input value={editForm.cpf} onChange={(e) => setEditForm({ ...editForm, cpf: formatCpf(e.target.value) })} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Senha</Label>
                    <Input value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} className="h-11" />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleSaveEdit}>Salvar</Button>
                    <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Nome</p>
                      <p className="font-semibold italic">{detailDirector.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">CPF</p>
                      <p className="font-mono text-xs">{formatCpf(detailDirector.cpf)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Senha</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{showPassword ? detailDirector.password : "••••••••"}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Status</p>
                    <span className={`text-xs font-semibold ${detailDirector.active ? "text-green-600" : "text-destructive"}`}>
                      {detailDirector.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => setEditMode(true)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DirectorsPage;
