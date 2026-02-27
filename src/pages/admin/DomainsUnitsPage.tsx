import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Building2, Building, Crown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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
  is_matriz?: boolean;
}

const DomainsUnitsPage = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [newUnit, setNewUnit] = useState({ name: "", password: "" });
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const fetchDomains = async () => {
    const { data } = await supabase.from("domains").select("id, name, active").order("name");
    if (data) setDomains(data);
  };

  const fetchUnits = async (domainId: string) => {
    const { data } = await supabase.from("units").select("id, domain_id, name, active, is_matriz").eq("domain_id", domainId).order("name");
    if (data) setUnits(data as any);
  };

  useEffect(() => { fetchDomains(); }, []);

  useEffect(() => {
    if (selectedDomain) fetchUnits(selectedDomain);
    else setUnits([]);
  }, [selectedDomain]);

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    const { error } = await supabase.from("domains").insert({ name: newDomain.trim().toUpperCase() });
    if (!error) {
      setNewDomain("");
      fetchDomains();
      // Refresh units if a domain is selected (trigger creates MATRIZ ADMIN)
      if (selectedDomain) setTimeout(() => fetchUnits(selectedDomain), 500);
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
  };

  const addUnit = async () => {
    if (!newUnit.name.trim() || !newUnit.password || !selectedDomain) return;
    const { error } = await supabase.from("units").insert({
      domain_id: selectedDomain,
      name: newUnit.name.trim().toUpperCase(),
      password: newUnit.password,
    });
    if (!error) {
      setNewUnit({ name: "", password: "" });
      fetchUnits(selectedDomain);
    }
  };

  const toggleUnit = async (id: string, active: boolean) => {
    await supabase.from("units").update({ active: !active }).eq("id", id);
    if (selectedDomain) fetchUnits(selectedDomain);
  };

  const deleteUnit = async (id: string) => {
    await supabase.from("units").delete().eq("id", id);
    if (selectedDomain) fetchUnits(selectedDomain);
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
              className="font-medium italic h-11"
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
            />
            <Button size="sm" onClick={addDomain} className="h-11 px-4">
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
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteDomain(d.id); }}>
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
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={newUnit.name}
                  onChange={(e) => setNewUnit((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome"
                  className="font-medium italic h-11"
                />
                <Input
                  value={newUnit.password}
                  onChange={(e) => setNewUnit((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Senha"
                  type="password"
                  className="h-11"
                />
                <Button size="sm" onClick={addUnit} className="h-11 px-4">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {units.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                    <div className="flex items-center gap-2">
                      <span className="font-bold italic text-sm">{u.name}</span>
                      {u.is_matriz && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 gap-1 text-[10px]">
                          <Crown className="h-3 w-3" /> Matriz
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={u.active} onCheckedChange={() => toggleUnit(u.id, u.active)} />
                      {!u.is_matriz && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteUnit(u.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
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
  );
};

export default DomainsUnitsPage;
