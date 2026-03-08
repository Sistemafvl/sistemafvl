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
import CiclosPage from "./pages/dashboard/CiclosPage";
import RelatoriosPage from "./pages/dashboard/RelatoriosPage";
import FeedbacksPage from "./pages/dashboard/FeedbacksPage";
import FinanceiroPage from "./pages/dashboard/FinanceiroPage";
import DriverLayout from "./components/dashboard/DriverLayout";
import DriverHome from "./pages/driver/DriverHome";
import DriverQueue from "./pages/driver/DriverQueue";
import DriverRides from "./pages/driver/DriverRides";
import DriverProfile from "./pages/driver/DriverProfile";
import DriverReviews from "./pages/driver/DriverReviews";
import DriverSettings from "./pages/driver/DriverSettings";
import DriverDocuments from "./pages/driver/DriverDocuments";
import DNRPage from "./pages/dashboard/DNRPage";
import ReversaPage from "./pages/dashboard/ReversaPage";
import ReativoPage from "./pages/dashboard/ReativoPage";
import DriverDNR from "./pages/driver/DriverDNR";
import DriverRecebiveis from "./pages/driver/DriverRecebiveis";
import DriverRescue from "./pages/driver/DriverRescue";
import MatrizLayout from "./components/matriz/MatrizLayout";
import MatrizOverview from "./pages/matriz/MatrizOverview";
import MatrizUnidades from "./pages/matriz/MatrizUnidades";
import MatrizMotoristas from "./pages/matriz/MatrizMotoristas";
import MatrizFinanceiro from "./pages/matriz/MatrizFinanceiro";
import MatrizOcorrencias from "./pages/matriz/MatrizOcorrencias";
import AdminLayout from "./components/admin/AdminLayout";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import DomainsUnitsPage from "./pages/admin/DomainsUnitsPage";
import ManagersPage from "./pages/admin/ManagersPage";
import DirectorsPage from "./pages/admin/DirectorsPage";
import AdminDriversPage from "./pages/admin/AdminDriversPage";
import DatabasePage from "./pages/admin/DatabasePage";
import SecurityPage from "./pages/admin/SecurityPage";
import NotFound from "./pages/NotFound";
import InstallPage from "./pages/InstallPage";
import OfflineIndicator from "./components/OfflineIndicator";
import PWAAutoUpdate from "./components/PWAAutoUpdate";
import { Toaster } from "./components/ui/sonner";
import { Toaster as RadixToaster } from "./components/ui/toaster";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
      <OfflineIndicator />
      <PWAAutoUpdate />
      <Toaster />
      <RadixToaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/install" element={<InstallPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="motoristas-parceiros" element={<MotoristasParceirosPage />} />
            <Route path="conferentes" element={<ConferentesPage />} />
            <Route path="conferencia" element={<ConferenciaCarregamentoPage />} />
            <Route path="ps" element={<PSPage />} />
            <Route path="rto" element={<RTOPage />} />
            <Route path="retorno-piso" element={<RetornoPisoPage />} />
            <Route path="operacao" element={<OperacaoPage />} />
            <Route path="ciclos" element={<CiclosPage />} />
            <Route path="relatorios" element={<RelatoriosPage />} />
            <Route path="feedbacks" element={<FeedbacksPage />} />
            <Route path="financeiro" element={<FinanceiroPage />} />
            <Route path="configuracoes" element={<ConfiguracoesPage />} />
            <Route path="dnr" element={<DNRPage />} />
            <Route path="reversa" element={<ReversaPage />} />
            <Route path="reativo" element={<ReativoPage />} />
            <Route path="bi" element={<MatrizOverview />} />
            <Route path="bi/unidades" element={<MatrizUnidades />} />
            <Route path="bi/motoristas" element={<MatrizMotoristas />} />
            <Route path="bi/financeiro" element={<MatrizFinanceiro />} />
            <Route path="bi/ocorrencias" element={<MatrizOcorrencias />} />
          </Route>
          <Route path="/motorista" element={<DriverLayout />}>
            <Route index element={<DriverHome />} />
            <Route path="fila" element={<DriverQueue />} />
            <Route path="corridas" element={<DriverRides />} />
            <Route path="perfil" element={<DriverProfile />} />
            <Route path="documentos" element={<DriverDocuments />} />
            <Route path="dnr" element={<DriverDNR />} />
            <Route path="socorrendo" element={<DriverRescue />} />
            <Route path="recebiveis" element={<DriverRecebiveis />} />
            <Route path="avaliacoes" element={<DriverReviews />} />
            <Route path="configuracoes" element={<DriverSettings />} />
          </Route>
          <Route path="/matriz" element={<MatrizLayout />}>
            <Route index element={<MatrizOverview />} />
            <Route path="unidades" element={<MatrizUnidades />} />
            <Route path="motoristas" element={<MatrizMotoristas />} />
            <Route path="financeiro" element={<MatrizFinanceiro />} />
            <Route path="ocorrencias" element={<MatrizOcorrencias />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="dominios" element={<DomainsUnitsPage />} />
            <Route path="gerentes" element={<ManagersPage />} />
            <Route path="diretores" element={<DirectorsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
  </QueryClientProvider>
);

export default App;
