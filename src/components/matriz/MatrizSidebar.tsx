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
import { LayoutDashboard, Building, Truck, DollarSign, AlertTriangle, LogOut } from "lucide-react";
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
  const { logout } = useAuthStore();

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
