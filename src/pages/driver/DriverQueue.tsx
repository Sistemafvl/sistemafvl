import { Users } from "lucide-react";

const DriverQueue = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-3">
      <Users className="h-7 w-7 text-primary" />
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Entrar na Fila</h1>
    </div>
    <p className="text-muted-foreground">
      Em breve você poderá selecionar um domínio e unidade para entrar na fila de carregamento.
    </p>
  </div>
);

export default DriverQueue;
