import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, KeyRound, Trash2, Plus, Loader2 } from "lucide-react";

const ConfiguracoesPage = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;

  // Geofencing
  const [geoCep, setGeoCep] = useState("");
  const [geoAddress, setGeoAddress] = useState("");
  const [geoRadius, setGeoRadius] = useState(500);
  const [currentGeo, setCurrentGeo] = useState<{ address: string | null; radius: number | null; lat: number | null; lng: number | null }>({ address: null, radius: null, lat: null, lng: null });
  const [geoLoading, setGeoLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  // Logins
  const [logins, setLogins] = useState<{ id: string; login: string; password: string }[]>([]);
  const [newLogin, setNewLogin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loginsLoading, setLoginsLoading] = useState(false);

  const fetchUnit = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("units").select("geofence_address, geofence_radius_meters, geofence_lat, geofence_lng").eq("id", unitId).maybeSingle();
    if (data) {
      setCurrentGeo({ address: data.geofence_address, radius: data.geofence_radius_meters, lat: data.geofence_lat, lng: data.geofence_lng });
    }
  }, [unitId]);

  const fetchLogins = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("unit_logins").select("id, login, password").eq("unit_id", unitId).eq("active", true).order("created_at", { ascending: true });
    setLogins(data ?? []);
  }, [unitId]);

  useEffect(() => { fetchUnit(); fetchLogins(); }, [fetchUnit, fetchLogins]);

  // CEP lookup
  const handleCepChange = async (value: string) => {
    const digits = value.replace(/\D/g, "");
    setGeoCep(digits);
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (data.erro) {
          // CEP not found
        } else {
          const addr = [data.logradouro, data.bairro, `${data.localidade} - ${data.uf}`].filter(Boolean).join(", ");
          setGeoAddress(addr);
        }
      } catch {
        // Error fetching CEP
      }
      setCepLoading(false);
    }
  };

  const [geoError, setGeoError] = useState("");

  const handleSetGeofence = async () => {
    if (!unitId || !geoAddress.trim()) return;
    setGeoLoading(true);
    setGeoError("");
    try {
      const res = await supabase.functions.invoke("geocode-address", { body: { address: geoAddress.trim() } });
      let geoData = res.data;
      if (typeof geoData === "string") {
        try { geoData = JSON.parse(geoData); } catch { geoData = null; }
      }
      if (res.error) {
        // Try to extract message from error context
        let msg = "Erro ao chamar serviço de geocodificação. Tente novamente.";
        try {
          const parsed = JSON.parse((res.error as any)?.context?.body || "{}");
          if (parsed.error) msg = parsed.error;
        } catch { /* ignore */ }
        setGeoError(msg);
        setGeoLoading(false);
        return;
      }
      if (!geoData || geoData.error) {
        setGeoError(geoData?.error || "Endereço não encontrado. Tente simplificar (ex: apenas rua e cidade).");
        setGeoLoading(false);
        return;
      }
      if (!geoData.lat || !geoData.lng) {
        setGeoError("Não foi possível obter coordenadas para este endereço.");
        setGeoLoading(false);
        return;
      }
      await supabase.from("units").update({
        geofence_address: geoAddress.trim(),
        geofence_lat: geoData.lat,
        geofence_lng: geoData.lng,
        geofence_radius_meters: geoRadius,
      } as any).eq("id", unitId);
      setCurrentGeo({ address: geoAddress.trim(), radius: geoRadius, lat: geoData.lat, lng: geoData.lng });
      setGeoAddress("");
      setGeoCep("");
    } catch (err) {
      setGeoError("Erro de rede ao definir perímetro. Verifique sua conexão.");
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
  };

  const handleDeleteLogin = async (id: string) => {
    await supabase.from("unit_logins").delete().eq("id", id);
    await fetchLogins();
  };

  // Build map iframe URL
  const getMapUrl = (lat: number, lng: number, radius: number) => {
    const delta = (radius / 111320) * 1.5; // rough degrees for bbox
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
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

          {/* Map */}
          {currentGeo.lat && currentGeo.lng && currentGeo.radius && (
            <div className="rounded-md overflow-hidden border border-border">
              <iframe
                src={getMapUrl(currentGeo.lat, currentGeo.lng, currentGeo.radius)}
                width="100%"
                height="300"
                className="border-0"
                title="Mapa do perímetro"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-semibold">CEP</Label>
              <div className="relative">
                <Input
                  placeholder="00000-000"
                  value={geoCep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  maxLength={8}
                />
                {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Raio (metros)</Label>
              <Input type="number" min={100} value={geoRadius} onChange={(e) => setGeoRadius(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">Endereço completo</Label>
            <Input placeholder="Ex: Rua Example, 123, Bairro, Cidade - UF" value={geoAddress} onChange={(e) => setGeoAddress(e.target.value)} />
          </div>
          {geoError && (
            <p className="text-sm text-destructive font-semibold">{geoError}</p>
          )}
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
