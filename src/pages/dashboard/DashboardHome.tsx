import { useAuthStore } from "@/stores/auth-store";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

const DashboardHome = () => {
  const { unitSession } = useAuthStore();
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!unitSession) return null;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold italic text-foreground">Bem-vindo</h1>
        <p className="text-muted-foreground italic text-sm mt-1">
          {unitSession.domain_name} — {unitSession.name}
        </p>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-bold italic text-foreground">
              {dateTime.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="text-lg font-bold italic text-primary">
              {dateTime.toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
