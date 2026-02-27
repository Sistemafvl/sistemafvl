import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import MatrizSidebar from "./MatrizSidebar";

const MatrizLayout = () => {
  const { unitSession } = useAuthStore();
  const { setTheme } = useTheme();

  useEffect(() => {
    const saved = localStorage.getItem("theme_unit") || "light";
    setTheme(saved);
  }, [setTheme]);

  if (!unitSession) return <Navigate to="/" replace />;
  if (unitSession.sessionType !== "matriz") return <Navigate to="/" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <MatrizSidebar />
        <main className="flex-1 flex flex-col overflow-x-hidden">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card">
            <SidebarTrigger className="mr-3" />
            <span className="text-xs font-bold italic text-primary uppercase tracking-wider">
              Diretoria — {unitSession.domain_name}
            </span>
          </header>
          <div className="flex-1 p-4 sm:p-6 overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default MatrizLayout;
