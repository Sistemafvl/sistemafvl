import { Settings } from "lucide-react";

const DriverSettings = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Settings className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Configurações</h1>
    </div>
    <p className="text-muted-foreground">
      Em breve suas preferências estarão disponíveis aqui.
    </p>
  </div>
);

export default DriverSettings;
