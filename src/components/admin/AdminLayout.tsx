import { useAuthStore } from "@/stores/auth-store";
import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";
import { ShieldCheck } from "lucide-react";
import VersionSyncControl from "@/components/VersionSyncControl";

const AdminLayout = () => {
  const { isMasterAdmin } = useAuthStore();

  if (!isMasterAdmin) return <Navigate to="/" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <AdminSidebar />
        <main className="flex-1 flex flex-col overflow-x-hidden">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card">
            <SidebarTrigger className="mr-3" />
            <span className="text-xs font-bold italic text-primary uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Master Admin
            </span>
            <div className="ml-auto"><VersionSyncControl /></div>
          </header>
          <div className="flex-1 p-4 sm:p-6 overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
