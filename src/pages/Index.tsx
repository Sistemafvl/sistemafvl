import { useState } from "react";
import LogoHeader from "@/components/LogoHeader";
import AdminLoginModal from "@/components/AdminLoginModal";
import UnitLoginForm from "@/components/UnitLoginForm";
import { useAuthStore } from "@/stores/auth-store";
import { Navigate } from "react-router-dom";

const Index = () => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const { isMasterAdmin, unitSession } = useAuthStore();

  if (isMasterAdmin) return <Navigate to="/admin/domains" replace />;
  if (unitSession) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm space-y-6 sm:space-y-8">
        <LogoHeader onTripleClick={() => setShowAdminModal(true)} size="lg" />

        <div className="text-center">
          <h1 className="text-xl font-bold italic text-foreground tracking-tight">
            SISTEMA LOGÍSTICO
          </h1>
          <p className="text-sm text-muted-foreground italic mt-1">
            Selecione seu domínio e unidade para entrar
          </p>
        </div>

        <UnitLoginForm />
      </div>

      <AdminLoginModal open={showAdminModal} onOpenChange={setShowAdminModal} />
    </div>
  );
};

export default Index;
