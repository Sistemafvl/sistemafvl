import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { getBrazilTodayStr } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LifeBuoy, Landmark, Zap } from "lucide-react";

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
    icon: Landmark,
    title: "Cadastre seus dados bancários",
    body: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Para receber seus pagamentos corretamente, siga os passos:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Acesse <strong>"Documentos"</strong> no menu lateral</li>
          <li>Role até a seção <strong>"Dados Bancários / Pix"</strong></li>
          <li>Preencha o <strong>tipo de chave</strong>, <strong>chave Pix</strong> e <strong>nome do titular</strong></li>
          <li>Clique em <strong>"Salvar"</strong></li>
        </ol>
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
  const driverId = unitSession?.user_profile_id;
  const [currentIndex, setCurrentIndex] = useState(-1);

  useEffect(() => {
    if (!driverId) return;
    const today = getBrazilTodayStr();
    const key = `driver_notices_seen_${driverId}_${today}`;
    if (localStorage.getItem(key)) return;
    setCurrentIndex(0);
  }, [driverId]);

  const handleOk = () => {
    if (currentIndex < NOTICES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Mark as seen
      const today = getBrazilTodayStr();
      const key = `driver_notices_seen_${driverId}_${today}`;
      localStorage.setItem(key, "1");
      setCurrentIndex(-1);
    }
  };

  if (currentIndex < 0) return null;

  const notice = NOTICES[currentIndex];
  const Icon = notice.icon;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base">{notice.title}</DialogTitle>
              <DialogDescription className="text-xs">
                Aviso {currentIndex + 1} de {NOTICES.length}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="mt-2">{notice.body}</div>
        <Button onClick={handleOk} className="w-full mt-2">
          Ok, Ciente
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default DriverDailyNotices;
