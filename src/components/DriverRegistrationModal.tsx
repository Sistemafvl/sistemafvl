import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Truck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskCEP = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

const maskWhatsApp = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskPlate = (v: string) => {
  const raw = v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 7);
  let result = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (i < 3) { if (/[A-Z]/.test(ch)) result += ch; else break; }
    else if (i === 3) { if (/[0-9]/.test(ch)) result += ch; else break; }
    else if (i === 4) { if (/[A-Z]/.test(ch)) result += ch; else break; }
    else { if (/[A-Z0-9]/.test(ch)) result += ch; else break; }
  }
  if (result.length > 3) return result.slice(0, 3) + "-" + result.slice(3);
  return result;
};

const capitalize = (v: string) =>
  v.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const DriverRegistrationModal = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    cep: "",
    address: "",
    neighborhood: "",
    city: "",
    state: "",
    car_plate: "",
    car_model: "",
    car_color: "",
    email: "",
    whatsapp: "",
    password: "",
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Auto-fetch address from CEP
  const rawCep = form.cep.replace(/\D/g, "");
  useEffect(() => {
    if (rawCep.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    fetch(`https://viacep.com.br/ws/${rawCep}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data.erro) return;
        setForm((prev) => ({
          ...prev,
          address: data.logradouro || "",
          neighborhood: data.bairro || "",
          city: data.localidade || "",
          state: data.uf || "",
        }));
      })
      .catch(() => {})
      .finally(() => !cancelled && setCepLoading(false));
    return () => { cancelled = true; };
  }, [rawCep]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = form.cpf.replace(/\D/g, "");
    if (rawCpf.length !== 11) {
      toast({ title: "CPF inválido", variant: "destructive" });
      return;
    }
    if (!form.name || !form.car_plate || !form.car_model || !form.password) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("drivers" as any).insert({
      name: form.name.trim(),
      cpf: rawCpf,
      cep: form.cep.replace(/\D/g, "") || null,
      address: form.address || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      car_plate: form.car_plate.replace("-", "").trim().toUpperCase(),
      car_model: form.car_model.trim(),
      car_color: form.car_color.trim() || null,
      email: form.email.trim() || null,
      whatsapp: form.whatsapp.replace(/\D/g, "") || null,
      password: form.password,
    });
    setLoading(false);

    if (error) {
      const msg = error.message.includes("duplicate")
        ? "CPF já cadastrado"
        : "Erro ao cadastrar. Tente novamente.";
      toast({ title: msg, variant: "destructive" });
      return;
    }

    toast({ title: "Cadastro realizado com sucesso!" });
    setForm({
      name: "", cpf: "", cep: "", address: "", neighborhood: "",
      city: "", state: "", car_plate: "", car_model: "", car_color: "",
      email: "", whatsapp: "", password: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Cadastro Motorista Parceiro
          </DialogTitle>
          <DialogDescription>
            Preencha seus dados para se cadastrar como motorista parceiro.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Nome */}
          <div className="space-y-1">
            <Label htmlFor="dr-name">Nome completo *</Label>
            <Input id="dr-name" value={form.name} onChange={(e) => set("name", capitalize(e.target.value))} required />
          </div>

          {/* CPF */}
          <div className="space-y-1">
            <Label htmlFor="dr-cpf">CPF *</Label>
            <Input id="dr-cpf" value={form.cpf} onChange={(e) => set("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" required />
          </div>

          {/* CEP */}
          <div className="space-y-1">
            <Label htmlFor="dr-cep">CEP</Label>
            <div className="relative">
              <Input id="dr-cep" value={form.cep} onChange={(e) => set("cep", maskCEP(e.target.value))} placeholder="00000-000" />
              {cepLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          {/* Endereço */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="dr-address">Endereço</Label>
              <Input id="dr-address" value={form.address} onChange={(e) => set("address", capitalize(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-neighborhood">Bairro</Label>
              <Input id="dr-neighborhood" value={form.neighborhood} onChange={(e) => set("neighborhood", capitalize(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-city">Cidade</Label>
              <Input id="dr-city" value={form.city} onChange={(e) => set("city", capitalize(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-state">Estado</Label>
              <Input id="dr-state" value={form.state} onChange={(e) => set("state", e.target.value)} maxLength={2} />
            </div>
          </div>

          {/* Veículo */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="dr-plate">Placa do carro *</Label>
              <Input id="dr-plate" value={form.car_plate} onChange={(e) => set("car_plate", maskPlate(e.target.value))} placeholder="AAA-0AAA" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-model">Modelo do carro *</Label>
              <Input id="dr-model" value={form.car_model} onChange={(e) => set("car_model", capitalize(e.target.value))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-color">Cor do carro</Label>
              <Input id="dr-color" value={form.car_color} onChange={(e) => set("car_color", capitalize(e.target.value))} />
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="dr-email">Email</Label>
              <Input id="dr-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-whatsapp">WhatsApp</Label>
              <Input id="dr-whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", maskWhatsApp(e.target.value))} placeholder="(00) 00000-0000" />
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-1">
            <Label htmlFor="dr-password">Senha *</Label>
            <div className="relative">
              <Input
                id="dr-password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            Cadastrar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DriverRegistrationModal;
