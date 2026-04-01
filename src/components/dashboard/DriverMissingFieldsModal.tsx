import { useState, useEffect } from "react";
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
import { AlertTriangle, User, Phone, Calendar, Shield } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * DriverMissingFieldsModal
 * Checks if the driver has filled all required profile fields.
 * If not, shows a persistent modal redirecting them to the profile page.
 * The modal will keep appearing until all required fields are filled.
 */

const REQUIRED_FIELDS = [
  { key: "whatsapp", label: "WhatsApp", icon: Phone },
  { key: "birth_date", label: "Data de Nascimento", icon: Calendar },
  { key: "contact_1", label: "Contato de Emergência 1", icon: Shield },
  { key: "contact_2", label: "Contato de Emergência 2", icon: Shield },
];

const DriverMissingFieldsModal = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;
  const [isOpen, setIsOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<typeof REQUIRED_FIELDS>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't show while already on the profile page
    if (!driverId || location.pathname === "/motorista/perfil") {
      setIsOpen(false);
      return;
    }
    checkMissingFields();
  }, [driverId, location.pathname]);

  const checkMissingFields = async () => {
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("whatsapp, birth_date, contact_1, contact_2")
        .eq("id", driverId!)
        .single();

      if (error || !data) return;

      const missing = REQUIRED_FIELDS.filter((field) => {
        const value = (data as any)[field.key];
        return !value || String(value).trim() === "";
      });

      setMissingFields(missing);
      if (missing.length > 0) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } catch (err) {
      console.error("[DriverMissingFieldsModal] Error checking fields:", err);
    }
  };

  const handleGoToProfile = () => {
    setIsOpen(false);
    navigate("/motorista/perfil");
  };

  if (missingFields.length === 0) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Prevent closing by clicking outside — modal stays visible until fields are filled
        if (!open) return;
        setIsOpen(true);
      }}
    >
      <DialogContent
        className="sm:max-w-md border-amber-500/30 shadow-2xl"
        // Prevent closing via Escape key
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-col items-center justify-center text-center space-y-3 pt-4">
          <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-10 w-10 text-amber-500 animate-pulse" />
          </div>
          <DialogTitle className="text-xl font-black italic text-amber-600 uppercase tracking-tighter">
            Complete seu Perfil!
          </DialogTitle>
          <DialogDescription className="text-base font-semibold text-foreground px-4">
            Existem campos{" "}
            <span className="text-destructive font-bold">obrigatórios</span>{" "}
            não preenchidos no seu perfil.
          </DialogDescription>

          <div className="w-full px-2 space-y-2">
            <p className="text-sm text-muted-foreground text-left font-medium mb-2">
              Campos pendentes:
            </p>
            {missingFields.map((field) => (
              <div
                key={field.key}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5"
              >
                <field.icon className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm font-semibold text-destructive">
                  {field.label}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-amber-500/5 p-3 rounded-lg border border-amber-500/20 mt-2 w-full">
            <p className="font-bold text-amber-700 dark:text-amber-400 text-xs uppercase text-center">
              ⚠️ Atenção
            </p>
            <p className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400/80 text-center mt-1">
              Esses dados são necessários para garantir sua segurança e o
              correto funcionamento do sistema. Preencha agora para continuar.
            </p>
          </div>
        </DialogHeader>

        <DialogFooter className="sm:justify-center mt-4 pb-4">
          <Button
            type="button"
            className="w-full h-12 text-md font-bold italic uppercase tracking-widest gap-3 bg-amber-500 hover:bg-amber-600 text-white shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:shadow-[0_4px_25px_rgba(245,158,11,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={handleGoToProfile}
          >
            <User className="h-5 w-5" />
            Ir para Perfil Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DriverMissingFieldsModal;
