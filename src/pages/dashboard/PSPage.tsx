import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Search, CheckCircle, X, ChevronLeft, ChevronRight, CalendarIcon, FileText, Camera, RefreshCw, Plus, Pencil, Loader2, Keyboard, Trash2, Package } from "lucide-react";
import { translateStatus } from "@/lib/status-labels";
import { isBarcodeInsideViewfinder } from "@/lib/scanner-utils";
import QrViewfinder from "@/components/ui/QrViewfinder";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn, isValidTbrCode } from "@/lib/utils";
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
  photo_url_2: string | null;
  photo_url_3: string | null;
  status: string;
  created_at: string;
  conferente_id: string | null;
  conferente_name?: string;
  is_seller?: boolean;
  observations?: string | null;
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

  // Camera scanner for TBR reading
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState("");

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
  const [isSeller, setIsSeller] = useState(false);
  const [observations, setObservations] = useState("");
  const [editingEntry, setEditingEntry] = useState<PsEntry | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<PsEntry | null>(null);
  const [manualModePs, setManualModePs] = useState(false);
  const [psTbrSearch, setPsTbrSearch] = useState("");
  const [psTbrSearchOpen, setPsTbrSearchOpen] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [endDate, setEndDate] = useState<Date>(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [statusFilter, setStatusFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [reasonSearchOpen, setReasonSearchOpen] = useState(false);

  // Custom reasons
  const [customReasons, setCustomReasons] = useState<{ id: string; label: string }[]>([]);
  const [showNewReason, setShowNewReason] = useState(false);
  const [newReasonInput, setNewReasonInput] = useState("");

  // Photo capture — 3 slots
  const [activePhotoSlot, setActivePhotoSlot] = useState<number | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<(Blob | null)[]>([null, null, null]);
  const [photoPreviews, setPhotoPreviews] = useState<(string | null)[]>([null, null, null]);
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
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const data = await fetchAllRows<any>((from, to) => {
      let query = supabase
        .from("ps_entries")
        .select("id, tbr_code, driver_name, route, description, reason, photo_url, photo_url_2, photo_url_3, status, created_at, conferente_id, is_seller, observations")
        .eq("unit_id", unitSession.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      return query.range(from, to);
    });
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
        photo_url_2: e.photo_url_2 ?? null,
        photo_url_3: e.photo_url_3 ?? null,
        conferente_name: e.conferente_id ? confMap[e.conferente_id] : undefined,
        is_seller: (e as any).is_seller ?? false,
        observations: (e as any).observations ?? null,
      })));
    }
    setIsLoading(false);
  };

  const handleTbrInput = (value: string) => {
    setTbrInput(value);
    if (manualModePs) return; // In manual mode, only trigger on Enter
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const code = value.trim();
      if (code.toUpperCase().startsWith("TBR") && code.length >= 10) {
        if (!isValidTbrCode(code)) {
          toast({ title: "TBR inválido", description: "O código TBR deve conter apenas 'TBR' seguido de números.", variant: "destructive" });
          setTbrInput("");
          return;
        }
        searchTbr(code);
      }
    }, 300);
  };

  const searchTbr = async (code: string) => {
    setSearching(true);
    setTbrCode(code);

    // Check for duplicate open PS
    if (unitSession) {
      const { data: existingPs } = await supabase
        .from("ps_entries")
        .select("id")
        .eq("tbr_code", code.toUpperCase())
        .eq("unit_id", unitSession.id)
        .eq("status", "open")
        .limit(1);
      if (existingPs && existingPs.length > 0) {
        toast({ title: "TBR duplicado", description: "Este TBR já possui um PS aberto.", variant: "destructive" });
        setSearching(false);
        setTbrInput("");
        inputRef.current?.focus();
        return;
      }

      // Check for closed PS — TBR finalizado não pode entrar novamente
      const { data: closedPs } = await supabase
        .from("ps_entries")
        .select("id")
        .ilike("tbr_code", code)
        .eq("unit_id", unitSession.id)
        .eq("status", "closed")
        .limit(1);
      if (closedPs && closedPs.length > 0) {
        toast({ title: "TBR finalizado", description: "Este TBR já foi finalizado no PS e não pode ser registrado novamente.", variant: "destructive" });
        setSearching(false);
        setTbrInput("");
        inputRef.current?.focus();
        return;
      }
    }

    const { data: tbrData } = await supabase
      .from("ride_tbrs")
      .select("ride_id")
      .eq("code", code)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let rideId: string | null = tbrData?.ride_id ?? null;

    // Fallback: if ride_tbrs has no record (trigger deleted it), search piso/rto/ps entries
    if (!rideId) {
      const [pisoFallback, rtoFallback, psFallback] = await Promise.all([
        supabase.from("piso_entries").select("ride_id").ilike("tbr_code", code).not("ride_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("rto_entries").select("ride_id").ilike("tbr_code", code).not("ride_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("ps_entries").select("ride_id").ilike("tbr_code", code).not("ride_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      rideId = pisoFallback.data?.ride_id ?? rtoFallback.data?.ride_id ?? psFallback.data?.ride_id ?? null;
    }

    if (!rideId) {
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
      .eq("id", rideId)
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
    setCapturedPhotos([null, null, null]);
    setPhotoPreviews([null, null, null]);
    setActivePhotoSlot(null);
    setIsSeller(false);
    setObservations("");
    setEditingEntry(null);
  };

  const handleEditEntry = (entry: PsEntry) => {
    setEditingEntry(entry);
    setTbrCode(entry.tbr_code);
    setSelectedReason(entry.reason ?? entry.description ?? "");
    setSelectedConferente(entry.conferente_id ?? "");
    setIsSeller(entry.is_seller ?? false);
    setObservations(entry.observations ?? "");
    setPhotoPreviews([entry.photo_url ?? null, entry.photo_url_2 ?? null, entry.photo_url_3 ?? null]);
    setCapturedPhotos([null, null, null]);
    setActivePhotoSlot(null);
    setHistory(null);
    setIncludeMode(true);
    setHistoryModalOpen(true);
  };

  // Camera functions
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async (slotIndex: number) => {
    setActivePhotoSlot(slotIndex);
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      // Wait for video element to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch {
      toast({ title: "Erro ao acessar câmera", description: "Permita o acesso à câmera.", variant: "destructive" });
      setCameraActive(false);
      setActivePhotoSlot(null);
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
    if (!videoRef.current || !canvasRef.current || activePhotoSlot === null) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob && activePhotoSlot !== null) {
        setCapturedPhotos(prev => { const n = [...prev]; n[activePhotoSlot] = blob; return n; });
        setPhotoPreviews(prev => { const n = [...prev]; n[activePhotoSlot] = URL.createObjectURL(blob); return n; });
        stopCamera();
        setActivePhotoSlot(null);
      }
    }, "image/jpeg", 0.8);
  };

  const clearPhotoSlot = (slotIndex: number) => {
    setCapturedPhotos(prev => { const n = [...prev]; n[slotIndex] = null; return n; });
    setPhotoPreviews(prev => { const n = [...prev]; n[slotIndex] = null; return n; });
  };

  const uploadSinglePhoto = async (blob: Blob): Promise<string | null> => {
    const fileName = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from("ps-photos").upload(fileName, blob, { contentType: "image/jpeg" });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("ps-photos").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const uploadAllPhotos = async (): Promise<(string | null)[]> => {
    setUploadingPhoto(true);
    const results: (string | null)[] = [null, null, null];
    for (let i = 0; i < 3; i++) {
      if (capturedPhotos[i]) {
        results[i] = await uploadSinglePhoto(capturedPhotos[i]!);
      }
    }
    setUploadingPhoto(false);
    return results;
  };

  const handleAddReason = async () => {
    if (!unitSession || !newReasonInput.trim()) return;
    const text = newReasonInput.trim();
    const formatted = text.charAt(0).toUpperCase() + text.slice(1);
    const { data } = await supabase
      .from("ps_reasons")
      .insert({ unit_id: unitSession.id, label: formatted } as any)
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

    // Edit mode — update existing entry
    if (editingEntry) {
      let photoUrls: (string | null)[] = [
        editingEntry.photo_url ?? null,
        editingEntry.photo_url_2 ?? null,
        editingEntry.photo_url_3 ?? null,
      ];
      if (capturedPhotos.some(p => p !== null)) {
        const uploaded = await uploadAllPhotos();
        for (let i = 0; i < 3; i++) {
          if (uploaded[i]) photoUrls[i] = uploaded[i];
        }
      }

      const { error } = await supabase.from("ps_entries").update({
        reason: selectedReason,
        description: selectedReason,
        conferente_id: selectedConferente || null,
        is_seller: isSeller,
        observations: observations || null,
        photo_url: photoUrls[0],
        photo_url_2: photoUrls[1],
        photo_url_3: photoUrls[2],
      } as any).eq("id", editingEntry.id);
      setSaving(false);

      if (error) {
        toast({ title: "Erro ao atualizar PS", variant: "destructive" });
        return;
      }
      toast({ title: "PS atualizado com sucesso" });
      closeModal();
      loadEntries();
      inputRef.current?.focus();
      return;
    }

    // Double-check for duplicate open PS before saving
    const { data: existingPs } = await supabase
      .from("ps_entries")
      .select("id")
      .eq("tbr_code", tbrCode.toUpperCase())
      .eq("unit_id", unitSession.id)
      .eq("status", "open")
      .limit(1);
    if (existingPs && existingPs.length > 0) {
      toast({ title: "TBR duplicado", description: "Este TBR já possui um PS aberto.", variant: "destructive" });
      setSaving(false);
      return;
    }

    let photoUrls: (string | null)[] = [null, null, null];
    if (capturedPhotos.some(p => p !== null)) {
      photoUrls = await uploadAllPhotos();
    }

    const entry = {
      tbr_code: tbrCode,
      ride_id: history?.ride_id ?? null,
      unit_id: unitSession.id,
      conferente_id: selectedConferente || null,
      description: selectedReason,
      reason: selectedReason,
      photo_url: photoUrls[0],
      photo_url_2: photoUrls[1],
      photo_url_3: photoUrls[2],
      driver_name: history?.driver_name ?? null,
      route: history?.route ?? null,
      is_seller: isSeller,
      observations: observations || null,
    };

    const { error } = await supabase.from("ps_entries").insert(entry as any);
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao gravar PS", variant: "destructive" });
      return;
    }

    // Fechar piso_entry aberta com mesmo tbr_code (THE FIX)
    await supabase.from("piso_entries")
      .update({ status: "closed", closed_at: new Date().toISOString() } as any)
      .ilike("tbr_code", tbrCode.trim())
      .eq("unit_id", unitSession.id)
      .eq("status", "open");

    // Remover TBR da ride_tbrs se está em carregamento ativo
    if (history?.ride_id) {
      await supabase.from("ride_tbrs").delete()
        .eq("ride_id", history.ride_id)
        .ilike("code", tbrCode);
    }

    toast({ title: "PS registrado com sucesso" });
    closeModal();
    loadEntries();
    inputRef.current?.focus();
  };

  const handleFinalize = async (id: string) => {
    await supabase.from("ps_entries").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", id);
    
    // Fechar piso_entry aberta com mesmo tbr_code
    const entry = entries.find(e => e.id === id);
    if (entry && unitSession) {
      await supabase.from("piso_entries")
        .update({ status: "closed", closed_at: new Date().toISOString() } as any)
        .ilike("tbr_code", entry.tbr_code)
        .eq("unit_id", unitSession.id)
        .eq("status", "open");
    }
    
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: "closed" } : e));
    toast({ title: "PS finalizado" });
  };

  const handleDeletePs = async (entry: PsEntry) => {
    if (!unitSession) return;
    // Check if there's a closed piso_entry with same tbr_code
    const { data: pisoMatch } = await supabase
      .from("piso_entries")
      .select("id")
      .ilike("tbr_code", entry.tbr_code)
      .eq("unit_id", unitSession.id)
      .eq("status", "closed")
      .limit(1);

    // If piso exists, reopen it
    if (pisoMatch?.length) {
      await supabase.from("piso_entries")
        .update({ status: "open", closed_at: null })
        .eq("id", pisoMatch[0].id);
    }

    // Delete the PS entry
    await supabase.from("ps_entries").delete().eq("id", entry.id);
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    setDeletingEntry(null);
    toast({ title: pisoMatch?.length ? "PS excluído e insucesso reaberto" : "PS excluído com sucesso" });
  };

  const closeModal = () => {
    setHistoryModalOpen(false);
    setIncludeMode(false);
    setHistory(null);
    setCapturedPhotos([null, null, null]);
    setPhotoPreviews([null, null, null]);
    setActivePhotoSlot(null);
    setIsSeller(false);
    setObservations("");
    setEditingEntry(null);
    stopCamera();
    stopCameraScanner();
    inputRef.current?.focus();
  };

  // Camera scanner for TBR barcode reading
  const playSuccessBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1000;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  const stopCameraScanner = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (scannerStreamRef.current) { scannerStreamRef.current.getTracks().forEach(t => t.stop()); scannerStreamRef.current = null; }
    setScannerOpen(false);
    setLastScannedCode("");
  }, []);

  const startCameraScanner = useCallback(async () => {
    setScannerOpen(true);
    setLastScannedCode("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } });
      scannerStreamRef.current = stream;
      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        scannerVideoRef.current.play();
      }

      if (!("BarcodeDetector" in window)) {
        toast({ title: "Scanner não suportado", description: "Seu navegador não suporta leitura de código de barras pela câmera.", variant: "destructive" });
        return;
      }

      const detector = new (window as any).BarcodeDetector({ formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "codabar", "itf", "upc_a", "upc_e"] });
      const recentCodes = new Set<string>();

      scanIntervalRef.current = setInterval(async () => {
        if (!scannerVideoRef.current || scannerVideoRef.current.readyState < 2) return;
        try {
          const allBarcodes = await detector.detect(scannerVideoRef.current);
          if (allBarcodes.length === 0) return;

          // Only consider barcodes fully inside the viewfinder area (~25% inset for centered 40x40 in 48h)
          const barcodes = allBarcodes.filter((b: any) => isBarcodeInsideViewfinder(b, scannerVideoRef.current!, 0.2));
          if (barcodes.length === 0) return;

          // Filter only TBR codes
          const tbrBarcodes = barcodes.filter((b: any) => b.rawValue.toUpperCase().startsWith("TBR"));

          // Multiple TBR codes visible — ask user to focus
          if (tbrBarcodes.length > 1) {
            setLastScannedCode("⚠ Múltiplos códigos. Foque em apenas 1.");
            return;
          }

          if (tbrBarcodes.length === 0) return;

          const code = tbrBarcodes[0].rawValue;
          if (recentCodes.has(code)) return;
          recentCodes.add(code);
          setTimeout(() => recentCodes.delete(code), 5000);

          if (!isValidTbrCode(code)) return;
          setLastScannedCode(code);
          playSuccessBeep();
          stopCameraScanner();
          searchTbr(code);
        } catch {}
      }, 100);
    } catch {
      toast({ title: "Erro ao acessar câmera", description: "Permita o acesso à câmera nas configurações do navegador.", variant: "destructive" });
      stopCameraScanner();
    }
  }, [stopCameraScanner]);

  // Cleanup scanner on unmount
  useEffect(() => { return () => { stopCameraScanner(); }; }, [stopCameraScanner]);

  // PDF generation
  const loadImageAsBase64 = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const generatePDF = async () => {
    setGeneratingPdf(true);
    try {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    const openCount = entries.filter(e => e.status === "open").length;
    const closedCount = entries.filter(e => e.status === "closed").length;
    const uniqueDrivers = new Set(entries.map(e => e.driver_name).filter(Boolean)).size;
    const uniqueRoutes = new Set(entries.map(e => e.route).filter(Boolean)).size;
    const reasonCount: Record<string, number> = {};
    entries.forEach(e => { const r = e.reason ?? e.description ?? "-"; reasonCount[r] = (reasonCount[r] || 0) + 1; });
    const topReason = Object.entries(reasonCount).sort((a, b) => b[1] - a[1])[0];

    // ── Header banner ──
    doc.setFillColor(30, 58, 138); // dark blue
    doc.rect(0, 0, pageW, 42, "F");
    doc.setFillColor(37, 99, 235); // lighter blue accent
    doc.rect(0, 42, pageW, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO PS - PROBLEM SOLVE", margin, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Unidade: ${unitSession?.name ?? "—"}`, margin, 27);
    doc.text(`Domínio: ${unitSession?.domain_name ?? "—"}`, margin, 32);
    doc.text(`Gerado por: ${unitSession?.user_name ?? "—"}`, margin, 37);

    doc.text(`Período: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`, pageW - margin, 27, { align: "right" });
    doc.text(`Data/Hora: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageW - margin, 32, { align: "right" });
    doc.text(`Total: ${entries.length} registros`, pageW - margin, 37, { align: "right" });

    // ── Stats cards ──
    let y = 52;
    doc.setTextColor(0, 0, 0);

    const cardW = (pageW - margin * 2 - 12) / 4;
    const cards = [
      { label: "Abertos", value: String(openCount), color: [254, 243, 199] as [number, number, number], textColor: [180, 83, 9] as [number, number, number] },
      { label: "Finalizados", value: String(closedCount), color: [209, 250, 229] as [number, number, number], textColor: [5, 122, 85] as [number, number, number] },
      { label: "Motoristas", value: String(uniqueDrivers), color: [219, 234, 254] as [number, number, number], textColor: [30, 64, 175] as [number, number, number] },
      { label: "Rotas", value: String(uniqueRoutes), color: [243, 232, 255] as [number, number, number], textColor: [107, 33, 168] as [number, number, number] },
    ];

    cards.forEach((card, i) => {
      const x = margin + i * (cardW + 4);
      doc.setFillColor(card.color[0], card.color[1], card.color[2]);
      doc.roundedRect(x, y, cardW, 18, 2, 2, "F");
      doc.setTextColor(card.textColor[0], card.textColor[1], card.textColor[2]);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(card.value, x + cardW / 2, y + 10, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(card.label, x + cardW / 2, y + 15, { align: "center" });
    });

    y += 24;

    // Top reason line
    if (topReason) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.text(`Motivo mais recorrente: "${topReason[0]}" (${topReason[1]}x)`, margin, y);
      y += 6;
    }

    // ── Separator ──
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // ── Entries ──
    let entryIndex = 0;
    for (const e of entries) {
      entryIndex++;
      const needsSpace = e.photo_url ? 90 : 30;
      if (y + needsSpace > pageH - 20) {
        // Footer before new page
        addFooter(doc, pageW, pageH);
        doc.addPage();
        y = 15;
      }

      // Entry number badge
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(margin, y - 3, 8, 6, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text(String(entryIndex), margin + 4, y + 1, { align: "center" });

      // TBR code
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(10);
      doc.text(e.tbr_code, margin + 11, y + 1);

      // Seller badge in PDF
      if (e.is_seller) {
        const sellerX = margin + 11 + doc.getTextWidth(e.tbr_code) + 3;
        doc.setFillColor(234, 88, 12); // orange
        const sellerW = doc.getTextWidth("SELLER") + 6;
        doc.roundedRect(sellerX, y - 3, sellerW, 6, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text("SELLER", sellerX + 3, y + 1);
      }

      // Status badge
      const statusText = e.status === "open" ? "ABERTO" : "FINALIZADO";
      const statusColor = e.status === "open" ? [234, 179, 8] : [34, 197, 94];
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      const statusW = doc.getTextWidth(statusText) + 6;
      doc.roundedRect(pageW - margin - statusW, y - 3, statusW, 6, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text(statusText, pageW - margin - statusW + 3, y + 1);

      y += 6;
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Motorista: ${e.driver_name ?? "—"}`, margin + 4, y);
      doc.text(`Rota: ${e.route ?? "—"}`, margin + 90, y);
      y += 4;
      doc.text(`Motivo: ${(e.reason ?? e.description ?? "—").slice(0, 60)}${e.is_seller ? " [Seller]" : ""}`, margin + 4, y);
      y += 4;
      if (e.observations) {
        doc.text(`Obs: ${e.observations.slice(0, 80)}`, margin + 4, y);
        y += 4;
      }
      doc.setTextColor(130, 130, 130);
      doc.setFontSize(7);
      doc.text(`Registrado em: ${format(new Date(e.created_at), "dd/MM/yyyy 'às' HH:mm")}`, margin + 4, y);
      if (e.conferente_name) {
        doc.text(`Conferente: ${e.conferente_name}`, margin + 90, y);
      }
      y += 3;

      if (e.photo_url) {
        const imgData = await loadImageAsBase64(e.photo_url);
        if (imgData) {
          if (y + 65 > pageH - 20) {
            addFooter(doc, pageW, pageH);
            doc.addPage();
            y = 15;
          }
          doc.setDrawColor(200, 200, 200);
          doc.roundedRect(margin + 4, y, 82, 62, 1, 1, "S");
          doc.addImage(imgData, "JPEG", margin + 5, y + 1, 80, 60);
          y += 64;
        }
      }

      // Separator
      y += 3;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
    }

    addFooter(doc, pageW, pageH);
    doc.save(`PS_Relatorio_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    toast({ title: "PDF gerado com sucesso" });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const addFooter = (doc: jsPDF, pageW: number, pageH: number) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(0, pageH - 12, pageW, 12, "F");
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`FVL Logística — ${unitSession?.name ?? ""}`, 14, pageH - 5);
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
    doc.text(`Página ${pageNum}`, pageW - 14, pageH - 5, { align: "right" });
  };

  // Pagination removed — all entries rendered directly

  // Card metrics
  const totalPs = entries.length;
  const openPs = entries.filter(e => e.status === "open").length;
  const closedPs = entries.filter(e => e.status === "closed").length;
  const psReasonCounts: Record<string, number> = {};
  entries.forEach(e => {
    const r = e.reason ?? e.description;
    if (r) psReasonCounts[r] = (psReasonCounts[r] || 0) + 1;
  });
  const topPsReason = Object.entries(psReasonCounts).sort((a, b) => b[1] - a[1])[0];
  const sellerCount = entries.filter(e => e.is_seller).length;
  const sellerPct = totalPs > 0 ? ((sellerCount / totalPs) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      {/* Indicator Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <AlertTriangle className="h-4 w-4 mx-auto text-primary" />
            <p className="text-2xl font-bold">{totalPs}</p>
            <p className="text-[10px] text-muted-foreground">Total PS</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <CheckCircle className="h-4 w-4 mx-auto text-green-600" />
            <p className="text-lg font-bold">
              <span className="text-amber-500">{openPs}</span> / <span className="text-green-600">{closedPs}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Abertos / Finalizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <FileText className="h-4 w-4 mx-auto text-amber-500" />
            <p className="text-sm font-bold truncate">{topPsReason ? topPsReason[0] : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Top Motivo ({topPsReason?.[1] ?? 0})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <Search className="h-4 w-4 mx-auto text-primary" />
            <p className="text-2xl font-bold">{sellerPct}%</p>
            <p className="text-[10px] text-muted-foreground">% Seller</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <AlertTriangle className="h-5 w-5 text-primary" />
            PS - Problem Solve
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scanner input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={tbrInput}
                onChange={(e) => handleTbrInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && manualModePs) {
                    const code = tbrInput.trim();
                    if (code.length >= 3) {
                      if (!isValidTbrCode(code)) {
                        toast({ title: 'TBR inválido', description: 'O código TBR deve conter apenas TBR seguido de números.', variant: 'destructive' });
                        setTbrInput('');
                      } else {
                        searchTbr(code);
                      }
                    }
                  }
                }}
                placeholder={manualModePs ? "Digite o TBR e pressione Enter..." : "Leia ou digite o código TBR..."}
                className="pl-9 h-11"
                disabled={searching}
                autoFocus
              />
            </div>
            <Button
              variant={manualModePs ? "default" : "outline"}
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => { setManualModePs(prev => !prev); inputRef.current?.focus(); }}
              title={manualModePs ? "Modo manual ativo (Enter para buscar)" : "Ativar modo de digitação livre"}
            >
              <Keyboard className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-700"
              onClick={() => {
                const tempCode = `SEM_EMBALAGEM_${Date.now()}`;
                setTbrCode(tempCode);
                setHistory(null);
                setHistoryModalOpen(true);
                setIncludeMode(true);
              }}
              title="PS sem embalagem / sem TBR identificável"
            >
              <Package className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => scannerOpen ? stopCameraScanner() : startCameraScanner()}
              title="Scanner de câmera"
            >
              <Camera className="h-5 w-5" />
            </Button>
          </div>

          {/* Camera scanner overlay */}
          {scannerOpen && (
            <div className="relative rounded-lg overflow-hidden border bg-black aspect-square max-w-xs mx-auto">
              <video ref={scannerVideoRef} className="w-full h-full object-cover" playsInline muted />
              <QrViewfinder />
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-20">
                {lastScannedCode && (
                  <span className="text-xs bg-background/80 text-foreground px-2 py-1 rounded">{lastScannedCode}</span>
                )}
                <Button size="sm" variant="destructive" onClick={stopCameraScanner} className="ml-auto">
                  <X className="h-3 w-3 mr-1" /> Fechar
                </Button>
              </div>
            </div>
          )}

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

            <Button variant="outline" size="sm" onClick={generatePDF} className="gap-1" disabled={generatingPdf}>
              {generatingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} PDF
            </Button>

            {/* Lupa para busca por TBR na lista */}
            <Button
              variant={psTbrSearchOpen ? "default" : "outline"}
              size="sm"
              className="gap-1"
              onClick={() => { setPsTbrSearchOpen(p => !p); setPsTbrSearch(""); }}
              title="Buscar TBR na lista"
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
            {psTbrSearchOpen && (
              <Input
                className="h-9 text-sm font-mono w-40"
                placeholder="Buscar TBR..."
                value={psTbrSearch}
                onChange={e => setPsTbrSearch(e.target.value)}
                autoFocus
              />
            )}
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
                      <TableHead className="font-bold">Observação</TableHead>
                      <TableHead className="font-bold">Data</TableHead>
                      <TableHead className="font-bold text-center">Status</TableHead>
                      <TableHead className="font-bold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(psTbrSearchOpen && psTbrSearch.trim() ? entries.filter(e => e.tbr_code.toUpperCase().includes(psTbrSearch.trim().toUpperCase())) : entries).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.tbr_code}</TableCell>
                        <TableCell>{e.driver_name ?? "-"}</TableCell>
                        <TableCell>{e.route ?? "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          <span>{e.reason ?? e.description}</span>
                          {e.is_seller && (
                            <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 border-orange-400 text-orange-600 font-bold">Seller</Badge>
                          )}
                        </TableCell>
                        <TableCell>{e.conferente_name ?? "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs" title={e.observations ?? ""}>
                          {e.observations ? (e.observations.length > 30 ? e.observations.slice(0, 30) + "…" : e.observations) : "-"}
                        </TableCell>
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
                            {e.status === "open" && (
                              <Button variant="ghost" size="sm" onClick={() => handleEditEntry(e)} title="Editar PS">
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                            {(e.photo_url || e.photo_url_2 || e.photo_url_3) && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="sm" title="Ver fotos">
                                    <Camera className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" align="end">
                                  <div className="flex gap-2">
                                    {[e.photo_url, e.photo_url_2, e.photo_url_3].filter(Boolean).map((url, i) => (
                                      <img
                                        key={i}
                                        src={url!}
                                        alt={`Foto ${i + 1}`}
                                        className="h-24 w-24 object-cover rounded-md border cursor-pointer hover:opacity-80"
                                        onClick={() => window.open(url!, "_blank")}
                                      />
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {e.status === "open" && (
                              <Button variant="outline" size="sm" onClick={() => handleFinalize(e.id)}>
                                <CheckCircle className="h-3 w-3 mr-1" /> Finalizar
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => setDeletingEntry(e)} title="Excluir PS">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination removed */}
            </>
          )}
        </CardContent>
      </Card>

      {/* PS Modal */}
      <Dialog open={historyModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <AlertTriangle className="h-5 w-5 text-primary" /> PS — {tbrCode}
            </DialogTitle>
            <DialogDescription>{editingEntry ? "Editar Problem Solve existente." : "Registrar Problem Solve para este TBR."}</DialogDescription>
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

                {/* Seller checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="is-seller"
                    checked={isSeller}
                    onCheckedChange={(checked) => setIsSeller(checked === true)}
                  />
                  <label htmlFor="is-seller" className="text-xs font-medium cursor-pointer">
                    Este TBR é Seller
                  </label>
                </div>
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

              {/* Photo capture — 3 slots */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Fotos (até 3)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((slotIndex) => (
                    <div key={slotIndex} className="space-y-1">
                      {photoPreviews[slotIndex] ? (
                        <div className="relative">
                          <img src={photoPreviews[slotIndex]!} alt={`Foto ${slotIndex + 1}`} className="w-full rounded-md border aspect-square object-cover" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-5 w-5"
                            onClick={() => clearPhotoSlot(slotIndex)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full aspect-square flex flex-col gap-1"
                          onClick={() => startCamera(slotIndex)}
                          disabled={cameraActive}
                        >
                          <Camera className="h-4 w-4" />
                          <span className="text-[10px]">Foto {slotIndex + 1}</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {cameraActive && (
                  <div className="space-y-2">
                    <video ref={videoRef} className="w-full rounded-md border" autoPlay playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={capturePhoto}>Capturar</Button>
                      <Button variant="outline" size="sm" onClick={() => { stopCamera(); setActivePhotoSlot(null); }}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Observations */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Observação</label>
                <Textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Observação (opcional)..."
                  className="min-h-[60px] text-sm"
                />
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving || !selectedReason || uploadingPhoto}>
                {saving || uploadingPhoto ? "Gravando..." : editingEntry ? "Atualizar PS" : "Gravar PS"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingEntry} onOpenChange={(open) => !open && setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir PS</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o PS do TBR <span className="font-mono font-bold">{deletingEntry?.tbr_code}</span>?
              {" "}Se este PS veio de um insucesso, o insucesso será reaberto automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingEntry && handleDeletePs(deletingEntry)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PSPage;
