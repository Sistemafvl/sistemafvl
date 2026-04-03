import { useState, useEffect, useRef } from "react";
import { Truck, BarChart3, Settings, LogOut, UserCog, Eye, EyeOff, ClipboardCheck, Users, LayoutDashboard, AlertTriangle, RotateCcw, PackageX, Activity, MessageSquare, FileWarning, DollarSign, RefreshCw, UserCheck, PackageSearch, Zap, Crown, PieChart, Building2, Users2, Receipt, ShieldAlert, LifeBuoy, Scale } from "lucide-react";
import { useConferenteSessionLock } from "@/hooks/use-conferente-session-lock";
import { NavLink } from "@/components/NavLink";
import { useAuthStore } from "@/stores/auth-store";
import LogoHeader from "@/components/LogoHeader";
import { supabase } from "@/integrations/supabase/client";
import DriverRegistrationModal from "@/components/DriverRegistrationModal";
import { Badge } from "@/components/ui/badge";
import DirectorUnitSwitcher from "./DirectorUnitSwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const formatCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const menuItems = [
  { title: "Visão Geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Carregamento", url: "/dashboard/conferencia", icon: Truck },
  { title: "Insucessos", url: "/dashboard/retorno-piso", icon: PackageX },
  { title: "PS", url: "/dashboard/ps", icon: AlertTriangle },
  { title: "DNR", url: "/dashboard/dnr", icon: FileWarning },
  { title: "Relatório Reversa", url: "/dashboard/reversa", icon: PackageSearch },
  { title: "Socorrendo", url: "/dashboard/socorrendo", icon: LifeBuoy },
  { title: "Reativo", url: "/dashboard/reativo", icon: Zap },
  { title: "Contestações", url: "/dashboard/contestacoes", icon: Scale },
];

const managerMenuItems = [
  { title: "Ciclos", url: "/dashboard/ciclos", icon: RefreshCw },
  { title: "Relatórios", url: "/dashboard/relatorios", icon: BarChart3 },
  { title: "Financeiro", url: "/dashboard/financeiro", icon: DollarSign },
  { title: "Feedbacks", url: "/dashboard/feedbacks", icon: MessageSquare },
  { title: "Ajuste", url: "/dashboard/configuracoes", icon: DollarSign },
  { title: "Motoristas Parceiros", url: "/dashboard/motoristas-parceiros", icon: Users },
  { title: "Conferentes", url: "/dashboard/conferentes", icon: ClipboardCheck },
];

const biMenuItems = [
  { title: "Visão Consolidada", url: "/dashboard/bi", icon: PieChart },
  { title: "Unidades", url: "/dashboard/bi/unidades", icon: Building2 },
  { title: "Motoristas", url: "/dashboard/bi/motoristas", icon: Users2 },
  { title: "Financeiro", url: "/dashboard/bi/financeiro", icon: Receipt },
  { title: "Ocorrências", url: "/dashboard/bi/ocorrencias", icon: ShieldAlert },
];

const directorMenuItems = [
  { title: "Visão Geral", url: "/dashboard/matriz", icon: LayoutDashboard },
  { title: "Financeiro", url: "/dashboard/matriz/financeiro", icon: DollarSign },
  { title: "Análise Geral", url: "/dashboard/matriz/analise", icon: BarChart3 },
  { title: "Contrato Motorista", url: "/dashboard/matriz/contrato", icon: Scale },
];

const managerModalItems = [
  { title: "Cadastro de Motorista", key: "driver" as const, icon: Truck },
];

interface ConferenteOption {
  id: string;
  name: string;
}

