import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PackageX, Search, Loader2, X, Plus, AlertTriangle, Trash2, Camera, RefreshCw, Check, ChevronsUpDown } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { format } from "date-fns";
import { translateStatus } from "@/lib/status-labels";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const MAX_TBR_LENGTH = 15;

const DEFAULT_REASONS = [
  "1ª tentativa de entrega",
  "2ª tentativa de entrega",
  "3ª tentativa de entrega",
  "Endereço não localizado",
];

const DEFAULT_PS_REASONS = [
  "3 tentativas de entrega",
  "Produto danificado",
  "Embalagem danificada",
  "Endereço não localizado",
  "Cliente ausente",
  "Recusado pelo cliente",
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
  trip_number: number;
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
  const { unitSession, managerSession } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [reasonSearchOpen, setReasonSearchOpen] = useState(false);

  // PS Modal state
  const [psModalOpen, setPsModalOpen] = useState(false);
  const [psEntry, setPsEntry] = useState<PisoEntry | null>(null);
  const [psReason, setPsReason] = useState("");
  const [psCustomReasons, setPsCustomReasons] = useState<{ id: string; label: string }[]>([]);
  const [psNewReasonInput, setPsNewReasonInput] = useState("");
  const [psShowNewReason, setPsShowNewReason] = useState(false);
  const [psSaving, setPsSaving] = useState(false);
  const [psCameraActive, setPsCameraActive] = useState(false);
  const [psCapturedPhoto, setPsCapturedPhoto] = useState<Blob | null>(null);
  const [psPhotoPreview, setPsPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (unitSession) {
      loadEntries();
      loadCustomReasons();
      loadPsCustomReasons();
    }
  }, [unitSession]);

  const loadCustomReasons = async () => {
    if (!unitSession) return;
    const { data } = await supabase.from("piso_reasons").select("id, label").eq("unit_id", unitSession.id).order("created_at");
    if (data) setCustomReasons(data);
  };

  const loadPsCustomReasons = async () => {
    if (!unitSession) return;
    const { data } = await supabase.from("ps_reasons").select("id, label").eq("unit_id", unitSession.id).order("created_at");
    if (data) setPsCustomReasons(data);
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
      .select("ride_id, trip_number")
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
      supabase.from("drivers_public").select("name, car_model, car_plate, car_color").eq("id", ride.driver_id).maybeSingle(),
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
      trip_number: tbrData?.trip_number ?? 1,
    });
    setModalOpen(true);
    setSearching(false);
    setTbrInput("");
    setSelectedReason("");
    setShowNewReason(false);
  };

  const handleAddReason = async () => {
    if (!unitSession || !newReasonInput.trim()) return;
    const text = newReasonInput.trim();
    const formatted = text.charAt(0).toUpperCase() + text.slice(1);
    const { data } = await supabase
      .from("piso_reasons")
      .insert({ unit_id: unitSession.id, label: formatted } as any)
      .select("id, label")
      .single();
    if (data) {
      setCustomReasons((prev) => [...prev, data]);
      setSelectedReason(data.label);
      setNewReasonInput("");
      setShowNewReason(false);
      toast({ title: "Motivo adicionado" });
    }
  };

  const handleSave = async () => {
    if (!unitSession || !selectedReason) return;
    setSaving(true);
    const { error } = await supabase.from("piso_entries").insert({
      tbr_code: tbrCode,
      ride_id: trackInfo?.ride_id ?? null,
      unit_id: unitSession.id,
      driver_name: trackInfo?.driver_name ?? null,
      route: trackInfo?.route ?? null,
      reason: selectedReason,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao gravar", variant: "destructive" });
      return;
    }
    toast({ title: "Retorno Piso registrado" });
    setModalOpen(false);
    setTrackInfo(null);
    loadEntries();
    inputRef.current?.focus();
  };

  // PS Modal handlers
  const openPsModal = (entry: PisoEntry) => {
    setPsEntry(entry);
    setPsReason("");
    setPsCapturedPhoto(null);
    setPsPhotoPreview(null);
    setPsShowNewReason(false);
    setPsModalOpen(true);
  };

  const closePsModal = () => {
    setPsModalOpen(false);
    setPsEntry(null);
    stopPsCamera();
    setPsCapturedPhoto(null);
    setPsPhotoPreview(null);
  };

  const startPsCamera = async () => {
    setPsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast({ title: "Erro ao acessar câmera", variant: "destructive" });
      setPsCameraActive(false);
    }
  };

  const stopPsCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setPsCameraActive(false);
  };

  const capturePsPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setPsCapturedPhoto(blob);
        setPsPhotoPreview(URL.createObjectURL(blob));
        stopPsCamera();
      }
    }, "image/jpeg", 0.8);
  };

  const handleAddPsReason = async () => {
    if (!unitSession || !psNewReasonInput.trim()) return;
    const text = psNewReasonInput.trim();
    const formatted = text.charAt(0).toUpperCase() + text.slice(1);
    const { data } = await supabase
      .from("ps_reasons")
      .insert({ unit_id: unitSession.id, label: formatted } as any)
      .select("id, label")
      .single();
    if (data) {
      setPsCustomReasons(prev => [...prev, data]);
      setPsReason(data.label);
      setPsNewReasonInput("");
      setPsShowNewReason(false);
      toast({ title: "Motivo PS adicionado" });
    }
  };

  const handleConfirmPs = async () => {
    if (!unitSession || !psEntry || !psReason) return;
    setPsSaving(true);

    let photoUrl: string | null = null;
    if (psCapturedPhoto) {
      const fileName = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: uploadErr } = await supabase.storage.from("ps-photos").upload(fileName, psCapturedPhoto, { contentType: "image/jpeg" });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("ps-photos").getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("ps_entries").insert({
      tbr_code: psEntry.tbr_code,
      ride_id: psEntry.ride_id,
      unit_id: unitSession.id,
      driver_name: psEntry.driver_name,
      route: psEntry.route,
      description: psReason,
      reason: psReason,
      photo_url: photoUrl,
    } as any);

    if (!error) {
      await supabase.from("piso_entries").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", psEntry.id);
      setEntries(prev => prev.filter(e => e.id !== psEntry.id));
      toast({ title: "PS registrado com sucesso" });
    } else {
      toast({ title: "Erro ao registrar PS", variant: "destructive" });
    }

    setPsSaving(false);
    closePsModal();
  };

  const allReasons = [...DEFAULT_REASONS, ...customReasons.map((r) => r.label)];
  const allPsReasons = [...DEFAULT_PS_REASONS, ...psCustomReasons.map(r => r.label)];

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
                          <Button variant="outline" size="sm" onClick={() => openPsModal(e)}>
                            <AlertTriangle className="h-3 w-3 mr-1" /> PS
                          </Button>
                          {managerSession && (
                            deleteConfirmId === e.id ? (
                              <div className="flex gap-1">
                                <Button variant="destructive" size="sm" onClick={async () => {
                                  await supabase.from("piso_entries").delete().eq("id", e.id);
                                  setEntries((prev) => prev.filter((p) => p.id !== e.id));
                                  setDeleteConfirmId(null);
                                  toast({ title: "Registro excluído" });
                                }}>
                                  Confirmar
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteConfirmId(e.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )
                          )}
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

      {/* Piso Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={() => setModalOpen(false)} />
          <div className="relative z-50 w-full max-w-lg border bg-background p-6 shadow-lg sm:rounded-lg animate-in fade-in-0 zoom-in-95 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setModalOpen(false)} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center justify-between pr-8">
              <h2 className="text-lg font-bold italic mb-1">Retorno Piso — {tbrCode}</h2>
              {trackInfo && trackInfo.trip_number >= 2 && (
                <Badge className={cn(
                  "text-xs font-bold",
                  trackInfo.trip_number === 2 && "bg-purple-500 hover:bg-purple-600",
                  trackInfo.trip_number === 3 && "bg-orange-500 hover:bg-orange-600",
                  trackInfo.trip_number >= 4 && "bg-red-500 hover:bg-red-600",
                )}>
                  {trackInfo.trip_number >= 4 ? "4ª+ tentativa" : `${trackInfo.trip_number}ª tentativa`}
                </Badge>
              )}
            </div>

            {trackInfo ? (
              <div className="space-y-3 text-sm mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Motorista:</strong> {trackInfo.driver_name}</div>
                  <div><strong>Rota:</strong> {trackInfo.route || "—"}</div>
                  <div><strong>Carro:</strong> {[trackInfo.car_model, trackInfo.car_color].filter(Boolean).join(" • ") || "—"}</div>
                  <div><strong>Placa:</strong> {trackInfo.car_plate || "—"}</div>
                  <div><strong>Login:</strong> {trackInfo.login || "—"}</div>
                  <div><strong>Conferente:</strong> {trackInfo.conferente_name || "—"}</div>
                  <div><strong>Status:</strong> {translateStatus(trackInfo.loading_status)}</div>
                  <div><strong>Data:</strong> {format(new Date(trackInfo.completed_at), "dd/MM/yyyy HH:mm")}</div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic mt-2">TBR sem histórico de carregamento vinculado.</p>
            )}

            <div className="space-y-3 mt-4 border-t pt-4">
              <label className="text-xs font-semibold">Motivo do insucesso</label>
              <Popover open={reasonSearchOpen} onOpenChange={setReasonSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={reasonSearchOpen} className="w-full justify-between font-normal">
                    {selectedReason || "Selecione o motivo"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar motivo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum motivo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {allReasons.map((r) => (
                          <CommandItem key={r} value={r} onSelect={() => { setSelectedReason(r); setReasonSearchOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedReason === r ? "opacity-100" : "opacity-0")} />
                            {r}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

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

      {/* PS Modal */}
      <Dialog open={psModalOpen} onOpenChange={(open) => !open && closePsModal()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <AlertTriangle className="h-5 w-5 text-primary" /> Migrar para PS — {psEntry?.tbr_code}
            </DialogTitle>
            <DialogDescription>Informe o motivo e tire uma foto antes de confirmar.</DialogDescription>
          </DialogHeader>

          {psEntry && (
            <div className="space-y-2 text-sm">
              <div><strong>TBR:</strong> {psEntry.tbr_code}</div>
              <div><strong>Motorista:</strong> {psEntry.driver_name ?? "-"}</div>
              <div><strong>Rota:</strong> {psEntry.route ?? "-"}</div>
              <div><strong>Motivo Piso:</strong> {psEntry.reason}</div>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t">
            {/* PS Reason */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Motivo do PS</label>
              <Select value={psReason} onValueChange={setPsReason}>
                <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                <SelectContent>
                  {allPsReasons.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!psShowNewReason ? (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setPsShowNewReason(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Novo motivo
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={psNewReasonInput}
                    onChange={(e) => setPsNewReasonInput(e.target.value)}
                    placeholder="Novo motivo PS..."
                    className="flex-1 h-9 text-sm"
                  />
                  <Button size="sm" onClick={handleAddPsReason} disabled={!psNewReasonInput.trim()}>Adicionar</Button>
                </div>
              )}
            </div>

            {/* Photo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Foto</label>
              {!psCameraActive && !psPhotoPreview && (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={startPsCamera}>
                  <Camera className="h-4 w-4" /> Tirar Foto
                </Button>
              )}
              {psCameraActive && (
                <div className="space-y-2">
                  <video ref={videoRef} className="w-full rounded-md border" autoPlay playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={capturePsPhoto}>Capturar</Button>
                    <Button variant="outline" size="sm" onClick={stopPsCamera}>Cancelar</Button>
                  </div>
                </div>
              )}
              {psPhotoPreview && (
                <div className="space-y-2">
                  <img src={psPhotoPreview} alt="Preview" className="w-full rounded-md border max-h-48 object-cover" />
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => { setPsCapturedPhoto(null); setPsPhotoPreview(null); startPsCamera(); }}>
                    <RefreshCw className="h-3 w-3" /> Refazer
                  </Button>
                </div>
              )}
            </div>

            <Button className="w-full" onClick={handleConfirmPs} disabled={psSaving || !psReason}>
              {psSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar PS
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RetornoPisoPage;
