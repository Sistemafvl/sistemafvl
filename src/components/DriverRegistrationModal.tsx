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
import { Eye, EyeOff, Truck, Loader2, Upload, Check, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  if (raw.length > 3) return raw.slice(0, 3) + "-" + raw.slice(3);
  return raw;
};

const capitalize = (v: string) =>
  v.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

const DOC_TYPES = [
  { value: "cnh", label: "CNH", required: false },
  { value: "crlv", label: "CRLV", required: false },
  { value: "comprovante_endereco", label: "Comprovante de Endereço", required: false },
  { value: "outros_1", label: "Outros 1", required: false },
  { value: "outros_2", label: "Outros 2", required: false },
  { value: "outros_3", label: "Outros 3", required: false },
];

const DriverRegistrationModal = ({ open, onOpenChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    cep: "",
    address: "",
    house_number: "",
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

  // Document uploads
  const [docFiles, setDocFiles] = useState<Record<string, File>>({});
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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
    if (rawCpf.length !== 11) return;
    if (!form.name || !form.car_plate || !form.car_model || !form.password) return;

    setLoading(true);

    const driverId = crypto.randomUUID();

    const { error } = await supabase.from("drivers" as any).insert({
      id: driverId,
      name: form.name.trim(),
      cpf: rawCpf,
      cep: form.cep.replace(/\D/g, "") || null,
      address: form.address || null,
      house_number: form.house_number || null,
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

    if (error) {
      const msg = error.message.includes("duplicate") ? "CPF ou placa já cadastrado." : "Não foi possível cadastrar o motorista. Tente novamente.";
      toast({ title: "Erro ao cadastrar", description: msg, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Success — close modal and reset immediately
    toast({ title: "Motorista cadastrado!", description: "Cadastro realizado com sucesso." });
    setLoading(false);
    setForm({
      name: "", cpf: "", cep: "", address: "", house_number: "", neighborhood: "",
      city: "", state: "", car_plate: "", car_model: "", car_color: "",
      email: "", whatsapp: "", password: "",
    });
    const pendingDocs = { ...docFiles };
    setDocFiles({});
    onOpenChange(false);

    // Upload documents in the background (fire-and-forget)
    if (Object.keys(pendingDocs).length > 0) {
      (async () => {
        for (const [docType, file] of Object.entries(pendingDocs)) {
          const ext = file.name.split(".").pop()?.toLowerCase();
          const path = `${driverId}/${docType}_${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("driver-documents").upload(path, file);
          if (!uploadError) {
            await supabase.from("driver_documents").insert({
              driver_id: driverId,
              doc_type: docType,
              file_url: path,
              file_name: file.name,
            } as any);
          }
        }
      })();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="dr-address">Endereço</Label>
              <Input id="dr-address" value={form.address} onChange={(e) => set("address", capitalize(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-house-number">Número</Label>
              <Input id="dr-house-number" value={form.house_number} onChange={(e) => set("house_number", e.target.value)} placeholder="Nº" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <Label htmlFor="dr-plate">Placa do Carro/Moto *</Label>
              <Input id="dr-plate" value={form.car_plate} onChange={(e) => set("car_plate", maskPlate(e.target.value))} placeholder="AAA-0AAA" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-model">Modelo do Carro/Moto *</Label>
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

          {/* Documents Upload Section */}
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-bold italic flex items-center gap-1">
              <FileText className="h-4 w-4 text-primary" />
              Documentos
            </p>
            <div className="space-y-2">
              {DOC_TYPES.map((dt) => {
                const file = docFiles[dt.value];
                return (
                  <div key={dt.value} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">
                        {dt.label} {dt.required && <span className="text-destructive">*</span>}
                      </p>
                      {file ? (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                          <Check className="h-3 w-3 text-green-500 shrink-0" />
                          {file.name}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Nenhum arquivo</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <input
                        id={`doc-${dt.value}`}
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.size > 5 * 1024 * 1024) {
                              toast({ title: "Arquivo muito grande", description: "Máximo 5MB.", variant: "destructive" });
                              return;
                            }
                            const ext = f.name.split(".").pop()?.toLowerCase() || "";
                            const isImage = f.type.startsWith("image/") || ["png", "jpg", "jpeg", "heic", "webp"].includes(ext);
                            const isPdf = f.type === "application/pdf" || ext === "pdf";
                            
                            if (!isImage && !isPdf) {
                              toast({ title: "Formato inválido", description: "Selecione uma imagem ou PDF.", variant: "destructive" });
                              return;
                            }
                            setDocFiles(prev => ({ ...prev, [dt.value]: f }));
                          }
                          // This ensures the same file can be selected again if needed
                          e.target.value = "";
                        }}
                      />
                      <Button size="sm" variant="outline" asChild className="h-7 text-xs cursor-pointer">
                        <label htmlFor={`doc-${dt.value}`}>
                          {uploadingDoc === dt.value ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                          {file ? "Trocar" : "Enviar"}
                        </label>
                      </Button>
                    </div>
                  </div>
                );
              })}
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
