import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, KeyRound, Trash2, Plus, Loader2, Save } from "lucide-react";

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
  const [geoError, setGeoError] = useState("");
  const [pinMoved, setPinMoved] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
      if (data.geofence_radius_meters) setGeoRadius(data.geofence_radius_meters);
    }
  }, [unitId]);

  const fetchLogins = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase.from("unit_logins").select("id, login, password").eq("unit_id", unitId).eq("active", true).order("created_at", { ascending: true });
    setLogins(data ?? []);
  }, [unitId]);

  useEffect(() => { fetchUnit(); fetchLogins(); }, [fetchUnit, fetchLogins]);

  // Listen for marker-moved postMessage from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "marker-moved") {
        setCurrentGeo(prev => ({ ...prev, lat: e.data.lat, lng: e.data.lng }));
        setPinMoved(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Send radius updates to iframe
  useEffect(() => {
    if (iframeRef.current?.contentWindow && currentGeo.lat && currentGeo.lng) {
      iframeRef.current.contentWindow.postMessage({ type: "update-radius", radius: geoRadius }, "*");
    }
  }, [geoRadius, currentGeo.lat, currentGeo.lng]);

  // CEP lookup
  const handleCepChange = async (value: string) => {
    const digits = value.replace(/\D/g, "");
    setGeoCep(digits);
    if (digits.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          const addr = data.logradouro || "";
          setGeoAddress(addr);
        }
      } catch { /* ignore */ }
      setCepLoading(false);
    }
  };

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
      setPinMoved(false);
    } catch {
      setGeoError("Erro de rede ao definir perímetro. Verifique sua conexão.");
    }
    setGeoLoading(false);
  };

  const handleSavePin = async () => {
    if (!unitId || !currentGeo.lat || !currentGeo.lng) return;
    setSavingPin(true);
    await supabase.from("units").update({
      geofence_lat: currentGeo.lat,
      geofence_lng: currentGeo.lng,
      geofence_radius_meters: geoRadius,
    } as any).eq("id", unitId);
    setCurrentGeo(prev => ({ ...prev, radius: geoRadius }));
    setPinMoved(false);
    setSavingPin(false);
  };

  // Leaflet map HTML
  const mapBlobUrl = useMemo(() => {
    if (!currentGeo.lat || !currentGeo.lng) return null;
    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map');
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
var marker=L.marker([${currentGeo.lat},${currentGeo.lng}],{draggable:true}).addTo(map);
var circle=L.circle([${currentGeo.lat},${currentGeo.lng}],{radius:${geoRadius},color:'#3b82f6',fillColor:'#3b82f6',fillOpacity:0.15,weight:2}).addTo(map);
map.fitBounds(circle.getBounds());
marker.on('dragend',function(e){
  var p=e.target.getLatLng();
  circle.setLatLng(p);
  parent.postMessage({type:'marker-moved',lat:p.lat,lng:p.lng},'*');
});
window.addEventListener('message',function(e){
  if(e.data&&e.data.type==='update-radius'){
    circle.setRadius(e.data.radius);
    map.fitBounds(circle.getBounds());
  }
});
<\/script>
</body></html>`;
    return URL.createObjectURL(new Blob([html], { type: "text/html" }));
  }, [currentGeo.lat, currentGeo.lng]);

  // Cleanup blob URL
  useEffect(() => {
    return () => { if (mapBlobUrl) URL.revokeObjectURL(mapBlobUrl); };
  }, [mapBlobUrl]);

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

          {/* Leaflet Map */}
          {mapBlobUrl && (
            <div className="rounded-md overflow-hidden border border-border">
              <iframe
                ref={iframeRef}
                src={mapBlobUrl}
                width="100%"
                height="350"
                className="border-0"
                title="Mapa do perímetro"
                sandbox="allow-scripts"
              />
            </div>
          )}

          {pinMoved && (
            <Button onClick={handleSavePin} disabled={savingPin} variant="outline" className="font-bold italic gap-2">
              {savingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Posição
            </Button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-semibold">CEP</Label>
              <div className="relative">
                <Input placeholder="00000-000" value={geoCep} onChange={(e) => handleCepChange(e.target.value)} maxLength={8} />
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
          {geoError && <p className="text-sm text-destructive font-semibold">{geoError}</p>}
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
