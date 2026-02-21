import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Search, CheckCircle, X, ChevronLeft, ChevronRight, CalendarIcon, FileText, Camera, RefreshCw, Plus } from "lucide-react";
import { translateStatus } from "@/lib/status-labels";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

interface TbrHistory {
  ride_id: string;
  driver_name: string;
  route: string | null;
  login: string | null;
  conferente_name: string | null;
  completed_at: string;
  loading_status: string | null;
}

interface PsEntry {
  id: string;
  tbr_code: string;
  driver_name: string | null;
  route: string | null;
  description: string;
  reason: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
  conferente_id: string | null;
  conferente_name?: string;
}

interface Conferente {
  id: string;
  name: string;
}

const DEFAULT_REASONS = [
  "3 tentativas de entrega",
  "Produto danificado",
  "Embalagem danificada",
  "Endereço não localizado",
  "Cliente ausente",
  "Recusado pelo cliente",
];

const ITEMS_PER_PAGE = 30;

const PSPage = () => {
  const { unitSession } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [tbrInput, setTbrInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [history, setHistory] = useState<TbrHistory | null>(null);
  const [tbrCode, setTbrCode] = useState("");
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [includeMode, setIncludeMode] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [selectedConferente, setSelectedConferente] = useState("");
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [entries, setEntries] = useState<PsEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  // Filters
  const [startDate, setStartDate] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; });
  const [endDate, setEndDate] = useState<Date>(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [statusFilter, setStatusFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [reasonSearchOpen, setReasonSearchOpen] = useState(false);

  // Custom reasons
  const [customReasons, setCustomReasons] = useState<{ id: string; label: string }[]>([]);
  const [showNewReason, setShowNewReason] = useState(false);
  const [newReasonInput, setNewReasonInput] = useState("");

  // Photo capture
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (unitSession) {
      loadEntries();
      loadConferentes();
      loadCustomReasons();
    }
  }, [unitSession, startDate, endDate, statusFilter, reasonFilter]);

  const loadConferentes = async () => {
    if (!unitSession) return;
    const { data } = await supabase
      .from("user_profiles")
      .select("id, name")
      .eq("unit_id", unitSession.id)
      .eq("active", true)
      .order("name");
    if (data) setConferentes(data);
  };

  const loadCustomReasons = async () => {
    if (!unitSession) return;
    const { data } = await supabase
      .from("ps_reasons")
      .select("id, label")
      .eq("unit_id", unitSession.id)
      .order("created_at");
    if (data) setCustomReasons(data);
  };

  const allReasons = [...DEFAULT_REASONS, ...customReasons.map(r => r.label)];

  const loadEntries = async () => {
    if (!unitSession) return;
    let query = supabase
      .from("ps_entries")
      .select("*")
      .eq("unit_id", unitSession.id)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    if (data) {
      let filtered = data;
      if (reasonFilter !== "all") {
        filtered = filtered.filter(e => e.reason === reasonFilter || e.description === reasonFilter);
      }

      const confIds = [...new Set(filtered.filter(e => e.conferente_id).map(e => e.conferente_id!))];
      let confMap: Record<string, string> = {};
      if (confIds.length > 0) {
        const { data: confs } = await supabase.from("user_profiles").select("id, name").in("id", confIds);
        if (confs) confMap = Object.fromEntries(confs.map(c => [c.id, c.name]));
      }
      setEntries(filtered.map(e => ({
        ...e,
        reason: e.reason ?? null,
        photo_url: e.photo_url ?? null,
        conferente_name: e.conferente_id ? confMap[e.conferente_id] : undefined,
      })));
    }
    setIsLoading(false);
  };

  const handleTbrInput = (value: string) => {
    setTbrInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const code = value.trim();
      if (code.toUpperCase().startsWith("TBR") && code.length >= 5) {
        searchTbr(code);
      }
    }, 300);
  };

  const searchTbr = async (code: string) => {
    setSearching(true);
    setTbrCode(code);

    const { data: tbrData } = await supabase
      .from("ride_tbrs")
      .select("ride_id")
      .eq("code", code)
      .maybeSingle();

    if (!tbrData) {
      setHistory(null);
      setHistoryModalOpen(true);
      setIncludeMode(true);
      setSearching(false);
      setTbrInput("");
      inputRef.current?.focus();
      return;
    }

    const { data: ride } = await supabase
      .from("driver_rides")
      .select("id, route, login, loading_status, completed_at, conferente_id, driver_id")
      .eq("id", tbrData.ride_id)
      .maybeSingle();

    if (!ride) {
      setHistory(null);
      setHistoryModalOpen(true);
      setIncludeMode(true);
      setSearching(false);
      setTbrInput("");
      return;
    }

    const { data: driver } = await supabase.from("drivers_public").select("name").eq("id", ride.driver_id).maybeSingle();
    let confName: string | null = null;
    if (ride.conferente_id) {
      const { data: conf } = await supabase.from("user_profiles").select("name").eq("id", ride.conferente_id).maybeSingle();
      confName = conf?.name ?? null;
    }

    setHistory({
      ride_id: ride.id,
      driver_name: driver?.name ?? "Desconhecido",
      route: ride.route,
      login: ride.login,
      conferente_name: confName,
      completed_at: ride.completed_at,
      loading_status: ride.loading_status,
    });
    setHistoryModalOpen(true);
    setIncludeMode(true);
    setSearching(false);
    setTbrInput("");
  };

  const handleIncludePS = () => {
    setIncludeMode(true);
    setSelectedReason("");
    setSelectedConferente("");
    setCapturedPhoto(null);
    setPhotoPreview(null);
  };

  // Camera functions
  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      toast({ title: "Erro ao acessar câmera", description: "Permita o acesso à câmera.", variant: "destructive" });
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
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
        setCapturedPhoto(blob);
        setPhotoPreview(URL.createObjectURL(blob));
        stopCamera();
      }
    }, "image/jpeg", 0.8);
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setPhotoPreview(null);
    startCamera();
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!capturedPhoto) return null;
    setUploadingPhoto(true);
    const fileName = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from("ps-photos").upload(fileName, capturedPhoto, { contentType: "image/jpeg" });
    setUploadingPhoto(false);
    if (error) {
      toast({ title: "Erro no upload", description: "Não foi possível enviar a foto.", variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("ps-photos").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleAddReason = async () => {
    if (!unitSession || !newReasonInput.trim()) return;
    const { data } = await supabase
      .from("ps_reasons")
      .insert({ unit_id: unitSession.id, label: newReasonInput.trim() } as any)
      .select("id, label")
      .single();
    if (data) {
      setCustomReasons(prev => [...prev, data]);
      setSelectedReason(data.label);
      setNewReasonInput("");
      setShowNewReason(false);
      toast({ title: "Motivo adicionado" });
    }
  };

  const handleSave = async () => {
    if (!unitSession || !selectedReason) return;
    setSaving(true);

    let photoUrl: string | null = null;
    if (capturedPhoto) {
      photoUrl = await uploadPhoto();
    }

    const entry = {
      tbr_code: tbrCode,
      ride_id: history?.ride_id ?? null,
      unit_id: unitSession.id,
      conferente_id: selectedConferente || null,
      description: selectedReason,
      reason: selectedReason,
      photo_url: photoUrl,
      driver_name: history?.driver_name ?? null,
      route: history?.route ?? null,
    };

    const { error } = await supabase.from("ps_entries").insert(entry as any);
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao gravar PS", variant: "destructive" });
      return;
    }
    toast({ title: "PS registrado com sucesso" });
    closeModal();
    loadEntries();
    inputRef.current?.focus();
  };

  const handleFinalize = async (id: string) => {
    await supabase.from("ps_entries").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: "closed" } : e));
    toast({ title: "PS finalizado" });
  };

  const closeModal = () => {
    setHistoryModalOpen(false);
    setIncludeMode(false);
    setHistory(null);
    setCapturedPhoto(null);
    setPhotoPreview(null);
    stopCamera();
    inputRef.current?.focus();
  };

  // PDF generation
  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório PS - Problem Solve", 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`, 14, 28);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 34);
    doc.text(`Total de registros: ${entries.length}`, 14, 40);

    let y = 50;
    doc.setFontSize(8);
    // Header
    doc.setFont("helvetica", "bold");
    doc.text("TBR", 14, y);
    doc.text("Motorista", 40, y);
    doc.text("Rota", 80, y);
    doc.text("Motivo", 100, y);
    doc.text("Data", 150, y);
    doc.text("Status", 180, y);
    doc.setFont("helvetica", "normal");
    y += 6;

    for (const e of entries) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(e.tbr_code, 14, y);
      doc.text((e.driver_name ?? "-").slice(0, 20), 40, y);
      doc.text((e.route ?? "-").slice(0, 10), 80, y);
      doc.text((e.reason ?? e.description ?? "-").slice(0, 25), 100, y);
      doc.text(format(new Date(e.created_at), "dd/MM HH:mm"), 150, y);
      doc.text(e.status === "open" ? "Aberto" : "Finalizado", 180, y);
      y += 5;
    }

    doc.save(`PS_Relatorio_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    toast({ title: "PDF gerado com sucesso" });
  };

  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE);
  const paginatedEntries = entries.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <AlertTriangle className="h-5 w-5 text-primary" />
            PS - Problem Solve
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scanner input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={tbrInput}
              onChange={(e) => handleTbrInput(e.target.value)}
              placeholder="Leia ou digite o código TBR..."
              className="pl-9 h-11"
              disabled={searching}
              autoFocus
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-end">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(startDate, "dd/MM/yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate((() => { d.setHours(0,0,0,0); return d; })())} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(endDate, "dd/MM/yy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate((() => { d.setHours(23,59,59,999); return d; })())} />
              </PopoverContent>
            </Popover>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="closed">Finalizado</SelectItem>
              </SelectContent>
            </Select>

            <Popover open={reasonSearchOpen} onOpenChange={setReasonSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs min-w-[130px] justify-start">
                  {reasonFilter === "all" ? "Todos motivos" : reasonFilter.slice(0, 20)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar motivo..." />
                  <CommandList>
                    <CommandEmpty>Nenhum motivo</CommandEmpty>
                    <CommandGroup>
                      <CommandItem onSelect={() => { setReasonFilter("all"); setReasonSearchOpen(false); }}>Todos motivos</CommandItem>
                      {allReasons.map(r => (
                        <CommandItem key={r} onSelect={() => { setReasonFilter(r); setReasonSearchOpen(false); }}>{r}</CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={generatePDF} className="gap-1">
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground italic py-8">Nenhum PS registrado</p>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">TBR</TableHead>
                      <TableHead className="font-bold">Motorista</TableHead>
                      <TableHead className="font-bold">Rota</TableHead>
                      <TableHead className="font-bold">Motivo</TableHead>
                      <TableHead className="font-bold">Conferente</TableHead>
                      <TableHead className="font-bold">Data</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                      <TableHead className="font-bold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.tbr_code}</TableCell>
                        <TableCell>{e.driver_name ?? "-"}</TableCell>
                        <TableCell>{e.route ?? "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{e.reason ?? e.description}</TableCell>
                        <TableCell>{e.conferente_name ?? "-"}</TableCell>
                        <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-center">
                          {e.status === "open" ? (
                            <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-semibold">Aberto</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-semibold">Finalizado</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            {e.photo_url && (
                              <Button variant="ghost" size="sm" onClick={() => window.open(e.photo_url!, "_blank")}>
                                <Camera className="h-3 w-3" />
                              </Button>
                            )}
                            {e.status === "open" && (
                              <Button variant="outline" size="sm" onClick={() => handleFinalize(e.id)}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Finalizar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">Página {page} de {totalPages} ({entries.length} registros)</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      Próxima <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* PS Modal */}
      <Dialog open={historyModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <AlertTriangle className="h-5 w-5 text-primary" /> PS — {tbrCode}
            </DialogTitle>
            <DialogDescription>Registrar Problem Solve para este TBR.</DialogDescription>
          </DialogHeader>
          {history && (
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold text-muted-foreground">Motorista:</span> <span className="font-bold">{history.driver_name}</span></div>
              <div><span className="font-semibold text-muted-foreground">Rota:</span> {history.route ?? "-"}</div>
              <div><span className="font-semibold text-muted-foreground">Login:</span> {history.login ?? "-"}</div>
              <div><span className="font-semibold text-muted-foreground">Conferente:</span> {history.conferente_name ?? "-"}</div>
              <div><span className="font-semibold text-muted-foreground">Status:</span> {translateStatus(history.loading_status)}</div>
              <div><span className="font-semibold text-muted-foreground">Data:</span> {new Date(history.completed_at).toLocaleString("pt-BR")}</div>
            </div>
          )}
          {!history && (
            <p className="text-sm text-muted-foreground italic">TBR sem histórico de carregamento vinculado.</p>
          )}

          {includeMode && (
            <div className="space-y-3 pt-2 border-t">
              {/* Reason select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Motivo do PS</label>
                <Select value={selectedReason} onValueChange={setSelectedReason}>
                  <SelectTrigger><SelectValue placeholder="Selecione o motivo" /></SelectTrigger>
                  <SelectContent>
                    {allReasons.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!showNewReason ? (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowNewReason(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Novo motivo
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
              </div>

              {/* Conferente */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Conferente</label>
                <Select value={selectedConferente} onValueChange={setSelectedConferente}>
                  <SelectTrigger><SelectValue placeholder="Selecione o conferente" /></SelectTrigger>
                  <SelectContent>
                    {conferentes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Photo capture */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Foto</label>
                {!cameraActive && !photoPreview && (
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={startCamera}>
                    <Camera className="h-4 w-4" /> Tirar Foto
                  </Button>
                )}
                {cameraActive && (
                  <div className="space-y-2">
                    <video ref={videoRef} className="w-full rounded-md border" autoPlay playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={capturePhoto}>Capturar</Button>
                      <Button variant="outline" size="sm" onClick={stopCamera}>Cancelar</Button>
                    </div>
                  </div>
                )}
                {photoPreview && (
                  <div className="space-y-2">
                    <img src={photoPreview} alt="Preview" className="w-full rounded-md border max-h-48 object-cover" />
                    <Button variant="outline" size="sm" className="w-full gap-2" onClick={retakePhoto}>
                      <RefreshCw className="h-3 w-3" /> Refazer
                    </Button>
                  </div>
                )}
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving || !selectedReason || uploadingPhoto}>
                {saving || uploadingPhoto ? "Gravando..." : "Gravar PS"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PSPage;
