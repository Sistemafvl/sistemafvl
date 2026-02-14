import { useAuthStore } from "@/stores/auth-store";
import { Truck } from "lucide-react";

const DriverHome = () => {
  const { unitSession } = useAuthStore();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bem-vindo, {unitSession?.user_name}!
        </h1>
      </div>
      <p className="text-muted-foreground">
        Este é o seu painel de motorista parceiro. Utilize o menu lateral para navegar entre as funcionalidades.
      </p>
    </div>
  );
};

export default DriverHome;
