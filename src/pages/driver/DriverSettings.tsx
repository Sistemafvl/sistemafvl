import { useState } from "react";
import { Settings, Moon, Sun, Bell, Globe, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";

const DriverSettings = () => {
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(() => localStorage.getItem("driver_notifications") !== "false");

  const handleNotifications = (checked: boolean) => {
    setNotifications(checked);
    localStorage.setItem("driver_notifications", String(checked));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold italic flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        Configurações
      </h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            Aparência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Tema escuro</Label>
            <Switch checked={theme === "dark"} onCheckedChange={(c) => setTheme(c ? "dark" : "light")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Notificações da fila</Label>
            <Switch checked={notifications} onCheckedChange={handleNotifications} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Globe className="h-4 w-4" /> Idioma
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Português (BR) — em breve mais idiomas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Info className="h-4 w-4" /> Sobre
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Sistema FVL — v1.0.0</p>
          <p>Suporte: contato@sistemafvl.com</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverSettings;
