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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, UserCheck, ArrowRight } from "lucide-react";

const REQUIRED_FIELDS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "birth_date", label: "Data de Nascimento" },
  { key: "emergency_contact_1", label: "Contato de Emergência 1" },
  { key: "emergency_contact_2", label: "Contato de Emergência 2" },
];

const DriverMissingFieldsModal = () => {
  const { unitSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const driverId = unitSession?.user_profile_id;

  useEffect(() => {
    if (!driverId) return;
    
    // Auto-close or don't show if already on profile page
    if (location.pathname.includes("/motorista/perfil")) {
      setShowModal(false);
      return;
    }

    const checkMissingFields = async () => {
      try {
        setLoading(true);
        // Use edge function to bypass RLS and accurately check fields
        const { data: driverData, error } = await supabase.functions.invoke("get-driver-details", {
          body: { driver_id: driverId, self_access: true }
        });

        if (error || !driverData) {
          console.error("Error checking profile completion:", error);
          setLoading(false);
          return;
        }

        const missing = REQUIRED_FIELDS
          .filter(f => !driverData[f.key])
          .map(f => f.label);

        if (missing.length > 0) {
          setMissingFields(missing);
          setShowModal(true);
        } else {
          setShowModal(false);
        }
      } catch (err) {
        console.error("Critical error checking profile:", err);
      } finally {
        setLoading(false);
      }
    };

    checkMissingFields();
  }, [driverId, location.pathname]);

  const handleGoToProfile = () => {
    setShowModal(false);
    navigate("/motorista/perfil");
  };

  if (!showModal || loading) return null;

  return (
    <Dialog open={showModal} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md border-destructive/20 shadow-2xl [&>button]:hidden">
        <DialogHeader className="flex flex-col items-center justify-center text-center space-y-4 pt-4">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <ShieldAlert className="h-12 w-12 text-destructive animate-pulse" />
          </div>
          
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-black italic text-destructive uppercase tracking-tighter">
              Perfil Incompleto!
            </DialogTitle>
            <DialogDescription className="text-base font-semibold text-foreground px-4">
              Para sua segurança e conformidade da FVL, precisamos que você complete seu cadastro.
            </DialogDescription>
          </div>

          <div className="w-full bg-destructive/5 p-4 rounded-xl border border-destructive/10 text-left">
            <p className="font-bold text-xs uppercase text-destructive/70 mb-2 flex items-center gap-2">
              <UserCheck className="h-3 w-3" /> Campos Obrigatórios Faltantes:
            </p>
            <ul className="grid grid-cols-1 gap-1">
              {missingFields.map((field, idx) => (
                <li key={idx} className="text-sm font-bold text-destructive flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  {field}
                </li>
              ))}
            </ul>
          </div>

          <div className="text-[11px] text-muted-foreground px-6 leading-tight italic">
            * O preenchimento destes dados é indispensável para a liberação de novos carregamentos e contato em casos de emergência.
          </div>
        </DialogHeader>

        <DialogFooter className="sm:justify-center mt-6 pb-4">
          <Button 
            variant="destructive" 
            className="w-full h-14 text-lg font-black italic uppercase tracking-widest gap-3 shadow-[0_4px_25px_rgba(220,38,38,0.4)] hover:shadow-[0_4px_30px_rgba(220,38,38,0.5)] transition-all group"
            onClick={handleGoToProfile}
          >
            Completar Cadastro Agora
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DriverMissingFieldsModal;
