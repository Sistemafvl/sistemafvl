import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Users, Building2, Building } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Domain { id: string; name: string; }
interface Unit { id: string; name: string; }
interface Manager { id: string; name: string; cnpj: string; active: boolean; unit_id: string; }

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
  const [newManager, setNewManager] = useState({ name: "", cnpj: "", password: "" });
  const { toast } = useToast();

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
    supabase.from("managers").select("*").eq("unit_id", selectedUnit).order("name").then(({ data }) => {
      if (data) setManagers(data);
    });
  }, [selectedUnit]);

  const addManager = async () => {
    const cleanCnpj = newManager.cnpj.replace(/\D/g, "");
    if (!newManager.name.trim() || cleanCnpj.length !== 14 || !newManager.password || !selectedUnit) return;
    const { error } = await supabase.from("managers").insert({
      name: newManager.name.trim().toUpperCase(),
      cnpj: cleanCnpj,
      password: newManager.password,
      unit_id: selectedUnit,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewManager({ name: "", cnpj: "", password: "" });
      supabase.from("managers").select("*").eq("unit_id", selectedUnit).order("name").then(({ data }) => { if (data) setManagers(data); });
      toast({ title: "Gerenciador criado" });
    }
  };

  const toggleManager = async (id: string, active: boolean) => {
    await supabase.from("managers").update({ active: !active }).eq("id", id);
    if (selectedUnit) supabase.from("managers").select("*").eq("unit_id", selectedUnit).order("name").then(({ data }) => { if (data) setManagers(data); });
  };

  const deleteManager = async (id: string) => {
    await supabase.from("managers").delete().eq("id", id);
    if (selectedUnit) supabase.from("managers").select("*").eq("unit_id", selectedUnit).order("name").then(({ data }) => { if (data) setManagers(data); });
    toast({ title: "Gerenciador excluído" });
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
                    placeholder="Senha"
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
                    <div className="flex items-center gap-2">
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
    </div>
  );
};

export default ManagersPage;
