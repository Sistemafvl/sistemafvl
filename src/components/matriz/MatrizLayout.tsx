import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "next-themes";
import MatrizSidebar from "./MatrizSidebar";
import VersionSyncControl from "@/components/VersionSyncControl";

const MatrizLayout = () => {
  const { unitSession } = useAuthStore();
  const { setTheme } = useTheme();

  const handleClearCache = async () => {
    setLoadingCache(true);
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
      toast({ 
        title: "Cache limpo!", 
        description: "Enviando comando de sincronização... A página irá recarregar.",
      });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      console.error("Cache purge failed:", err);
      toast({ title: "Erro", description: "Falha ao sincronizar versão.", variant: "destructive" });
      setLoadingCache(false);
    }
  };

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
            <div className="ml-auto flex items-center">
              <VersionSyncControl />
            </div>
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
