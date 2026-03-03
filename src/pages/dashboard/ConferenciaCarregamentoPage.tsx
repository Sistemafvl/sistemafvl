import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, MapPin, User, Hash, KeyRound, Play, CheckCircle, RotateCcw, ScanBarcode, UserCheck, Clock, Search, X, CalendarIcon, Timer, Pencil, Eye, Lightbulb, Keyboard, Ban, ArrowRightLeft, Loader2, Bell, Lock, Camera, Trash2, Check, Maximize2, Minimize2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format, differenceInMinutes } from "date-fns";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn, isValidTbrCode } from "@/lib/utils";
import { isBarcodeInsideViewfinder } from "@/lib/scanner-utils";


interface RideWithDriver {
  id: string;
  unit_id: string;
  route: string | null;
  login: string | null;
  password: string | null;
  sequence_number: number | null;
  driver_id: string;
  conferente_id: string | null;
  loading_status: string | null;
  driver_name?: string;
  driver_avatar?: string;
  car_model?: string;
  car_plate?: string;
  car_color?: string;
  started_at?: string | null;
  finished_at?: string | null;
  queue_entry_id?: string | null;
}

interface Conferente {
  id: string;
  name: string;
}

interface Tbr {
  id: string;
  code: string;
  scanned_at: string;
  trip_number?: number;
  _duplicate?: boolean;
  _triplicate?: boolean;
  _yellowHighlight?: boolean;
}

interface OpenRto {
  id: string;
  tbr_code: string;
  cep: string;
  description: string;
  driver_name: string | null;
}

interface SwapDriver {
  id: string;
  name: string;
  cpf: string;
  avatar_url: string | null;
  car_model: string;
  car_plate: string;
  car_color: string | null;
}

