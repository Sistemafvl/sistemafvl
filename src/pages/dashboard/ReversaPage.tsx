import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  PackageSearch, Send, CheckCircle2, Clock, Camera, X, Printer, Image as ImageIcon, Keyboard, Search, History, Download, CalendarDays, User, Package,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn, formatDateBR, isValidTbrCode } from "@/lib/utils";
import { isBarcodeInsideViewfinder } from "@/lib/scanner-utils";
import QrViewfinder from "@/components/ui/QrViewfinder";
import jsPDF from "jspdf";
import { loadLogoBase64 } from "./reports/pdf-utils";

interface PsReversa {
  id: string;
  tbr_code: string;
  driver_name: string | null;
  route: string | null;
  reason: string | null;
  description: string;
  photo_url: string | null;
  created_at: string;
  is_seller: boolean;
  observations: string | null;
}

interface ReversaBatch {
  id: string;
  conferente_name: string | null;
  total_scanned: number;
  total_pending: number;
  lacre: string | null;
  vrid: string | null;
  created_at: string;
}

type ModalStep = "scan" | "summary";

const playSuccessBeep = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 880; gain.gain.value = 0.15;
    osc.start(); osc.stop(ctx.currentTime + 0.1);
  } catch {}
};

const playErrorBeep = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 300; osc.type = "square"; gain.gain.value = 0.2;
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch {}
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const ReversaPage = () => {
  const { unitSession, conferenteSession } = useAuthStore();
  const [entries, setEntries] = useState<PsReversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Scan modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>("scan");
  const [scannedCodes, setScannedCodes] = useState<Set<string>>(new Set());
  const [scanInput, setScanInput] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Camera
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanCooldownRef = useRef(false);

  // Extra Details
  const [lacre, setLacre] = useState("");
  const [vrid, setVrid] = useState("");

  // PDF
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // History modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [batches, setBatches] = useState<ReversaBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!unitSession?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("ps_entries")
      .select("id, tbr_code, driver_name, route, reason, description, photo_url, created_at, is_seller, observations")
      .eq("unit_id", unitSession.id)
      .eq("status", "closed")
      .is("reversa_at", null)
      .order("created_at", { ascending: false });
    setEntries(data ?? []);
    setLoading(false);
  }, [unitSession?.id]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Fetch history batches
  const fetchBatches = useCallback(async () => {
    if (!unitSession?.id) return;
    setLoadingBatches(true);
    const { data } = await (supabase
      .from("reversa_batches" as any)
      .select("id, conferente_name, total_scanned, total_pending, lacre, vrid, created_at")
      .eq("unit_id", unitSession.id)
      .order("created_at", { ascending: false })
      .limit(500) as any);
    setBatches((data as ReversaBatch[]) ?? []);
    setLoadingBatches(false);
  }, [unitSession?.id]);

  useEffect(() => { if (historyOpen) fetchBatches(); }, [historyOpen, fetchBatches]);

  // Scanner
  const processScan = useCallback((code: string) => {
    if (scannedCodes.has(code)) {
      playErrorBeep();
      toast({ title: "Já conferido", description: `${code} já foi bipado.`, variant: "destructive" });
      return;
    }
    const found = entries.find(e => e.tbr_code.toUpperCase() === code);
    if (!found) {
      playErrorBeep();
      toast({ title: "TBR não encontrado", description: `${code} não está na lista de reversa.`, variant: "destructive" });
      return;
    }
    playSuccessBeep();
    setScannedCodes(prev => new Set(prev).add(code));
    toast({ title: "✅ Conferido", description: code });
  }, [entries, scannedCodes]);

  const handleScanInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setScanInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const code = val.trim().toUpperCase();
      if (code.length >= 6 && isValidTbrCode(code)) {
        processScan(code);
        setScanInput("");
      }
    }, 20);
  }, [processScan]);

  const handleScanKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = scanInput.trim().toUpperCase();
      if (code && isValidTbrCode(code)) {
        processScan(code);
        setScanInput("");
      }
    }
  }, [scanInput, processScan]);

  // Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraOpen(true);
    } catch { toast({ title: "Erro ao acessar câmera", variant: "destructive" }); }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current) return;
    if (!("BarcodeDetector" in window)) return;
    // @ts-ignore
    const detector = new BarcodeDetector({ formats: ["data_matrix", "qr_code", "code_128", "code_39", "pdf417"] });
    const interval = setInterval(async () => {
      if (scanCooldownRef.current || !videoRef.current) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        const inside = barcodes.filter((b: any) => isBarcodeInsideViewfinder(b, videoRef.current!, 0.2));
        if (inside.length === 1) {
          const code = inside[0].rawValue?.trim().toUpperCase();
          if (code && isValidTbrCode(code)) {
            scanCooldownRef.current = true;
            processScan(code);
            setTimeout(() => { scanCooldownRef.current = false; }, 3000);
          }
        }
      } catch {}
    }, 100);
    return () => clearInterval(interval);
  }, [cameraOpen, processScan]);

  useEffect(() => {
    if (!modalOpen) { stopCamera(); setScannedCodes(new Set()); setModalStep("scan"); }
  }, [modalOpen, stopCamera]);

  const filtered = entries.filter(e => {
    if (!searchTerm) return true;
    const s = searchTerm.toUpperCase();
    return e.tbr_code.toUpperCase().includes(s) || (e.driver_name?.toUpperCase().includes(s)) || (e.route?.toUpperCase().includes(s));
  });

  const scannedEntries = entries.filter(e => scannedCodes.has(e.tbr_code.toUpperCase()));
  const pendingEntries = entries.filter(e => !scannedCodes.has(e.tbr_code.toUpperCase()));

  const handleConfirmAll = () => {
    if (entries.length === 0) return;
    const allIds = entries.map(e => e.tbr_code.toUpperCase());
    setScannedCodes(new Set(allIds));
    playSuccessBeep();
    toast({ title: "Pronto!", description: "Todos os TBRs foram marcados como conferidos." });
  };

  // Finalize reversa — create batch + update ps_entries
  const handleFinalize = async () => {
    if (scannedEntries.length === 0) return;

    // Create batch record
    const { data: batch } = await (supabase
      .from("reversa_batches" as any)
      .insert({
        unit_id: unitSession!.id,
        conferente_name: conferenteSession?.name ?? null,
        total_scanned: scannedEntries.length,
        total_pending: pendingEntries.length,
        lacre: lacre.trim() || null,
        vrid: vrid.trim() || null,
      })
      .select("id")
      .single() as any);

    const batchId = batch?.id;
    const now = new Date().toISOString();
    const ids = scannedEntries.map(e => e.id);

    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      await supabase.from("ps_entries").update({
        reversa_at: now,
        ...(batchId ? { reversa_batch_id: batchId } : {}),
      } as any).in("id", chunk);
    }

    toast({ title: "Reversa finalizada", description: `${scannedEntries.length} TBRs conferidos e removidos.` });
    setModalOpen(false);
    fetchEntries();
  };

  // Generate PDF for current pending list
  const generatePdf = async () => {
    setGeneratingPdf(true);
    try {
      // Fake batch data to attach the currently typed Lacre and VRID to the preview print
      const tempBatch: Partial<ReversaBatch> = { lacre, vrid };
      await buildReversaPdf(entries.map(e => ({ ...e, _status: "Pendente" })), 0, entries.length, `reversa_pendentes_${new Date().toISOString().slice(0, 10)}.pdf`, tempBatch as ReversaBatch);
    } catch { toast({ title: "Erro ao gerar PDF", variant: "destructive" }); }
    setGeneratingPdf(false);
  };

  // Generate PDF for a specific batch
  const generateBatchPdf = async (batch: ReversaBatch) => {
    setDownloadingBatchId(batch.id);
    try {
      const { data: batchEntries }: any = await supabase
        .from("ps_entries")
        .select("id, tbr_code, driver_name, route, reason, description, photo_url, created_at, is_seller, observations")
        .filter("reversa_batch_id", "eq", batch.id)
        .order("created_at", { ascending: true });

      const items = ((batchEntries ?? []) as PsReversa[]).map(e => ({ ...e, _status: "OK" as const }));
      const dateStr = new Date(batch.created_at).toLocaleDateString("pt-BR").replace(/\//g, "-");
      await buildReversaPdf(items, batch.total_scanned, batch.total_pending, `reversa_${dateStr}.pdf`, batch);
    } catch { toast({ title: "Erro ao gerar PDF", variant: "destructive" }); }
    setDownloadingBatchId(null);
  };

  // Shared PDF builder
  const buildReversaPdf = async (
    items: (PsReversa & { _status: string })[],
    scanned: number,
    pending: number,
    fileName: string,
    batch?: ReversaBatch,
  ) => {
    const logo = await loadLogoBase64();
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const margin = 10;
    const contentW = pageW - margin * 2;
    let y = margin;

    // Header
    if (logo) pdf.addImage(logo, "PNG", margin, y, 20, 20);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Relatório de Reversa", margin + 24, y + 8);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Unidade: ${unitSession?.name ?? ""}`, margin + 24, y + 14);
    if (batch) {
      pdf.text(`Data: ${formatDateTime(batch.created_at || new Date().toISOString())}`, margin + 24, y + 19);
      if (batch.conferente_name) {
        pdf.text(`Conferente: ${batch.conferente_name}`, margin + 80, y + 19);
      }
      if (batch.lacre || batch.vrid) {
        pdf.text(`Lacre: ${batch.lacre || "-"}    VRID: ${batch.vrid || "-"}`, margin + 130, y + 19);
      }
    } else {
      pdf.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, margin + 24, y + 19);
    }
    y += 28;

    // Summary
    pdf.setFillColor(220, 252, 231);
    pdf.roundedRect(margin, y, contentW / 2 - 2, 12, 2, 2, "F");
    pdf.setFillColor(254, 243, 199);
    pdf.roundedRect(margin + contentW / 2 + 2, y, contentW / 2 - 2, 12, 2, 2, "F");
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(22, 101, 52);
    pdf.text(`Conferidos: ${scanned}`, margin + 4, y + 8);
    pdf.setTextColor(146, 64, 14);
    pdf.text(`Pendentes: ${pending}`, margin + contentW / 2 + 6, y + 8);
    pdf.setTextColor(0, 0, 0);
    y += 18;

    // Table header
    const cols = [12, 38, 28, 35, 22, 22, 18, 15];
    const headers = ["#", "TBR", "Motorista", "Motivo", "Rota", "Data PS", "Status", "Foto"];
    pdf.setFillColor(13, 148, 136);
    pdf.rect(margin, y, contentW, 7, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    let cx = margin;
    headers.forEach((h, i) => { pdf.text(h, cx + 1, y + 5); cx += cols[i]; });
    y += 7;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal");

    for (let idx = 0; idx < items.length; idx++) {
      if (y > 270) { pdf.addPage(); y = margin; }
      const e = items[idx];
      const rowH = 6;
      if (idx % 2 === 0) { pdf.setFillColor(249, 250, 251); pdf.rect(margin, y, contentW, rowH, "F"); }
      pdf.setFontSize(7);
      cx = margin;
      const vals = [
        String(idx + 1), e.tbr_code, (e.driver_name ?? "-").slice(0, 18),
        (e.reason ?? e.description).slice(0, 22), (e.route ?? "-").slice(0, 10),
        formatDateBR(e.created_at), e._status, e.photo_url ? "Sim" : "-",
      ];
      vals.forEach((v, i) => {
        if (i === 6) {
          if (e._status === "OK") pdf.setTextColor(22, 101, 52);
          else pdf.setTextColor(146, 64, 14);
        } else { pdf.setTextColor(0, 0, 0); }
        pdf.text(v, cx + 1, y + 4);
        cx += cols[i];
      });
      pdf.setTextColor(0, 0, 0);
      y += rowH;
    }

    // Photos
    const withPhotos = items.filter(e => e.photo_url);
    if (withPhotos.length > 0) {
      pdf.addPage();
      y = margin;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Fotos dos PS", margin, y + 6);
      y += 12;

      for (const e of withPhotos) {
        if (y > 230) { pdf.addPage(); y = margin; }
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${e.tbr_code} — ${e.driver_name ?? "Sem motorista"} — ${e.reason ?? e.description}`, margin, y + 4);
        y += 6;
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve) => {
            img.onload = () => {
              const maxW = 80, maxH = 60;
              const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
              pdf.addImage(img, "JPEG", margin, y, img.naturalWidth * ratio, img.naturalHeight * ratio);
              y += img.naturalHeight * ratio + 4;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = e.photo_url!;
          });
        } catch { y += 4; }
      }
    }

    // Footer on every page
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(120, 120, 120);
      pdf.text("Sistema FVL — Relatório gerado automaticamente", margin, 287);
      pdf.text(`Página ${p} de ${totalPages}`, pageW - margin - 25, 287);
    }

    pdf.save(fileName);
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <PackageSearch className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold italic tracking-tight">Relatório Reversa</h1>
            <p className="text-xs text-muted-foreground">Conferência de PS para devolução</p>
          </div>
          <Badge variant="secondary" className="ml-2 font-bold">
            {entries.length} pendentes
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={generatePdf} disabled={generatingPdf || entries.length === 0}>
            <Printer className="h-4 w-4 mr-1" />
            {generatingPdf ? "Gerando..." : "Imprimir"}
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)} disabled={entries.length === 0} className="gap-1.5">
            <Send className="h-4 w-4" />
            Enviar Reversa
          </Button>
        </div>
      </div>

      {/* Search + History button */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar TBR, motorista ou rota..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)} className="gap-1.5 whitespace-nowrap">
          <History className="h-4 w-4" />
          Últimas Reversas
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <PackageSearch className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-semibold">Nenhum PS pendente de reversa</p>
              <p className="text-xs mt-1">Todos os PS finalizados já foram conferidos</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>TBR</TableHead>
                    <TableHead>Motorista</TableHead>
                    <TableHead>Rota</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data PS</TableHead>
                    <TableHead className="w-14 text-center">Foto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e, i) => (
                    <TableRow key={e.id} className="text-xs">
                      <TableCell className="text-center font-mono text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-bold font-mono">{e.tbr_code}</TableCell>
                      <TableCell className="truncate max-w-[120px]">{e.driver_name ?? "-"}</TableCell>
                      <TableCell>{e.route ?? "-"}</TableCell>
                      <TableCell className="truncate max-w-[140px]">{e.reason ?? e.description}</TableCell>
                      <TableCell>{formatDateBR(e.created_at)}</TableCell>
                      <TableCell className="text-center">
                        {e.photo_url ? (
                          <a href={e.photo_url} target="_blank" rel="noopener noreferrer">
                            <ImageIcon className="h-4 w-4 text-primary mx-auto" />
                          </a>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ========= SCAN MODAL ========= */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Send className="h-5 w-5 text-primary" />
              {modalStep === "scan" ? "Conferência de Reversa" : "Resumo da Conferência"}
            </DialogTitle>
            <DialogDescription>
              {modalStep === "scan"
                ? "Bipe ou digite os TBRs para conferir a devolução."
                : "Revise os itens conferidos e pendentes antes de finalizar."}
            </DialogDescription>
          </DialogHeader>

          {modalStep === "scan" && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{scannedCodes.size}</p>
                  <p className="text-[10px] font-semibold text-green-700 uppercase">Conferidos</p>
                </div>
                <div className="flex-1 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{entries.length - scannedCodes.size}</p>
                  <p className="text-[10px] font-semibold text-amber-700 uppercase">Pendentes</p>
                </div>
                <div className="flex-1 rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{entries.length}</p>
                  <p className="text-[10px] font-semibold text-primary uppercase">Total</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-muted/30 p-2 rounded-lg border">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">Lacre do Caminhão</label>
                  <Input 
                    value={lacre} 
                    onChange={e => setLacre(e.target.value)} 
                    placeholder="Ex: 123456" 
                    className="h-9" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase px-1">VRID</label>
                  <Input 
                    value={vrid} 
                    onChange={e => setVrid(e.target.value)} 
                    placeholder="Ex: VRID-999" 
                    className="h-9" 
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="default" 
                    onClick={handleConfirmAll} 
                    disabled={entries.length === 0 || scannedCodes.size === entries.length}
                    className="w-full h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar Todos
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={handleScanInputChange}
                    onKeyDown={handleScanKeyDown}
                    placeholder="Bipe ou digite o TBR..."
                    className="pl-9 h-11 font-mono"
                    autoFocus
                  />
                </div>
                <Button
                  variant={cameraOpen ? "destructive" : "outline"}
                  size="icon" className="h-11 w-11"
                  onClick={() => cameraOpen ? stopCamera() : startCamera()}
                >
                  {cameraOpen ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                </Button>
              </div>

              {cameraOpen && (
                <div className="relative rounded-lg overflow-hidden bg-black aspect-square max-w-xs mx-auto">
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                  <QrViewfinder />
                </div>
              )}

              <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-10 text-center">✓</TableHead>
                      <TableHead>TBR</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map(e => {
                      const checked = scannedCodes.has(e.tbr_code.toUpperCase());
                      return (
                        <TableRow key={e.id} className={cn("text-xs transition-colors", checked && "bg-green-50 dark:bg-green-900/20")}>
                          <TableCell className="text-center">
                            {checked
                              ? <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto animate-in zoom-in-50" />
                              : <Clock className="h-4 w-4 text-muted-foreground mx-auto" />}
                          </TableCell>
                          <TableCell className={cn("font-bold font-mono", checked && "text-green-700 dark:text-green-400")}>{e.tbr_code}</TableCell>
                          <TableCell className="truncate max-w-[100px]">{e.driver_name ?? "-"}</TableCell>
                          <TableCell className="truncate max-w-[120px]">{e.reason ?? e.description}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={() => setModalStep("summary")} disabled={scannedCodes.size === 0}>Finalizar Conferência</Button>
              </div>
            </div>
          )}

          {modalStep === "summary" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-bold text-green-700 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> PS OK (Conferidos)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-3xl font-bold text-green-600">{scannedEntries.length}</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm font-bold text-amber-700 flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> PS Pendentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-3xl font-bold text-amber-600">{pendingEntries.length}</p>
                  </CardContent>
                </Card>
              </div>

              {scannedEntries.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-green-700 mb-1.5 uppercase">Conferidos — serão removidos</p>
                  <div className="max-h-[150px] overflow-y-auto rounded-lg border border-green-200">
                    <Table><TableBody>
                      {scannedEntries.map(e => (
                        <TableRow key={e.id} className="text-xs bg-green-50/50">
                          <TableCell><CheckCircle2 className="h-4 w-4 text-green-500" /></TableCell>
                          <TableCell className="font-bold font-mono">{e.tbr_code}</TableCell>
                          <TableCell>{e.driver_name ?? "-"}</TableCell>
                          <TableCell>{e.reason ?? e.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table>
                  </div>
                </div>
              )}

              {pendingEntries.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-700 mb-1.5 uppercase">Pendentes — permanecerão na lista</p>
                  <div className="max-h-[150px] overflow-y-auto rounded-lg border border-amber-200">
                    <Table><TableBody>
                      {pendingEntries.map(e => (
                        <TableRow key={e.id} className="text-xs bg-amber-50/50">
                          <TableCell><Clock className="h-4 w-4 text-amber-500" /></TableCell>
                          <TableCell className="font-bold font-mono">{e.tbr_code}</TableCell>
                          <TableCell>{e.driver_name ?? "-"}</TableCell>
                          <TableCell>{e.reason ?? e.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table>
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setModalStep("scan")}>Voltar</Button>
                <Button variant="destructive" onClick={handleFinalize}>Finalizar Reversa</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ========= HISTORY MODAL ========= */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <History className="h-5 w-5 text-primary" />
              Últimas Reversas Enviadas
            </DialogTitle>
            <DialogDescription>Clique em uma reversa para baixar o relatório em PDF.</DialogDescription>
          </DialogHeader>

          {loadingBatches ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-semibold text-sm">Nenhuma reversa enviada ainda</p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {batches.map(b => (
                <button
                  key={b.id}
                  onClick={() => generateBatchPdf(b)}
                  disabled={downloadingBatchId === b.id}
                  className={cn(
                    "w-full text-left rounded-lg border p-4 transition-all hover:shadow-md hover:border-primary/40 hover:bg-primary/5 group",
                    downloadingBatchId === b.id && "opacity-60 pointer-events-none"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span className="text-sm font-bold">{formatDateTime(b.created_at)}</span>
                      </div>
                      {b.conferente_name && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span>{b.conferente_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-green-600 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {b.total_scanned} conferidos
                        </span>
                        <span className="flex items-center gap-1 text-amber-600 font-semibold">
                          <Clock className="h-3.5 w-3.5" /> {b.total_pending} pendentes
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      {downloadingBatchId === b.id ? (
                        <span className="text-primary font-semibold">Gerando...</span>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          <span className="font-semibold">PDF</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReversaPage;
