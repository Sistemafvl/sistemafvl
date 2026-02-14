import { useAuthStore } from "@/stores/auth-store";
import { Navigate } from "react-router-dom";
import LogoHeader from "@/components/LogoHeader";
import { Button } from "@/components/ui/button";
import { Package, Truck, BarChart3, QrCode, Settings, LogOut, Clock } from "lucide-react";
import { useEffect, useState } from "react";

const DashboardPage = () => {
  const { unitSession, logout } = useAuthStore();
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!unitSession) return <Navigate to="/" replace />;

  const menuItems = [
    { icon: Package, label: "Entrada de Mercadoria", disabled: true },
    { icon: Truck, label: "Saída de Mercadoria", disabled: true },
    { icon: BarChart3, label: "Relatórios", disabled: true },
    { icon: QrCode, label: "Scanner QR / Código de Barras", disabled: true },
    { icon: Settings, label: "Configurações", disabled: true },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <LogoHeader size="sm" />
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground italic font-semibold">
            <LogOut className="h-4 w-4 mr-1" />
            Sair
          </Button>
        </div>
      </header>

      {/* Unit info */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-card rounded-lg border border-border p-4 animate-slide-up">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs text-muted-foreground italic font-medium uppercase tracking-wider">Domínio</p>
              <p className="text-lg font-bold italic text-primary">{unitSession.domain_name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground italic font-medium uppercase tracking-wider">Unidade</p>
              <p className="text-lg font-bold italic text-foreground">{unitSession.name}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm italic font-medium">
              {dateTime.toLocaleDateString("pt-BR")} — {dateTime.toLocaleTimeString("pt-BR")}
            </span>
          </div>
        </div>

        {/* Menu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {menuItems.map((item) => (
            <button
              key={item.label}
              disabled={item.disabled}
              className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg text-left transition-all hover:border-primary hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed animate-fade-in"
            >
              <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold italic text-sm text-foreground">{item.label}</p>
                {item.disabled && (
                  <p className="text-xs text-muted-foreground italic">Em breve</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
