import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Building2, Users, Truck } from "lucide-react";

const AdminOverviewPage = () => {
  const [stats, setStats] = useState({ domains: 0, units: 0, managers: 0, drivers: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from("domains").select("id", { count: "exact", head: true }),
      supabase.from("units").select("id", { count: "exact", head: true }).eq("is_matriz", false),
      supabase.from("managers").select("id", { count: "exact", head: true }),
      supabase.from("drivers_public").select("id", { count: "exact", head: true }),
    ]).then(([d, u, m, dr]) => {
      setStats({
        domains: d.count ?? 0,
        units: u.count ?? 0,
        managers: m.count ?? 0,
        drivers: dr.count ?? 0,
      });
    });
  }, []);

  const cards = [
    { label: "Domínios", value: stats.domains, icon: Globe, color: "text-blue-600" },
    { label: "Unidades", value: stats.units, icon: Building2, color: "text-green-600" },
    { label: "Gerentes", value: stats.managers, icon: Users, color: "text-amber-600" },
    { label: "Motoristas", value: stats.drivers, icon: Truck, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold italic">Visão Geral do Sistema</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold italic">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminOverviewPage;
