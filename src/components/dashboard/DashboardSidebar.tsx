import { Truck, BarChart3, Settings, LogOut, Clock } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuthStore } from "@/stores/auth-store";
import LogoHeader from "@/components/LogoHeader";
import { useEffect, useState } from "react";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "Conferência Carregamento", url: "/dashboard/conferencia", icon: Truck },
  { title: "Relatórios", url: "/dashboard/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/dashboard/configuracoes", icon: Settings },
];

const DashboardSidebar = () => {
  const { unitSession, logout } = useAuthStore();
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 py-6">
          <LogoHeader size="lg" />
        </div>

        {unitSession && (
          <div className="px-4 pb-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground italic font-medium uppercase tracking-wider">Domínio</p>
              <p className="text-sm font-bold italic text-primary">{unitSession.domain_name}</p>
              <p className="text-[10px] text-muted-foreground italic font-medium uppercase tracking-wider mt-2">Unidade</p>
              <p className="text-sm font-bold italic text-foreground">{unitSession.name}</p>
              <div className="flex items-center gap-1.5 text-muted-foreground pt-2 border-t border-border mt-2">
                <Clock className="h-3 w-3" />
                <span className="text-xs italic font-medium">
                  {dateTime.toLocaleDateString("pt-BR")} — {dateTime.toLocaleTimeString("pt-BR")}
                </span>
              </div>
            </div>
          </div>
        )}

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

export default DashboardSidebar;
