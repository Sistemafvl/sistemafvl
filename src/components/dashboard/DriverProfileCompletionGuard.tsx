import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

const REQUIRED_FIELDS = ["whatsapp", "emergency_contact_1", "emergency_contact_2", "birth_date"];

const DriverProfileCompletionGuard = () => {
  const { unitSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const driverId = unitSession?.user_profile_id;

  useEffect(() => {
    if (!driverId) return;
    // Don't show modal if already on profile page
    if (location.pathname.includes("/driver/perfil")) return;

    const check = async () => {
      const { data } = await supabase
        .from("drivers")
        .select("whatsapp, emergency_contact_1, emergency_contact_2, birth_date")
        .eq("id", driverId)
        .single();

      if (!data) return;
      const d = data as any;
      const missing = REQUIRED_FIELDS.some((f) => !d[f]);
      if (missing) setShowModal(true);
    };
    check();
  }, [driverId, location.pathname]);

  const handleGo = () => {
    setShowModal(false);
    navigate("/driver/perfil");
  };

  return (
    <Dialog open={showModal} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Dados Obrigatórios Pendentes
          </DialogTitle>
          <DialogDescription>
            Para continuar utilizando o sistema, é necessário preencher os seguintes dados no seu perfil: <strong>WhatsApp</strong>, <strong>Contatos de Emergência</strong> e <strong>Data de Nascimento</strong>.
          </DialogDescription>
        </DialogHeader>
        <Button onClick={handleGo} className="w-full font-bold italic">
          IR PARA O PERFIL
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DriverProfileCompletionGuard;
