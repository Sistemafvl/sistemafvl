import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Navigate, Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AdminSidebar from "./AdminSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AdminLayout = () => {
  const { isMasterAdmin, setMasterAdmin, logout } = useAuthStore();
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateSession = async () => {
      if (!isMasterAdmin) {
        setValidating(false);
        return;
      }

      // Check if there's an active Supabase Auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMasterAdmin(false);
        setValidating(false);
        return;
      }

      // Validate admin role server-side
      const { data, error } = await supabase.functions.invoke("admin-validate", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error || !data?.isAdmin) {
        setMasterAdmin(false);
        await supabase.auth.signOut();
        setValidating(false);
        return;
      }

      setIsValid(true);
      setValidating(false);
    };

    validateSession();
  }, [isMasterAdmin, setMasterAdmin]);

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isMasterAdmin || !isValid) return <Navigate to="/" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card">
            <SidebarTrigger className="mr-3" />
            <span className="text-xs font-bold italic text-primary uppercase tracking-wider">
              Master Admin
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

export default AdminLayout;
