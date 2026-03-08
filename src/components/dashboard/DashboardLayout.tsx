import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import DashboardSidebar from "./DashboardSidebar";
import QueuePanel from "./QueuePanel";
import { UserCheck, Crown } from "lucide-react";
import InsucessoBalloon from "./InsucessoBalloon";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConferenteSessionLock } from "@/hooks/use-conferente-session-lock";

const DashboardLayout = () => {
  const { unitSession, managerSession, conferenteSession, setConferenteSession } = useAuthStore();
  const { setTheme } = useTheme();
  const [conferentes, setConferentes] = useState<{ id: string; name: string }[]>([]);
  const { claimSession } = useConferenteSessionLock();

  useEffect(() => {
    const saved = localStorage.getItem("theme_unit") || "light";
    setTheme(saved);
  }, [setTheme]);

  useEffect(() => {
    if (!unitSession?.id) return;
    supabase
      .from("user_profiles")
      .select("id, name")
      .eq("unit_id", unitSession.id)
      .eq("active", true)
      .then(({ data }) => { if (data) setConferentes(data); });
  }, [unitSession?.id]);

  if (!unitSession) return <Navigate to="/" replace />;

  // Redirect drivers to their dedicated panel
  if (unitSession.sessionType === "driver") {
    return <Navigate to="/motorista" replace />;
  }

  const isDirector = unitSession.sessionType === "matriz";
  const hasAccess = isDirector || !!managerSession || !!conferenteSession;

  return (
    <SidebarProvider>
        <div className="min-h-screen flex w-full overflow-x-hidden">
          <DashboardSidebar />
          <main className="flex-1 flex flex-col overflow-x-hidden">
            <header className="h-12 flex items-center border-b border-border px-4 bg-card">
              <SidebarTrigger className="mr-3" />
              <span className="text-xs font-bold italic text-primary uppercase tracking-wider">
                Dashboard
              </span>
              {isDirector && (
                <span className="ml-auto text-xs text-amber-600 flex items-center gap-1 font-semibold">
                  <Crown className="h-3.5 w-3.5" />
                  {unitSession.name}
                </span>
              )}
              {!isDirector && conferenteSession && (
                <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                  <UserCheck className="h-3.5 w-3.5" />
                  {conferenteSession.name}
                </span>
              )}
            </header>
            <div className="flex-1 p-4 sm:p-6 overflow-x-hidden">
              {hasAccess ? (
                <Outlet />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
                  <div className="p-6 rounded-xl border border-border bg-card shadow-sm text-center max-w-sm space-y-4">
                    <UserCheck className="h-12 w-12 text-muted-foreground mx-auto" />
                    <h2 className="text-lg font-bold italic">Selecione um Conferente</h2>
                    <p className="text-sm text-muted-foreground">
                      Para acessar o sistema, selecione um conferente na barra lateral ou faça login como gerente.
                    </p>
                    <Select
                      onValueChange={(val) => {
                        const c = conferentes.find(c => c.id === val);
                        if (c) {
                          setConferenteSession({ id: c.id, name: c.name });
                          claimSession(c.id);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecionar Conferente" />
                      </SelectTrigger>
                      <SelectContent>
                        {conferentes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
          </div>
        </main>
      </div>
      <InsucessoBalloon />
      <QueuePanel />
    </SidebarProvider>
  );
};

export default DashboardLayout;
