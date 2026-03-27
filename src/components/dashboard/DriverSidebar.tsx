import { useState, useEffect } from "react";
import { LayoutDashboard, Users, Car, User, Star, Settings, LogOut, FileText, FileWarning, DollarSign, AlertCircle, LifeBuoy, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { useAuthStore } from "@/stores/auth-store";
import LogoHeader from "@/components/LogoHeader";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const driverMenuItems = [
  { title: "Visão Geral", url: "/motorista", icon: LayoutDashboard },
  { title: "Entrar na Fila", url: "/motorista/fila", icon: Users },
  { title: "Corridas", url: "/motorista/corridas", icon: Car },
  { title: "Recebíveis", url: "/motorista/recebiveis", icon: DollarSign },
  { title: "Perfil", url: "/motorista/perfil", icon: User },
  { title: "Documentos", url: "/motorista/documentos", icon: FileText },
  { title: "DNR", url: "/motorista/dnr", icon: FileWarning },
  { title: "Socorrendo", url: "/motorista/socorrendo", icon: LifeBuoy },
  { title: "Contrato", url: "/motorista/contrato", icon: Scale },
  { title: "Avaliar Unidades", url: "/motorista/avaliacoes", icon: Star },
  { title: "Configurações", url: "/motorista/configuracoes", icon: Settings },
];

const DriverSidebar = () => {
  const { logout, unitSession } = useAuthStore();
  const { setOpenMobile } = useSidebar();
  const driverName = unitSession?.user_name ?? "Motorista";
  const driverId = unitSession?.user_profile_id;
  const [avatarUrl, setAvatarUrl] = useState("");
  const [hasPendingInvoice, setHasPendingInvoice] = useState(false);
  const initials = driverName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!driverId) return;
    supabase.from("drivers_public").select("avatar_url").eq("id", driverId).single()
      .then(({ data }) => {
        if (data && (data as any).avatar_url) setAvatarUrl((data as any).avatar_url);
      });
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;
    const checkPending = async () => {
      const { data: reports } = await supabase
        .from("payroll_reports")
        .select("id, report_data")
        .eq("unit_id", unitSession?.id!);
      if (!reports) { setHasPendingInvoice(false); return; }

      // Filter reports that include this driver
      const driverReportIds = reports
        .filter((r) => {
          const data = r.report_data as any[];
          return Array.isArray(data) && data.some((d: any) => d.driver?.id === driverId);
        })
        .map((r) => r.id);

      if (driverReportIds.length === 0) { setHasPendingInvoice(false); return; }

      const { data: invoices } = await supabase
        .from("driver_invoices")
        .select("payroll_report_id")
        .eq("driver_id", driverId)
        .in("payroll_report_id", driverReportIds);

      const invoicedIds = new Set((invoices ?? []).map((i) => i.payroll_report_id));
      const pending = driverReportIds.some((id) => !invoicedIds.has(id));
      setHasPendingInvoice(pending);
    };
    checkPending();
  }, [driverId]);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 py-6">
          <LogoHeader size="lg" />
        </div>

        <div className="px-3 pb-4 flex flex-col items-center gap-2">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl} alt={driverName} />
            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-center min-w-0">
           <p className="text-sm font-bold italic truncate">Bem-vindo,</p>
            <p className="text-sm font-bold italic text-primary truncate">{driverName}</p>
            {unitSession?.name && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{unitSession.name}</p>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="font-bold italic text-xs uppercase tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {driverMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/motorista"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold italic transition-colors hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary"
                      onClick={() => setOpenMobile(false)}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                      {item.title === "Recebíveis" && hasPendingInvoice && (
                        <AlertCircle className="h-4 w-4 text-red-500 animate-pulse ml-auto shrink-0" />
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Button
          variant="ghost"
          className="w-full justify-start font-semibold italic text-muted-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default DriverSidebar;