const formatDuration = (startedAt: string, finishedAt: string) => {
  const mins = differenceInMinutes(new Date(finishedAt), new Date(startedAt));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}min`;
  }
  return `${mins} min`;
};

const playErrorBeep = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 400;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
};

const playReincidenceBeep = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.value = 0.4;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.value = 1000;
      gain2.gain.value = 0.4;
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.15);
    }, 200);
  } catch {}
};

const SkeletonCard = () => (
  <Card className="overflow-hidden">
    <CardContent className="p-4 flex flex-col items-center gap-3">
      <Skeleton className="h-16 w-16 rounded-full" />
      <Skeleton className="h-5 w-32" />
      <div className="w-full space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-8 w-full" />
    </CardContent>
  </Card>
);

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const ConferenciaCarregamentoPage = () => {
  const { unitSession, managerSession, conferenteSession } = useAuthStore();
  const [rides, setRides] = useState<RideWithDriver[]>([]);
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [tbrs, setTbrs] = useState<Record<string, Tbr[]>>({});
  const [tbrInputs, setTbrInputs] = useState<Record<string, string>>({});
  const [tbrSearch, setTbrSearch] = useState("");
  const [tbrSearchCommitted, setTbrSearchCommitted] = useState("");
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [endDate, setEndDate] = useState<Date>(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [editingField, setEditingField] = useState<{ rideId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [driverModalData, setDriverModalData] = useState<any>(null);
  const [driverModalLoading, setDriverModalLoading] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const tbrListRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const deletingRef = useRef<Set<string>>(new Set());
  const realtimeLockUntil = useRef<number>(0);
  const [lockedConferenteIds, setLockedConferenteIds] = useState<Set<string>>(new Set());
  const [driverNameFilter, setDriverNameFilter] = useState("");
  const [loginFilter, setLoginFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [routePopoverOpen, setRoutePopoverOpen] = useState(false);
  const [unitLogins, setUnitLogins] = useState<{login: string; password: string}[]>([]);
  const [loginPopoverOpen, setLoginPopoverOpen] = useState(false);
  const [iniciarConfirmRideId, setIniciarConfirmRideId] = useState<string | null>(null);
  const unitId = unitSession?.id;
  const [openRtos, setOpenRtos] = useState<OpenRto[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [focusedRideId, setFocusedRideId] = useState<string | null>(null);
  const currentRideIdsRef = useRef<string[]>([]);
  const [removedTbrCounts, setRemovedTbrCounts] = useState<Record<string, number>>({});
  const requestIdRef = useRef<number>(0);

  // Manual mode toggle per ride
  const [manualMode, setManualMode] = useState<Record<string, boolean>>({});

  // Cancel loading modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelRideId, setCancelRideId] = useState<string | null>(null);
  const [cancelPassword, setCancelPassword] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Swap driver modal
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapRideId, setSwapRideId] = useState<string | null>(null);
  const [swapNameSearch, setSwapNameSearch] = useState("");
  const [swapCpfSearch, setSwapCpfSearch] = useState("");
  const [swapResults, setSwapResults] = useState<SwapDriver[]>([]);
  const [swapSearchLoading, setSwapSearchLoading] = useState(false);
  const [selectedSwapDriver, setSelectedSwapDriver] = useState<SwapDriver | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState("");
  const swapDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swap password modal (for non-manager users)
  const [showSwapPasswordModal, setShowSwapPasswordModal] = useState(false);
  const [swapPasswordInput, setSwapPasswordInput] = useState("");
  const [swapPasswordRideId, setSwapPasswordRideId] = useState<string | null>(null);

  // Delete loading modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRideId, setDeleteRideId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Call driver
  const [callingDriverId, setCallingDriverId] = useState<string | null>(null);

  // Finalizar confirmation modal
  const [finalizarConfirmRideId, setFinalizarConfirmRideId] = useState<string | null>(null);

  // Delete TBR with manager password
  const [showDeleteTbrPasswordModal, setShowDeleteTbrPasswordModal] = useState(false);
  const [deleteTbrPassword, setDeleteTbrPassword] = useState("");
  const [deleteTbrPending, setDeleteTbrPending] = useState<{ tbrId: string; rideId: string } | null>(null);
  const [deleteTbrLoading, setDeleteTbrLoading] = useState(false);

  // Batch delete TBRs
  const [selectedTbrsForDelete, setSelectedTbrsForDelete] = useState<Record<string, Set<string>>>({});
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [batchDeletePassword, setBatchDeletePassword] = useState("");
  const [batchDeleteRideId, setBatchDeleteRideId] = useState<string | null>(null);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  // Camera scanner state
  const [cameraOpen, setCameraOpen] = useState<string | null>(null); // rideId or null
  const [lastScannedCode, setLastScannedCode] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTbrRef = useRef<(rideId: string, code: string) => Promise<void>>();

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

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraOpen(null);
    setLastScannedCode("");
  }, []);

  const startCamera = useCallback(async (rideId: string) => {
    setCameraOpen(rideId);
    setLastScannedCode("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Check BarcodeDetector support
      if (!("BarcodeDetector" in window)) {
        const { toast } = await import("@/hooks/use-toast");
        toast({ title: "Scanner não suportado", description: "Seu navegador não suporta leitura de código de barras pela câmera.", variant: "destructive" });
        return;
      }

      const detector = new (window as any).BarcodeDetector({ formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "data_matrix", "pdf417", "codabar", "itf", "upc_a", "upc_e"] });
      const recentCodes = new Set<string>();
      let scanningPaused = false;

      scanIntervalRef.current = setInterval(async () => {
        if (scanningPaused) return;
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const allBarcodes = await detector.detect(videoRef.current);
          if (allBarcodes.length === 0) return;

          // Only consider barcodes fully inside the viewfinder area (20% inset)
          const barcodes = allBarcodes.filter((b: any) => isBarcodeInsideViewfinder(b, videoRef.current!, 0.2));
          if (barcodes.length === 0) return;

          // Filter only TBR codes
          const tbrBarcodes = barcodes.filter((b: any) => b.rawValue.toUpperCase().startsWith("TBR"));

          // If multiple TBR codes visible, ask user to focus
          if (tbrBarcodes.length > 1) {
            setLastScannedCode("⚠ Múltiplos códigos detectados. Foque em apenas 1.");
            return;
          }

          // If no TBR codes but other codes visible, show error
          if (tbrBarcodes.length === 0) {
            const code = barcodes[0].rawValue;
            if (recentCodes.has(code)) return;
            recentCodes.add(code);
            setTimeout(() => recentCodes.delete(code), 5000);
            setLastScannedCode(code);
            playErrorBeep();
            return;
          }

          const code = tbrBarcodes[0].rawValue;
          if (recentCodes.has(code)) return;
          recentCodes.add(code);
          setTimeout(() => recentCodes.delete(code), 5000);

          if (!isValidTbrCode(code)) { setLastScannedCode(code); playErrorBeep(); return; }

          // Pause scanning after successful read
          scanningPaused = true;
          setLastScannedCode(code);
          playSuccessBeep();

          // Synchronous lock BEFORE async saveTbr to prevent duplicates
          if (!processedCodesRef.current[rideId]) processedCodesRef.current[rideId] = new Set();
          const upper = code.toUpperCase();
          if (processedCodesRef.current[rideId].has(upper)) {
            // Already processed — resume scanning after short delay
            setTimeout(() => { scanningPaused = false; }, 1500);
            return;
          }

          await saveTbrRef.current?.(rideId, code);

          // Resume scanning after a delay so user sees the result
          setTimeout(() => { scanningPaused = false; }, 1500);
        } catch {}
      }, 100);
    } catch (err) {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Erro ao acessar câmera", description: "Permita o acesso à câmera nas configurações do navegador.", variant: "destructive" });
      stopCamera();
    }
  }, [stopCamera]);

  // Cleanup camera on unmount
  useEffect(() => { return () => { stopCamera(); }; }, [stopCamera]);


  const [searchRides, setSearchRides] = useState<RideWithDriver[]>([]);
  const [searchTbrs, setSearchTbrs] = useState<Record<string, Tbr[]>>({});

  const fetchRides = useCallback(async () => {
    if (!unitId) return;

    // Concurrency control: only apply results from the latest request
    const thisRequestId = ++requestIdRef.current;


    const { data } = await supabase
      .from("driver_rides")
      .select("*")
      .eq("unit_id", unitId)
      .gte("completed_at", startDate.toISOString())
      .lte("completed_at", endDate.toISOString())
      .order("sequence_number", { ascending: true });

    // Stale response check
    if (thisRequestId !== requestIdRef.current) return;

    if (!data) { setRides([]); setIsLoading(false); return; }

    const driverIds = [...new Set(data.map((r) => r.driver_id))];
    const { data: drivers } = await supabase
      .from("drivers_public")
      .select("id, name, avatar_url, car_model, car_plate, car_color")
      .in("id", driverIds);

    // Stale response check
    if (thisRequestId !== requestIdRef.current) return;

    const driverMap = new Map((drivers ?? []).map((d) => [d.id, d]));

    const mapped = data.map((r) => {
      const d = driverMap.get(r.driver_id);
      return {
        ...r,
        conferente_id: r.conferente_id ?? null,
        loading_status: r.loading_status ?? "pending",
        password: r.password ?? null,
        driver_name: d?.name ?? "Motorista",
        driver_avatar: d?.avatar_url ?? undefined,
        car_model: d?.car_model ?? undefined,
        car_plate: d?.car_plate ?? undefined,
        car_color: d?.car_color ?? undefined,
      };
    });

    setRides(mapped);
    // Update ref for realtime filtering
    currentRideIdsRef.current = mapped.map(r => r.id);

    setLockedConferenteIds(prev => {
      const next = new Set(prev);
      mapped.forEach(r => { if (r.conferente_id) next.add(r.id); });
      return next;
    });

    const rideIds = mapped.map((r) => r.id);
    if (rideIds.length > 0) {
      // Use pagination to fetch ALL TBRs (bypass 1000 row limit)
      const { fetchAllRows } = await import("@/lib/supabase-helpers");
      const tbrData = await fetchAllRows<any>((from, to) =>
        supabase.from("ride_tbrs").select("*")
          .in("ride_id", rideIds)
          .order("scanned_at", { ascending: false })
          .range(from, to)
      );

      // Stale response check
      if (thisRequestId !== requestIdRef.current) return;

      const grouped: Record<string, Tbr[]> = {};
      (tbrData).forEach((t: any) => {
        // Filter out TBRs currently being deleted
        if (deletingRef.current.has(t.id)) return;
        if (!grouped[t.ride_id]) grouped[t.ride_id] = [];
        grouped[t.ride_id].push(t);
      });
      const result: Record<string, Tbr[]> = {};
      for (const [rideId, list] of Object.entries(grouped)) {
        result[rideId] = list.map((t: any) => ({
          ...t,
          trip_number: t.trip_number ?? 1,
          _yellowHighlight: t.highlight === "yellow",
        }));
      }
      setTbrs(result);
      // Sync processedCodesRef with loaded data
      const newProcessed: Record<string, Set<string>> = {};
      for (const [rideId, tbrList] of Object.entries(result)) {
        newProcessed[rideId] = new Set(tbrList.map(t => t.code.toUpperCase()));
      }
      processedCodesRef.current = newProcessed;
    } else {
      setTbrs({});
      processedCodesRef.current = {};
    }
    setIsLoading(false);

    // Fetch removed TBR counts per ride from piso_entries
    if (rideIds.length > 0) {
      const { data: removedEntries } = await supabase
        .from("piso_entries")
        .select("ride_id")
        .in("ride_id", rideIds)
        .eq("reason", "Removido do carregamento");
      const counts: Record<string, number> = {};
      (removedEntries ?? []).forEach((e: any) => {
        counts[e.ride_id] = (counts[e.ride_id] || 0) + 1;
      });
      setRemovedTbrCounts(counts);
    } else {
      setRemovedTbrCounts({});
    }

  }, [unitId, startDate, endDate]);

  const [searchUnitNames, setSearchUnitNames] = useState<Record<string, string>>({});

  const fetchSearchResults = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchRides([]);
      setSearchTbrs({});
      setSearchUnitNames({});
      return;
    }

    // Global search: find TBRs across ALL units
    const { data: matchingTbrs } = await supabase
      .from("ride_tbrs")
      .select("*")
      .ilike("code", `%${searchTerm.trim()}%`)
      .order("scanned_at", { ascending: false });

    if (!matchingTbrs || matchingTbrs.length === 0) { setSearchRides([]); setSearchTbrs({}); setSearchUnitNames({}); return; }

    const matchingRideIds = [...new Set(matchingTbrs.map(t => t.ride_id))];

    const { data: ridesData } = await supabase
      .from("driver_rides")
      .select("*")
      .in("id", matchingRideIds)
      .order("sequence_number", { ascending: true });

    if (!ridesData) { setSearchRides([]); setSearchTbrs({}); setSearchUnitNames({}); return; }

    // Fetch unit names for results from other units
    const otherUnitIds = [...new Set(ridesData.filter(r => r.unit_id !== unitId).map(r => r.unit_id))];
    if (otherUnitIds.length > 0) {
      const { data: units } = await supabase.from("units_public").select("id, name").in("id", otherUnitIds);
      const map: Record<string, string> = {};
      (units ?? []).forEach(u => { if (u.id && u.name) map[u.id] = u.name; });
      setSearchUnitNames(map);
    } else {
      setSearchUnitNames({});
    }

    const driverIds = [...new Set(ridesData.map(r => r.driver_id))];
    const { data: drivers } = await supabase
      .from("drivers_public")
      .select("id, name, avatar_url, car_model, car_plate, car_color")
      .in("id", driverIds);

    const driverMap = new Map((drivers ?? []).map(d => [d.id, d]));

    const mapped = ridesData.map((r) => {
      const d = driverMap.get(r.driver_id);
      return {
        ...r,
        conferente_id: r.conferente_id ?? null,
        loading_status: r.loading_status ?? "pending",
        password: r.password ?? null,
        driver_name: d?.name ?? "Motorista",
        driver_avatar: d?.avatar_url ?? undefined,
        car_model: d?.car_model ?? undefined,
        car_plate: d?.car_plate ?? undefined,
        car_color: d?.car_color ?? undefined,
      };
    });

    setSearchRides(mapped);

    const { data: allTbrData } = await supabase
      .from("ride_tbrs")
      .select("*")
      .in("ride_id", matchingRideIds)
      .order("scanned_at", { ascending: false });

    const grouped: Record<string, Tbr[]> = {};
    (allTbrData ?? []).forEach((t: any) => {
      if (!grouped[t.ride_id]) grouped[t.ride_id] = [];
      grouped[t.ride_id].push(t);
    });
    setSearchTbrs(grouped);
  }, [unitId]);

  useEffect(() => {
    if (!unitId) return;
    supabase
      .from("user_profiles")
      .select("id, name")
      .eq("unit_id", unitId)
      .eq("active", true)
      .then(({ data }) => { if (data) setConferentes(data); });
  }, [unitId]);

  const fetchOpenRtos = useCallback(async () => {
    if (!unitId) return;
    const { data } = await supabase
      .from("rto_entries")
      .select("id, tbr_code, cep, description, driver_name")
      .eq("unit_id", unitId)
      .eq("status", "open")
      .not("cep", "is", null);
    setOpenRtos((data ?? []).filter(r => r.cep && r.cep.trim().length >= 4) as OpenRto[]);
  }, [unitId]);

  useEffect(() => { fetchOpenRtos(); }, [fetchOpenRtos]);
  useEffect(() => { fetchRides(); }, [fetchRides]);

  // Polling fallback: refresh rides every 5 seconds as safety net
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() < realtimeLockUntil.current) return;
      fetchRides();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchRides]);

  // Fetch unit logins for the dropdown filter
  useEffect(() => {
    if (!unitId) return;
    const fetchLogins = async () => {
      const { data } = await supabase
        .from("unit_logins")
        .select("login, password")
        .eq("unit_id", unitId)
        .eq("active", true)
        .order("login", { ascending: true });
      setUnitLogins((data ?? []).map((l: any) => ({ login: l.login, password: l.password })));
    };
    fetchLogins();
  }, [unitId]);

  useEffect(() => {
    if (!unitId) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = (payload?: any) => {
      if (Date.now() < realtimeLockUntil.current) return;
      // Filter ride_tbrs events: only react if ride_id belongs to current unit's rides
      if (payload?.new?.ride_id || payload?.old?.ride_id) {
        const eventRideId = payload.new?.ride_id || payload.old?.ride_id;
        if (currentRideIdsRef.current.length > 0 && !currentRideIdsRef.current.includes(eventRideId)) return;
      }
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { fetchRides(); }, 400);
    };
    const channel = supabase
      .channel("conferencia-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_rides", filter: `unit_id=eq.${unitId}` }, debouncedFetch)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ride_tbrs" }, (payload) => debouncedFetch(payload))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ride_tbrs" }, (payload) => debouncedFetch(payload))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "ride_tbrs" }, (payload) => debouncedFetch(payload))
      .subscribe();
    return () => { if (debounceTimer) clearTimeout(debounceTimer); supabase.removeChannel(channel); };
  }, [unitId, fetchRides]);


  const handleSelectConferente = async (rideId: string, conferenteId: string) => {
    // Lock immediately using state to force re-render
    setLockedConferenteIds((prev) => new Set(prev).add(rideId));
    // Optimistic update to lock dropdown immediately
    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, conferente_id: conferenteId } : r));
    await supabase.from("driver_rides").update({ conferente_id: conferenteId } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleIniciar = async (rideId: string) => {
    // Auto-fill conferente from session if not already set
    const ride = rides.find(r => r.id === rideId);
    const conferenteId = ride?.conferente_id || conferenteSession?.id;
    // Optimistic: update local state and open overlay immediately
    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, loading_status: "loading", started_at: new Date().toISOString(), conferente_id: conferenteId || r.conferente_id } : r));
    if (conferenteId) setLockedConferenteIds((prev) => new Set(prev).add(rideId));
    setFocusedRideId(rideId);
    // Then persist to DB in background
    if (conferenteId && !ride?.conferente_id) {
      await supabase.from("driver_rides").update({ loading_status: "loading", started_at: new Date().toISOString(), conferente_id: conferenteId } as any).eq("id", rideId);
    } else {
      await supabase.from("driver_rides").update({ loading_status: "loading", started_at: new Date().toISOString() } as any).eq("id", rideId);
    }
    fetchRides();
  };

  const handleFinalizar = async (rideId: string) => {
    setFocusedRideId(null);
    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, loading_status: "finished", finished_at: new Date().toISOString() } : r));
    await supabase.from("driver_rides").update({ loading_status: "finished", finished_at: new Date().toISOString() } as any).eq("id", rideId);
    fetchRides();
  };

  const handleRetornar = async (rideId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLockedConferenteIds((prev) => new Set(prev).add(rideId));
    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, loading_status: "loading", finished_at: null } : r));
    setFocusedRideId(rideId);
    await supabase.from("driver_rides").update({ loading_status: "loading", finished_at: null } as any).eq("id", rideId);
    fetchRides();
  };

  const handleDeleteTbr = async (tbrId: string, rideId: string) => {
    if (deletingRef.current.has(tbrId)) return;
    deletingRef.current.add(tbrId);
    realtimeLockUntil.current = Date.now() + 8000;

    // Look in both tbrs and searchTbrs to find the TBR to delete
    const tbrToDelete = (tbrs[rideId] ?? []).find(t => t.id === tbrId)
      || (searchTbrs[rideId] ?? []).find(t => t.id === tbrId);

    // Optimistic UI removal + sync processedCodesRef
    if (tbrToDelete) {
      processedCodesRef.current[rideId]?.delete(tbrToDelete.code.toUpperCase());
    }
    setTbrs((prev) => ({
      ...prev,
      [rideId]: (prev[rideId] ?? []).filter((t) => t.id !== tbrId),
    }));
    setSearchTbrs((prev) => ({
      ...prev,
      [rideId]: (prev[rideId] ?? []).filter((t) => t.id !== tbrId),
    }));

    const { error } = await supabase.from("ride_tbrs").delete().eq("id", tbrId);
    if (error) console.error("Delete TBR error:", error);

    // Create/reopen piso_entry for removed TBR
    if (tbrToDelete && unitId) {
      const ride = rides.find(r => r.id === rideId);
      // Check if open piso_entry already exists
      const { data: existingPiso } = await supabase
        .from("piso_entries")
        .select("id")
        .ilike("tbr_code", tbrToDelete.code)
        .eq("unit_id", unitId)
        .eq("status", "open")
        .maybeSingle();

      if (!existingPiso) {
        // Check for closed entry to reopen (case-insensitive)
        const { data: closedPiso } = await supabase
          .from("piso_entries")
          .select("id")
          .ilike("tbr_code", tbrToDelete.code)
          .eq("unit_id", unitId)
          .eq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (closedPiso) {
          await supabase.from("piso_entries").update({ status: "open", closed_at: null, reason: "Removido do carregamento" } as any).eq("id", closedPiso.id);
        } else {
          await supabase.from("piso_entries").insert({
            tbr_code: tbrToDelete.code,
            unit_id: unitId,
            reason: "Removido do carregamento",
            driver_name: ride?.driver_name ?? null,
            route: ride?.route ?? null,
            ride_id: rideId,
          } as any);
        }
      }

      // Reopen RTO if exists
      const { data: rtoMatch } = await supabase
        .from("rto_entries")
        .select("id")
        .ilike("tbr_code", tbrToDelete.code)
        .eq("status", "closed")
        .eq("unit_id", unitId)
        .maybeSingle();
      if (rtoMatch) {
        await supabase.from("rto_entries").update({ status: "open", closed_at: null }).eq("id", rtoMatch.id);
      }
    }

    await fetchOpenRtos();

    // Wait for DB ops to propagate, then re-fetch
    await new Promise(r => setTimeout(r, 500));
    await fetchRides();
    // Also refresh search results if search is active
    if (tbrSearchCommitted.trim()) {
      await fetchSearchResults(tbrSearchCommitted);
    }
    deletingRef.current.delete(tbrId);
    // Lock expires automatically after 5s - no need to reset
  };

  // Open password modal for individual TBR delete
  const handleDeleteTbrWithPassword = (tbrId: string, rideId: string) => {
    setDeleteTbrPending({ tbrId, rideId });
    setDeleteTbrPassword("");
    setShowDeleteTbrPasswordModal(true);
  };

  const confirmDeleteTbrWithPassword = async () => {
    if (!deleteTbrPending || !unitId) return;
    setDeleteTbrLoading(true);
    const { data: managers } = await supabase.from("managers").select("manager_password").eq("unit_id", unitId).eq("active", true);
    const valid = (managers ?? []).some(m => m.manager_password === deleteTbrPassword);
    if (!valid) {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Senha incorreta", variant: "destructive" });
      setDeleteTbrLoading(false);
      return;
    }
    setShowDeleteTbrPasswordModal(false);
    await handleDeleteTbr(deleteTbrPending.tbrId, deleteTbrPending.rideId);
    setDeleteTbrPending(null);
    setDeleteTbrLoading(false);
  };

  // Batch delete helpers
  const toggleTbrSelection = (rideId: string, tbrId: string) => {
    setSelectedTbrsForDelete(prev => {
      const current = new Set(prev[rideId] ?? []);
      if (current.has(tbrId)) current.delete(tbrId); else current.add(tbrId);
      return { ...prev, [rideId]: current };
    });
  };

  const getSelectedCount = (rideId: string) => selectedTbrsForDelete[rideId]?.size ?? 0;

  const openBatchDeleteModal = (rideId: string) => {
    setBatchDeleteRideId(rideId);
    setBatchDeletePassword("");
    setShowBatchDeleteModal(true);
  };

  const confirmBatchDelete = async () => {
    if (!batchDeleteRideId || !unitId) return;
    setBatchDeleteLoading(true);
    const { data: managers } = await supabase.from("managers").select("manager_password").eq("unit_id", unitId).eq("active", true);
    const valid = (managers ?? []).some(m => m.manager_password === batchDeletePassword);
    if (!valid) {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Senha incorreta", variant: "destructive" });
      setBatchDeleteLoading(false);
      return;
    }
    setShowBatchDeleteModal(false);
    const ids = [...(selectedTbrsForDelete[batchDeleteRideId] ?? [])];
    for (const tbrId of ids) {
      await handleDeleteTbr(tbrId, batchDeleteRideId);
    }
    setSelectedTbrsForDelete(prev => ({ ...prev, [batchDeleteRideId!]: new Set() }));
    setBatchDeleteLoading(false);
    const { toast } = await import("@/hooks/use-toast");
    toast({ title: `${ids.length} TBR(s) excluído(s) com sucesso` });
  };

  const scrollTbrList = (rideId: string) => {
    setTimeout(() => {
      const el = tbrListRefs.current[rideId];
      if (el) {
        // Last scanned is now first in list, scroll to top
        const firstChild = el.firstElementChild;
        if (firstChild) {
          firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          el.scrollTop = 0;
        }
      }
    }, 250);
  };

  // Save TBR logic (shared between scanner debounce and manual Enter)
  const saveTbr = async (rideId: string, code: string) => {
    if (!code.trim()) return;
    if (!isValidTbrCode(code)) {
      playErrorBeep();
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "TBR inválido", description: "O código TBR deve conter apenas 'TBR' seguido de números.", variant: "destructive" });
      setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
      setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
      return;
    }
    if (code.toUpperCase().startsWith("TBR")) {
      // Use processedCodesRef for synchronous duplicate detection (avoids stale React state)
      if (!processedCodesRef.current[rideId]) processedCodesRef.current[rideId] = new Set();
      const alreadyProcessed = processedCodesRef.current[rideId].has(code.toUpperCase());
      const currentTbrs = tbrs[rideId] ?? [];
      const occurrences = currentTbrs.filter(t => t.code.toUpperCase() === code.toUpperCase());
      const count = alreadyProcessed ? Math.max(occurrences.length, 1) : occurrences.length;

      const tempId = crypto.randomUUID();
      const newTbr: Tbr = { id: tempId, code, scanned_at: new Date().toISOString() };

      if (count === 0) {
        const { data: previousTbrs } = await supabase
          .from("ride_tbrs")
          .select("id, ride_id")
          .eq("code", code)
          .neq("ride_id", rideId);

        let tripNumber = 1;

        if (previousTbrs && previousTbrs.length > 0) {
          // Check if any of those TBRs belong to ACTIVE loads
          const prevRideIds = [...new Set(previousTbrs.map(t => t.ride_id))];
          const { data: prevRides } = await supabase
            .from("driver_rides")
            .select("id, loading_status")
            .in("id", prevRideIds)
            .in("loading_status", ["pending", "loading"]);

          if (prevRides && prevRides.length > 0) {
            playErrorBeep();
            const { toast } = await import("@/hooks/use-toast");
            toast({
              title: "TBR em carregamento ativo",
              description: "Este TBR já está em outro carregamento ativo. Remova-o do carregamento anterior antes de escaneá-lo aqui.",
              variant: "destructive",
            });
            setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
            setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
            return;
          }

          const { data: pisoEntries } = await supabase
            .from("piso_entries")
            .select("id, status")
            .eq("tbr_code", code);

          if (!pisoEntries || pisoEntries.length === 0) {
            playErrorBeep();
            const { toast } = await import("@/hooks/use-toast");
            toast({
              title: "TBR em viagem",
              description: "Este TBR encontra-se em viagem. Registre-o no Retorno Piso antes de escaneá-lo novamente no carregamento.",
              variant: "destructive",
            });
            setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
            setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
            return;
          }

          tripNumber = previousTbrs.length + 1;

          playReincidenceBeep();
        }

        // Close piso and rto entries in background (don't block optimistic UI)
        // Case-insensitive match prevents mismatch by code casing
        const closedAt = new Date().toISOString();
        void Promise.all([
          supabase
            .from("piso_entries")
            .update({ status: "closed", closed_at: closedAt } as any)
            .ilike("tbr_code", code)
            .eq("status", "open"),
          supabase
            .from("rto_entries")
            .update({ status: "closed", closed_at: closedAt } as any)
            .ilike("tbr_code", code)
            .eq("status", "open"),
        ]);

        newTbr.trip_number = tripNumber;

        // Track synchronously BEFORE async React setState
        processedCodesRef.current[rideId]?.add(code.toUpperCase());

        // Block Realtime refresh for 3s to prevent flicker on optimistic insert
        realtimeLockUntil.current = Date.now() + 3000;

        setTbrs((prev) => ({
          ...prev,
          [rideId]: [newTbr, ...(prev[rideId] ?? [])],
        }));
        setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
        setTimeout(() => { inputRefs.current[rideId]?.focus(); scrollTbrList(rideId); }, 50);

        // DB-level duplicate check before insert (safety net)
        const { data: existingTbr } = await supabase
          .from("ride_tbrs")
          .select("id")
          .eq("ride_id", rideId)
          .ilike("code", code)
          .eq("trip_number", tripNumber)
          .limit(1);

        if (existingTbr && existingTbr.length > 0) {
          // Already exists in DB — remove from local state to avoid ghost entry
          setTbrs((prev) => ({
            ...prev,
            [rideId]: (prev[rideId] ?? []).filter(t => t.id !== tempId),
          }));
          return;
        }

        await supabase.from("ride_tbrs").insert({ ride_id: rideId, code, trip_number: tripNumber, scanned_at: newTbr.scanned_at } as any);
        playSuccessBeep();
      } else if (count === 1) {
        newTbr._duplicate = true;
        setTbrs((prev) => {
          const updated = (prev[rideId] ?? []).map(t =>
            t.code.toUpperCase() === code.toUpperCase() ? { ...t, _duplicate: true } : t
          );
          return { ...prev, [rideId]: [newTbr, ...updated] };
        });
        playErrorBeep();

        setTimeout(() => {
          setTbrs((prev) => {
            const list = prev[rideId] ?? [];
            const filtered = list
              .filter(t => t.id !== tempId)
              .map(t => t.code.toUpperCase() === code.toUpperCase() ? { ...t, _duplicate: false } : t);
            return { ...prev, [rideId]: filtered };
          });
        }, 1000);
        setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
        setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
      } else if (count >= 2) {
        // 3x beep: don't add the 3rd TBR at all. Remove the 2nd duplicate immediately, keep 1st as yellow.
        playErrorBeep();

        const firstTbr = occurrences[0];
        const secondId = occurrences[1]?.id;

        // Save yellow highlight to DB immediately so any refetch restores it permanently
        if (firstTbr?.id) {
          supabase.from("ride_tbrs").update({ highlight: "yellow" }).eq("id", firstTbr.id).then(() => {});
        }
        // Delete the 2nd duplicate from DB
        if (secondId) {
          supabase.from("ride_tbrs").delete().eq("id", secondId).then(() => {});
        }

        // Extend realtime lock to prevent refetch from overwriting
        realtimeLockUntil.current = Date.now() + 15000;

        // Immediately update local state: remove 2nd duplicate, mark 1st as yellow
        setTbrs((prev) => {
          const list = prev[rideId] ?? [];
          const idsToRemove = new Set([secondId].filter(Boolean));
          const filtered = list
            .filter(t => !idsToRemove.has(t.id))
            .map(t => t.id === firstTbr?.id ? { ...t, _triplicate: false, _duplicate: false, _yellowHighlight: true } : t);
          return { ...prev, [rideId]: filtered };
        });

        setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
        setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
      }
    } else {
      playErrorBeep();
      setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
      setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
    }
  };

  // Keep ref updated for camera scanner callback
  saveTbrRef.current = saveTbr;

  // Queue system for ultra-fast scanning - never blocks input
  const queueRef = useRef<Record<string, string[]>>({});
  const processingQueueRef = useRef<Record<string, boolean>>({});
  // Synchronous tracking of codes already enqueued/processed per ride (avoids stale React state)
  const processedCodesRef = useRef<Record<string, Set<string>>>({});

  const fetchRidesRef = useRef(fetchRides);
  fetchRidesRef.current = fetchRides;
  const fetchOpenRtosRef = useRef(fetchOpenRtos);
  fetchOpenRtosRef.current = fetchOpenRtos;

  const processQueue = useCallback(async (rideId: string) => {
    if (processingQueueRef.current[rideId]) return;
    processingQueueRef.current[rideId] = true;

    while (queueRef.current[rideId]?.length > 0) {
      const code = queueRef.current[rideId].shift()!;
      try {
        await saveTbrRef.current?.(rideId, code);
      } catch (err) {
        console.error("Queue processing error:", err);
      }
    }

    processingQueueRef.current[rideId] = false;
    // Sync with DB only once after all queued items are processed
    fetchRidesRef.current();
    fetchOpenRtosRef.current();
  }, []);

  // Auto-save TBR with debounce (scanner mode) or Enter (manual mode)
  const handleTbrInputChange = (rideId: string, value: string) => {
    if (value.length > 15) return;

    setTbrInputs((prev) => ({ ...prev, [rideId]: value }));

    if (debounceTimers.current[rideId]) {
      clearTimeout(debounceTimers.current[rideId]);
    }

    if (!value.trim()) return;

    // In manual mode, don't auto-save
    if (manualMode[rideId]) return;

    // Scanner mode: ultra-fast 20ms debounce - enqueue and never block
    debounceTimers.current[rideId] = setTimeout(() => {
      const code = value.trim();
      // Clear input immediately so scanner can read next code
      setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
      requestAnimationFrame(() => {
        inputRefs.current[rideId]?.focus();
      });
      // Enqueue the code for background processing
      if (!queueRef.current[rideId]) queueRef.current[rideId] = [];
      queueRef.current[rideId].push(code);
      processQueue(rideId);
    }, 20);
  };

  const handleTbrKeyDown = (rideId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && manualMode[rideId]) {
      e.preventDefault();
      const value = tbrInputs[rideId]?.trim();
      if (value) {
        saveTbr(rideId, value);
      }
    }
  };

  // Cancel loading
  const handleOpenCancelModal = (rideId: string) => {
    setCancelRideId(rideId);
    setCancelPassword("");
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelRideId || !unitId) return;
    setCancelLoading(true);

    // Validate manager password against all managers of this unit
    const { data: managers } = await supabase
      .from("managers")
      .select("manager_password")
      .eq("unit_id", unitId)
      .eq("active", true);

    const passwordValid = (managers ?? []).some(m => m.manager_password === cancelPassword);
    if (!passwordValid) {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Senha incorreta", description: "A senha do gerente está incorreta.", variant: "destructive" });
      setCancelLoading(false);
      return;
    }

    const ride = rides.find(r => r.id === cancelRideId);
    if (!ride) { setCancelLoading(false); return; }

    // Move all TBRs to piso_entries
    const rideTbrs = tbrs[cancelRideId] ?? [];
    if (rideTbrs.length > 0) {
      const pisoInserts = rideTbrs.map(t => ({
        tbr_code: t.code,
        unit_id: unitId,
        ride_id: cancelRideId,
        reason: "Carregamento cancelado",
        status: "open",
        driver_name: ride.driver_name || null,
        route: ride.route || null,
      }));
      await supabase.from("piso_entries").insert(pisoInserts as any);
    }

    // Update ride status
    await supabase.from("driver_rides").update({ loading_status: "cancelled" } as any).eq("id", cancelRideId);

    // Complete queue entry
    if (ride.queue_entry_id) {
      await supabase.from("queue_entries").update({ status: "completed", completed_at: new Date().toISOString() } as any).eq("id", ride.queue_entry_id);
    }

    setCancelLoading(false);
    setShowCancelModal(false);
    fetchRides();
  };

  // Delete/Reset loading
  const handleOpenDeleteModal = (rideId: string) => {
    setDeleteRideId(rideId);
    setDeletePassword("");
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteRideId || !unitId) return;
    setDeleteLoading(true);

    // Validate manager password
    const { data: managers } = await supabase
      .from("managers")
      .select("manager_password")
      .eq("unit_id", unitId)
      .eq("active", true);

    const passwordValid = (managers ?? []).some(m => m.manager_password === deletePassword);
    if (!passwordValid) {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Senha incorreta", description: "A senha do gerente está incorreta.", variant: "destructive" });
      setDeleteLoading(false);
      return;
    }

    const ride = rides.find(r => r.id === deleteRideId);
    if (!ride) { setDeleteLoading(false); return; }

    // Move TBRs to piso_entries
    const rideTbrs = tbrs[deleteRideId] ?? [];
    if (rideTbrs.length > 0) {
      const pisoInserts = rideTbrs.map(t => ({
        tbr_code: t.code,
        unit_id: unitId,
        ride_id: deleteRideId,
        reason: "Carregamento resetado",
        status: "open",
        driver_name: ride.driver_name || null,
        route: ride.route || null,
      }));
      await supabase.from("piso_entries").insert(pisoInserts as any);
    }

    // Delete ride_tbrs
    await supabase.from("ride_tbrs").delete().eq("ride_id", deleteRideId);

    // Delete driver_rides
    await supabase.from("driver_rides").delete().eq("id", deleteRideId);

    // Release queue_entry if exists
    if (ride.queue_entry_id) {
      await supabase.from("queue_entries").update({ status: "waiting", called_at: null, completed_at: null } as any).eq("id", ride.queue_entry_id);
    }

    setDeleteLoading(false);
    setShowDeleteModal(false);
    fetchRides();
  };

  // Swap driver - requires password for non-managers
  const handleOpenSwapModal = (rideId: string) => {
    if (!managerSession) {
      setSwapPasswordRideId(rideId);
      setSwapPasswordInput("");
      setShowSwapPasswordModal(true);
      return;
    }
    openSwapModalDirect(rideId);
  };

  const openSwapModalDirect = (rideId: string) => {
    setSwapRideId(rideId);
    setSwapNameSearch("");
    setSwapCpfSearch("");
    setSwapResults([]);
    setSelectedSwapDriver(null);
    setSwapError("");
    setShowSwapModal(true);
  };

  // Name search with debounce
  useEffect(() => {
    if (!swapNameSearch.trim()) {
      setSwapResults([]);
      return;
    }
    if (swapDebounceRef.current) clearTimeout(swapDebounceRef.current);
    swapDebounceRef.current = setTimeout(async () => {
      setSwapSearchLoading(true);
      const { data } = await supabase
        .from("drivers_public")
        .select("id, name, cpf, avatar_url, car_model, car_plate, car_color")
        .ilike("name", `%${swapNameSearch.trim()}%`)
        .eq("active", true)
        .limit(10);
      setSwapResults((data ?? []) as SwapDriver[]);
      setSwapSearchLoading(false);
    }, 400);
    return () => { if (swapDebounceRef.current) clearTimeout(swapDebounceRef.current); };
  }, [swapNameSearch]);

  const handleSwapCpfSearch = async () => {
    const cpf = swapCpfSearch.replace(/\D/g, "");
    if (cpf.length < 11) { setSwapError("CPF deve ter 11 dígitos."); return; }
    setSwapSearchLoading(true);
    setSwapError("");
    const { data } = await supabase
      .from("drivers_public")
      .select("id, name, cpf, avatar_url, car_model, car_plate, car_color")
      .eq("cpf", cpf)
      .eq("active", true)
      .maybeSingle();
    if (!data) {
      setSwapError("Motorista não encontrado.");
    } else {
      setSelectedSwapDriver(data as SwapDriver);
    }
    setSwapSearchLoading(false);
  };

  const handleConfirmSwap = async () => {
    if (!selectedSwapDriver || !swapRideId) return;
    setSwapLoading(true);

    const ride = rides.find(r => r.id === swapRideId);

    // Update driver_rides
    await supabase.from("driver_rides").update({ driver_id: selectedSwapDriver.id } as any).eq("id", swapRideId);

    // Update queue_entry if exists
    if (ride?.queue_entry_id) {
      await supabase.from("queue_entries").update({ driver_id: selectedSwapDriver.id } as any).eq("id", ride.queue_entry_id);
    }

    setSwapLoading(false);
    setShowSwapModal(false);
    fetchRides();
  };

  const handleSaveEdit = async (rideId: string, field: string, value: string) => {
    if (field === "login" && value && unitId) {
      const now = new Date();
      const brasiliaStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const brasiliaDate = new Date(brasiliaStr);
      const year = brasiliaDate.getFullYear();
      const month = String(brasiliaDate.getMonth() + 1).padStart(2, "0");
      const day = String(brasiliaDate.getDate()).padStart(2, "0");
      const startUtc = `${year}-${month}-${day}T03:00:00.000Z`;
      const nextDay = new Date(brasiliaDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const ny = nextDay.getFullYear();
      const nm = String(nextDay.getMonth() + 1).padStart(2, "0");
      const nd = String(nextDay.getDate()).padStart(2, "0");
      const endUtc = `${ny}-${nm}-${nd}T02:59:59.999Z`;

      const { data: alreadyUsed } = await supabase
        .from("driver_rides")
        .select("id")
        .eq("unit_id", unitId)
        .eq("login", value)
        .gte("completed_at", startUtc)
        .lte("completed_at", endUtc)
        .neq("id", rideId)
        .maybeSingle();

      if (alreadyUsed) {
        const { toast } = await import("@/hooks/use-toast");
        toast({
          title: "Login já em uso",
          description: `O login "${value}" já foi atribuído a outro carregamento hoje. Ele será liberado após 00:00 (horário de Brasília).`,
          variant: "destructive",
        });
        return;
      }
    }

    setEditingField(null);
    setRides((prev) =>
      prev.map((r) => (r.id === rideId ? { ...r, [field]: value || null } : r))
    );
    await supabase.from("driver_rides").update({ [field]: value || null } as any).eq("id", rideId);
    fetchRides();
  };

  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = tbrSearch.trim();
      setTbrSearchCommitted(val);
      if (val) {
        setIsSearchLoading(true);
        await fetchSearchResults(val);
        setIsSearchLoading(false);
      }
    }
  };

  const handleClearSearch = () => {
    setTbrSearch("");
    setTbrSearchCommitted("");
    setSearchRides([]);
    setSearchTbrs({});
    setSearchUnitNames({});
  };

  const isSearchActive = tbrSearchCommitted.trim().length > 0;
  
  // All conferentes see all rides - session is only for auto-filling conferente on "Iniciar"
  const displayRides = (isSearchActive ? searchRides : rides)
    .filter(r => !driverNameFilter || r.driver_name?.toLowerCase().includes(driverNameFilter.toLowerCase()))
    .filter(r => !loginFilter || r.login === loginFilter)
    .filter(r => !routeFilter || r.route === routeFilter);

  // Extract unique routes from today's rides for filter
  const uniqueRoutes = [...new Set(rides.map(r => r.route).filter(Boolean) as string[])].sort();
  const displayTbrs = isSearchActive ? searchTbrs : tbrs;

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) { date.setHours(0, 0, 0, 0); setStartDate(date); }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) { date.setHours(23, 59, 59, 999); setEndDate(date); }
  };

  const [loginEditPopoverOpen, setLoginEditPopoverOpen] = useState<string | null>(null);

  const handleSelectLoginFromList = async (rideId: string, selectedLogin: { login: string; password: string }) => {
    setLoginEditPopoverOpen(null);
    setEditingField(null);
    // Update both login and password
    setRides((prev) =>
      prev.map((r) => (r.id === rideId ? { ...r, login: selectedLogin.login, password: selectedLogin.password } : r))
    );
    await supabase.from("driver_rides").update({ login: selectedLogin.login, password: selectedLogin.password } as any).eq("id", rideId);
    fetchRides();
  };

  const renderEditableField = (ride: RideWithDriver, field: "route" | "login" | "password", icon: React.ReactNode, label: string) => {
    const value = ride[field];
    const isEditing = editingField?.rideId === ride.id && editingField?.field === field;

    if (isEditing && field === "login") {
      return (
        <div className="flex items-center gap-2 w-full">
          {icon}
          <Popover open={loginEditPopoverOpen === ride.id} onOpenChange={(open) => {
            setLoginEditPopoverOpen(open ? ride.id : null);
            if (!open) { setEditingField(null); }
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-7 text-sm flex-1 justify-start font-normal px-2"
                ref={(el) => { if (el && loginEditPopoverOpen !== ride.id) setLoginEditPopoverOpen(ride.id); }}
              >
                {editValue || "Selecionar login..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar login..." />
                <CommandList>
                  <CommandEmpty>Nenhum login encontrado.</CommandEmpty>
                  <CommandGroup>
                    {unitLogins.map((ul) => (
                      <CommandItem
                        key={ul.login}
                        value={ul.login}
                        onSelect={() => handleSelectLoginFromList(ride.id, ul)}
                      >
                        <KeyRound className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        {ul.login}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          {icon}
          <Input
            className="h-7 text-sm flex-1"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSaveEdit(ride.id, field, editValue)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(ride.id, field, editValue); }}
            autoFocus
          />
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        {icon}
        <span><strong>{label}:</strong> {value || "—"}</span>
        <button
          onClick={() => { setEditingField({ rideId: ride.id, field }); setEditValue(value ?? ""); }}
          className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
          title={`Editar ${label.toLowerCase()}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const handleOpenDriverModal = async (driverId: string) => {
    setDriverModalOpen(true);
    setDriverModalLoading(true);
    setDriverModalData(null);
    const { data: driver } = await supabase.from("drivers_public").select("*").eq("id", driverId).maybeSingle();
    const { count: ridesCount } = await supabase.from("driver_rides").select("*", { count: "exact", head: true }).eq("driver_id", driverId);
    const { data: driverRides } = await supabase.from("driver_rides").select("id").eq("driver_id", driverId);
    let tbrsCount = 0;
    if (driverRides && driverRides.length > 0) {
      const rIds = driverRides.map(r => r.id);
      const { count } = await supabase.from("ride_tbrs").select("*", { count: "exact", head: true }).in("ride_id", rIds);
      tbrsCount = count ?? 0;
    }
    setDriverModalData({ driver, ridesCount: ridesCount ?? 0, tbrsCount });
    setDriverModalLoading(false);
  };

  // Track which TBR codes have piso entries (for red highlighting)
  const [pisoTbrCodes, setPisoTbrCodes] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    if (!unitId) return;
    const fetchPisoCodes = async () => {
      const { data } = await supabase
        .from("piso_entries")
        .select("tbr_code")
        .eq("unit_id", unitId)
        .eq("status", "open");
      setPisoTbrCodes(new Set((data ?? []).map((e: any) => e.tbr_code.toUpperCase())));
    };
    fetchPisoCodes();
  }, [unitId]);

  // Subscribe to piso_entries changes to keep red highlighting in sync
  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("piso-highlight-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "piso_entries", filter: `unit_id=eq.${unitId}` }, async () => {
        const { data } = await supabase
          .from("piso_entries")
          .select("tbr_code")
          .eq("unit_id", unitId)
          .eq("status", "open");
        setPisoTbrCodes(new Set((data ?? []).map((e: any) => e.tbr_code.toUpperCase())));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId]);

  const getTbrItemClass = (tbr: Tbr, isInActiveRide?: boolean) => {
    if (tbr._duplicate || tbr._triplicate) return "bg-red-100 text-red-700 border-red-300";
    if (tbr._yellowHighlight) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (tbrSearchCommitted.trim() && tbr.code.toLowerCase().includes(tbrSearchCommitted.trim().toLowerCase())) {
      return "bg-green-100 border-green-400 text-green-800";
    }
    // Red if TBR is in open piso entries (returned to floor) — but NOT if it's currently in an active ride
    if (!isInActiveRide && pisoTbrCodes.has(tbr.code.toUpperCase())) return "bg-red-100 text-red-700 border-red-300";
    if (tbr.trip_number && tbr.trip_number >= 3) return "bg-orange-100 text-orange-700 border-orange-300";
    if (tbr.trip_number === 2) return "bg-purple-100 text-purple-700 border-purple-300";
    return "bg-muted/50";
  };

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-x-hidden">
      <h1 className="text-2xl font-bold italic">Conferência Carregamento</h1>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative sm:w-1/4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-10"
              placeholder="Buscar TBR... (Enter)"
              value={tbrSearch}
              onChange={(e) => setTbrSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {tbrSearch && (
              <button onClick={handleClearSearch} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <div className="relative sm:w-1/4">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-10"
              placeholder="Nome do motorista..."
              value={driverNameFilter}
              onChange={(e) => setDriverNameFilter(e.target.value)}
            />
            {driverNameFilter && (
              <button onClick={() => setDriverNameFilter("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <Popover open={loginPopoverOpen} onOpenChange={setLoginPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="sm:w-1/4 h-10 justify-start gap-2 font-normal">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{loginFilter || "Login..."}</span>
                {loginFilter && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setLoginFilter(""); }}
                    className="ml-auto"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar login..." />
                <CommandList>
                  <CommandEmpty>Nenhum login encontrado.</CommandEmpty>
                  <CommandGroup>
                    {unitLogins.map((ul) => (
                      <CommandItem
                        key={ul.login}
                        value={ul.login}
                        onSelect={() => {
                          setLoginFilter(ul.login);
                          setLoginPopoverOpen(false);
                        }}
                      >
                        {ul.login}
                        {loginFilter === ul.login && <Check className="ml-auto h-4 w-4" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover open={routePopoverOpen} onOpenChange={setRoutePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="sm:w-1/4 h-10 justify-start gap-2 font-normal">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{routeFilter || "Rota..."}</span>
                {routeFilter && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setRouteFilter(""); }}
                    className="ml-auto"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar rota..." />
                <CommandList>
                  <CommandEmpty>Nenhuma rota encontrada.</CommandEmpty>
                  <CommandGroup>
                    {uniqueRoutes.map((route) => (
                      <CommandItem
                        key={route}
                        value={route}
                        onSelect={() => {
                          setRouteFilter(route);
                          setRoutePopoverOpen(false);
                        }}
                      >
                        {route}
                        {routeFilter === route && <Check className="ml-auto h-4 w-4" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-row gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 justify-start">
                <CalendarIcon className="h-4 w-4" />
                {format(startDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={handleStartDateSelect} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 justify-start">
                <CalendarIcon className="h-4 w-4" />
                {format(endDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={handleEndDateSelect} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : isSearchLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : displayRides.length === 0 ? (
        <p className="text-muted-foreground italic text-center py-12">
          {isSearchActive ? "Nenhum resultado encontrado." : "Nenhum carregamento programado hoje."}
        </p>
      ) : (
        <div>
          <div className="flex items-center justify-start gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm border bg-white" />
                <span>1ª viagem</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-purple-200 border border-purple-300" />
                <span>2ª viagem</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-orange-200 border border-orange-300" />
                <span>3ª+ viagem</span>
              </div>
            </div>
          </div>

          <div ref={scrollContainerRef} className="overflow-x-auto pb-2 [transform:rotateX(180deg)]" style={{ scrollbarWidth: 'auto', scrollbarColor: 'hsl(var(--muted-foreground) / 0.3) transparent' }}>
            <div className="flex gap-4 [transform:rotateX(180deg)]" style={{ minWidth: 'max-content' }}>
              {displayRides.map((ride) => {
                const status = ride.loading_status ?? "pending";
                const rideTbrs = displayTbrs[ride.id] ?? [];
                const isLoadingStatus = status === "loading";
                const isFinished = status === "finished";
                const isCancelled = status === "cancelled";
                const isMyRide = !!managerSession || ride.conferente_id === conferenteSession?.id;

                return (
                  <div key={ride.id} className="w-[85vw] sm:w-[320px] shrink-0">
                    <Card className={cn(
                      "relative overflow-hidden h-full transition-colors",
                      isLoadingStatus && "bg-blue-50 border-blue-200",
                      isFinished && "bg-green-50 border-green-200",
                      isCancelled && "bg-red-50 border-red-200"
                    )}>
                      <CardContent className="p-4 flex flex-col items-center gap-3">
                        {/* TBR Counter badge + Bell icon (top-left) */}
                        <div className="absolute top-2 left-2 flex flex-col items-center gap-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold gap-0.5" title="TBRs no carregamento">
                            <ScanBarcode className="h-2.5 w-2.5" />
                            {rideTbrs.length}
                          </Badge>
                          {ride.queue_entry_id && !isCancelled && !isFinished && (
                            <button
                              onClick={async () => {
                                setCallingDriverId(ride.queue_entry_id!);
                                await supabase.from("queue_entries").update({ called_at: new Date().toISOString() } as any).eq("id", ride.queue_entry_id!);
                                const { toast } = await import("@/hooks/use-toast");
                                toast({ title: "Motorista chamado!", description: "O motorista foi notificado." });
                                setTimeout(() => setCallingDriverId(null), 2000);
                              }}
                              className={cn("h-6 w-6 flex items-center justify-center rounded-full transition-colors", callingDriverId === ride.queue_entry_id ? "bg-yellow-400 text-yellow-900 animate-pulse" : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground")}
                              title="Chamar motorista"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          {managerSession && (
                            <button
                              onClick={() => handleOpenDeleteModal(ride.id)}
                              className="h-6 w-6 flex items-center justify-center rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                              title="Excluir carregamento"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isCancelled && (
                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Cancelado</Badge>
                          )}
                          {isFinished && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                          <button
                            onClick={() => handleOpenDriverModal(ride.driver_id)}
                            className="h-7 w-7 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
                            title="Ver motorista"
                          >
                            <Eye className="h-3.5 w-3.5 text-foreground" />
                          </button>
                          <Badge variant="default" className="text-sm px-3 py-0.5 font-bold">
                            <Hash className="h-3.5 w-3.5 mr-0.5" />
                            {ride.sequence_number}º
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 mt-2">
                          <Avatar className="h-16 w-16 shrink-0">
                            {ride.driver_avatar && <AvatarImage src={ride.driver_avatar} />}
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                              {(ride.driver_name ?? "M")[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="text-lg font-bold">{ride.driver_name}</h3>
                        </div>
                        {isSearchActive && ride.unit_id !== unitId && (
                          <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-[10px]">
                            {searchUnitNames[ride.unit_id] || "Outra Unidade"}
                          </Badge>
                        )}

                        <div className="w-full space-y-1.5 text-sm">
                          {(ride.car_model || ride.car_color) && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Car className="h-4 w-4 shrink-0" />
                              <span>{[ride.car_model, ride.car_color].filter(Boolean).join(" — ")}</span>
                            </div>
                          )}
                          {ride.car_plate && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Car className="h-4 w-4 shrink-0" />
                              <span className="font-mono font-bold text-foreground">{ride.car_plate}</span>
                            </div>
                          )}
                          {ride.started_at && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4 shrink-0 text-green-600" />
                              <span className="text-xs"><strong>Início:</strong> {format(new Date(ride.started_at), "dd/MM/yyyy HH:mm")}</span>
                            </div>
                          )}
                          {ride.finished_at && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4 shrink-0 text-red-600" />
                              <span className="text-xs"><strong>Término:</strong> {format(new Date(ride.finished_at), "dd/MM/yyyy HH:mm")}</span>
                            </div>
                          )}
                          {ride.started_at && ride.finished_at && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Timer className="h-4 w-4 shrink-0 text-blue-600" />
                              <span className="text-xs"><strong>Duração:</strong> {formatDuration(ride.started_at, ride.finished_at)}</span>
                            </div>
                          )}
                          {renderEditableField(ride, "route", <MapPin className="h-4 w-4 shrink-0 text-primary" />, "Rota")}
                          {renderEditableField(ride, "login", <User className="h-4 w-4 shrink-0 text-primary" />, "Login")}
                          {renderEditableField(ride, "password", <KeyRound className="h-4 w-4 shrink-0 text-primary" />, "Senha")}
                        </div>

                        {/* Conferente Select — always locked, shows auto-filled or session conferente */}
                        <div className="w-full">
                          {(() => {
                            const conferenteId = ride.conferente_id || (conferenteSession?.id ?? null);
                            const selectedConferente = conferentes.find(c => c.id === conferenteId);
                            const isLocked = !managerSession; // Only manager can change
                            if (isLocked || selectedConferente) {
                              return (
                                <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted text-sm">
                                  <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{selectedConferente?.name || "Aguardando..."}</span>
                                </div>
                              );
                            }
                            return (
                              <Select value={ride.conferente_id ?? undefined} onValueChange={(val) => handleSelectConferente(ride.id, val)}>
                                <SelectTrigger className="w-full h-9">
                                  <SelectValue placeholder="Selecionar Conferente" />
                                </SelectTrigger>
                                <SelectContent>
                                  {conferentes.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          })()}
                        </div>

                        {/* Action Buttons */}
                        {!isCancelled && (
                          <div className="w-full flex gap-2">
                            {!isLoadingStatus && !isFinished && (
                              <Button size="sm" className="flex-1 gap-1" onClick={() => setIniciarConfirmRideId(ride.id)} disabled={!ride.conferente_id && !conferenteSession}>
                                <Play className="h-3.5 w-3.5" /> Iniciar
                              </Button>
                            )}
                            {isLoadingStatus && isMyRide && (
                              <>
                                <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => setFinalizarConfirmRideId(ride.id)}>
                                  <CheckCircle className="h-3.5 w-3.5" /> Finalizar
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => setFocusedRideId(ride.id)} title="Modo foco">
                                  <Maximize2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {isFinished && isMyRide && (
                              <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={(e) => handleRetornar(ride.id, e)}>
                                <RotateCcw className="h-3.5 w-3.5" /> Retornar
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Cancel & Swap buttons (visible to all, password required for non-managers) */}
                        {!isCancelled && (
                          <div className="w-full flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => handleOpenCancelModal(ride.id)}
                            >
                              <Ban className="h-3.5 w-3.5" /> Cancelar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 gap-1"
                              onClick={() => handleOpenSwapModal(ride.id)}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" /> Trocar
                            </Button>
                          </div>
                        )}

                        {/* RTO Suggestion Bubble */}
                        {ride.route && openRtos.length > 0 && (() => {
                          const routeText = ride.route!.replace(/\s/g, "");
                          const matchingRto = openRtos.find(rto => {
                            const cepPrefix = rto.cep.substring(0, 4);
                            return routeText.includes(cepPrefix);
                          });
                          if (!matchingRto) return null;
                          const alreadyIncluded = (displayTbrs[ride.id] ?? []).some(
                            t => t.code.toUpperCase() === matchingRto.tbr_code.toUpperCase()
                          );
                          if (alreadyIncluded) return null;
                          return (
                            <div className="w-full rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-xs space-y-2">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                                <p className="text-yellow-800">
                                  <strong>Sugestão:</strong> O <span className="font-mono font-bold">{matchingRto.tbr_code}</span> possui um RTO pendente com CEP <span className="font-mono">{matchingRto.cep}</span>, compatível com esta rota. Considere incluí-lo neste carregamento.
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                                onClick={async () => {
                                  await supabase.from("ride_tbrs").insert({ ride_id: ride.id, code: matchingRto.tbr_code, trip_number: 1 } as any);
                                  await supabase.from("rto_entries").update({ status: "closed", closed_at: new Date().toISOString() } as any).eq("id", matchingRto.id);
                                  fetchRides();
                                  fetchOpenRtos();
                                }}
                              >
                                <ScanBarcode className="h-3.5 w-3.5 mr-1" /> Incluir TBR
                              </Button>
                            </div>
                          );
                        })()}

                        {/* TBR Area */}
                        {(isLoadingStatus || isFinished) && (
                          <div className="w-full space-y-2 border-t pt-3">
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-bold italic flex items-center gap-1">
                                <ScanBarcode className="h-3.5 w-3.5 text-primary" />
                                TBRs Lidos ({rideTbrs.length + (removedTbrCounts[ride.id] || 0)})
                              </p>
                              {(removedTbrCounts[ride.id] || 0) > 0 && (
                                <p className="text-xs font-bold italic flex items-center gap-1 text-green-700">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  TBRs Final ({rideTbrs.length})
                                </p>
                              )}
                            </div>
                            {rideTbrs.length > 0 && (() => {
                              const visibleTbrs = isSearchActive
                                ? rideTbrs.filter(t => t.code.toLowerCase().includes(tbrSearchCommitted.toLowerCase()))
                                : rideTbrs;
                              return (
                              <div ref={(el) => { tbrListRefs.current[ride.id] = el; }} className="max-h-32 overflow-y-auto space-y-1">
                                {visibleTbrs.map((t, i) => (
                                   <div key={t.id} className={cn("flex items-center gap-2 text-xs rounded px-2 py-1 transition-colors", getTbrItemClass(t, true))}>
                                    <span className="font-bold text-primary">{visibleTbrs.length - i}.</span>
                                    <span className="font-mono">{t.code}</span>
                                    {t.scanned_at && (
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        {(() => {
                                          const d = new Date(t.scanned_at);
                                          const hh = String(d.getHours()).padStart(2, "0");
                                          const mm = String(d.getMinutes()).padStart(2, "0");
                                          const ss = String(d.getSeconds()).padStart(2, "0");
                                          const ms = String(d.getMilliseconds()).padStart(3, "0");
                                          return `${hh}:${mm}:${ss}.${ms}`;
                                        })()}
                                      </span>
                                    )}
                                    <span className="flex-1" />
                                    {isMyRide && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <input
                                          type="checkbox"
                                          className="h-3 w-3 accent-destructive cursor-pointer"
                                          checked={selectedTbrsForDelete[ride.id]?.has(t.id) ?? false}
                                          onChange={() => toggleTbrSelection(ride.id, t.id)}
                                        />
                                        <button
                                          onClick={() => handleDeleteTbrWithPassword(t.id, ride.id)}
                                          className="text-destructive hover:text-destructive/80 shrink-0"
                                          title="Excluir TBR"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                              );
                            })()}
                            {isMyRide && getSelectedCount(ride.id) > 0 && (
                              <Button size="sm" variant="destructive" className="w-full gap-1 text-xs" onClick={() => openBatchDeleteModal(ride.id)}>
                                <Trash2 className="h-3 w-3" /> Excluir selecionados ({getSelectedCount(ride.id)})
                              </Button>
                            )}
                            {isLoadingStatus && isMyRide && (
                              <div className="flex gap-1 items-center">
                                <div className="relative flex-1 max-w-[45%] sm:max-w-none">
                                  {!manualMode[ride.id] && (
                                    <Lock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                                  )}
                                  <Input
                                    ref={(el) => { inputRefs.current[ride.id] = el; }}
                                    className={cn("h-8 text-sm font-mono", !manualMode[ride.id] && "pl-7 bg-muted/30")}
                                    placeholder={manualMode[ride.id] ? "Digite o TBR + Enter..." : "Escanear TBR..."}
                                    value={tbrInputs[ride.id] ?? ""}
                                    onChange={(e) => handleTbrInputChange(ride.id, e.target.value)}
                                    onKeyDown={(e) => handleTbrKeyDown(ride.id, e)}
                                    autoFocus
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => startCamera(ride.id)}
                                  title="Abrir câmera para escanear"
                                >
                                  <Camera className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant={manualMode[ride.id] ? "default" : "outline"}
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => setManualMode(prev => ({ ...prev, [ride.id]: !prev[ride.id] }))}
                                  title={manualMode[ride.id] ? "Modo manual (Enter para salvar)" : "Modo scanner (automático)"}
                                >
                                  <Keyboard className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Focus Mode Overlay */}
      {focusedRideId && (() => {
        const ride = rides.find(r => r.id === focusedRideId);
        if (!ride) return null;
        const isFocusMyRide = !!managerSession || ride.conferente_id === conferenteSession?.id;
        if (!isFocusMyRide) { setFocusedRideId(null); return null; }
        const focusedTbrs = tbrs[ride.id] ?? [];
        const conferenteId = ride.conferente_id || (conferenteSession?.id ?? null);
        const selectedConferente = conferentes.find(c => c.id === conferenteId);
        const focusInputRef = (el: HTMLInputElement | null) => { inputRefs.current[`focus-${ride.id}`] = el; };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setFocusedRideId(null)}>
            <div className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <Card className="bg-blue-50 border-blue-200 shadow-2xl">
                <CardContent className="p-5 flex flex-col items-center gap-3">
                  {/* Header */}
                  <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold gap-0.5" title="TBRs no carregamento">
                        <ScanBarcode className="h-2.5 w-2.5" />
                        {focusedTbrs.length}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="text-sm px-3 py-0.5 font-bold">
                        <Hash className="h-3.5 w-3.5 mr-0.5" />
                        {ride.sequence_number}º
                      </Badge>
                      <button onClick={() => setFocusedRideId(null)} className="h-7 w-7 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors" title="Minimizar">
                        <Minimize2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Driver Info */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16 shrink-0">
                      {ride.driver_avatar && <AvatarImage src={ride.driver_avatar} />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                        {(ride.driver_name ?? "M")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-lg font-bold">{ride.driver_name}</h3>
                  </div>

                  {/* Vehicle & details */}
                  <div className="w-full space-y-1.5 text-sm">
                    {ride.car_plate && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Car className="h-4 w-4 shrink-0" />
                        <span className="font-mono font-bold text-foreground">{ride.car_plate}</span>
                        {ride.car_model && <span>· {ride.car_model}</span>}
                        {ride.car_color && <span>· {ride.car_color}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <span><strong>Rota:</strong> {ride.route || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 shrink-0 text-primary" />
                      <span><strong>Login:</strong> {ride.login || "—"}</span>
                    </div>
                  </div>

                  {/* Conferente */}
                  <div className="w-full flex items-center gap-2 h-9 px-3 rounded-md border bg-muted text-sm">
                    <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                    <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{selectedConferente?.name || "Aguardando..."}</span>
                  </div>

                  {/* TBR List */}
                  <div className="w-full space-y-2 border-t pt-3">
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-bold italic flex items-center gap-1">
                        <ScanBarcode className="h-3.5 w-3.5 text-primary" />
                        TBRs Lidos ({focusedTbrs.length + (removedTbrCounts[ride.id] || 0)})
                      </p>
                      {(removedTbrCounts[ride.id] || 0) > 0 && (
                        <p className="text-xs font-bold italic flex items-center gap-1 text-green-700">
                          <CheckCircle className="h-3.5 w-3.5" />
                          TBRs Final ({focusedTbrs.length})
                        </p>
                      )}
                    </div>
                    {focusedTbrs.length > 0 && (
                      <div ref={(el) => { tbrListRefs.current[`focus-${ride.id}`] = el; }} className="max-h-48 overflow-y-auto space-y-1">
                        {focusedTbrs.map((t, i) => (
                          <div key={t.id} className={cn("flex items-center gap-2 text-xs rounded px-2 py-1 transition-colors", getTbrItemClass(t, true))}>
                            <span className="font-bold text-primary">{focusedTbrs.length - i}.</span>
                            <span className="font-mono">{t.code}</span>
                            {t.scanned_at && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {(() => {
                                  const d = new Date(t.scanned_at);
                                  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}.${String(d.getMilliseconds()).padStart(3,"0")}`;
                                })()}
                              </span>
                            )}
                            <span className="flex-1" />
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="checkbox"
                                className="h-3 w-3 accent-destructive cursor-pointer"
                                checked={selectedTbrsForDelete[ride.id]?.has(t.id) ?? false}
                                onChange={() => toggleTbrSelection(ride.id, t.id)}
                              />
                              <button onClick={() => handleDeleteTbrWithPassword(t.id, ride.id)} className="text-destructive hover:text-destructive/80 shrink-0" title="Excluir TBR">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {getSelectedCount(ride.id) > 0 && (
                      <Button size="sm" variant="destructive" className="w-full gap-1 text-xs" onClick={() => openBatchDeleteModal(ride.id)}>
                        <Trash2 className="h-3 w-3" /> Excluir selecionados ({getSelectedCount(ride.id)})
                      </Button>
                    )}

                    {/* TBR Input */}
                    <div className="flex gap-1 items-center">
                      <div className="relative flex-1">
                        {!manualMode[ride.id] && (
                          <Lock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        )}
                        <Input
                          ref={(el) => { inputRefs.current[ride.id] = el; }}
                          className={cn("h-8 text-sm font-mono", !manualMode[ride.id] && "pl-7 bg-muted/30")}
                          placeholder={manualMode[ride.id] ? "Digite o TBR + Enter..." : "Escanear TBR..."}
                          value={tbrInputs[ride.id] ?? ""}
                          onChange={(e) => handleTbrInputChange(ride.id, e.target.value)}
                          onKeyDown={(e) => handleTbrKeyDown(ride.id, e)}
                          autoFocus
                        />
                      </div>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => startCamera(ride.id)} title="Câmera">
                        <Camera className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant={manualMode[ride.id] ? "default" : "outline"} className="h-8 w-8 shrink-0" onClick={() => setManualMode(prev => ({ ...prev, [ride.id]: !prev[ride.id] }))} title={manualMode[ride.id] ? "Modo manual" : "Modo scanner"}>
                        <Keyboard className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="w-full flex gap-2 pt-2">
                    <Button size="sm" variant="destructive" className="flex-1 gap-1 font-bold" onClick={() => setFinalizarConfirmRideId(ride.id)}>
                      <CheckCircle className="h-3.5 w-3.5" /> Finalizar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => setFocusedRideId(null)}>
                      <Minimize2 className="h-3.5 w-3.5" /> Minimizar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* Driver Info Modal */}
      <Dialog open={driverModalOpen} onOpenChange={setDriverModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2">
              <User className="h-5 w-5 text-primary" /> Informações do Motorista
            </DialogTitle>
            <DialogDescription>Dados cadastrais e estatísticas</DialogDescription>
          </DialogHeader>
          {driverModalLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          ) : driverModalData?.driver ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Nome:</strong> {driverModalData.driver.name}</div>
                <div><strong>CPF:</strong> {driverModalData.driver.cpf}</div>
                <div><strong>Placa:</strong> {driverModalData.driver.car_plate}</div>
                <div><strong>Modelo:</strong> {driverModalData.driver.car_model}</div>
                <div><strong>Cor:</strong> {driverModalData.driver.car_color || "—"}</div>
                <div><strong>Email:</strong> {driverModalData.driver.email || "—"}</div>
                <div><strong>WhatsApp:</strong> {driverModalData.driver.whatsapp || "—"}</div>
                <div><strong>Endereço:</strong> {driverModalData.driver.address || "—"}</div>
              </div>
              <div className="border-t pt-3 flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{driverModalData.ridesCount}</p>
                  <p className="text-xs text-muted-foreground">Corridas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{driverModalData.tbrsCount}</p>
                  <p className="text-xs text-muted-foreground">TBRs Carregados</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground italic text-sm py-4">Motorista não encontrado.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Loading Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" /> Cancelar Carregamento
            </DialogTitle>
            <DialogDescription>
              Digite a senha do gerente para confirmar o cancelamento. Todos os TBRs serão movidos para o Retorno Piso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="cancel-pw" className="font-semibold">Senha do Gerente</Label>
              <Input
                id="cancel-pw"
                type="password"
                value={cancelPassword}
                onChange={(e) => setCancelPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmCancel(); }}
                placeholder="Digite a senha..."
                autoFocus
              />
            </div>
            <Button
              onClick={handleConfirmCancel}
              variant="destructive"
              className="w-full font-bold italic"
              disabled={cancelLoading || !cancelPassword}
            >
              {cancelLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Driver Modal */}
      <Dialog open={showSwapModal} onOpenChange={setShowSwapModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Trocar Motorista
            </DialogTitle>
            <DialogDescription>
              Busque um motorista cadastrado pelo nome ou CPF
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Name search */}
            <div className="space-y-2">
              <Label className="font-semibold">Buscar por Nome</Label>
              <Input
                placeholder="Digite o nome..."
                value={swapNameSearch}
                onChange={(e) => { setSwapNameSearch(e.target.value); setSelectedSwapDriver(null); }}
              />
              {swapSearchLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {swapResults.length > 0 && !selectedSwapDriver && (
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-1">
                  {swapResults.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedSwapDriver(d); setSwapResults([]); }}
                      className="w-full text-left p-2 rounded hover:bg-muted text-xs space-y-0.5"
                    >
                      <p className="font-bold">{d.name}</p>
                      <p className="text-muted-foreground">CPF: {maskCPF(d.cpf)} · {d.car_model} {d.car_color || ""} · {d.car_plate}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CPF search */}
            <div className="space-y-2">
              <Label className="font-semibold">Buscar por CPF</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o CPF..."
                  value={swapCpfSearch}
                  onChange={(e) => setSwapCpfSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSwapCpfSearch(); }}
                  maxLength={14}
                />
                <Button onClick={handleSwapCpfSearch} disabled={swapSearchLoading} size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {swapError && <p className="text-sm text-destructive font-semibold">{swapError}</p>}

            {selectedSwapDriver && (
              <div className="p-3 rounded-lg border border-border bg-card space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {selectedSwapDriver.avatar_url && <AvatarImage src={selectedSwapDriver.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{selectedSwapDriver.name[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-sm">{selectedSwapDriver.name}</p>
                    <p className="text-xs text-muted-foreground">CPF: {maskCPF(selectedSwapDriver.cpf)}</p>
                  </div>
                </div>
                <div className="text-xs space-y-0.5">
                  <p><strong>Veículo:</strong> {selectedSwapDriver.car_model} — {selectedSwapDriver.car_color || "N/A"}</p>
                  <p><strong>Placa:</strong> {selectedSwapDriver.car_plate}</p>
                </div>
                <Button onClick={handleConfirmSwap} disabled={swapLoading} className="w-full font-bold italic">
                  {swapLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar Troca
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Password Modal (for non-managers) */}
      <Dialog open={showSwapPasswordModal} onOpenChange={setShowSwapPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Trocar Motorista
            </DialogTitle>
            <DialogDescription>
              Digite a senha do gerente para autorizar a troca.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="swap-pw" className="font-semibold">Senha do Gerente</Label>
              <Input
                id="swap-pw"
                type="password"
                value={swapPasswordInput}
                onChange={(e) => setSwapPasswordInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && swapPasswordInput) {
                    const { data: managers } = await supabase.from("managers").select("manager_password").eq("unit_id", unitId!).eq("active", true);
                    const valid = (managers ?? []).some(m => m.manager_password === swapPasswordInput);
                    if (valid && swapPasswordRideId) {
                      setShowSwapPasswordModal(false);
                      openSwapModalDirect(swapPasswordRideId);
                    } else {
                      const { toast } = await import("@/hooks/use-toast");
                      toast({ title: "Senha incorreta", variant: "destructive" });
                    }
                  }
                }}
                placeholder="Digite a senha..."
                autoFocus
              />
            </div>
            <Button
              onClick={async () => {
                const { data: managers } = await supabase.from("managers").select("manager_password").eq("unit_id", unitId!).eq("active", true);
                const valid = (managers ?? []).some(m => m.manager_password === swapPasswordInput);
                if (valid && swapPasswordRideId) {
                  setShowSwapPasswordModal(false);
                  openSwapModalDirect(swapPasswordRideId);
                } else {
                  const { toast } = await import("@/hooks/use-toast");
                  toast({ title: "Senha incorreta", variant: "destructive" });
                }
              }}
              className="w-full font-bold italic"
              disabled={!swapPasswordInput}
            >
              Autorizar Troca
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Camera Scanner Modal */}
      <Dialog open={!!cameraOpen} onOpenChange={(open) => { if (!open) stopCamera(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" /> Scanner de Câmera
            </DialogTitle>
            <DialogDescription>Aponte a câmera para o código de barras ou QR Code do TBR</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-[20%] border-2 border-primary/50 rounded-lg pointer-events-none" />
            </div>
            {lastScannedCode && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm">
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                <span className="font-mono font-bold">{lastScannedCode}</span>
              </div>
            )}
            <Button variant="destructive" className="w-full font-bold italic" onClick={stopCamera}>
              Fechar Câmera
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete/Reset Loading Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Excluir Carregamento
            </DialogTitle>
            <DialogDescription>
              Digite a senha do gerente para confirmar. Todos os TBRs serão movidos para o Retorno Piso como "resetados". O card será removido completamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="delete-pw" className="font-semibold">Senha do Gerente</Label>
              <Input
                id="delete-pw"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDelete(); }}
                placeholder="Digite a senha..."
                autoFocus
              />
            </div>
            <Button
              onClick={handleConfirmDelete}
              variant="destructive"
              className="w-full font-bold italic"
              disabled={deleteLoading || !deletePassword}
            >
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finalizar Confirmation Modal */}
      <Dialog open={!!finalizarConfirmRideId} onOpenChange={(open) => { if (!open) setFinalizarConfirmRideId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" /> Confirmar Finalização
            </DialogTitle>
            <DialogDescription>
              Confirme com o motorista antes de finalizar o carregamento.
            </DialogDescription>
          </DialogHeader>
          {finalizarConfirmRideId && (() => {
            const ride = rides.find(r => r.id === finalizarConfirmRideId);
            const rideTbrs = tbrs[finalizarConfirmRideId] ?? [];
            return (
              <div className="space-y-3 pt-2">
                <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TBRs bipados:</span>
                    <span className="font-bold text-lg">{rideTbrs.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Login do coletor:</span>
                    <span className="font-bold font-mono">{ride?.login ?? "—"}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  ⚠ Verifique se o login utilizado no coletor da Amazon é o mesmo que aparece no card de carregamento. Isso é importante pois define o valor de pagamento do motorista.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setFinalizarConfirmRideId(null)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" className="flex-1 font-bold" onClick={() => {
                    handleFinalizar(finalizarConfirmRideId);
                    setFinalizarConfirmRideId(null);
                  }}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Confirmar e Finalizar
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete TBR Password Modal */}
      <Dialog open={showDeleteTbrPasswordModal} onOpenChange={setShowDeleteTbrPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Excluir TBR
            </DialogTitle>
            <DialogDescription>
              Digite a senha do gerente para autorizar a exclusão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="delete-tbr-pw" className="font-semibold">Senha do Gerente</Label>
              <Input
                id="delete-tbr-pw"
                type="password"
                value={deleteTbrPassword}
                onChange={(e) => setDeleteTbrPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmDeleteTbrWithPassword(); }}
                placeholder="Digite a senha..."
                autoFocus
              />
            </div>
            <Button
              onClick={confirmDeleteTbrWithPassword}
              variant="destructive"
              className="w-full font-bold italic"
              disabled={deleteTbrLoading || !deleteTbrPassword}
            >
              {deleteTbrLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Delete TBR Password Modal */}
      <Dialog open={showBatchDeleteModal} onOpenChange={setShowBatchDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Excluir TBRs em Lote
            </DialogTitle>
            <DialogDescription>
              {batchDeleteRideId && `${getSelectedCount(batchDeleteRideId)} TBR(s) selecionado(s). Digite a senha do gerente para autorizar.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="batch-delete-pw" className="font-semibold">Senha do Gerente</Label>
              <Input
                id="batch-delete-pw"
                type="password"
                value={batchDeletePassword}
                onChange={(e) => setBatchDeletePassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmBatchDelete(); }}
                placeholder="Digite a senha..."
                autoFocus
              />
            </div>
            <Button
              onClick={confirmBatchDelete}
              variant="destructive"
              className="w-full font-bold italic"
              disabled={batchDeleteLoading || !batchDeletePassword}
            >
              {batchDeleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Exclusão em Lote
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Iniciar Confirmation Modal */}
      <Dialog open={!!iniciarConfirmRideId} onOpenChange={(open) => { if (!open) setIniciarConfirmRideId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic">Confirmar Início de Carregamento</DialogTitle>
            <DialogDescription className="text-sm">
              {(() => {
                const ride = rides.find(r => r.id === iniciarConfirmRideId);
                const activeConf = conferenteSession?.name || conferentes.find(c => c.id === ride?.conferente_id)?.name;
                return (
                  <>
                    Você confirma que <span className="font-semibold text-foreground">{activeConf || "o conferente selecionado"}</span> irá conferir o carregamento do motorista <span className="font-semibold text-foreground">{ride?.driver_name || "—"}</span>?
                    <br /><br />
                    <span className="text-xs text-muted-foreground">Certifique-se de que o conferente ativo corresponde ao usuário que realizará a bipagem dos TBRs.</span>
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setIniciarConfirmRideId(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (iniciarConfirmRideId) {
                  handleIniciar(iniciarConfirmRideId);
                  setIniciarConfirmRideId(null);
                }
              }}
              className="gap-1 font-bold italic"
            >
              <Play className="h-4 w-4" /> Confirmar e Iniciar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConferenciaCarregamentoPage;
