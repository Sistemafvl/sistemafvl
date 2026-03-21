import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Trash2, Plus, DollarSign, Save, Loader2, Users, Gift, Search, X, Package, CalendarCheck, Pencil, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateFullBR } from "./reports/pdf-utils";

interface CustomValue {
  id: string;
  driver_id: string;
  driver_name: string;
  custom_tbr_value: number;
}

interface Bonus {
  id: string;
  driver_id: string;
  driver_name: string | null;
  amount: number;
  description: string | null;
  period_start: string;
  period_end: string;
}

interface MinPackage {
  id: string;
  driver_id: string;
  driver_name: string;
  min_packages: number;
  target_date: string | null;
}

interface FixedValue {
  id: string;
  driver_id: string;
  driver_name: string;
  target_date: string;
  fixed_value: number;
}

interface PredefinedDriver {
  id: string;
  driver_id: string;
  driver_name: string;
  suggested_route: string | null;
}

interface DriverOption {
  id: string;
  name: string;
  cpf: string;
}

const ConfiguracoesPage = () => {
  const { unitSession } = useAuthStore();
  const { toast } = useToast();
  const unitId = unitSession?.id;

  // Logins
  const [logins, setLogins] = useState<{ id: string; login: string; password: string }[]>([]);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loginsLoading, setLoginsLoading] = useState(false);
  const [loginsPage, setLoginsPage] = useState(1);
  const loginsPerPage = 10;
  const [editingLoginId, setEditingLoginId] = useState<string | null>(null);
  const [editLoginValue, setEditLoginValue] = useState("");
  const [editPasswordValue, setEditPasswordValue] = useState("");

  // TBR Value
  const [tbrValue, setTbrValue] = useState("");
  const [tbrSaving, setTbrSaving] = useState(false);
  const [tbrLoaded, setTbrLoaded] = useState(false);

  // Custom Values
  const [customValues, setCustomValues] = useState<CustomValue[]>([]);
  const [cvDriverSearch, setCvDriverSearch] = useState("");
  const [cvDriverResults, setCvDriverResults] = useState<DriverOption[]>([]);
  const [cvSelectedDriver, setCvSelectedDriver] = useState<DriverOption | null>(null);
  const [cvValue, setCvValue] = useState("");
  const [cvSaving, setCvSaving] = useState(false);

  // Bonus
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [bonusDriverSearch, setBonusDriverSearch] = useState("");
  const [bonusDriverResults, setBonusDriverResults] = useState<DriverOption[]>([]);
  const [bonusSelectedDriver, setBonusSelectedDriver] = useState<DriverOption | null>(null);
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusDescription, setBonusDescription] = useState("");
  const [bonusDate, setBonusDate] = useState("");
  const [bonusSaving, setBonusSaving] = useState(false);

  // Min packages
  const [minPackages, setMinPackages] = useState<MinPackage[]>([]);
  const [mpDriverSearch, setMpDriverSearch] = useState("");
  const [mpDriverResults, setMpDriverResults] = useState<DriverOption[]>([]);
  const [mpSelectedDriver, setMpSelectedDriver] = useState<DriverOption | null>(null);
  const [mpValue, setMpValue] = useState("");
  const [mpSaving, setMpSaving] = useState(false);

  // Fixed values
  const [fixedValues, setFixedValues] = useState<FixedValue[]>([]);
  const [fvDriverSearch, setFvDriverSearch] = useState("");
  const [fvDriverResults, setFvDriverResults] = useState<DriverOption[]>([]);
  const [fvSelectedDriver, setFvSelectedDriver] = useState<DriverOption | null>(null);
  const [fvDate, setFvDate] = useState("");
  const [fvValue, setFvValue] = useState("");
  const [fvSaving, setFvSaving] = useState(false);

  // Predefined Drivers
  const [predefinedDrivers, setPredefinedDrivers] = useState<PredefinedDriver[]>([]);
  const [pdDriverSearch, setPdDriverSearch] = useState("");
  const [pdDriverResults, setPdDriverResults] = useState<DriverOption[]>([]);
  const [pdSelectedDriver, setPdSelectedDriver] = useState<DriverOption | null>(null);
  const [pdRoute, setPdRoute] = useState("");
  const [pdLoginId, setPdLoginId] = useState("");
  const [pdSaving, setPdSaving] = useState(false);

  const fetchLogins = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("unit_logins").select("id, login, password").eq("unit_id", unitId).eq("active", true).order("created_at", { ascending: true });
    setLogins(data ?? []);
  }, [unitId]);

  const fetchTbrValue = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("unit_settings").select("tbr_value").eq("unit_id", unitId).maybeSingle();
    if (data) setTbrValue(formatCurrency(Number(data.tbr_value)));
    setTbrLoaded(true);
  }, [unitId]);

  const fetchCustomValues = useCallback(async () => {
    if (!unitId) return;
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const data = await fetchAllRows<any>((from, to) => supabase.from("driver_custom_values").select("id, driver_id, custom_tbr_value, created_at").eq("unit_id", unitId).order("created_at", { ascending: false }).range(from, to));
    if (!data.length) { setCustomValues([]); return; }
    const driverIds = data.map(d => d.driver_id);
    const { data: drivers } = await supabase.from("drivers_public").select("id, name").in("id", driverIds);
    const nameMap = new Map((drivers ?? []).map(d => [d.id, d.name]));
    setCustomValues(data.map(d => ({ ...d, driver_name: nameMap.get(d.driver_id) ?? "—" })));
  }, [unitId]);

  const fetchBonuses = useCallback(async () => {
    if (!unitId) return;
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const data = await fetchAllRows<any>((from, to) => supabase.from("driver_bonus").select("id, driver_id, driver_name, amount, description, period_start, period_end, created_at").eq("unit_id", unitId).order("created_at", { ascending: false }).range(from, to));
    setBonuses(data as Bonus[]);
  }, [unitId]);

  const fetchMinPackages = useCallback(async () => {
    if (!unitId) return;
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const data = await fetchAllRows<any>((from, to) => supabase.from("driver_minimum_packages" as any).select("id, driver_id, min_packages, created_at").eq("unit_id", unitId).order("created_at", { ascending: false }).range(from, to));
    if (!data.length) { setMinPackages([]); return; }
    const driverIds = data.map((d: any) => d.driver_id);
    if (!driverIds.length) { setMinPackages([]); return; }
    const { data: drivers } = await supabase.from("drivers_public").select("id, name").in("id", driverIds);
    const nameMap = new Map((drivers ?? []).map(d => [d.id, d.name]));
    setMinPackages(data.map((d: any) => ({
      id: d.id,
      driver_id: d.driver_id,
      driver_name: nameMap.get(d.driver_id) ?? "—",
      min_packages: d.min_packages,
      target_date: d.target_date
    })));
  }, [unitId]);

  const fetchFixedValues = useCallback(async () => {
    if (!unitId) return;
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const data = await fetchAllRows<any>((from, to) => supabase.from("driver_fixed_values" as any).select("id, driver_id, driver_name, target_date, fixed_value").eq("unit_id", unitId).order("target_date", { ascending: false }).range(from, to));
    if (!data.length) { setFixedValues([]); return; }
    const driverIds = [...new Set(data.map((d: any) => d.driver_id))];
    const { data: drivers } = await supabase.from("drivers_public").select("id, name").in("id", driverIds);
    const nameMap = new Map((drivers ?? []).map(d => [d.id, d.name]));
    setFixedValues(data.map((d: any) => ({ id: d.id, driver_id: d.driver_id, driver_name: nameMap.get(d.driver_id) ?? d.driver_name ?? "—", target_date: d.target_date, fixed_value: Number(d.fixed_value) })));
  }, [unitId]);

  const fetchPredefinedDrivers = useCallback(async () => {
    if (!unitId) return;
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const data = await fetchAllRows<any>((from, to) => supabase.from("unit_predefined_drivers" as any).select("id, driver_id, suggested_route").eq("unit_id", unitId).order("created_at", { ascending: false }).range(from, to));
    if (!data.length) { setPredefinedDrivers([]); return; }
    const driverIds = data.map((d: any) => d.driver_id);
    const { data: drivers } = await supabase.from("drivers_public").select("id, name").in("id", driverIds);
    const nameMap = new Map((drivers ?? []).map(d => [d.id, d.name]));

    const loginIds = data.map((d: any) => d.unit_login_id).filter(Boolean);
    const { data: logins } = loginIds.length ? await supabase.from("unit_logins").select("id, login").in("id", loginIds) : { data: [] };
    const loginMap = new Map((logins ?? []).map(l => [l.id, l.login]));

    setPredefinedDrivers(data.map((d: any) => ({
      id: d.id,
      driver_id: d.driver_id,
      driver_name: nameMap.get(d.driver_id) ?? "—",
      suggested_route: d.suggested_route,
      unit_login_id: d.unit_login_id,
      login_name: loginMap.get(d.unit_login_id) ?? null
    })));
  }, [unitId]);

  useEffect(() => { fetchLogins(); fetchTbrValue(); fetchCustomValues(); fetchBonuses(); fetchMinPackages(); fetchFixedValues(); fetchPredefinedDrivers(); }, [fetchLogins, fetchTbrValue, fetchCustomValues, fetchBonuses, fetchMinPackages, fetchFixedValues, fetchPredefinedDrivers]);

  // Search drivers that have been to this unit
  const searchDrivers = async (term: string, setter: (v: DriverOption[]) => void) => {
    if (!unitId || !term.trim()) { setter([]); return; }
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const rides = await fetchAllRows<{ driver_id: string }>((from, to) => supabase.from("driver_rides").select("driver_id").eq("unit_id", unitId).order("id").range(from, to));
    if (!rides.length) { setter([]); return; }
    const driverIds = [...new Set(rides.map(r => r.driver_id))];
    if (driverIds.length === 0) { setter([]); return; }
    const { data } = await supabase.from("drivers_public").select("id, name, cpf").in("id", driverIds).or(`name.ilike.%${term}%,cpf.ilike.%${term}%`).limit(10);
    setter((data ?? []).map(d => ({ id: d.id!, name: d.name!, cpf: d.cpf! })));
  };

  useEffect(() => { const t = setTimeout(() => searchDrivers(cvDriverSearch, setCvDriverResults), 300); return () => clearTimeout(t); }, [cvDriverSearch]);
  useEffect(() => { const t = setTimeout(() => searchDrivers(bonusDriverSearch, setBonusDriverResults), 300); return () => clearTimeout(t); }, [bonusDriverSearch]);
  useEffect(() => { const t = setTimeout(() => searchDrivers(mpDriverSearch, setMpDriverResults), 300); return () => clearTimeout(t); }, [mpDriverSearch]);
  useEffect(() => { const t = setTimeout(() => searchDrivers(fvDriverSearch, setFvDriverResults), 300); return () => clearTimeout(t); }, [fvDriverSearch]);
  useEffect(() => { const t = setTimeout(() => searchDrivers(pdDriverSearch, setPdDriverResults), 300); return () => clearTimeout(t); }, [pdDriverSearch]);

  const handleAddLogin = async () => {
    if (!unitId || !newLogin.trim() || !newPassword.trim()) return;
    setLoginsLoading(true);
    await supabase.from("unit_logins").insert({ unit_id: unitId, login: newLogin.trim(), password: newPassword.trim() } as any);
    setNewLogin(""); setNewPassword("");
    await fetchLogins();
    setLoginsLoading(false);
  };

  const handleDeleteLogin = async (id: string) => {
    const { error } = await supabase.from("unit_logins").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir login", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Login excluído com sucesso" });
    await fetchLogins();
  };

  const handleEditLogin = (l: { id: string; login: string; password: string }) => {
    setEditingLoginId(l.id);
    setEditLoginValue(l.login);
    setEditPasswordValue(l.password);
  };

  const handleSaveEditLogin = async () => {
    if (!editingLoginId || !editLoginValue.trim() || !editPasswordValue.trim()) return;
    await supabase.from("unit_logins").update({ login: editLoginValue.trim(), password: editPasswordValue.trim() } as any).eq("id", editingLoginId);
    setEditingLoginId(null);
    await fetchLogins();
    toast({ title: "Login atualizado!" });
  };

  const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parseCurrency = (str: string): number => { const cleaned = str.replace(/[^\d,]/g, "").replace(",", "."); return parseFloat(cleaned) || 0; };

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
    toast({ title: "Valor salvo!" });
  };

  const handleAddCustomValue = async () => {
    if (!unitId || !cvSelectedDriver || !cvValue) return;
    setCvSaving(true);
    const numValue = parseCurrency(cvValue);
    await supabase.from("driver_custom_values").upsert({ unit_id: unitId, driver_id: cvSelectedDriver.id, custom_tbr_value: numValue } as any, { onConflict: "unit_id,driver_id" });
    setCvSelectedDriver(null); setCvDriverSearch(""); setCvValue(""); setCvDriverResults([]);
    await fetchCustomValues();
    setCvSaving(false);
    toast({ title: "Valor customizado salvo!" });
  };

  const handleDeleteCustomValue = async (id: string) => {
    await supabase.from("driver_custom_values").delete().eq("id", id);
    await fetchCustomValues();
  };

  const handleAddBonus = async () => {
    if (!unitId || !bonusSelectedDriver || !bonusAmount || !bonusDate) return;
    setBonusSaving(true);
    await supabase.from("driver_bonus").insert({
      unit_id: unitId,
      driver_id: bonusSelectedDriver.id,
      driver_name: bonusSelectedDriver.name,
      amount: parseCurrency(bonusAmount),
      description: bonusDescription || null,
      period_start: bonusDate,
      period_end: bonusDate,
    } as any);
    setBonusSelectedDriver(null); setBonusDriverSearch(""); setBonusAmount(""); setBonusDescription(""); setBonusDate(""); setBonusDriverResults([]);
    await fetchBonuses();
    setBonusSaving(false);
    toast({ title: "Adicional cadastrado!" });
  };

  const handleDeleteBonus = async (id: string) => {
    await supabase.from("driver_bonus").delete().eq("id", id);
    await fetchBonuses();
  };

  const handleCvValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d]/g, "");
    if (!raw) { setCvValue(""); return; }
    setCvValue(formatCurrency(parseInt(raw, 10) / 100));
  };

  const handleAddMinPackage = async () => {
    if (!unitId || !mpSelectedDriver || !mpValue) return;
    setMpSaving(true);
    const num = parseInt(mpValue, 10);
    if (isNaN(num) || num <= 0) { setMpSaving(false); return; }
    await supabase.from("driver_minimum_packages" as any).upsert({
      unit_id: unitId,
      driver_id: mpSelectedDriver.id,
      min_packages: num,
      target_date: mpDate || null
    } as any, { onConflict: "unit_id,driver_id,target_date" });
    setMpSelectedDriver(null); setMpDriverSearch(""); setMpValue(""); setMpDate(""); setMpDriverResults([]);
    await fetchMinPackages();
    setMpSaving(false);
    toast({ title: "Pacote mínimo salvo!" });
  };

  const handleDeleteMinPackage = async (id: string) => {
    await supabase.from("driver_minimum_packages" as any).delete().eq("id", id);
    await fetchMinPackages();
  };

  const handleBonusAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d]/g, "");
    if (!raw) { setBonusAmount(""); return; }
    setBonusAmount(formatCurrency(parseInt(raw, 10) / 100));
  };

  const handleFvValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d]/g, "");
    if (!raw) { setFvValue(""); return; }
    setFvValue(formatCurrency(parseInt(raw, 10) / 100));
  };

  const handleAddFixedValue = async () => {
    if (!unitId || !fvSelectedDriver || !fvValue || !fvDate) return;
    setFvSaving(true);
    const numValue = parseCurrency(fvValue);
    await supabase.from("driver_fixed_values" as any).upsert({
      unit_id: unitId,
      driver_id: fvSelectedDriver.id,
      driver_name: fvSelectedDriver.name,
      target_date: fvDate,
      fixed_value: numValue,
    } as any, { onConflict: "unit_id,driver_id,target_date" });
    setFvSelectedDriver(null); setFvDriverSearch(""); setFvValue(""); setFvDate(""); setFvDriverResults([]);
    await fetchFixedValues();
    setFvSaving(false);
    toast({ title: "Valor fixo salvo!" });
  };

  const handleDeleteFixedValue = async (id: string) => {
    await supabase.from("driver_fixed_values" as any).delete().eq("id", id);
    await fetchFixedValues();
  };

  const handleAddPredefinedDriver = async () => {
    if (!unitId || !pdSelectedDriver) return;
    setPdSaving(true);
    await supabase.from("unit_predefined_drivers" as any).upsert({
      unit_id: unitId,
      driver_id: pdSelectedDriver.id,
      suggested_route: pdRoute || null,
      unit_login_id: pdLoginId || null,
    } as any, { onConflict: "unit_id,driver_id" });
    setPdSelectedDriver(null); setPdDriverSearch(""); setPdRoute(""); setPdLoginId(""); setPdDriverResults([]);
    await fetchPredefinedDrivers();
    setPdSaving(false);
    toast({ title: "Motorista adicionado à programação!" });
  };

  const handleDeletePredefinedDriver = async (id: string) => {
    await supabase.from("unit_predefined_drivers" as any).delete().eq("id", id);
    await fetchPredefinedDrivers();
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
              {logins.slice((loginsPage - 1) * loginsPerPage, loginsPage * loginsPerPage).map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card text-sm">
                  {editingLoginId === l.id ? (
                    <>
                      <Input value={editLoginValue} onChange={(e) => setEditLoginValue(e.target.value)} className="flex-1 h-8" placeholder="Login" />
                      <Input value={editPasswordValue} onChange={(e) => setEditPasswordValue(e.target.value)} className="flex-1 h-8" placeholder="Senha" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={handleSaveEditLogin}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingLoginId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold flex-1">{l.login}</span>
                      <span className="text-muted-foreground flex-1">{l.password}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleEditLogin(l)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteLogin(l.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
              {logins.length > loginsPerPage && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Página {loginsPage} de {Math.ceil(logins.length / loginsPerPage)} ({logins.length} logins)
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={loginsPage <= 1} onClick={() => setLoginsPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={loginsPage >= Math.ceil(logins.length / loginsPerPage)} onClick={() => setLoginsPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
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
            <Input value={tbrValue} onChange={handleTbrValueChange} placeholder="0,00" className="max-w-[160px] text-right font-mono" disabled={!tbrLoaded} />
            <Button onClick={handleSaveTbrValue} disabled={tbrSaving || !tbrValue} size="sm">
              {tbrSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Valores Diferenciados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic text-lg">
            <Users className="h-5 w-5 text-primary" />
            Valores Diferenciados por Motorista
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina um valor por TBR diferente para motoristas específicos. Este valor substitui o padrão na geração do relatório.
          </p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={cvSelectedDriver ? cvSelectedDriver.name : cvDriverSearch}
                onChange={(e) => { setCvDriverSearch(e.target.value); setCvSelectedDriver(null); }}
                placeholder="Buscar motorista por nome ou CPF..."
                className="pl-9"
              />
              {cvSelectedDriver && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setCvSelectedDriver(null); setCvDriverSearch(""); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {cvDriverResults.length > 0 && !cvSelectedDriver && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {cvDriverResults.map(d => (
                  <button key={d.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => { setCvSelectedDriver(d); setCvDriverResults([]); }}>
                    {d.name} — {d.cpf}
                  </button>
                ))}
              </div>
            )}
            {cvSelectedDriver && (
              <div className="flex gap-2 items-center">
                <span className="text-sm font-semibold text-muted-foreground">R$</span>
                <Input value={cvValue} onChange={handleCvValueChange} placeholder="0,00" className="max-w-[140px] text-right font-mono" />
                <Button onClick={handleAddCustomValue} disabled={cvSaving || !cvValue} size="sm">
                  {cvSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </div>
            )}
          </div>
          {customValues.length > 0 && (
            <div className="space-y-2">
              {customValues.map(cv => (
                <div key={cv.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card text-sm">
                  <span className="font-semibold flex-1">{cv.driver_name}</span>
                  <span className="text-primary font-mono font-bold">R$ {formatCurrency(Number(cv.custom_tbr_value))}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCustomValue(cv.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adicionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic text-lg">
            <Gift className="h-5 w-5 text-primary" />
            Adicionais por Motorista
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Adicione valores extras para motoristas que serão incluídos no próximo relatório de pagamento do período selecionado.
          </p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={bonusSelectedDriver ? bonusSelectedDriver.name : bonusDriverSearch}
                onChange={(e) => { setBonusDriverSearch(e.target.value); setBonusSelectedDriver(null); }}
                placeholder="Buscar motorista..."
                className="pl-9"
              />
              {bonusSelectedDriver && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setBonusSelectedDriver(null); setBonusDriverSearch(""); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {bonusDriverResults.length > 0 && !bonusSelectedDriver && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {bonusDriverResults.map(d => (
                  <button key={d.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => { setBonusSelectedDriver(d); setBonusDriverResults([]); }}>
                    {d.name} — {d.cpf}
                  </button>
                ))}
              </div>
            )}
            {bonusSelectedDriver && (
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-semibold text-muted-foreground">R$</span>
                  <Input value={bonusAmount} onChange={handleBonusAmountChange} placeholder="0,00" className="max-w-[140px] text-right font-mono" />
                </div>
                <Input value={bonusDescription} onChange={(e) => setBonusDescription(e.target.value)} placeholder="Descrição (opcional)" />
                <div>
                  <label className="text-xs text-muted-foreground">Data da Corrida</label>
                  <Input type="date" value={bonusDate} onChange={(e) => setBonusDate(e.target.value)} />
                </div>
                <Button onClick={handleAddBonus} disabled={bonusSaving || !bonusAmount || !bonusDate} className="w-full" size="sm">
                  {bonusSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Adicionar
                </Button>
              </div>
            )}
          </div>
          {bonuses.length > 0 && (
            <div className="space-y-2">
              {bonuses.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card text-sm">
                  <div className="flex-1">
                    <span className="font-semibold">{b.driver_name ?? "—"}</span>
                    {b.description && <span className="text-muted-foreground ml-2 text-xs">({b.description})</span>}
                    <p className="text-xs text-muted-foreground">Data: {formatDateFullBR(b.period_start)}</p>
                  </div>
                  <span className="text-green-600 font-mono font-bold">+R$ {formatCurrency(Number(b.amount))}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteBonus(b.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pacotes Mínimos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic text-lg">
            <Package className="h-5 w-5 text-primary" />
            Pacotes Mínimos por Motorista
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina o mínimo de pacotes. Se o motorista sair com menos, o sistema complementa automaticamente no cálculo da folha de pagamento.
          </p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={mpSelectedDriver ? mpSelectedDriver.name : mpDriverSearch}
                onChange={(e) => { setMpDriverSearch(e.target.value); setMpSelectedDriver(null); }}
                placeholder="Buscar motorista por nome ou CPF..."
                className="pl-9"
              />
              {mpSelectedDriver && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setMpSelectedDriver(null); setMpDriverSearch(""); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {mpDriverResults.length > 0 && !mpSelectedDriver && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {mpDriverResults.map(d => (
                  <button key={d.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => { setMpSelectedDriver(d); setMpDriverResults([]); }}>
                    {d.name} — {d.cpf}
                  </button>
                ))}
              </div>
            )}
            {mpSelectedDriver && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Data (Opcional - Em branco fica fixo)</label>
                  <Input type="date" value={mpDate} onChange={(e) => setMpDate(e.target.value)} />
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={mpValue}
                    onChange={(e) => setMpValue(e.target.value)}
                    placeholder="Mínimo de pacotes"
                    className="max-w-[180px]"
                    min={1}
                  />
                  <Button onClick={handleAddMinPackage} disabled={mpSaving || !mpValue} size="sm">
                    {mpSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </div>
          {minPackages.length > 0 && (
            <div className="space-y-2">
              {minPackages.map(mp => (
                <div key={mp.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card text-sm">
                  <div className="flex-1">
                    <span className="font-semibold">{mp.driver_name}</span>
                    {mp.target_date && <p className="text-xs text-muted-foreground">Data: {formatDateFullBR(mp.target_date)}</p>}
                  </div>
                  <span className="text-primary font-mono font-bold">{mp.min_packages} pacotes</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteMinPackage(mp.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Valor Fixo de Saída */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic text-lg">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Valor Fixo de Saída
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Defina um valor fixo de pagamento para um motorista em uma data específica. Naquele dia, ele receberá esse valor independente da quantidade de pacotes.
          </p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={fvSelectedDriver ? fvSelectedDriver.name : fvDriverSearch}
                onChange={(e) => { setFvDriverSearch(e.target.value); setFvSelectedDriver(null); }}
                placeholder="Buscar motorista por nome ou CPF..."
                className="pl-9"
              />
              {fvSelectedDriver && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setFvSelectedDriver(null); setFvDriverSearch(""); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {fvDriverResults.length > 0 && !fvSelectedDriver && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {fvDriverResults.map(d => (
                  <button key={d.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => { setFvSelectedDriver(d); setFvDriverResults([]); }}>
                    {d.name} — {d.cpf}
                  </button>
                ))}
              </div>
            )}
            {fvSelectedDriver && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Data</label>
                  <Input type="date" value={fvDate} onChange={(e) => setFvDate(e.target.value)} />
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-sm font-semibold text-muted-foreground">R$</span>
                  <Input value={fvValue} onChange={handleFvValueChange} placeholder="0,00" className="max-w-[140px] text-right font-mono" />
                  <Button onClick={handleAddFixedValue} disabled={fvSaving || !fvValue || !fvDate} size="sm">
                    {fvSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                </div>
              </div>
            )}
          </div>
          {fixedValues.length > 0 && (
            <div className="space-y-2">
              {fixedValues.map(fv => (
                <div key={fv.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card text-sm">
                  <div className="flex-1">
                    <span className="font-semibold">{fv.driver_name}</span>
                    <p className="text-xs text-muted-foreground">Data: {formatDateFullBR(fv.target_date)}</p>
                  </div>
                  <span className="text-primary font-mono font-bold">R$ {formatCurrency(fv.fixed_value)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteFixedValue(fv.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Programação Pré-definida */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic text-lg">
            <Users className="h-5 w-5 text-primary" />
            Programação Pré-definida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure motoristas para carregamento rápido. Ao usar o botão na fila, esses motoristas serão processados em sequência com as rotas pré-definidas.
          </p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={pdSelectedDriver ? pdSelectedDriver.name : pdDriverSearch}
                onChange={(e) => { setPdDriverSearch(e.target.value); setPdSelectedDriver(null); }}
                placeholder="Buscar motorista por nome ou CPF..."
                className="pl-9"
              />
              {pdSelectedDriver && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setPdSelectedDriver(null); setPdDriverSearch(""); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            {pdDriverResults.length > 0 && !pdSelectedDriver && (
              <div className="border rounded-md max-h-32 overflow-y-auto">
                {pdDriverResults.map(d => (
                  <button key={d.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm" onClick={() => { setPdSelectedDriver(d); setPdDriverResults([]); }}>
                    {d.name} — {d.cpf}
                  </button>
                ))}
              </div>
            )}
            {pdSelectedDriver && (
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Rota Sugerida (Opcional)</label>
                  <Input value={pdRoute} onChange={(e) => setPdRoute(e.target.value)} placeholder="Ex: ROTA 01" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Login Sugerido (Opcional)</label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    value={pdLoginId}
                    onChange={(e) => setPdLoginId(e.target.value)}
                  >
                    <option value="">Nenhum</option>
                    {logins.map(l => (
                      <option key={l.id} value={l.id}>{l.login}</option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleAddPredefinedDriver} disabled={pdSaving} size="sm" className="w-full">
                  {pdSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Adicionar à Programação
                </Button>
              </div>
            )}
          </div>
          {predefinedDrivers.length > 0 && (
            <div className="space-y-2">
              {predefinedDrivers.map(pd => (
                <div key={pd.id} className="flex items-center gap-3 p-2 rounded-md border border-border bg-card text-sm">
                  <div className="flex-1">
                    <span className="font-semibold">{pd.driver_name}</span>
                    <div className="flex gap-2">
                      {pd.suggested_route && <p className="text-xs text-muted-foreground">Rota: {pd.suggested_route}</p>}
                      {pd.login_name && <p className="text-xs text-muted-foreground font-semibold text-primary">Login: {pd.login_name}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeletePredefinedDriver(pd.id)}>
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
