import { useState, useEffect } from "react";
import LogoHeader from "@/components/LogoHeader";
import UnitLoginForm from "@/components/UnitLoginForm";
import DriverRegistrationModal from "@/components/DriverRegistrationModal";
import { useAuthStore } from "@/stores/auth-store";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Truck, Download, X } from "lucide-react";
import { useTheme } from "next-themes";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const Index = () => {
  const { setTheme } = useTheme();
  const { canInstall, isInstalled, install } = usePwaInstall();
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const { unitSession } = useAuthStore();

  if (unitSession?.sessionType === "driver") return <Navigate to="/motorista" replace />;
  if (unitSession?.sessionType === "matriz") return <Navigate to="/matriz" replace />;
  if (unitSession) return <Navigate to="/dashboard" replace />;

  const showBanner = (canInstall || !isInstalled) && !dismissedBanner;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm space-y-6 sm:space-y-8">
        <LogoHeader size="xl" />

        <div className="text-center">
          <h1 className="text-xl font-bold italic text-foreground tracking-tight">
            SISTEMA LOGÍSTICO
          </h1>
          <p className="text-sm text-muted-foreground italic mt-1">
            Selecione seu domínio e unidade para entrar
          </p>
        </div>

        <UnitLoginForm />

        <div className="text-center">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowDriverModal(true)}
          >
            <Truck className="mr-2 h-4 w-4" />
            Cadastro Motorista
          </Button>
        </div>

        {showBanner && (
          <div className="relative rounded-lg border bg-card p-3 shadow-sm">
            <button
              onClick={() => setDismissedBanner(true)}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 pr-6">
              <Download className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Instale o app!</p>
                <p className="text-xs text-muted-foreground">Acesse mais rápido pela tela inicial</p>
              </div>
              <Button
                size="sm"
                variant="default"
                onClick={() => canInstall ? install() : navigate("/install")}
              >
                {canInstall ? "Instalar" : "Ver como"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <DriverRegistrationModal open={showDriverModal} onOpenChange={setShowDriverModal} />
    </div>
  );
};

export default Index;
