import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilTodayStr } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, LifeBuoy, Landmark, Zap, Banknote } from "lucide-react";

const NOTICES = [
  {
    icon: ShieldCheck,
    title: "Confira suas informações!",
    body: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Sempre confira a <strong>quantidade de pacotes</strong>, o <strong>login usado no dia</strong> e a <strong>senha</strong> antes de sair da unidade.
        </p>
        <p>
          Essas informações precisam bater com o coletor da Amazon. Isso garante <strong>segurança e transparência</strong> com relação à administração e finanças do seu trabalho.
        </p>
        <p className="font-semibold text-foreground">
          Não saia da unidade se essas informações não estiverem corretas!
        </p>
      </div>
    ),
  },
  {
    icon: LifeBuoy,
    title: "Novidade: Socorrendo",
    body: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Se você socorreu um colega na rua coletando os pacotes dele, agora no menu <strong>"Socorrendo"</strong> você pode transferir esses pacotes para a sua contagem de TBR.
        </p>
        <p>
          Isso garante mais <strong>rapidez e agilidade</strong> com seus pacotes do dia, e os pacotes resgatados serão contabilizados corretamente no seu relatório.
        </p>
      </div>
    ),
  },
  {
    icon: Zap,
    title: "Reativos na Quinzena",
    body: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Agora os <strong>reativos ativados</strong> ficam visíveis nos cards principais da sua Visão Geral e são <strong>somados junto à quinzena</strong>.
        </p>
        <p>
          Isso significa que seu ganho total reflete com precisão toda a sua produção, incluindo pacotes reativados.
        </p>
      </div>
    ),
  },
];

const DriverDailyNotices = () => {
  const { unitSession } = useAuthStore();
  const navigate = useNavigate();
  const driverId = unitSession?.user_profile_id;
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showBankModal, setShowBankModal] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    const today = getBrazilTodayStr();
    const key = `driver_notices_seen_${driverId}_${today}`;
    if (localStorage.getItem(key)) {
      // Notices already seen today, check bank data
      checkBankData();
      return;
    }
    setCurrentIndex(0);
  }, [driverId]);

  const checkBankData = async () => {
    if (!driverId) return;
    // If already confirmed this session, skip
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

  const handleOk = () => {
    if (currentIndex < NOTICES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const today = getBrazilTodayStr();
      const key = `driver_notices_seen_${driverId}_${today}`;
      localStorage.setItem(key, "1");
      setCurrentIndex(-1);
      // After all notices, check bank data
      checkBankData();
    }
  };

  const handleGoToDocuments = () => {
    setShowBankModal(false);
    navigate("/motorista/documentos");
  };

  // Bank data modal
  if (showBankModal) {
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
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Você ainda <strong>não cadastrou seus dados bancários</strong>. Para receber seus pagamentos corretamente, é necessário preencher suas informações de PIX.
              </p>
              <p>
                Acesse a seção <strong>"Documentos"</strong> e preencha seus dados bancários antes de continuar.
              </p>
              <p className="font-semibold text-foreground">
                Esta ação é obrigatória para continuar usando o sistema.
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
  }

  if (currentIndex < 0) return null;

  const notice = NOTICES[currentIndex];
  const Icon = notice.icon;

  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <AlertDialogTitle className="text-base">{notice.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-xs">
                Aviso {currentIndex + 1} de {NOTICES.length}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <div className="mt-2">{notice.body}</div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleOk} className="w-full">
            Ok, Ciente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DriverDailyNotices;
