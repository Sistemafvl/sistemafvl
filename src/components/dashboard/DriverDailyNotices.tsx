import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Banknote } from "lucide-react";

const DriverDailyNotices = () => {
  const { unitSession } = useAuthStore();
  const navigate = useNavigate();
  const driverId = unitSession?.user_profile_id;
  const [showBankModal, setShowBankModal] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    checkBankData();
  }, [driverId]);

  const checkBankData = async () => {
    if (!driverId) return;
    if (localStorage.getItem(`driver_bank_filled_${driverId}`)) return;

    try {
      const { data } = await supabase.functions.invoke("get-driver-details", {
        body: { driver_id: driverId, self_access: true },
      });
      if (!data?.pix_key) {
        setShowBankModal(true);
      } else {
        localStorage.setItem(`driver_bank_filled_${driverId}`, "1");
      }
    } catch {
      // Don't block on error
    }
  };

  const handleGoToDocuments = () => {
    setShowBankModal(false);
    navigate("/motorista/documentos");
  };

  if (!showBankModal) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <Banknote className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle className="text-base">Dados Bancários Pendentes</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                Ação obrigatória
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <div className="mt-2">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Você ainda <strong>não cadastrou seus dados bancários</strong>. O fechamento das quinzenas 
              acontece sempre no <strong>dia 15</strong> e no <strong>último dia do mês</strong>.
            </p>
            <p className="text-destructive font-semibold">
              Sem os dados bancários preenchidos, você ficará impossibilitado de receber seus ganhos!
            </p>
            <p>
              Acesse a seção <strong>"Documentos"</strong> e preencha suas informações de PIX antes de continuar.
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleGoToDocuments} className="w-full">
            Ir para Documentos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DriverDailyNotices;