const DashboardSidebar = () => {
  const { logout, unitSession, managerSession, setManagerSession, conferenteSession, setConferenteSession } = useAuthStore();
  const { setOpenMobile } = useSidebar();
  const { claimSession, releaseSession } = useConferenteSessionLock(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [conferentes, setConferentes] = useState<ConferenteOption[]>([]);
  const [conferenteSelectOpen, setConferenteSelectOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingDisputesCount, setPendingDisputesCount] = useState(0);
  const pendingFetchRef = useRef(false);
  const pendingDisputesFetchRef = useRef(false);

  const isDirector = unitSession?.sessionType === "matriz";
  const showManagerMenu = isDirector || !!managerSession;

  // Fetch pending loading count
  useEffect(() => {
    if (!unitSession?.id) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const fetchPending = async () => {
      if (pendingFetchRef.current) return;
      pendingFetchRef.current = true;
      const { count } = await supabase
        .from("driver_rides")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", unitSession.id)
        .eq("loading_status", "pending")
        .gte("completed_at", todayISO);
      setPendingCount(count ?? 0);
      pendingFetchRef.current = false;
    };

    fetchPending();

    const channel = supabase
      .channel(`pending-rides-count-${unitSession.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "driver_rides",
        filter: `unit_id=eq.${unitSession.id}`,
      }, () => { fetchPending(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unitSession?.id]);

  // Fetch pending disputes count
  useEffect(() => {
    if (!unitSession?.id) return;
    
    const fetchPendingDisputes = async () => {
      if (pendingDisputesFetchRef.current) return;
      pendingDisputesFetchRef.current = true;
      try {
        const { count, error } = await supabase
          .from("ride_disputes" as any)
          .select("id", { count: "exact", head: true })
          .eq("unit_id", unitSession.id)
          .eq("status", "pending");
        
        if (error) {
          console.warn("Error fetching pending disputes (might be missing table):", error);
          setPendingDisputesCount(0);
        } else {
          setPendingDisputesCount(count ?? 0);
        }
      } catch (err) {
        console.error("Critical error in fetchPendingDisputes:", err);
      } finally {
        pendingDisputesFetchRef.current = false;
      }
    };

    fetchPendingDisputes();

    const channel = supabase
      .channel(`pending-disputes-count-${unitSession.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ride_disputes" as any,
        filter: `unit_id=eq.${unitSession.id}`,
      }, () => { 
        try {
          fetchPendingDisputes(); 
        } catch (e) {
          console.error("Realtime subscription error for ride_disputes:", e);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unitSession?.id]);

  // Fetch conferentes for the unit
  useEffect(() => {
    if (!unitSession?.id || isDirector) return;
    supabase
      .from("user_profiles")
      .select("id, name")
      .eq("unit_id", unitSession.id)
      .eq("active", true)
      .then(({ data }) => { if (data) setConferentes(data); });
  }, [unitSession?.id, isDirector]);

  const handleManagerLogin = async () => {
    const cleanCnpj = cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14 || !password || !unitSession) return;
    setLoading(true);
    const { validateManagerPassword } = await import("@/lib/validate-manager-password");
    const result = await validateManagerPassword(unitSession.id, password, cleanCnpj);
    setLoading(false);
    if (!result.valid || !result.manager) return;
    setManagerSession({ id: result.manager.id, name: result.manager.name, cnpj: result.manager.cnpj });
    setLoginOpen(false);
    setCnpj("");
    setPassword("");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarContent>
          <div className="p-4 py-6">
            <LogoHeader size="lg" />
          </div>

          {/* Director section: unit switcher + crown card */}
          {isDirector ? (
            <DirectorUnitSwitcher />
          ) : (
            <>
              {/* Manager login/card */}
              <div className="px-3 pb-2">
                {managerSession ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                    <UserCog className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold italic truncate">{managerSession.name}</p>
                      <p className="text-[10px] text-muted-foreground">Gerente</p>
                      {unitSession && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {unitSession.name} • {unitSession.domain_name}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs px-2" onClick={() => setManagerSession(null)}>
                      Sair
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start font-semibold italic gap-2 bg-accent text-accent-foreground hover:bg-background hover:text-foreground"
                    onClick={() => setLoginOpen(true)}
                  >
                    <UserCog className="h-4 w-4" />
                    Gerente
                  </Button>
                )}
              </div>

              {/* Conferente Selector */}
              <div className="px-3 pb-2">
                {conferenteSession ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                    <UserCheck className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold italic truncate">{conferenteSession.name}</p>
                      <p className="text-[10px] text-muted-foreground">Conferente</p>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs px-2" onClick={() => {
                      if (conferenteSession?.id) releaseSession(conferenteSession.id);
                      setConferenteSession(null);
                    }}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <Select
                    open={conferenteSelectOpen}
                    onOpenChange={setConferenteSelectOpen}
                    onValueChange={(val) => {
                      const c = conferentes.find(c => c.id === val);
                      if (c) {
                        setConferenteSession({ id: c.id, name: c.name });
                        claimSession(c.id);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full font-semibold italic gap-2 bg-green-500/10 border-green-500/20 text-green-700 hover:bg-green-500/20">
                      <UserCheck className="h-4 w-4" />
                      <SelectValue placeholder="Selecionar Conferente" />
                    </SelectTrigger>
                    <SelectContent>
                      {conferentes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </>
          )}

          {/* Director new menu structure */}
          {isDirector ? (
            <SidebarGroup>
              <SidebarGroupLabel className="font-bold italic text-xs uppercase tracking-wider">
                Diretoria
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {directorMenuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          end
                          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold italic transition-colors hover:bg-muted/50"
                          activeClassName="bg-primary/10 text-primary"
                          onClick={() => setOpenMobile(false)}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            <>
              <SidebarGroup>
                <SidebarGroupLabel className="font-bold italic text-xs uppercase tracking-wider">
                  Menu
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {menuItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            end
                            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold italic transition-colors hover:bg-muted/50"
                            activeClassName="bg-primary/10 text-primary"
                            onClick={() => setOpenMobile(false)}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{item.title}</span>
                            {item.url === "/dashboard/conferencia" && pendingCount > 0 && (
                              <Badge className="ml-auto h-5 min-w-5 flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold px-1.5 animate-pulse border-0">
                                {pendingCount}
                              </Badge>
                            )}
                            {item.url === "/dashboard/contestacoes" && pendingDisputesCount > 0 && (
                              <Badge className="ml-auto h-5 min-w-5 flex items-center justify-center rounded-full bg-destructive text-white text-[10px] font-bold px-1.5 animate-pulse border-0">
                                {pendingDisputesCount}
                              </Badge>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {showManagerMenu && !isDirector && (
                <SidebarGroup>
                  <SidebarGroupLabel className="font-bold italic text-xs uppercase tracking-wider">
                    Gerente
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {managerMenuItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end
                              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold italic transition-colors hover:bg-muted/50"
                              activeClassName="bg-primary/10 text-primary"
                              onClick={() => setOpenMobile(false)}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                      {managerModalItems.map((item) => (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold italic transition-colors hover:bg-muted/50 cursor-pointer"
                            onClick={() => setDriverModalOpen(true)}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </>
          )}

        </SidebarContent>
        <SidebarFooter className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start font-semibold italic text-muted-foreground"
            onClick={() => {
              if (conferenteSession?.id) releaseSession(conferenteSession.id);
              logout();
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </SidebarFooter>
      </Sidebar>

      {/* Manager Login Modal */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <UserCog className="h-5 w-5 text-primary" /> Login Gerente
            </DialogTitle>
            <DialogDescription>Entre com suas credenciais de gerente.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleManagerLogin(); }} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CNPJ</Label>
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Senha</Label>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  type={showPassword ? "text" : "password"}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <DriverRegistrationModal open={driverModalOpen} onOpenChange={setDriverModalOpen} />
    </>
  );
};

export default DashboardSidebar;
