import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Trash2, Plus } from "lucide-react";

const ConfiguracoesPage = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;

  // Logins
  const [logins, setLogins] = useState<{ id: string; login: string; password: string }[]>([]);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loginsLoading, setLoginsLoading] = useState(false);

  const fetchLogins = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("unit_logins").select("id, login, password").eq("unit_id", unitId).eq("active", true).order("created_at", { ascending: true });
    setLogins(data ?? []);
  }, [unitId]);

  useEffect(() => { fetchLogins(); }, [fetchLogins]);

  const handleAddLogin = async () => {
    if (!unitId || !newLogin.trim() || !newPassword.trim()) return;
    setLoginsLoading(true);
    await supabase.from("unit_logins").insert({ unit_id: unitId, login: newLogin.trim(), password: newPassword.trim() } as any);
    setNewLogin("");
    setNewPassword("");
    await fetchLogins();
    setLoginsLoading(false);
  };

  const handleDeleteLogin = async (id: string) => {
    await supabase.from("unit_logins").delete().eq("id", id);
    await fetchLogins();
  };

  if (!unitId) return null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold italic">Configurações</h1>

      {/* Logins */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic text-lg">
            <KeyRound className="h-5 w-5 text-primary" />
            Logins e Senhas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Login" value={newLogin} onChange={(e) => setNewLogin(e.target.value)} className="flex-1" />
            <Input placeholder="Senha" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="flex-1" />
            <Button onClick={handleAddLogin} disabled={loginsLoading || !newLogin.trim() || !newPassword.trim()} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {logins.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nenhum login cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {logins.map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card text-sm">
                  <span className="font-semibold flex-1">{l.login}</span>
                  <span className="text-muted-foreground flex-1">{l.password}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteLogin(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracoesPage;
