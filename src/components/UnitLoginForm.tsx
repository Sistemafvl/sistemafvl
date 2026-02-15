import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth-store";
import { Building2, Eye, EyeOff, KeyRound, LogIn, User, Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

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
  const [showPassword, setShowPassword] = useState(false);
  const [domainOpen, setDomainOpen] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const setUnitSession = useAuthStore((s) => s.setUnitSession);

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
        setLoading(false);
        return;
      }

      setUnitSession(data.unit);
    } catch {
      // Connection error
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 w-full max-w-sm animate-slide-up">
      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Domínio
        </Label>
        <Popover open={domainOpen} onOpenChange={setDomainOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full h-11 justify-between font-normal">
              {selectedDomain ? domains.find((d) => d.id === selectedDomain)?.name : "Selecione o domínio"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar domínio..." />
              <CommandList>
                <CommandEmpty>Nenhum domínio encontrado.</CommandEmpty>
                <CommandGroup>
                  {domains.map((d) => (
                    <CommandItem key={d.id} value={d.name} onSelect={() => { setSelectedDomain(d.id); setSelectedUnit(""); setDomainOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", selectedDomain === d.id ? "opacity-100" : "opacity-0")} />
                      {d.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label className="font-semibold italic flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Unidade
        </Label>
        <Popover open={unitOpen} onOpenChange={setUnitOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full h-11 justify-between font-normal" disabled={!selectedDomain}>
              {selectedUnit ? units.find((u) => u.id === selectedUnit)?.name : "Selecione a unidade"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar unidade..." />
              <CommandList>
                <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
                <CommandGroup>
                  {units.map((u) => (
                    <CommandItem key={u.id} value={u.name} onSelect={() => { setSelectedUnit(u.id); setUnitOpen(false); }}>
                      <Check className={cn("mr-2 h-4 w-4", selectedUnit === u.id ? "opacity-100" : "opacity-0")} />
                      {u.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
        <div className="relative">
          <Input
            className="h-11 pr-10"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={!selectedUnit}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full font-bold italic text-base h-12 mt-2" disabled={loading || !selectedUnit || !document || !password}>
        <LogIn className="mr-2 h-4 w-4" />
        {loading ? "Entrando..." : "ENTRAR"}
      </Button>
    </form>
  );
};

export default UnitLoginForm;
