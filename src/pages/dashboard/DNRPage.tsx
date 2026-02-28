import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileWarning, Search, Loader2, CheckCircle, Clock, AlertTriangle, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface DnrEntry {
  id: string;
  tbr_code: string;
  driver_name: string | null;
  car_model: string | null;
  car_plate: string | null;
  car_color: string | null;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  loaded_at: string | null;
  dnr_value: number;
  observations: string | null;
  status: string;
  created_by_name: string | null;
  created_at: string;
  approved_at: string | null;
  closed_at: string | null;
  discounted: boolean;
}

interface TbrInfo {
  driver_name: string;
  car_model: string | null;
  car_plate: string | null;
  car_color: string | null;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  loaded_at: string | null;
  ride_id: string;
  driver_id: string;
}

const DNRPage = () => {
  const { unitSession, managerSession } = useAuthStore();
  const { toast } = useToast();
  const unitId = unitSession?.id;

  const [tbrCode, setTbrCode] = useState("");
  const [tbrInfo, setTbrInfo] = useState<TbrInfo | null>(null);
  const [tbrLoading, setTbrLoading] = useState(false);
  const [tbrNotFound, setTbrNotFound] = useState(false);
  const [dnrValue, setDnrValue] = useState("");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<DnrEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [activeTab, setActiveTab] = useState("open");

  const fetchEntries = useCallback(async () => {
    if (!unitId) return;
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const data = await fetchAllRows<DnrEntry>((from, to) =>
      supabase.from("dnr_entries").select("*").eq("unit_id", unitId).order("created_at", { ascending: false }).range(from, to)
    );
    setEntries(data);
    setLoadingEntries(false);
  }, [unitId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("dnr-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "dnr_entries", filter: `unit_id=eq.${unitId}` }, () => fetchEntries())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchEntries]);

  const searchTbr = async () => {
    if (!tbrCode.trim()) return;
    setTbrLoading(true);
    setTbrInfo(null);
    setTbrNotFound(false);

    const { data: tbrData } = await supabase
      .from("ride_tbrs")
      .select("ride_id")
      .eq("code", tbrCode.trim())
      .order("scanned_at", { ascending: false })
      .limit(1);

    if (!tbrData || tbrData.length === 0) {
      setTbrNotFound(true);
      setTbrLoading(false);
      return;
    }

    const rideId = tbrData[0].ride_id;
    const { data: ride } = await supabase.from("driver_rides").select("*").eq("id", rideId).maybeSingle();
    if (!ride) { setTbrNotFound(true); setTbrLoading(false); return; }

    const [driverRes, confRes] = await Promise.all([
      supabase.from("drivers_public").select("name, car_model, car_plate, car_color, id").eq("id", ride.driver_id).maybeSingle(),
      ride.conferente_id
        ? supabase.from("user_profiles").select("name").eq("id", ride.conferente_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setTbrInfo({
      driver_name: driverRes.data?.name ?? "Desconhecido",
      car_model: driverRes.data?.car_model ?? null,
      car_plate: driverRes.data?.car_plate ?? null,
      car_color: driverRes.data?.car_color ?? null,
      route: ride.route,
      login: ride.login,
      conferente_name: confRes.data?.name ?? null,
      loaded_at: ride.started_at ?? ride.completed_at,
      ride_id: rideId,
      driver_id: ride.driver_id,
    });
    setTbrLoading(false);
  };

  const handleRegister = async () => {
    if (!tbrInfo || !unitId || !dnrValue) return;
    setSaving(true);

    await supabase.from("dnr_entries").insert({
      unit_id: unitId,
      tbr_code: tbrCode.trim(),
      driver_id: tbrInfo.driver_id,
      driver_name: tbrInfo.driver_name,
      car_model: tbrInfo.car_model,
      car_plate: tbrInfo.car_plate,
      car_color: tbrInfo.car_color,
      ride_id: tbrInfo.ride_id,
      route: tbrInfo.route,
      login: tbrInfo.login,
      conferente_name: tbrInfo.conferente_name,
      loaded_at: tbrInfo.loaded_at,
      dnr_value: parseFloat(dnrValue),
      observations: observations || null,
      status: "open",
      created_by_name: managerSession?.name || unitSession?.name || null,
    } as any);

    toast({ title: "DNR registrado!", description: "O DNR foi salvo com sucesso." });
    setTbrCode("");
    setTbrInfo(null);
    setDnrValue("");
    setObservations("");
    setSaving(false);
    fetchEntries();
  };

  const handleApprove = async (id: string) => {
    await supabase.from("dnr_entries").update({ status: "analyzing", approved_at: new Date().toISOString() } as any).eq("id", id);
    fetchEntries();
  };

  const handleFinalize = async (id: string, withDiscount: boolean) => {
    await supabase.from("dnr_entries").update({ 
      status: "closed", 
      closed_at: new Date().toISOString(),
      discounted: withDiscount,
    } as any).eq("id", id);
    fetchEntries();
    toast({ 
      title: withDiscount ? "DNR finalizado com desconto" : "DNR finalizado sem desconto",
      description: withDiscount ? "O valor será descontado do motorista." : "Nenhum desconto aplicado.",
    });
  };

  const filtered = entries.filter(e => {
    if (activeTab === "open") return e.status === "open";
    if (activeTab === "analyzing") return e.status === "analyzing";
    if (activeTab === "closed") return e.status === "closed";
    return true;
  });

  const statusBadge = (entry: DnrEntry) => {
    if (entry.status === "open") return <Badge variant="destructive" className="text-xs">Aberto</Badge>;
    if (entry.status === "analyzing") return <Badge className="bg-amber-500 text-white text-xs">Analisando</Badge>;
    if (entry.discounted) return <Badge className="bg-red-600 text-white text-xs">Finalizado c/ Desconto</Badge>;
    return <Badge className="bg-green-600 text-white text-xs">Finalizado s/ Desconto</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileWarning className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold italic">DNR</h1>
      </div>

      {/* Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold italic">Registrar DNR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Código TBR..."
              value={tbrCode}
              onChange={(e) => setTbrCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") searchTbr(); }}
              maxLength={15}
              className="flex-1"
            />
            <Button onClick={searchTbr} disabled={tbrLoading} size="icon">
              {tbrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {tbrNotFound && <p className="text-sm text-destructive italic">TBR não encontrado.</p>}

          {tbrInfo && (
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Motorista:</strong> {tbrInfo.driver_name}</div>
                <div><strong>Carro:</strong> {[tbrInfo.car_model, tbrInfo.car_color].filter(Boolean).join(" • ") || "—"}</div>
                <div><strong>Placa:</strong> {tbrInfo.car_plate || "—"}</div>
                <div><strong>Rota:</strong> {tbrInfo.route || "—"}</div>
                <div><strong>Login:</strong> {tbrInfo.login || "—"}</div>
                <div><strong>Conferente:</strong> {tbrInfo.conferente_name || "—"}</div>
                <div><strong>Carregado em:</strong> {tbrInfo.loaded_at ? format(new Date(tbrInfo.loaded_at), "dd/MM/yyyy HH:mm") : "—"}</div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-xs">Valor DNR (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={dnrValue}
                  onChange={(e) => setDnrValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-xs">Observações</Label>
                <Textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
              <Button
                onClick={handleRegister}
                disabled={saving || !dnrValue}
                className="w-full font-bold italic"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Registrar DNR
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="open" className="gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Abertos ({entries.filter(e => e.status === "open").length})
          </TabsTrigger>
          <TabsTrigger value="analyzing" className="gap-1">
            <Clock className="h-3.5 w-3.5" /> Analisando ({entries.filter(e => e.status === "analyzing").length})
          </TabsTrigger>
          <TabsTrigger value="closed" className="gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Finalizados ({entries.filter(e => e.status === "closed").length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4 space-y-2">
          {loadingEntries ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-8">Nenhum DNR nesta categoria.</p>
          ) : (
            filtered.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{entry.tbr_code}</span>
                      {statusBadge(entry)}
                    </div>
                    <span className="text-lg font-bold text-destructive">R${Number(entry.dnr_value).toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <div><strong>Motorista:</strong> {entry.driver_name || "—"}</div>
                    <div><strong>Placa:</strong> {entry.car_plate || "—"}</div>
                    <div><strong>Rota:</strong> {entry.route || "—"}</div>
                    <div><strong>Conferente:</strong> {entry.conferente_name || "—"}</div>
                    <div><strong>Carregado:</strong> {entry.loaded_at ? format(new Date(entry.loaded_at), "dd/MM/yyyy HH:mm") : "—"}</div>
                    <div><strong>Registrado:</strong> {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}</div>
                  </div>
                  {entry.observations && (
                    <p className="text-xs bg-muted/50 p-2 rounded">{entry.observations}</p>
                  )}
                  {/* Manager actions */}
                  {managerSession && entry.status === "open" && (
                    <Button size="sm" onClick={() => handleApprove(entry.id)} className="w-full font-bold italic gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                    </Button>
                  )}
                  {managerSession && entry.status === "analyzing" && (
                    <div className="flex gap-2 w-full">
                      <Button size="sm" variant="outline" onClick={() => handleFinalize(entry.id, false)} className="flex-1 font-bold italic gap-1 border-green-500 text-green-700 hover:bg-green-50">
                        <CheckCircle className="h-3.5 w-3.5" /> Sem Desconto
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleFinalize(entry.id, true)} className="flex-1 font-bold italic gap-1">
                        <DollarSign className="h-3.5 w-3.5" /> Com Desconto
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DNRPage;
