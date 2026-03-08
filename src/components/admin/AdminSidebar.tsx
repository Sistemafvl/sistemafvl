import { ShieldCheck, LayoutDashboard, Globe, Users, Building2, LogOut, Truck, Database, Shield } from "lucide-react";
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

const menuItems = [
  { title: "Visão Geral", url: "/admin", icon: LayoutDashboard },
  { title: "Domínios & Unidades", url: "/admin/dominios", icon: Globe },
  { title: "Gerentes", url: "/admin/gerentes", icon: Users },
  { title: "Diretores", url: "/admin/diretores", icon: Building2 },
  { title: "Motoristas", url: "/admin/motoristas", icon: Truck },
  { title: "Banco de Dados", url: "/admin/banco", icon: Database },
  { title: "Segurança", url: "/admin/seguranca", icon: Shield },
];

const AdminSidebar = () => {
  const { setMasterAdmin } = useAuthStore();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 py-6">
          <LogoHeader size="lg" />
        </div>

        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20">
            <ShieldCheck className="h-4 w-4 text-red-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold italic truncate">Master Admin</p>
              <p className="text-[10px] text-muted-foreground">Acesso total ao sistema</p>
            </div>
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="font-bold italic text-xs uppercase tracking-wider">
            Administração
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
          onClick={() => setMasterAdmin(false)}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
