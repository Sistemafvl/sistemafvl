import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PackageX, Search, Loader2, X, Plus, AlertTriangle, RotateCcw, MapPin } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

const MAX_TBR_LENGTH = 15;

const DEFAULT_REASONS = [
  "1ª tentativa de entrega",
  "2ª tentativa de entrega",
  "3ª tentativa de entrega",
  "Endereço não localizado",
];

interface TbrTrackInfo {
  ride_id: string;
  driver_name: string;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  car_model: string | null;
  car_plate: string | null;
  car_color: string | null;
  loading_status: string | null;
  completed_at: string;
}

interface PisoEntry {
  id: string;
  tbr_code: string;
  driver_name: string | null;
  route: string | null;
  reason: string;
  created_at: string;
  ride_id: string | null;
}

const RetornoPisoPage = () => {
  const { unitSession } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [tbrInput, setTbrInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [tbrCode, setTbrCode] = useState("");
  const [trackInfo, setTrackInfo] = useState<TbrTrackInfo | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReasons, setCustomReasons] = useState<{ id: string; label: string }[]>([]);
  const [newReasonInput, setNewReasonInput] = useState("");
  const [showNewReason, setShowNewReason] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<PisoEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // RTO CEP Modal
  const [rtoModalOpen, setRtoModalOpen] = useState(false);
  const [rtoEntry, setRtoEntry] = useState<PisoEntry | null>(null);
  const [rtoCep, setRtoCep] = useState("");
  const [rtoSaving, setRtoSaving] = useState(false);

  useEffect(() => {
    if (unitSession) {
      loadEntries();
      loadCustomReasons();
    }
  }, [unitSession]);

  const loadCustomReasons = async () => {
    if (!unitSession) return;
    const { data } = await supabase
      .from("piso_reasons")
      .select("id, label")
      .eq("unit_id", unitSession.id)
      .order("created_at");
    if (data) setCustomReasons(data);
  };

  const loadEntries = async () => {
    if (!unitSession) return;
    const { data } = await supabase
      .from("piso_entries")
      .select("id, tbr_code, driver_name, route, reason, created_at, ride_id")
      .eq("unit_id", unitSession.id)
      .eq("status", "open")
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  };

  const handleTbrKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !tbrInput.trim()) return;
    const code = tbrInput.trim();
    if (code.length > MAX_TBR_LENGTH) return;

    setSearching(true);
    setTbrCode(code);

    const { data: tbrRows } = await supabase
      .from("ride_tbrs")
      .select("ride_id")
      .eq("code", code)
      .order("scanned_at", { ascending: false })
      .limit(1);

    const tbrData = tbrRows && tbrRows.length > 0 ? tbrRows[0] : null;

    if (!tbrData) {
      setSearching(false);
      setTbrInput("");
      setTrackInfo(null);
      setModalOpen(true);
      return;
    }

    const { data: ride } = await supabase
      .from("driver_rides")
      .select("id, route, login, loading_status, completed_at, conferente_id, driver_id")
      .eq("id", tbrData.ride_id)
      .maybeSingle();

    if (!ride) {
      setSearching(false);
      setTbrInput("");
      setTrackInfo(null);
      setModalOpen(true);
      return;
    }

    const [driverRes, confRes] = await Promise.all([
      supabase.from("drivers").select("name, car_model, car_plate, car_color").eq("id", ride.driver_id).maybeSingle(),
      ride.conferente_id
        ? supabase.from("user_profiles").select("name").eq("id", ride.conferente_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    setTrackInfo({
      ride_id: ride.id,
      driver_name: driverRes.data?.name ?? "Desconhecido",
      route: ride.route,
      login: ride.login,
      conferente_name: confRes.data?.name ?? null,
      car_model: driverRes.data?.car_model ?? null,
      car_plate: driverRes.data?.car_plate ?? null,
      car_color: driverRes.data?.car_color ?? null,
      loading_status: ride.loading_status,
      completed_at: ride.completed_at,
    });
    setModalOpen(true);
    setSearching(false);
    setTbrInput("");
    setSelectedReason("");
    setShowNewReason(false);
  };

  const handleAddReason = async () => {
    if (!unitSession || !newReasonInput.trim()) return;
    const { data } = await supabase
      .from("piso_reasons")
      .insert({ unit_id: unitSession.id, label: newReasonInput.trim() } as any)
      .select("id, label")
      .single();
    if (data) {
      setCustomReasons((prev) => [...prev, data]);
      setSelectedReason(data.label);
      setNewReasonInput("");
      setShowNewReason(false);
    }
  };

  const handleSave = async () => {
    if (!unitSession || !selectedReason) return;
    setSaving(true);
    await supabase.from("piso_entries").insert({
      tbr_code: tbrCode,
      ride_id: trackInfo?.ride_id ?? null,
      unit_id: unitSession.id,
      driver_name: trackInfo?.driver_name ?? null,
      route: trackInfo?.route ?? null,
      reason: selectedReason,
    } as any);
    setSaving(false);
    setModalOpen(false);
    setTrackInfo(null);
    loadEntries();
    inputRef.current?.focus();
  };

  const handleMigratePs = async (entry: PisoEntry) => {
    if (!unitSession) return;
    await supabase.from("ps_entries").insert({
      tbr_code: entry.tbr_code,
      ride_id: entry.ride_id,
      unit_id: unitSession.id,
      driver_name: entry.driver_name,
      route: entry.route,
      description: entry.reason,
    } as any);
    await supabase.from("piso_entries").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  const handleOpenRtoModal = (entry: PisoEntry) => {
    setRtoEntry(entry);
    setRtoCep("");
    setRtoModalOpen(true);
  };

  const handleCepChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) {
      setRtoCep(`${digits.slice(0, 5)}-${digits.slice(5)}`);
    } else {
      setRtoCep(digits);
    }
  };

  const handleConfirmRto = async () => {
    if (!unitSession || !rtoEntry) return;
    setRtoSaving(true);

    // Check if RTO already exists for this TBR code — reuse same row
    const { data: existingRto } = await supabase
      .from("rto_entries")
      .select("id")
      .eq("tbr_code", rtoEntry.tbr_code)
      .eq("unit_id", unitSession.id)
      .limit(1);

    if (existingRto && existingRto.length > 0) {
      await supabase.from("rto_entries").update({
        status: "open",
        closed_at: null,
        ride_id: rtoEntry.ride_id,
        driver_name: rtoEntry.driver_name,
        route: rtoEntry.route,
        description: rtoEntry.reason,
        cep: rtoCep.replace("-", "") || null,
      } as any).eq("id", existingRto[0].id);
    } else {
      await supabase.from("rto_entries").insert({
        tbr_code: rtoEntry.tbr_code,
        ride_id: rtoEntry.ride_id,
        unit_id: unitSession.id,
        driver_name: rtoEntry.driver_name,
        route: rtoEntry.route,
        description: rtoEntry.reason,
        cep: rtoCep.replace("-", "") || null,
      } as any);
    }

    await supabase.from("piso_entries").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", rtoEntry.id);
    setEntries((prev) => prev.filter((e) => e.id !== rtoEntry.id));
    setRtoModalOpen(false);
    setRtoEntry(null);
    setRtoSaving(false);
  };

  const allReasons = [...DEFAULT_REASONS, ...customReasons.map((r) => r.label)];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <PackageX className="h-5 w-5 text-primary" />
            Retorno Piso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={tbrInput}
              onChange={(e) => { if (e.target.value.length <= MAX_TBR_LENGTH) setTbrInput(e.target.value); }}
              onKeyDown={handleTbrKeyDown}
              placeholder="Leia o código TBR e pressione Enter..."
              className="pl-9 h-11"
              disabled={searching}
              autoFocus
            />
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground italic py-8">Nenhum TBR no piso</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">TBR</TableHead>
                    <TableHead className="font-bold">Motorista</TableHead>
                    <TableHead className="font-bold">Rota</TableHead>
                    <TableHead className="font-bold">Motivo</TableHead>
                    <TableHead className="font-bold">Data</TableHead>
                    <TableHead className="font-bold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.tbr_code}</TableCell>
                      <TableCell>{e.driver_name ?? "-"}</TableCell>
                      <TableCell>{e.route ?? "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{e.reason}</TableCell>
                      <TableCell className="text-xs">{format(new Date(e.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="outline" size="sm" onClick={() => handleMigratePs(e)}>
                            <AlertTriangle className="h-3 w-3 mr-1" /> PS
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleOpenRtoModal(e)}>
                            <RotateCcw className="h-3 w-3 mr-1" /> RTO
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={() => setModalOpen(false)} />
          <div className="relative z-50 w-full max-w-lg border bg-background p-6 shadow-lg sm:rounded-lg animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setModalOpen(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold italic mb-1">Retorno Piso — {tbrCode}</h2>

            {trackInfo ? (
              <div className="space-y-3 text-sm mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Motorista:</strong> {trackInfo.driver_name}</div>
                  <div><strong>Rota:</strong> {trackInfo.route || "—"}</div>
                  <div><strong>Carro:</strong> {[trackInfo.car_model, trackInfo.car_color].filter(Boolean).join(" • ") || "—"}</div>
                  <div><strong>Placa:</strong> {trackInfo.car_plate || "—"}</div>
                  <div><strong>Login:</strong> {trackInfo.login || "—"}</div>
                  <div><strong>Conferente:</strong> {trackInfo.conferente_name || "—"}</div>
                  <div><strong>Status:</strong> {trackInfo.loading_status || "—"}</div>
                  <div><strong>Data:</strong> {format(new Date(trackInfo.completed_at), "dd/MM/yyyy HH:mm")}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic mt-2">TBR sem histórico de carregamento vinculado.</p>
            )}

            <div className="space-y-3 mt-4 border-t pt-4">
              <label className="text-xs font-semibold">Motivo do insucesso</label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  {allReasons.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!showNewReason ? (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowNewReason(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Ocorrência
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newReasonInput}
                    onChange={(e) => setNewReasonInput(e.target.value)}
                    placeholder="Novo motivo..."
                    className="flex-1 h-9 text-sm"
                  />
                  <Button size="sm" onClick={handleAddReason} disabled={!newReasonInput.trim()}>Adicionar</Button>
                </div>
              )}

              <Button className="w-full" onClick={handleSave} disabled={saving || !selectedReason}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Gravar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RTO CEP Modal */}
      {rtoModalOpen && rtoEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={() => setRtoModalOpen(false)} />
          <div className="relative z-50 w-full max-w-sm border bg-background p-6 shadow-lg sm:rounded-lg animate-in fade-in-0 zoom-in-95">
            <button onClick={() => setRtoModalOpen(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-bold italic mb-1 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              RTO — {rtoEntry.tbr_code}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Informe o CEP do RTO para incluí-lo na lista.</p>
            <div className="space-y-3">
              <Input
                value={rtoCep}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                className="text-center font-mono text-lg tracking-widest"
                maxLength={9}
                autoFocus
              />
              <Button className="w-full" onClick={handleConfirmRto} disabled={rtoSaving || rtoCep.replace(/\D/g, "").length < 8}>
                {rtoSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                Incluir RTO
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetornoPisoPage;
