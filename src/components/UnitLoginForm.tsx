import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/hooks/use-toast";
import { Building2, KeyRound, LogIn, User } from "lucide-react";

interface Domain { id: string; name: string; }
interface Unit { id: string; name: string; domain_id: string; }

const formatCpf = (v: string) =>
  v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const formatCnpj = (v: string) =>
  v.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");

const UnitLoginForm = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [document, setDocument] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setUnitSession = useAuthStore((s) => s.setUnitSession);
  const { toast } = useToast();

  const rawDigits = document.replace(/\D/g, "");
  const isCnpj = rawDigits.length > 11;
  const docType = isCnpj ? "CNPJ" : "CPF";

  useEffect(() => {
    supabase.from("domains").select("id, name").eq("active", true).then(({ data }) => { if (data) setDomains(data); });
  }, []);

  useEffect(() => {
    if (!selectedDomain) { setUnits([]); setSelectedUnit(""); return; }
    supabase.from("units").select("id, name, domain_id").eq("domain_id", selectedDomain).eq("active", true).then(({ data }) => { if (data) setUnits(data); });
  }, [selectedDomain]);

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 14);
    setDocument(digits.length > 11 ? formatCnpj(digits) : formatCpf(digits));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !document || !password) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("authenticate-unit", {
        body: { unit_id: selectedUnit, document: rawDigits, password },
      });

      if (error || !data?.success) {
        toast({ title: "Erro", description: data?.error || "Credenciais inválidas", variant: "destructive" });
        setLoading(false);
        return;
      }

      setUnitSession(data.unit);
    } catch {
      toast({ title: "Erro", description: "Erro ao conectar", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 w-full max-w-sm animate-slide-up">
      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Domínio
        </Label>
        <Select value={selectedDomain} onValueChange={(v) => { setSelectedDomain(v); setSelectedUnit(""); }}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Selecione o domínio" /></SelectTrigger>
          <SelectContent>{domains.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Unidade
        </Label>
        <Select value={selectedUnit} onValueChange={setSelectedUnit} disabled={!selectedDomain}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
          <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <User className="h-4 w-4 text-primary" /> CPF / CNPJ
        </Label>
        <Input
          className="h-11"
          type="text"
          inputMode="numeric"
          value={document}
          onChange={handleDocChange}
          placeholder="000.000.000-00"
          disabled={!selectedUnit}
        />
        {rawDigits.length > 0 && (
          <p className="text-xs text-muted-foreground italic">
            Identificado como: <span className="font-bold text-primary">{docType}</span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" /> Senha
        </Label>
        <Input
          className="h-11"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={!selectedUnit}
        />
      </div>

      <Button type="submit" className="w-full font-bold italic text-base h-12 mt-2" disabled={loading || !selectedUnit || !document || !password}>
        <LogIn className="mr-2 h-4 w-4" />
        {loading ? "Entrando..." : "ENTRAR"}
      </Button>
    </form>
  );
};

export default UnitLoginForm;
