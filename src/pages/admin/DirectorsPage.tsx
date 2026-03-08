import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Crown } from "lucide-react";
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

  useEffect(() => {
    supabase.from("domains").select("id, name").eq("active", true).order("name").then(({ data }) => { if (data) setDomains(data); });
  }, []);

  useEffect(() => {
    if (!selectedDomain) { setDirectors([]); return; }
    // Find the MATRIZ ADMIN unit for this domain
    supabase.from("units").select("id").eq("domain_id", selectedDomain).eq("is_matriz", true).maybeSingle().then(({ data }) => {
      if (data) {
        setMatrizUnitId(data.id);
        supabase.from("directors").select("*").eq("unit_id", data.id).order("name").then(({ data: dirs }) => {
          if (dirs) setDirectors(dirs);
        });
      }
    });
  }, [selectedDomain]);

  const handleCreate = async () => {
    if (!form.name || !form.cpf || !form.password || !matrizUnitId) return;
    const { error } = await supabase.from("directors").insert({
      unit_id: matrizUnitId,
      name: form.name.trim(),
      cpf: form.cpf.replace(/\D/g, ""),
      password: form.password,
    });
    if (error) { toast.error("Erro ao criar diretor"); return; }
    toast.success("Diretor criado");
    setForm({ name: "", cpf: "", password: "" });
    setModalOpen(false);
    supabase.from("directors").select("*").eq("unit_id", matrizUnitId).order("name").then(({ data }) => { if (data) setDirectors(data); });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover diretor ${name}?`)) return;
    await supabase.from("directors").delete().eq("id", id);
    toast.success("Diretor removido");
    setDirectors((prev) => prev.filter((d) => d.id !== id));
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
              <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id, d.name)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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
    </div>
  );
};

export default DirectorsPage;
