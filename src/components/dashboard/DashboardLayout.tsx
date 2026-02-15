import { useAuthStore } from "@/stores/auth-store";
import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import DashboardSidebar from "./DashboardSidebar";
import QueuePanel from "./QueuePanel";

const DashboardLayout = () => {
  const { unitSession, managerSession } = useAuthStore();
  

  if (!unitSession) return <Navigate to="/" replace />;

  // Redirect drivers to their dedicated panel
  if (unitSession.sessionType === "driver") {
    return <Navigate to="/motorista" replace />;
  }

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
            </header>
            <div className="flex-1 p-4 sm:p-6 overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
      {managerSession && <QueuePanel />}
    </SidebarProvider>
  );
};

export default DashboardLayout;
