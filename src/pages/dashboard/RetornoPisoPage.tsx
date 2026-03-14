import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { PackageX, Search, Loader2, X, Plus, AlertTriangle, Trash2, Camera, RefreshCw, Check, ChevronsUpDown, Pencil, CalendarIcon, Users, TrendingUp, ClipboardCheck, FileText, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import jsPDF from "jspdf";
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
import { ptBR } from "date-fns/locale";
import { translateStatus, OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import { cn, isValidTbrCode } from "@/lib/utils";
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
  conferente_id?: string | null;
}

interface ConferenteOption {
  id: string;
  name: string;
}

const RetornoPisoPage = () => {
  const { unitSession, managerSession, conferenteSession } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filter state
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const [filterConferente, setFilterConferente] = useState("");
  const [filterMotorista, setFilterMotorista] = useState("");
  const [conferenteOptions, setConferenteOptions] = useState<ConferenteOption[]>([]);

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
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);
  const [editingReasonLabel, setEditingReasonLabel] = useState("");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  // Conferência de Retorno state
  const [confSheetOpen, setConfSheetOpen] = useState(false);
  const [checkedTbrs, setCheckedTbrs] = useState<Set<string>>(new Set());
  const [confScanInput, setConfScanInput] = useState("");
  const confInputRef = useRef<HTMLInputElement>(null);

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
      loadConferenteOptions();
      setBulkSelected(new Set());
    }
  }, [unitSession]);

  const loadConferenteOptions = async () => {
    if (!unitSession) return;
    const { data } = await supabase.from("user_profiles").select("id, name").eq("unit_id", unitSession.id).eq("active", true).order("name");
    if (data) setConferenteOptions(data);
  };

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

  const [conferenteNames, setConferenteNames] = useState<Record<string, string>>({});

  const loadEntries = async () => {
    if (!unitSession) return;
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    const allEntries = await fetchAllRows<PisoEntry & { conferente_id?: string | null }>((from, to) =>
      supabase.from("piso_entries").select("id, tbr_code, driver_name, route, reason, created_at, ride_id, conferente_id").eq("unit_id", unitSession.id).eq("status", "open").order("created_at", { ascending: false }).range(from, to)
    );

    // Fetch conferente names
    const confIds = [...new Set(allEntries.map(e => e.conferente_id).filter(Boolean))] as string[];
    if (confIds.length > 0) {
      const { data: profiles } = await supabase.from("user_profiles").select("id, name").in("id", confIds);
      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach(p => { nameMap[p.id] = p.name; });
      setConferenteNames(nameMap);
    } else {
      setConferenteNames({});
    }

    // Auto-close operational entries whose TBR is already loaded in a ride
    const operationalEntries = allEntries.filter(e => OPERATIONAL_PISO_REASONS.includes(e.reason));
    if (operationalEntries.length > 0) {
      const codes = operationalEntries.map(e => e.tbr_code.toLowerCase());
      const { data: matchingTbrs } = await supabase
        .from("ride_tbrs")
        .select("code")
        .in("code", codes);
      if (matchingTbrs && matchingTbrs.length > 0) {
        const loadedSet = new Set(matchingTbrs.map(t => t.code.toLowerCase()));
        const toClose = operationalEntries.filter(e => loadedSet.has(e.tbr_code.toLowerCase()));
        if (toClose.length > 0) {
          const closeIds = toClose.map(e => e.id);
          await supabase
            .from("piso_entries")
            .update({ status: "closed", closed_at: new Date().toISOString() } as any)
            .in("id", closeIds);
          // Remove auto-closed from displayed list
          const closeIdSet = new Set(closeIds);
          setEntries(allEntries.filter(e => !closeIdSet.has(e.id)));
          setLoading(false);
          return;
        }
      }
    }

    // Auto-close piso_entries that already have a PS registered
    const remainingEntries = allEntries;
    if (remainingEntries.length > 0) {
      // Fetch ALL ps_entries for this unit to do case-insensitive comparison client-side
      const { data: psMatches } = await supabase
        .from("ps_entries")
        .select("tbr_code")
        .eq("unit_id", unitSession.id);
      if (psMatches && psMatches.length > 0) {
        const psSet = new Set(psMatches.map(p => p.tbr_code.toLowerCase()));
        const toClosePs = remainingEntries.filter(e => psSet.has(e.tbr_code.toLowerCase()));
        if (toClosePs.length > 0) {
          const closePsIds = toClosePs.map(e => e.id);
          await supabase
            .from("piso_entries")
            .update({ status: "closed", closed_at: new Date().toISOString() } as any)
            .in("id", closePsIds);
          const closePsIdSet = new Set(closePsIds);
          setEntries(remainingEntries.filter(e => !closePsIdSet.has(e.id)));
          setLoading(false);
          return;
        }
      }
    }

    setEntries(allEntries);
    setLoading(false);
  };

  const handleTbrKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !tbrInput.trim()) return;
    const code = tbrInput.trim();
    if (code.length > MAX_TBR_LENGTH) return;

    if (!isValidTbrCode(code)) {
      toast({ title: "TBR inválido", description: "O código TBR deve conter apenas 'TBR' seguido de números.", variant: "destructive" });
      setTbrInput("");
      return;
    }

    setSearching(true);
    setTbrCode(code);

    // Check for duplicates across all occurrence tables
    const [pisoCheck, psCheck, rtoCheck, dnrCheck] = await Promise.all([
      supabase.from("piso_entries").select("id").ilike("tbr_code", code).eq("unit_id", unitSession!.id).eq("status", "open").limit(1),
      supabase.from("ps_entries").select("id").ilike("tbr_code", code).eq("unit_id", unitSession!.id).eq("status", "open").limit(1),
      supabase.from("rto_entries").select("id").ilike("tbr_code", code).eq("unit_id", unitSession!.id).eq("status", "open").limit(1),
      supabase.from("dnr_entries").select("id").ilike("tbr_code", code).eq("unit_id", unitSession!.id).in("status", ["open", "analyzing"]).limit(1),
    ]);

    if (pisoCheck.data && pisoCheck.data.length > 0) {
      toast({ title: "TBR já registrado", description: "Este TBR já está no Retorno Piso.", variant: "destructive" });
      setTbrInput(""); setSearching(false); return;
    }
    if (psCheck.data && psCheck.data.length > 0) {
      toast({ title: "TBR já registrado", description: "Este TBR já está registrado no PS.", variant: "destructive" });
      setTbrInput(""); setSearching(false); return;
    }
    if (rtoCheck.data && rtoCheck.data.length > 0) {
      toast({ title: "TBR já registrado", description: "Este TBR já está registrado no RTO.", variant: "destructive" });
      setTbrInput(""); setSearching(false); return;
    }
    if (dnrCheck.data && dnrCheck.data.length > 0) {
      toast({ title: "TBR já registrado", description: "Este TBR já está registrado no DNR.", variant: "destructive" });
      setTbrInput(""); setSearching(false); return;
    }

    // Check for closed PS — TBR finalizado não pode entrar em piso
    const { data: closedPsCheck } = await supabase
      .from("ps_entries")
      .select("id")
      .ilike("tbr_code", code)
      .eq("unit_id", unitSession!.id)
      .eq("status", "closed")
      .limit(1);
    if (closedPsCheck && closedPsCheck.length > 0) {
      toast({ title: "TBR finalizado no PS", description: "Este TBR já foi finalizado no Problem Solve e não pode ser registrado novamente.", variant: "destructive" });
      setTbrInput(""); setSearching(false); return;
    }

    const { data: tbrRows } = await supabase
      .from("ride_tbrs")
      .select("ride_id, trip_number")
      .ilike("code", code)
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

  const capitalizeFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

  const handleEditReason = async (id: string, newLabel: string) => {
    const formatted = capitalizeFirst(newLabel.trim());
    if (!formatted) return;
    const { error } = await supabase.from("piso_reasons").update({ label: formatted } as any).eq("id", id);
    if (!error) {
      setCustomReasons(prev => prev.map(r => r.id === id ? { ...r, label: formatted } : r));
      if (selectedReason === editingReasonLabel) setSelectedReason(formatted);
      toast({ title: "Motivo atualizado" });
    }
    setEditingReasonId(null);
    setEditingReasonLabel("");
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
      conferente_id: conferenteSession?.id ?? null,
    } as any);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao gravar", variant: "destructive" });
      return;
    }

    // Remover TBR da ride_tbrs se está em carregamento ativo
    if (trackInfo?.ride_id) {
      await supabase.from("ride_tbrs").delete()
        .eq("ride_id", trackInfo.ride_id)
        .ilike("code", tbrCode);
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

      // Remover TBR da ride_tbrs se está em carregamento ativo
      if (psEntry.ride_id) {
        await supabase.from("ride_tbrs").delete()
          .eq("ride_id", psEntry.ride_id)
          .ilike("code", psEntry.tbr_code);
      }

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

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filterStartDate) {
      result = result.filter(e => new Date(e.created_at) >= filterStartDate);
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(e => new Date(e.created_at) <= end);
    }
    if (filterConferente) {
      result = result.filter(e => e.conferente_id === filterConferente);
    }
    if (filterMotorista) {
      result = result.filter(e => e.driver_name === filterMotorista);
    }
    return result;
  }, [entries, filterStartDate, filterEndDate, filterConferente, filterMotorista]);

  // Card metrics from filtered
  const totalOpen = filteredEntries.length;
  const reasonCounts: Record<string, number> = {};
  const driverCounts: Record<string, number> = {};
  const confCounts: Record<string, number> = {};
  filteredEntries.forEach(e => {
    reasonCounts[e.reason] = (reasonCounts[e.reason] || 0) + 1;
    if (e.driver_name) driverCounts[e.driver_name] = (driverCounts[e.driver_name] || 0) + 1;
    if (e.conferente_id) {
      const name = conferenteNames[e.conferente_id] ?? e.conferente_id;
      confCounts[name] = (confCounts[name] || 0) + 1;
    }
  });
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  const topDriver = Object.entries(driverCounts).sort((a, b) => b[1] - a[1])[0];
  const topConferente = Object.entries(confCounts).sort((a, b) => b[1] - a[1])[0];

  const uniqueDriverNames = [...new Set(entries.map(e => e.driver_name).filter(Boolean) as string[])].sort();

  // Conferência handlers
  const handleConfScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !confScanInput.trim()) return;
    const code = confScanInput.trim().toUpperCase();
    const match = entries.find(en => en.tbr_code.toUpperCase() === code);
    if (match) {
      setCheckedTbrs(prev => new Set(prev).add(match.id));
      toast({ title: "TBR conferido", description: match.tbr_code });
    } else {
      toast({ title: "TBR não encontrado", description: "Este TBR não está na lista de retornos.", variant: "destructive" });
    }
    setConfScanInput("");
  };

  const handleBulkDelete = async () => {
    if (!managerSession || bulkSelected.size === 0) return;
    
    // Obter os itens selecionados
    const itemsToDelete = entries.filter(e => bulkSelected.has(e.id));
    if (itemsToDelete.length === 0) return;

    const idsToDelete = itemsToDelete.map(e => e.id);
    const codesToDelete = itemsToDelete.map(e => e.tbr_code);

    try {
      // 1. Deletar de piso_entries
      await supabase.from("piso_entries").delete().in("id", idsToDelete);
      // 2. Deletar de ride_tbrs
      await supabase.from("ride_tbrs").delete().in("code", codesToDelete);
      // 3. Deletar de ps_entries
      await supabase.from("ps_entries").delete().in("tbr_code", codesToDelete).eq("unit_id", unitSession!.id);
      // 4. Deletar de rto_entries
      await supabase.from("rto_entries").delete().in("tbr_code", codesToDelete).eq("unit_id", unitSession!.id);
      // 5. Deletar de dnr_entries
      await supabase.from("dnr_entries").delete().in("tbr_code", codesToDelete).eq("unit_id", unitSession!.id);

      setEntries((prev) => prev.filter((p) => !bulkSelected.has(p.id)));
      setBulkSelected(new Set());
      toast({ title: `${itemsToDelete.length} TBR(s) excluído(s) definitivamente.` });
    } catch (error) {
      toast({ title: "Erro ao excluir itens em lote.", variant: "destructive" });
    }
  };

  const toggleCheck = (id: string) => {
    setCheckedTbrs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfPdf = () => {
    const pdf = new jsPDF("l", "mm", "a4");
    const pw = 297;
    const margin = 10;
    const unitName = unitSession?.name ?? "Unidade";
    const dateStr = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

    // Header
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Conferência de Retorno", margin, 16);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${unitName} — ${dateStr}`, margin, 22);
    pdf.text(`Conferidos: ${checkedTbrs.size} / ${entries.length}`, margin, 27);

    // Table
    const headers = ["Status", "TBR", "Motorista", "Rota", "Motivo", "Data/Hora"];
    const colWidths = [18, 38, 55, 30, 80, 40];
    let y = 34;

    // Header row
    pdf.setFillColor(13, 148, 136);
    pdf.rect(margin, y, pw - margin * 2, 7, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    let x = margin + 2;
    headers.forEach((h, i) => {
      pdf.text(h, x, y + 5);
      x += colWidths[i];
    });
    y += 7;

    // Rows
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(0, 0, 0);
    const sortedEntries = [...entries].sort((a, b) => {
      const aChecked = checkedTbrs.has(a.id) ? 0 : 1;
      const bChecked = checkedTbrs.has(b.id) ? 0 : 1;
      return aChecked - bChecked;
    });

    for (const entry of sortedEntries) {
      if (y > 195) { pdf.addPage(); y = 15; }
      const isChecked = checkedTbrs.has(entry.id);
      if (y % 2 === 0) { pdf.setFillColor(243, 244, 246); pdf.rect(margin, y, pw - margin * 2, 6, "F"); }
      x = margin + 2;
      pdf.setFontSize(8);
      pdf.text(isChecked ? "✓ Conferido" : "Pendente", x, y + 4);
      x += colWidths[0];
      pdf.text(entry.tbr_code, x, y + 4);
      x += colWidths[1];
      pdf.text((entry.driver_name ?? "-").substring(0, 30), x, y + 4);
      x += colWidths[2];
      pdf.text(entry.route ?? "-", x, y + 4);
      x += colWidths[3];
      pdf.text(entry.reason.substring(0, 45), x, y + 4);
      x += colWidths[4];
      pdf.text(format(new Date(entry.created_at), "dd/MM HH:mm"), x, y + 4);
      y += 6;
    }

    pdf.save(`conferencia_retorno_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
    toast({ title: "PDF gerado com sucesso" });
  };

  return (
    <div className="space-y-4">
      {/* Indicator Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <PackageX className="h-4 w-4 mx-auto text-destructive" />
            <p className="text-2xl font-bold">{totalOpen}</p>
            <p className="text-[10px] text-muted-foreground">Total Abertos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <AlertTriangle className="h-4 w-4 mx-auto text-amber-500" />
            <p className="text-sm font-bold truncate">{topReason ? topReason[0] : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Top Motivo ({topReason?.[1] ?? 0})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <TrendingUp className="h-4 w-4 mx-auto text-destructive" />
            <p className="text-sm font-bold truncate">{topDriver ? topDriver[0] : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Motorista Ofensor ({topDriver?.[1] ?? 0})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <Users className="h-4 w-4 mx-auto text-primary" />
            <p className="text-sm font-bold truncate">{topConferente ? topConferente[0] : "—"}</p>
            <p className="text-[10px] text-muted-foreground">Top Conferente ({topConferente?.[1] ?? 0})</p>
          </CardContent>
        </Card>
      </div>

      {/* Conferência de Retorno e Ações em Lote */}
      <div className="flex gap-2 w-full">
        <Button
          variant="outline"
          className="flex-1 gap-2 border-primary/30 hover:bg-primary/5"
          onClick={() => { setConfSheetOpen(true); setTimeout(() => confInputRef.current?.focus(), 200); }}
        >
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <span className="font-semibold">Conferência de Retorno</span>
          {checkedTbrs.size > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{checkedTbrs.size}/{entries.length}</Badge>
          )}
        </Button>
        {managerSession && bulkSelected.size > 0 && (
          <Button variant="destructive" className="gap-2 shrink-0" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Excluir ({bulkSelected.size})</span>
            <span className="sm:hidden">({bulkSelected.size})</span>
          </Button>
        )}
      </div>

      {/* Conferência Sheet */}
      <Sheet open={confSheetOpen} onOpenChange={setConfSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Conferência de Retorno
            </SheetTitle>
          </SheetHeader>

          <div className="p-4 space-y-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={confInputRef}
                value={confScanInput}
                onChange={(e) => setConfScanInput(e.target.value)}
                onKeyDown={handleConfScan}
                placeholder="Bipe ou digite o TBR..."
                className="pl-9 h-10"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Conferidos: <span className="font-bold text-foreground">{checkedTbrs.size}</span> / {entries.length}
              </span>
              <div className="flex gap-2">
                {checkedTbrs.size > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setCheckedTbrs(new Set())}>
                    <RotateCcw className="h-3 w-3" /> Limpar
                  </Button>
                )}
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={handleConfPdf} disabled={entries.length === 0}>
                  <FileText className="h-3 w-3" /> Gerar PDF
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-1">
              {entries.length === 0 ? (
                <p className="text-center text-muted-foreground italic py-8">Nenhum retorno para conferir</p>
              ) : (
                [...entries].sort((a, b) => {
                  const aC = checkedTbrs.has(a.id) ? 0 : 1;
                  const bC = checkedTbrs.has(b.id) ? 0 : 1;
                  if (aC !== bC) return aC - bC;
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                }).map(entry => {
                  const isChecked = checkedTbrs.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        isChecked ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                      )}
                      onClick={() => toggleCheck(entry.id)}
                    >
                      <Checkbox checked={isChecked} className="mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">{entry.tbr_code}</span>
                          <span className="text-sm truncate">{entry.driver_name ?? "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Rota: {entry.route ?? "—"}</span>
                          <span>•</span>
                          <span className="truncate">{entry.reason}</span>
                          <span>•</span>
                          <span>{format(new Date(entry.created_at), "HH:mm")}</span>
                        </div>
                      </div>
                      {isChecked && (
                        <Check className="h-4 w-4 text-primary shrink-0 mt-1" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <PackageX className="h-5 w-5 text-primary" />
            Retorno Piso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal text-xs h-9", !filterStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {filterStartDate ? format(filterStartDate, "dd/MM/yy", { locale: ptBR }) : "Data início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterStartDate} onSelect={setFilterStartDate} className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("justify-start text-left font-normal text-xs h-9", !filterEndDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {filterEndDate ? format(filterEndDate, "dd/MM/yy", { locale: ptBR }) : "Data fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={filterEndDate} onSelect={setFilterEndDate} className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>
            <Select value={filterConferente} onValueChange={(v) => setFilterConferente(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Conferente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {conferenteOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMotorista} onValueChange={(v) => setFilterMotorista(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Motorista" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueDriverNames.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

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
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <p className="text-center text-muted-foreground italic py-8">Nenhum TBR no piso</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {managerSession && (
                      <TableHead className="w-[40px] px-2 text-center">
                        <Checkbox 
                          checked={filteredEntries.length > 0 && bulkSelected.size === filteredEntries.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setBulkSelected(new Set(filteredEntries.map(e => e.id)));
                            } else {
                              setBulkSelected(new Set());
                            }
                          }}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                    )}
                    <TableHead className="font-bold">TBR</TableHead>
                    <TableHead className="font-bold">Motorista</TableHead>
                    <TableHead className="font-bold">Rota</TableHead>
                    <TableHead className="font-bold">Conferente</TableHead>
                    <TableHead className="font-bold">Motivo</TableHead>
                    <TableHead className="font-bold">Data</TableHead>
                    <TableHead className="font-bold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((e) => (
                    <TableRow key={e.id}>
                      {managerSession && (
                        <TableCell className="px-2 text-center">
                          <Checkbox 
                            checked={bulkSelected.has(e.id)}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(bulkSelected);
                              if (checked) newSet.add(e.id);
                              else newSet.delete(e.id);
                              setBulkSelected(newSet);
                            }}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">{e.tbr_code}</TableCell>
                      <TableCell>{e.driver_name ?? "-"}</TableCell>
                      <TableCell>{e.route ?? "-"}</TableCell>
                      <TableCell className="text-xs">{e.conferente_id ? (conferenteNames[e.conferente_id] ?? "-") : "-"}</TableCell>
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
                                  const tbrCode = e.tbr_code;
                                  // 1. Deletar de piso_entries
                                  await supabase.from("piso_entries").delete().eq("id", e.id);
                                  // 2. Deletar de ride_tbrs (pelo code)
                                  await supabase.from("ride_tbrs").delete().eq("code", tbrCode);
                                  // 3. Deletar de ps_entries
                                  await supabase.from("ps_entries").delete().eq("tbr_code", tbrCode).eq("unit_id", unitSession!.id);
                                  // 4. Deletar de rto_entries
                                  await supabase.from("rto_entries").delete().eq("tbr_code", tbrCode).eq("unit_id", unitSession!.id);
                                  // 5. Deletar de dnr_entries
                                  await supabase.from("dnr_entries").delete().eq("tbr_code", tbrCode).eq("unit_id", unitSession!.id);
                                  setEntries((prev) => prev.filter((p) => p.id !== e.id));
                                  setDeleteConfirmId(null);
                                  toast({ title: "TBR excluído definitivamente do sistema" });
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
                        {allReasons.map((r) => {
                          const customReason = customReasons.find(cr => cr.label === r);
                          const isEditing = customReason && editingReasonId === customReason.id;
                          return (
                            <CommandItem key={r} value={r} onSelect={() => { if (!isEditing) { setSelectedReason(r); setReasonSearchOpen(false); } }}>
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedReason === r ? "opacity-100" : "opacity-0")} />
                              {isEditing ? (
                                <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    value={editingReasonLabel}
                                    onChange={(e) => setEditingReasonLabel(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleEditReason(customReason.id, editingReasonLabel); }}
                                    className="h-7 text-sm flex-1"
                                    autoFocus
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); handleEditReason(customReason.id, editingReasonLabel); }}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); setEditingReasonId(null); }}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="flex-1">{r}</span>
                              )}
                              {customReason && !isEditing && (
                                <Pencil
                                  className="h-3.5 w-3.5 ml-auto shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setEditingReasonId(customReason.id); setEditingReasonLabel(customReason.label); }}
                                />
                              )}
                            </CommandItem>
                          );
                        })}
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
                    onChange={(e) => setNewReasonInput(capitalizeFirst(e.target.value))}
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
