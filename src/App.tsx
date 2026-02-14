import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import MotoristasParceirosPage from "./pages/dashboard/MotoristasParceirosPage";
import ConferentesPage from "./pages/dashboard/ConferentesPage";
import DriverLayout from "./components/dashboard/DriverLayout";
import DriverHome from "./pages/driver/DriverHome";
import DriverQueue from "./pages/driver/DriverQueue";
import DriverStats from "./pages/driver/DriverStats";
import DriverProfile from "./pages/driver/DriverProfile";
import DriverReviews from "./pages/driver/DriverReviews";
import DriverSettings from "./pages/driver/DriverSettings";
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
            <Route path="motoristas-parceiros" element={<MotoristasParceirosPage />} />
            <Route path="conferentes" element={<ConferentesPage />} />
          </Route>
          <Route path="/motorista" element={<DriverLayout />}>
            <Route index element={<DriverHome />} />
            <Route path="fila" element={<DriverQueue />} />
            <Route path="indicadores" element={<DriverStats />} />
            <Route path="perfil" element={<DriverProfile />} />
            <Route path="avaliacoes" element={<DriverReviews />} />
            <Route path="configuracoes" element={<DriverSettings />} />
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
