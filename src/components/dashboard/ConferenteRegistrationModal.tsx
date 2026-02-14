import { useState } from "react";
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
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const capitalize = (v: string) =>
  v.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ConferenteRegistrationModal = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const { unitSession } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCpf = cpf.replace(/\D/g, "");
    if (!name.trim()) {
      toast({ title: "Preencha o nome", variant: "destructive" });
      return;
    }
    if (rawCpf.length !== 11) {
      toast({ title: "CPF inválido", variant: "destructive" });
      return;
    }
    if (!unitSession) return;

    setLoading(true);
    const { error } = await supabase.from("user_profiles").insert({
      name: name.trim(),
      cpf: rawCpf,
      unit_id: unitSession.id,
    });
    setLoading(false);

    if (error) {
      const msg = error.message.includes("duplicate")
        ? "CPF já cadastrado nesta unidade"
        : "Erro ao cadastrar. Tente novamente.";
      toast({ title: msg, variant: "destructive" });
      return;
    }

    toast({ title: "Conferente cadastrado com sucesso!" });
    setName("");
    setCpf("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-bold italic">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Cadastro de Conferente
          </DialogTitle>
          <DialogDescription>
            Cadastre um novo conferente para a unidade.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nome completo *</Label>
            <Input
              value={name}
              onChange={(e) => setName(capitalize(e.target.value))}
              placeholder="Nome do conferente"
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">CPF *</Label>
            <Input
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              placeholder="000.000.000-00"
              className="h-11"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ConferenteRegistrationModal;
