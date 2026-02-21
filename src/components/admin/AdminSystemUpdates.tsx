import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Megaphone, Plus, Trash2, RefreshCw, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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

const AdminSystemUpdates = () => {
  const [updates, setUpdates] = useState<SystemUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("update");
  const [module, setModule] = useState("");
  const [description, setDescription] = useState("");

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from("system_updates")
      .select("*")
      .order("published_at", { ascending: false });
    setUpdates(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchUpdates(); }, []);

  const handleCreate = async () => {
    if (!module.trim() || !description.trim()) {
      toast.error("Preencha módulo e descrição.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("system_updates").insert({ type, module: module.trim(), description: description.trim() });
    if (error) {
      toast.error("Erro ao criar atualização.");
    } else {
      toast.success("Atualização registrada!");
      setModule("");
      setDescription("");
      setType("update");
      fetchUpdates();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("system_updates").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao deletar.");
    } else {
      toast.success("Removido.");
      setUpdates((prev) => prev.filter((u) => u.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold italic">Atualizações do Sistema</h1>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova Atualização</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">🟢 Novo (create)</SelectItem>
                <SelectItem value="update">🔵 Atualização (update)</SelectItem>
                <SelectItem value="config">🟣 Config (config)</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Módulo (ex: Operação, Motoristas)" value={module} onChange={(e) => setModule(e.target.value)} />
          </div>
          <Textarea placeholder="Descrição da implementação ou melhoria..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          <Button onClick={handleCreate} disabled={saving} className="w-full md:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Publicar
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : updates.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">Nenhuma atualização.</p>
          ) : (
            <div className="space-y-2">
              {updates.map((u) => {
                const badge = typeBadge[u.type] ?? typeBadge.update;
                return (
                  <div key={u.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
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
                    <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:text-destructive" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSystemUpdates;
