import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Trash2, Plus, DollarSign, Save, Loader2 } from "lucide-react";

const ConfiguracoesPage = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;

  // Logins
  const [logins, setLogins] = useState<{ id: string; login: string; password: string }[]>([]);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loginsLoading, setLoginsLoading] = useState(false);

  // TBR Value
  const [tbrValue, setTbrValue] = useState("");
  const [tbrSaving, setTbrSaving] = useState(false);
  const [tbrLoaded, setTbrLoaded] = useState(false);

  const fetchLogins = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("unit_logins").select("id, login, password").eq("unit_id", unitId).eq("active", true).order("created_at", { ascending: true });
    setLogins(data ?? []);
  }, [unitId]);

  const fetchTbrValue = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("unit_settings").select("tbr_value").eq("unit_id", unitId).maybeSingle();
    if (data) {
      setTbrValue(formatCurrency(Number(data.tbr_value)));
    }
    setTbrLoaded(true);
  }, [unitId]);

  useEffect(() => { fetchLogins(); fetchTbrValue(); }, [fetchLogins, fetchTbrValue]);

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

  // Currency formatting
  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrency = (str: string): number => {
    const cleaned = str.replace(/[^\d,]/g, "").replace(",", ".");
    return parseFloat(cleaned) || 0;
  };

  const handleTbrValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d]/g, "");
    if (!raw) { setTbrValue(""); return; }
    const num = parseInt(raw, 10) / 100;
    setTbrValue(formatCurrency(num));
  };

  const handleSaveTbrValue = async () => {
    if (!unitId) return;
    setTbrSaving(true);
    const numValue = parseCurrency(tbrValue);
    const { data: existing } = await supabase.from("unit_settings").select("id").eq("unit_id", unitId).maybeSingle();
    if (existing) {
      await supabase.from("unit_settings").update({ tbr_value: numValue } as any).eq("unit_id", unitId);
    } else {
      await supabase.from("unit_settings").insert({ unit_id: unitId, tbr_value: numValue } as any);
    }
    setTbrSaving(false);
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

      {/* Valor por TBR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Valor por TBR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Valor pago por TBR entregue (exceto retornos piso). Este valor será utilizado para calcular os ganhos dos motoristas.
          </p>
          <div className="flex gap-2 items-center">
            <span className="text-sm font-semibold text-muted-foreground">R$</span>
            <Input
              value={tbrValue}
              onChange={handleTbrValueChange}
              placeholder="0,00"
              className="max-w-[160px] text-right font-mono"
              disabled={!tbrLoaded}
            />
            <Button onClick={handleSaveTbrValue} disabled={tbrSaving || !tbrValue} size="sm">
              {tbrSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracoesPage;
