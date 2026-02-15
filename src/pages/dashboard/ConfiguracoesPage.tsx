import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin, KeyRound, Trash2, Plus, Loader2 } from "lucide-react";

const ConfiguracoesPage = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;

  // Geofencing
  const [geoAddress, setGeoAddress] = useState("");
  const [geoRadius, setGeoRadius] = useState(500);
  const [currentGeo, setCurrentGeo] = useState<{ address: string | null; radius: number | null }>({ address: null, radius: null });
  const [geoLoading, setGeoLoading] = useState(false);

  // Logins
  const [logins, setLogins] = useState<{ id: string; login: string; password: string }[]>([]);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loginsLoading, setLoginsLoading] = useState(false);

  const fetchUnit = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("units").select("geofence_address, geofence_radius_meters").eq("id", unitId).maybeSingle();
    if (data) {
      setCurrentGeo({ address: data.geofence_address, radius: data.geofence_radius_meters });
    }
  }, [unitId]);

  const fetchLogins = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("unit_logins").select("id, login, password").eq("unit_id", unitId).eq("active", true).order("created_at", { ascending: true });
    setLogins(data ?? []);
  }, [unitId]);

  useEffect(() => { fetchUnit(); fetchLogins(); }, [fetchUnit, fetchLogins]);

  const handleSetGeofence = async () => {
    if (!unitId || !geoAddress.trim()) return;
    setGeoLoading(true);
    try {
      const res = await supabase.functions.invoke("geocode-address", { body: { address: geoAddress.trim() } });
      if (res.error || !res.data?.lat) {
        toast.error(res.data?.error || "Erro ao geocodificar endereço");
        setGeoLoading(false);
        return;
      }
      await supabase.from("units").update({
        geofence_address: geoAddress.trim(),
        geofence_lat: res.data.lat,
        geofence_lng: res.data.lng,
        geofence_radius_meters: geoRadius,
      } as any).eq("id", unitId);
      toast.success("Perímetro definido com sucesso!");
      setCurrentGeo({ address: geoAddress.trim(), radius: geoRadius });
      setGeoAddress("");
    } catch {
      toast.error("Erro ao definir perímetro");
    }
    setGeoLoading(false);
  };

  const handleAddLogin = async () => {
    if (!unitId || !newLogin.trim() || !newPassword.trim()) return;
    setLoginsLoading(true);
    await supabase.from("unit_logins").insert({ unit_id: unitId, login: newLogin.trim(), password: newPassword.trim() } as any);
    setNewLogin("");
    setNewPassword("");
    await fetchLogins();
    setLoginsLoading(false);
    toast.success("Login adicionado!");
  };

  const handleDeleteLogin = async (id: string) => {
    await supabase.from("unit_logins").delete().eq("id", id);
    await fetchLogins();
    toast.success("Login removido!");
  };

  if (!unitId) return null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold italic">Configurações</h1>

      {/* Geofencing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Perímetro / Geofencing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentGeo.address && (
            <div className="p-3 rounded-md bg-muted/50 border border-border text-sm">
              <p><strong>Endereço atual:</strong> {currentGeo.address}</p>
              <p><strong>Raio:</strong> {currentGeo.radius}m</p>
            </div>
          )}
          <div className="space-y-2">
            <Label className="font-semibold">Endereço</Label>
            <Input placeholder="Ex: Rua Example, 123, São Paulo" value={geoAddress} onChange={(e) => setGeoAddress(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">Raio (metros)</Label>
            <Input type="number" min={100} value={geoRadius} onChange={(e) => setGeoRadius(Number(e.target.value))} />
          </div>
          <Button onClick={handleSetGeofence} disabled={geoLoading || !geoAddress.trim()} className="font-bold italic">
            {geoLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Definir Perímetro
          </Button>
        </CardContent>
      </Card>

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
