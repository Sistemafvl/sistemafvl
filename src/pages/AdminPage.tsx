import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LogoHeader from "@/components/LogoHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Plus, Trash2, Building2, Building, Edit2, Check, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Domain {
  id: string;
  name: string;
  active: boolean;
}

interface Unit {
  id: string;
  domain_id: string;
  name: string;
  active: boolean;
}

const AdminPage = () => {
  const { isMasterAdmin, logout } = useAuthStore();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [newUnit, setNewUnit] = useState({ domain_id: "", name: "", password: "" });
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDomains = async () => {
    const { data } = await supabase.from("domains").select("*").order("name");
    if (data) setDomains(data);
  };

  const fetchUnits = async (domainId: string) => {
    const { data } = await supabase.from("units").select("*").eq("domain_id", domainId).order("name");
    if (data) setUnits(data);
  };

  useEffect(() => {
    if (isMasterAdmin) fetchDomains();
  }, [isMasterAdmin]);

  useEffect(() => {
    if (selectedDomain) fetchUnits(selectedDomain);
    else setUnits([]);
  }, [selectedDomain]);

  if (!isMasterAdmin) return <Navigate to="/" replace />;

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    const { error } = await supabase.from("domains").insert({ name: newDomain.trim().toUpperCase() });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewDomain("");
      fetchDomains();
      toast({ title: "Domínio criado" });
    }
  };

  const toggleDomain = async (id: string, active: boolean) => {
    await supabase.from("domains").update({ active: !active }).eq("id", id);
    fetchDomains();
  };

  const deleteDomain = async (id: string) => {
    await supabase.from("domains").delete().eq("id", id);
    if (selectedDomain === id) setSelectedDomain(null);
    fetchDomains();
    toast({ title: "Domínio excluído" });
  };

  const addUnit = async () => {
    if (!newUnit.name.trim() || !newUnit.password || !selectedDomain) return;
    const { error } = await supabase.from("units").insert({
      domain_id: selectedDomain,
      name: newUnit.name.trim().toUpperCase(),
      password: newUnit.password,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewUnit({ domain_id: "", name: "", password: "" });
      fetchUnits(selectedDomain);
      toast({ title: "Unidade criada" });
    }
  };

  const toggleUnit = async (id: string, active: boolean) => {
    await supabase.from("units").update({ active: !active }).eq("id", id);
    if (selectedDomain) fetchUnits(selectedDomain);
  };

  const deleteUnit = async (id: string) => {
    await supabase.from("units").delete().eq("id", id);
    if (selectedDomain) fetchUnits(selectedDomain);
    toast({ title: "Unidade excluída" });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <LogoHeader size="sm" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold italic text-primary uppercase tracking-wider">Master Admin</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground italic font-semibold">
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domains */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-bold italic">
              <Building2 className="h-5 w-5 text-primary" />
              Domínios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="Nome do domínio"
                className="font-medium italic"
                onKeyDown={(e) => e.key === "Enter" && addDomain()}
              />
              <Button size="sm" onClick={addDomain}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {domains.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between p-3 rounded-md border transition-all cursor-pointer ${
                    selectedDomain === d.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedDomain(d.id)}
                >
                  <span className="font-bold italic text-sm">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <Switch checked={d.active} onCheckedChange={() => toggleDomain(d.id, d.active)} />
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteDomain(d.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {domains.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum domínio cadastrado</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Units */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-bold italic">
              <Building className="h-5 w-5 text-primary" />
              Unidades
              {selectedDomain && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  ({domains.find((d) => d.id === selectedDomain)?.name})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedDomain ? (
              <>
                <div className="flex gap-2">
                  <Input
                    value={newUnit.name}
                    onChange={(e) => setNewUnit((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nome"
                    className="font-medium italic"
                  />
                  <Input
                    value={newUnit.password}
                    onChange={(e) => setNewUnit((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Senha"
                    type="password"
                  />
                  <Button size="sm" onClick={addUnit}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {units.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                      <span className="font-bold italic text-sm">{u.name}</span>
                      <div className="flex items-center gap-2">
                        <Switch checked={u.active} onCheckedChange={() => toggleUnit(u.id, u.active)} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteUnit(u.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {units.length === 0 && (
                    <p className="text-sm text-muted-foreground italic text-center py-4">Nenhuma unidade cadastrada</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                Selecione um domínio para gerenciar unidades
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPage;
