import { useAuthStore } from "@/stores/auth-store";
import { Truck } from "lucide-react";

const DriverPanel = () => {
  const { unitSession } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Painel do Motorista Parceiro
        </h1>
      </div>
      <p className="text-muted-foreground">
        Bem-vindo, <span className="font-semibold text-foreground">{unitSession?.user_name}</span>!
        Em breve novas funcionalidades estarão disponíveis aqui.
      </p>
    </div>
  );
};

export default DriverPanel;
