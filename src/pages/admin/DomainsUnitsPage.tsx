import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Domain {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

interface Unit {
  id: string;
  name: string;
  domain_id: string;
  active: boolean;
  is_matriz: boolean;
}

const DomainsUnitsPage = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState("");
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitPassword, setNewUnitPassword] = useState("");

  const fetchDomains = async () => {
    const { data } = await supabase.from("domains").select("id, name, active, created_at").order("name");
    if (data) setDomains(data);
  };

  const fetchUnits = async (domainId: string) => {
    const { data } = await supabase.from("units").select("id, name, domain_id, active, is_matriz").eq("domain_id", domainId).order("is_matriz", { ascending: false }).order("name");
    if (data) setUnits(data as Unit[]);
  };

  useEffect(() => { fetchDomains(); }, []);
  useEffect(() => { if (selectedDomain) fetchUnits(selectedDomain); }, [selectedDomain]);

  const handleCreateDomain = async () => {
    if (!newDomainName.trim()) return;
    const { error } = await supabase.from("domains").insert({ name: newDomainName.trim().toUpperCase() });
    if (error) { toast.error("Erro ao criar domínio"); return; }
    toast.success("Domínio criado");
    setNewDomainName("");
    setDomainModalOpen(false);
    fetchDomains();
  };

  const handleCreateUnit = async () => {
    if (!newUnitName.trim() || !newUnitPassword.trim() || !selectedDomain) return;
    const { error } = await supabase.from("units").insert({
      name: newUnitName.trim().toUpperCase(),
      password: newUnitPassword.trim(),
      domain_id: selectedDomain,
    });
    if (error) { toast.error("Erro ao criar unidade"); return; }
    toast.success("Unidade criada");
    setNewUnitName("");
    setNewUnitPassword("");
    setUnitModalOpen(false);
    fetchUnits(selectedDomain);
  };

  const handleDeleteUnit = async (unitId: string, name: string) => {
    if (!confirm(`Deletar unidade ${name}?`)) return;
    await supabase.from("units").delete().eq("id", unitId);
    toast.success("Unidade removida");
    if (selectedDomain) fetchUnits(selectedDomain);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold italic">Domínios & Unidades</h1>
        <Button size="sm" onClick={() => setDomainModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Domínio
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Domain list */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase">Domínios</p>
          {domains.map((d) => (
            <Card
              key={d.id}
              className={`cursor-pointer transition-colors ${selectedDomain === d.id ? "border-primary bg-primary/5" : ""}`}
              onClick={() => setSelectedDomain(d.id)}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold italic">{d.name}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Unit list */}
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground uppercase">Unidades</p>
            {selectedDomain && (
              <Button size="sm" variant="outline" onClick={() => setUnitModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova Unidade
              </Button>
            )}
          </div>
          {!selectedDomain ? (
            <p className="text-sm text-muted-foreground italic">Selecione um domínio</p>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhuma unidade</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {units.map((u) => (
                <Card key={u.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold italic">{u.name}</p>
                      {u.is_matriz && <span className="text-[10px] text-amber-600 font-semibold">MATRIZ</span>}
                    </div>
                    {!u.is_matriz && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteUnit(u.id, u.name)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Domain modal */}
      <Dialog open={domainModalOpen} onOpenChange={setDomainModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold italic">Novo Domínio</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateDomain(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)} placeholder="Ex: LOGISTICA SUL" className="h-11" />
            </div>
            <Button className="w-full" type="submit">Criar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unit modal */}
      <Dialog open={unitModalOpen} onOpenChange={setUnitModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-bold italic">Nova Unidade</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateUnit(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome</Label>
              <Input value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} placeholder="Ex: SSP9" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha</Label>
              <Input value={newUnitPassword} onChange={(e) => setNewUnitPassword(e.target.value)} placeholder="Senha da unidade" className="h-11" />
            </div>
            <Button className="w-full" type="submit">Criar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DomainsUnitsPage;
