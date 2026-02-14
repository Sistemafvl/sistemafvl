import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import DriverPanel from "./pages/dashboard/DriverPanel";
import AdminLayout from "./components/admin/AdminLayout";
import DomainsUnitsPage from "./pages/admin/DomainsUnitsPage";
import ManagersPage from "./pages/admin/ManagersPage";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="motorista" element={<DriverPanel />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DomainsUnitsPage />} />
            <Route path="domains" element={<DomainsUnitsPage />} />
            <Route path="managers" element={<ManagersPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
