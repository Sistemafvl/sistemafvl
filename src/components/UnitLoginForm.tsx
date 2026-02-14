import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Building2, KeyRound, LogIn } from "lucide-react";

interface Domain {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  domain_id: string;
}

const UnitLoginForm = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setUnitSession = useAuthStore((s) => s.setUnitSession);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDomains = async () => {
      const { data } = await supabase.from("domains").select("id, name").eq("active", true);
      if (data) setDomains(data);
    };
    fetchDomains();
  }, []);

  useEffect(() => {
    if (!selectedDomain) {
      setUnits([]);
      setSelectedUnit("");
      return;
    }
    const fetchUnits = async () => {
      const { data } = await supabase
        .from("units")
        .select("id, name, domain_id")
        .eq("domain_id", selectedDomain)
        .eq("active", true);
      if (data) setUnits(data);
    };
    fetchUnits();
  }, [selectedDomain]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !password) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("authenticate-unit", {
        body: { unit_id: selectedUnit, password },
      });

      if (error || !data?.success) {
        toast({
          title: "Erro",
          description: data?.error || "Senha inválida",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setUnitSession(data.unit);
    } catch {
      toast({
        title: "Erro",
        description: "Erro ao conectar",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5 w-full max-w-sm animate-slide-up">
      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Domínio
        </Label>
        <Select value={selectedDomain} onValueChange={(v) => { setSelectedDomain(v); setSelectedUnit(""); }}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o domínio" />
          </SelectTrigger>
          <SelectContent>
            {domains.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Unidade
        </Label>
        <Select value={selectedUnit} onValueChange={setSelectedUnit} disabled={!selectedDomain}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          Senha
        </Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={!selectedUnit}
        />
      </div>

      <Button type="submit" className="w-full font-bold italic text-base" disabled={loading || !selectedUnit || !password}>
        <LogIn className="mr-2 h-4 w-4" />
        {loading ? "Entrando..." : "ENTRAR"}
      </Button>
    </form>
  );
};

export default UnitLoginForm;
