import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Building, Truck, DollarSign, AlertTriangle, LogOut, Crown } from "lucide-react";
import LogoHeader from "@/components/LogoHeader";

const menuItems = [
  { label: "Visão Geral", icon: LayoutDashboard, path: "/matriz" },
  { label: "Unidades", icon: Building, path: "/matriz/unidades" },
  { label: "Motoristas", icon: Truck, path: "/matriz/motoristas" },
  { label: "Financeiro", icon: DollarSign, path: "/matriz/financeiro" },
  { label: "Ocorrências", icon: AlertTriangle, path: "/matriz/ocorrencias" },
];

const MatrizSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, unitSession } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <Sidebar>
      <SidebarContent>
        <div className="p-4 flex justify-center">
          <LogoHeader size="sm" />
        </div>

        {/* Director profile card */}
        {unitSession && (
          <div className="px-3 pb-2">
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-primary/10 border border-primary/20">
              <Crown className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold italic truncate">{unitSession.user_name}</p>
                <p className="text-[10px] text-muted-foreground">Diretor</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {unitSession.domain_name}
                </p>
              </div>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    className="font-semibold italic"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="text-destructive font-semibold italic">
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default MatrizSidebar;
