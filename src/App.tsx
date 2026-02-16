import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import MotoristasParceirosPage from "./pages/dashboard/MotoristasParceirosPage";
import ConferentesPage from "./pages/dashboard/ConferentesPage";
import ConferenciaCarregamentoPage from "./pages/dashboard/ConferenciaCarregamentoPage";
import PSPage from "./pages/dashboard/PSPage";
import RTOPage from "./pages/dashboard/RTOPage";
import ConfiguracoesPage from "./pages/dashboard/ConfiguracoesPage";
import RetornoPisoPage from "./pages/dashboard/RetornoPisoPage";
import OperacaoPage from "./pages/dashboard/OperacaoPage";
import RelatoriosPage from "./pages/dashboard/RelatoriosPage";
import FeedbacksPage from "./pages/dashboard/FeedbacksPage";
import DriverLayout from "./components/dashboard/DriverLayout";
import DriverHome from "./pages/driver/DriverHome";
import DriverQueue from "./pages/driver/DriverQueue";
import DriverRides from "./pages/driver/DriverRides";
import DriverProfile from "./pages/driver/DriverProfile";
import DriverReviews from "./pages/driver/DriverReviews";
import DriverSettings from "./pages/driver/DriverSettings";
import AdminLayout from "./components/admin/AdminLayout";
import DomainsUnitsPage from "./pages/admin/DomainsUnitsPage";
import ManagersPage from "./pages/admin/ManagersPage";
import AdminDriversPage from "./pages/admin/AdminDriversPage";
import DatabasePage from "./pages/admin/DatabasePage";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="motoristas-parceiros" element={<MotoristasParceirosPage />} />
            <Route path="conferentes" element={<ConferentesPage />} />
            <Route path="conferencia" element={<ConferenciaCarregamentoPage />} />
            <Route path="ps" element={<PSPage />} />
            <Route path="rto" element={<RTOPage />} />
            <Route path="retorno-piso" element={<RetornoPisoPage />} />
            <Route path="operacao" element={<OperacaoPage />} />
            <Route path="relatorios" element={<RelatoriosPage />} />
            <Route path="feedbacks" element={<FeedbacksPage />} />
            <Route path="configuracoes" element={<ConfiguracoesPage />} />
          </Route>
          <Route path="/motorista" element={<DriverLayout />}>
            <Route index element={<DriverHome />} />
            <Route path="fila" element={<DriverQueue />} />
            <Route path="corridas" element={<DriverRides />} />
            <Route path="perfil" element={<DriverProfile />} />
            <Route path="avaliacoes" element={<DriverReviews />} />
            <Route path="configuracoes" element={<DriverSettings />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DomainsUnitsPage />} />
            <Route path="domains" element={<DomainsUnitsPage />} />
            <Route path="managers" element={<ManagersPage />} />
            <Route path="drivers" element={<AdminDriversPage />} />
            <Route path="database" element={<DatabasePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
  </QueryClientProvider>
);

export default App;
