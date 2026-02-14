import { useAuthStore } from "@/stores/auth-store";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import DashboardSidebar from "./DashboardSidebar";

const DashboardLayout = () => {
  const { unitSession } = useAuthStore();
  const location = useLocation();

  if (!unitSession) return <Navigate to="/" replace />;

  // Redirect drivers to their panel
  if (unitSession.sessionType === "driver" && location.pathname === "/dashboard") {
    return <Navigate to="/dashboard/motorista" replace />;
  }

  const isDriver = unitSession.sessionType === "driver";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isDriver && <DashboardSidebar />}
        <main className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card">
            {!isDriver && <SidebarTrigger className="mr-3" />}
            <span className="text-xs font-bold italic text-primary uppercase tracking-wider">
              {isDriver ? "Motorista Parceiro" : "Dashboard"}
            </span>
          </header>
          <div className="flex-1 p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
