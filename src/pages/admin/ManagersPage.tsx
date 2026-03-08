import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const ManagersPage = () => {
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cnpj: "", password: "", manager_password: "" });

  useEffect(() => {
    supabase.from("domains").select("id, name").eq("active", true).order("name").then(({ data }) => { if (data) setDomains(data); });
  }, []);

  useEffect(() => {
    if (!selectedDomain) { setUnits([]); return; }
    supabase.from("units").select("id, name").eq("domain_id", selectedDomain).eq("is_matriz", false).eq("active", true).order("name").then(({ data }) => { if (data) setUnits(data); });
  }, [selectedDomain]);

  useEffect(() => {
    if (!selectedUnit) { setManagers([]); return; }
    supabase.from("managers").select("*").eq("unit_id", selectedUnit).order("name").then(({ data }) => { if (data) setManagers(data); });
  }, [selectedUnit]);

  const handleCreate = async () => {
    if (!form.name || !form.cnpj || !form.password || !selectedUnit) return;
    const { error } = await supabase.from("managers").insert({
      unit_id: selectedUnit,
      name: form.name.trim(),
      cnpj: form.cnpj.replace(/\D/g, ""),
      password: form.password,
      manager_password: form.manager_password || form.password,
    });
    if (error) { toast.error("Erro ao criar gerente"); return; }
    toast.success("Gerente criado");
    setForm({ name: "", cnpj: "", password: "", manager_password: "" });
    setModalOpen(false);
    supabase.from("managers").select("*").eq("unit_id", selectedUnit).order("name").then(({ data }) => { if (data) setManagers(data); });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover gerente ${name}?`)) return;
    await supabase.from("managers").delete().eq("id", id);
    toast.success("Gerente removido");
    setManagers((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold italic">Gerentes</h1>
        {selectedUnit && (
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Gerente
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={selectedDomain} onValueChange={(v) => { setSelectedDomain(v); setSelectedUnit(""); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Domínio" /></SelectTrigger>
          <SelectContent>{domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        {units.length > 0 && (
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {managers.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold italic">{m.name}</p>
                  <p className="text-[10px] text-muted-foreground">{m.cnpj}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id, m.name)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold italic">Novo Gerente</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })} placeholder="00.000.000/0000-00" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha Login</Label>
              <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha Gerente (Dashboard)</Label>
              <Input value={form.manager_password} onChange={(e) => setForm({ ...form, manager_password: e.target.value })} placeholder="Igual à senha login se vazio" className="h-11" />
            </div>
            <Button className="w-full" type="submit">Criar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManagersPage;
