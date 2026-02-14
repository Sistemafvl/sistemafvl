import { LayoutDashboard, Users, Car, BarChart3, User, Star, Settings, LogOut } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const driverMenuItems = [
  { title: "Visão Geral", url: "/motorista", icon: LayoutDashboard },
  { title: "Entrar na Fila", url: "/motorista/fila", icon: Users },
  { title: "Corridas", url: "/motorista/corridas", icon: Car },
  { title: "Indicadores", url: "/motorista/indicadores", icon: BarChart3 },
  { title: "Perfil", url: "/motorista/perfil", icon: User },
  { title: "Avaliar Unidades", url: "/motorista/avaliacoes", icon: Star },
  { title: "Configurações", url: "/motorista/configuracoes", icon: Settings },
];

const DriverSidebar = () => {
  const { logout, unitSession } = useAuthStore();
  const driverName = unitSession?.user_name ?? "Motorista";
  const initials = driverName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 py-6">
          <LogoHeader size="lg" />
        </div>

        <div className="px-3 pb-4 flex flex-col items-center gap-2">
          <Avatar className="h-16 w-16">
            <AvatarImage src="" alt={driverName} />
            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-center min-w-0">
            <p className="text-sm font-bold italic truncate">Bem-vindo,</p>
            <p className="text-sm font-bold italic text-primary truncate">{driverName}</p>
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

export default DriverSidebar;
