import { Truck, BarChart3, Settings, LogOut } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "Conferência Carregamento", url: "/dashboard/conferencia", icon: Truck },
  { title: "Relatórios", url: "/dashboard/relatorios", icon: BarChart3 },
  { title: "Configurações", url: "/dashboard/configuracoes", icon: Settings },
];

const DashboardSidebar = () => {
  const { logout } = useAuthStore();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 py-6">
          <LogoHeader size="lg" />
        </div>

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
