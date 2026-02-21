import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Megaphone, Plus, RefreshCw, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SystemUpdate {
  id: string;
  type: string;
  module: string;
  description: string;
  published_at: string;
}

const typeBadge: Record<string, { label: string; className: string }> = {
  create: { label: "Novo", className: "bg-emerald-600 text-white hover:bg-emerald-700" },
  update: { label: "Atualização", className: "bg-blue-600 text-white hover:bg-blue-700" },
  config: { label: "Config", className: "bg-purple-600 text-white hover:bg-purple-700" },
};

const typeIcon: Record<string, React.ReactNode> = {
  create: <Plus className="h-4 w-4" />,
  update: <RefreshCw className="h-4 w-4" />,
  config: <Settings className="h-4 w-4" />,
};

const SystemUpdates = () => {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from("system_updates")
      .select("id, type, module, description, published_at")
      .order("published_at", { ascending: false })
      .limit(20);
    setUpdates(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUpdates();

    const channel = supabase
      .channel("system-updates-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_updates" }, () => {
        fetchUpdates();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold italic">Atualizações do Sistema</h2>
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : updates.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            Nenhuma atualização registrada.
          </p>
        ) : (
          updates.map((u) => {
            const badge = typeBadge[u.type] ?? typeBadge.update;
            const icon = typeIcon[u.type] ?? typeIcon.update;
            return (
              <div
                key={u.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={badge.className}>{badge.label}</Badge>
                    <span className="text-sm font-bold italic">{u.module}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{u.description}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {format(new Date(u.published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SystemUpdates;
