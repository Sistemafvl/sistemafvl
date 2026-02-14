import { BarChart3 } from "lucide-react";

const DriverStats = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <BarChart3 className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Indicadores</h1>
    </div>
    <p className="text-muted-foreground">
      Em breve seus indicadores de entregas, devoluções e desempenho estarão disponíveis aqui.
    </p>
  </div>
);

export default DriverStats;
