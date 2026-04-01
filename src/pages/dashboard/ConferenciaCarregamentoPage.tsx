import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useDisputeStore } from "@/stores/use-dispute-store";
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
import { Car, MapPin, User, Users, Hash, KeyRound, Play, CheckCircle, RotateCcw, ScanBarcode, UserCheck, Clock, Search, X, CalendarIcon, Timer, Pencil, Eye, Lightbulb, Keyboard, Ban, ArrowRightLeft, Loader2, Bell, Lock, Camera, Trash2, Check, Maximize2, Minimize2, AlertTriangle, History, CheckSquare, Package, GripVertical, Download } from "lucide-react";
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
import QrViewfinder from "@/components/ui/QrViewfinder";


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
  completed_at?: string;
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
  is_rescue?: boolean;
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

const shortName = (name: string | undefined | null): string => {
  if (!name) return "Motorista";
  const parts = name.trim().split(/\s+/);
  return parts.length <= 2 ? name : `${parts[0]} ${parts[1]}`;
};

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
  } catch { }
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
  } catch { }
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
  const { setNeedsCheck, setShowDisputeModal } = useDisputeStore();
  const [rides, setRides] = useState<RideWithDriver[]>([]);
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [tbrs, setTbrs] = useState<Record<string, Tbr[]>>({});
  const [tbrInputs, setTbrInputs] = useState<Record<string, string>>({});
  const [tbrSearch, setTbrSearch] = useState("");
  const [tbrSearchCommitted, setTbrSearchCommitted] = useState("");
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [endDate, setEndDate] = useState<Date>(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; });
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
  const [conferenteFilter, setConferenteFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [routePopoverOpen, setRoutePopoverOpen] = useState(false);
  const [loginPopoverOpen, setLoginPopoverOpen] = useState(false);
  const [conferentePopoverOpen, setConferentePopoverOpen] = useState(false);
  const [unitLogins, setUnitLogins] = useState<{ login: string; password: string }[]>([]);
  const [iniciarConfirmRideId, setIniciarConfirmRideId] = useState<string | null>(null);
  const [parkingModalOpen, setParkingModalOpen] = useState(false);
  const [selectedQueueIdForCall, setSelectedQueueIdForCall] = useState<string | null>(null);
  const [parkingSpotInput, setParkingSpotInput] = useState("");
  const unitId = unitSession?.id;
  const [openRtos, setOpenRtos] = useState<OpenRto[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [focusedRideId, setFocusedRideId] = useState<string | null>(null);
  const currentRideIdsRef = useRef<string[]>([]);

  const requestIdRef = useRef<number>(0);
  // Persistent scan counter: rideId → code → totalScans (survives timeout cleanup)
  const scanCountsRef = useRef<Record<string, Record<string, number>>>({});

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

  // Retroactive loading
  const [showRetroModal, setShowRetroModal] = useState(false);
  const [retroDate, setRetroDate] = useState<Date | undefined>(startDate);
  const [retroDriverSearch, setRetroDriverSearch] = useState("");
  const [retroDriverResults, setRetroDriverResults] = useState<SwapDriver[]>([]);
  const [retroSelectedDriver, setRetroSelectedDriver] = useState<SwapDriver | null>(null);
  const [retroLoading, setRetroLoading] = useState(false);
  const [retroSearchLoading, setRetroSearchLoading] = useState(false);
  const retroDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draggedRideId, setDraggedRideId] = useState<string | null>(null);
  const [dragOverRideId, setDragOverRideId] = useState<string | null>(null);
  const [focusSearchActive, setFocusSearchActive] = useState(false);
  const [focusSearchInput, setFocusSearchInput] = useState("");

  // Finalizar confirmation modal
  const [finalizarConfirmRideId, setFinalizarConfirmRideId] = useState<string | null>(null);

  // Photo modal
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);

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

  // Batch insucesso
  const [showBatchInsucessoModal, setShowBatchInsucessoModal] = useState(false);
  const [batchInsucessoRideId, setBatchInsucessoRideId] = useState<string | null>(null);
  const [batchInsucessoReason, setBatchInsucessoReason] = useState("");
  const [batchInsucessoLoading, setBatchInsucessoLoading] = useState(false);
  const [batchInsucessoReasons, setBatchInsucessoReasons] = useState<string[]>([]);

  // Camera scanner state
  const [cameraOpen, setCameraOpen] = useState<string | null>(null); // rideId or null
  const [lastScannedCode, setLastScannedCode] = useState<string>("");
  // Transfer TBR modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState<{
    code: string;
    newRideId: string;
    oldRideId: string;
    driverName: string;
    date: string;
    conferenteName: string;
  } | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  // Search/locate mode per ride
  const [searchLocateMode, setSearchLocateMode] = useState<Record<string, boolean>>({});
  const [searchLocateInput, setSearchLocateInput] = useState<Record<string, string>>({});
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTbrRef = useRef<(rideId: string, code: string) => Promise<void>>();

  // Driver historical average TBRs/day (30 days)
  const [driverAvgMap, setDriverAvgMap] = useState<Map<string, number>>(new Map());

  // 30-second countdown for cards auto-refresh
  const [cardsCountdown, setCardsCountdown] = useState(30);


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
    } catch { }
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

          // Resume scanning after a shorter delay for faster flow
          setTimeout(() => { scanningPaused = false; }, 800);
        } catch { }
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

  const fetchRides = useCallback(async (showLoading = true, overrideStartDate?: Date, overrideEndDate?: Date) => {
    if (!unitId) return;

    if (showLoading) setIsLoading(true);

    const sDate = overrideStartDate || startDate;
    const eDate = overrideEndDate || endDate;

    // Concurrency control: only apply results from the latest request
    const thisRequestId = ++requestIdRef.current;

    const { data: rawRides } = await supabase
      .from("driver_rides")
      .select("id, unit_id, route, login, password, sequence_number, driver_id, conferente_id, loading_status, started_at, finished_at, completed_at, queue_entry_id")
      .eq("unit_id", unitId)
      .gte("completed_at", sDate.toISOString())
      .lte("completed_at", eDate.toISOString())
      .order("completed_at", { ascending: true })
      .order("sequence_number", { ascending: true });

    // Stale response check
    if (thisRequestId !== requestIdRef.current) return;

    if (!rawRides) { 
      setRides([]); 
      setTbrs({});
      processedCodesRef.current = {};
      setIsLoading(false); 
      return; 
    }

    const driverIds = [...new Set(rawRides.map((r) => r.driver_id))];
    const rideIds = rawRides.map((r) => r.id);

    // Fetch drivers and TBR data in parallel
    const [driversResult, tbrsResult] = await Promise.all([
      supabase
        .from("drivers_public")
        .select("id, name, avatar_url, car_model, car_plate, car_color")
        .in("id", driverIds),
      rideIds.length > 0 
        ? (async () => {
            const { fetchAllRowsWithIn } = await import("@/lib/supabase-helpers");
            return fetchAllRowsWithIn<any>(
              (ids) => (from, to) =>
                supabase.from("ride_tbrs").select("id, code, scanned_at, trip_number, highlight, ride_id")
                  .in("ride_id", ids)
                  .order("id")
                  .range(from, to),
              rideIds
            );
          })()
        : Promise.resolve([])
    ]);

    // Stale response check
    if (thisRequestId !== requestIdRef.current) return;

    const driverMap = new Map((driversResult.data ?? []).map((d) => [d.id, d]));
    
    // Process rides
    const mappedRides = rawRides.map((r) => {
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

    // Process TBRs
    const groupedTbrs: Record<string, Tbr[]> = {};
    const newProcessed: Record<string, Set<string>> = {};
    
    (tbrsResult ?? []).forEach((t: any) => {
      if (deletingRef.current.has(t.id)) return;
      if (!groupedTbrs[t.ride_id]) {
        groupedTbrs[t.ride_id] = [];
        newProcessed[t.ride_id] = new Set();
      }
      const tbrObj = {
        ...t,
        trip_number: t.trip_number ?? 1,
        _yellowHighlight: t.highlight === "yellow",
      };
      groupedTbrs[t.ride_id].push(tbrObj);
      newProcessed[t.ride_id].add(t.code.toUpperCase());
    });

    // Atomic update of all relevant states
    setRides(mappedRides);
    setTbrs(groupedTbrs);
    processedCodesRef.current = newProcessed;
    currentRideIdsRef.current = mappedRides.map(r => r.id);

    setLockedConferenteIds(prev => {
      const next = new Set(prev);
      mappedRides.forEach(r => { if (r.conferente_id) next.add(r.id); });
      return next;
    });

    setIsLoading(false);
  }, [unitId, startDate, endDate]);

  // Stable driver IDs key - only changes when the set of drivers changes, not on every TBR scan
  const stableDriverIdsKey = useMemo(() => {
    const ids = [...new Set(rides.map(r => r.driver_id))].sort();
    return ids.join(",");
  }, [rides]);

  // Fetch historical average TBRs/day per driver (30 days)
  useEffect(() => {
    if (!unitId || stableDriverIdsKey === "") { setDriverAvgMap(new Map()); return; }
    const driverIds = stableDriverIdsKey.split(",");
    if (driverIds.length === 0) return;

    const fetchAvg = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: histRides } = await supabase
        .from("driver_rides")
        .select("id, driver_id, completed_at")
        .eq("unit_id", unitId)
        .in("driver_id", driverIds)
        .gte("completed_at", since.toISOString())
        .eq("loading_status", "finished");

      if (!histRides || histRides.length === 0) { setDriverAvgMap(new Map()); return; }

      const histRideIds = histRides.map(r => r.id);
      const { data: counts } = await supabase.rpc("get_ride_tbr_counts", { p_ride_ids: histRideIds });

      const countMap = new Map<string, number>();
      (counts ?? []).forEach((c: any) => countMap.set(c.ride_id, Number(c.tbr_count)));

      const driverDays = new Map<string, Map<string, number>>();
      histRides.forEach(r => {
        const day = r.completed_at.slice(0, 10);
        if (!driverDays.has(r.driver_id)) driverDays.set(r.driver_id, new Map());
        const dayMap = driverDays.get(r.driver_id)!;
        dayMap.set(day, (dayMap.get(day) ?? 0) + (countMap.get(r.id) ?? 0));
      });

      const avgMap = new Map<string, number>();
      driverDays.forEach((dayMap, dId) => {
        const days = dayMap.size;
        const total = [...dayMap.values()].reduce((s, v) => s + v, 0);
        avgMap.set(dId, days > 0 ? Math.round(total / days) : 0);
      });
      setDriverAvgMap(avgMap);
    };
    fetchAvg();
  }, [unitId, stableDriverIdsKey]);

  const [searchUnitNames, setSearchUnitNames] = useState<Record<string, string>>({});

  const fetchSearchResults = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchRides([]);
      setSearchTbrs({});
      setSearchUnitNames({});
      return;
    }

    // Global search: find TBRs across ALL units
    const { fetchAllRows: fetchAll } = await import("@/lib/supabase-helpers");
    const matchingTbrs = await fetchAll<any>((from, to) =>
      supabase.from("ride_tbrs").select("id, code, scanned_at, ride_id, trip_number, highlight").ilike("code", `%${searchTerm.trim()}%`).order("scanned_at", { ascending: false }).range(from, to)
    );

    if (matchingTbrs.length === 0) { setSearchRides([]); setSearchTbrs({}); setSearchUnitNames({}); return; }

    const matchingRideIds = [...new Set(matchingTbrs.map(t => t.ride_id))];

    const { data: ridesData } = await supabase
      .from("driver_rides")
      .select("id, unit_id, route, login, password, sequence_number, driver_id, conferente_id, loading_status, started_at, finished_at, completed_at, queue_entry_id")
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

    const allTbrData = await fetchAll<any>((from, to) =>
      supabase.from("ride_tbrs").select("id, code, scanned_at, ride_id, trip_number, highlight").in("ride_id", matchingRideIds).order("scanned_at", { ascending: false }).range(from, to)
    );

    const grouped: Record<string, Tbr[]> = {};
    allTbrData.forEach((t: any) => {
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
  const fetchRidesRef = useRef(fetchRides);
  const fetchOpenRtosRef = useRef(fetchOpenRtos);
  useEffect(() => {
    fetchRidesRef.current = fetchRides;
    fetchOpenRtosRef.current = fetchOpenRtos;
  }, [fetchRides, fetchOpenRtos]);

  useEffect(() => { fetchRides(); }, [fetchRides]);

  // 2-second countdown timer: refreshes only cards (fetchRides) when it hits 0
  useEffect(() => {
    const timer = setInterval(() => {
      setCardsCountdown(prev => {
        if (prev <= 1) {
          // Only auto-refresh if realtime lock is not active
          if (Date.now() > realtimeLockUntil.current) {
            fetchRidesRef.current(false);
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);


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

  // Unit logins fetch removed from here to reduce noise if redundant, but keeping the refs logic



  const handleSelectConferente = async (rideId: string, conferenteId: string) => {
    // Lock immediately using state to force re-render
    setLockedConferenteIds((prev) => new Set(prev).add(rideId));
    // Optimistic update to lock dropdown immediately
    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, conferente_id: conferenteId } : r));
    await supabase.from("driver_rides").update({ conferente_id: conferenteId } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleIniciar = async (rideId: string) => {
    const { data: currentRide } = await supabase
      .from("driver_rides")
      .select("loading_status, conferente_id")
      .eq("id", rideId)
      .maybeSingle();

    if (currentRide?.loading_status === "loading" && currentRide.conferente_id && currentRide.conferente_id !== conferenteSession?.id) {
      const other = conferentes.find(c => c.id === currentRide.conferente_id)?.name || "outro conferente";
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Já em conferência", description: `Este carregamento já está sendo conferido por ${other}.`, variant: "destructive" });
      fetchRides();
      return;
    }

    const conferenteId = currentRide?.conferente_id || conferenteSession?.id;
    
    // Check if it's a retroactive ride (no queue_entry_id) to preserve its day
    const ride = rides.find(r => r.id === rideId);
    const now = new Date();
    let startAt = now.toISOString();

    if (ride && !ride.queue_entry_id && ride.completed_at) {
      const cDate = new Date(ride.completed_at);
      const sAt = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
      startAt = sAt.toISOString();
    }

    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, loading_status: "loading", started_at: startAt, conferente_id: conferenteId || r.conferente_id } : r));
    if (conferenteId) setLockedConferenteIds((prev) => new Set(prev).add(rideId));
    setFocusedRideId(rideId);
    
    if (conferenteId && !currentRide?.conferente_id) {
      await supabase.from("driver_rides").update({ loading_status: "loading", started_at: startAt, conferente_id: conferenteId } as any).eq("id", rideId);
    } else {
      await supabase.from("driver_rides").update({ loading_status: "loading", started_at: startAt } as any).eq("id", rideId);
    }
    fetchRides();
  };

  const handleFinalizar = async (rideId: string) => {
    setFocusedRideId(null);
    const ride = rides.find(r => r.id === rideId);
    const now = new Date();
    let finishAt = now.toISOString();

    if (ride && !ride.queue_entry_id && ride.completed_at) {
      const cDate = new Date(ride.completed_at);
      const fAt = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
      finishAt = fAt.toISOString();
    }

    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, loading_status: "finished", finished_at: finishAt } : r));
    await supabase.from("driver_rides").update({ loading_status: "finished", finished_at: finishAt } as any).eq("id", rideId);
    fetchRides();
    
    // Trigger dispute modal check after finishing a ride
    setNeedsCheck(true);
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

    // Optimistic UI removal + sync processedCodesRef + reset scan count
    if (tbrToDelete) {
      processedCodesRef.current[rideId]?.delete(tbrToDelete.code.toUpperCase());
      // Reset scan count so re-scanning starts fresh
      if (scanCountsRef.current[rideId]) {
        delete scanCountsRef.current[rideId][tbrToDelete.code.toUpperCase()];
      }
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

        const success = (closedPiso as any)?.id; // Check if closedPiso exists
        if (success) {
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
    const { validateManagerPassword } = await import("@/lib/validate-manager-password");
    const { valid } = await validateManagerPassword(unitId, deleteTbrPassword);
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
    const { validateManagerPassword } = await import("@/lib/validate-manager-password");
    const { valid } = await validateManagerPassword(unitId, batchDeletePassword);
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

  // Batch insucesso helpers
  const BATCH_INSUCESSO_DEFAULT_REASONS = [
    "1ª tentativa de entrega",
    "2ª tentativa de entrega",
    "3ª tentativa de entrega",
    "Endereço não localizado",
  ];

  const openBatchInsucessoModal = async (rideId: string) => {
    setBatchInsucessoRideId(rideId);
    setBatchInsucessoReason("");
    setShowBatchInsucessoModal(true);
    // Load custom reasons
    if (unitId) {
      const { data } = await supabase.from("piso_reasons").select("label").eq("unit_id", unitId).order("created_at");
      const custom = (data ?? []).map((r: any) => r.label);
      setBatchInsucessoReasons([...BATCH_INSUCESSO_DEFAULT_REASONS, ...custom]);
    } else {
      setBatchInsucessoReasons(BATCH_INSUCESSO_DEFAULT_REASONS);
    }
  };

  const confirmBatchInsucesso = async () => {
    if (!batchInsucessoRideId || !unitId || !batchInsucessoReason) return;
    setBatchInsucessoLoading(true);
    const ride = rides.find(r => r.id === batchInsucessoRideId);
    const selectedIds = [...(selectedTbrsForDelete[batchInsucessoRideId] ?? [])];
    const rideTbrsList = tbrs[batchInsucessoRideId] ?? [];
    const selectedTbrItems = rideTbrsList.filter(t => selectedIds.includes(t.id));

    if (selectedTbrItems.length === 0) {
      setBatchInsucessoLoading(false);
      return;
    }

    const conferenteId = conferenteSession?.id || ride?.conferente_id || null;
    const inserts = selectedTbrItems.map(t => ({
      tbr_code: t.code,
      unit_id: unitId,
      reason: batchInsucessoReason,
      driver_name: ride?.driver_name ?? null,
      route: ride?.route ?? null,
      ride_id: batchInsucessoRideId,
      conferente_id: conferenteId,
    }));

    const { error } = await supabase.from("piso_entries").insert(inserts as any);
    if (error) {
      const { toast } = await import("@/hooks/use-toast");
      toast({ title: "Erro ao lançar insucessos", description: error.message, variant: "destructive" });
      setBatchInsucessoLoading(false);
      return;
    }

    // Auto-excluir Reativos para TBRs que voltaram como insucesso (pacotes não entregues)
    const insucessoCodes = selectedTbrItems.map(t => t.code);
    for (const code of insucessoCodes) {
      await supabase.from("reativo_entries").delete()
        .ilike("tbr_code", code)
        .eq("unit_id", unitId!);
    }

    setSelectedTbrsForDelete(prev => ({ ...prev, [batchInsucessoRideId!]: new Set() }));
    setShowBatchInsucessoModal(false);
    setBatchInsucessoLoading(false);
    await fetchRides();
    const { toast } = await import("@/hooks/use-toast");
    toast({ title: `${selectedTbrItems.length} TBR(s) enviado(s) para insucessos` });
  };

  const handleConfirmTransfer = async () => {
    if (!transferData || !unitId) return;
    setTransferLoading(true);

    // Always use the SECURITY DEFINER RPC — direct client updates are blocked by RLS
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("transfer_tbr_to_ride", {
      p_code: transferData.code,
      p_new_ride_id: transferData.newRideId,
      p_unit_id: unitId,
    });

    console.log("Transfer RPC result:", rpcResult, "error:", rpcError);

    if (rpcError || !rpcResult?.success) {
      const { toast } = await import("@/hooks/use-toast");
      toast({
        title: "Erro na transferência",
        description: rpcResult?.error || rpcError?.message || "Não foi possível transferir o TBR.",
        variant: "destructive",
      });
      setTransferLoading(false);
      return;
    }

    playSuccessBeep();
    const savedNewRideId = transferData.newRideId;
    setShowTransferModal(false);
    setTransferData(null);
    setTransferLoading(false);

    const { toast } = await import("@/hooks/use-toast");
    toast({ title: "✅ TBR transferido com sucesso!" });

    realtimeLockUntil.current = Date.now() + 5000;
    await fetchRides();
    setTimeout(() => {
      inputRefs.current[savedNewRideId]?.focus();
      scrollTbrList(savedNewRideId);
    }, 200);
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

  const exportCsv = () => {
    const rows: string[][] = [["TBR", "Motorista", "Hora da Leitura", "Status", "Sequência"]];
    rides.forEach(ride => {
      const rideTbrList = tbrs[ride.id] ?? [];
      if (rideTbrList.length === 0) {
        rows.push(["", ride.driver_name ?? "", "", ride.loading_status ?? "", String(ride.sequence_number ?? "")]);
      } else {
        rideTbrList.forEach((tbr, idx) => {
          const d = new Date(tbr.scanned_at);
          const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
          const status = tbr._yellowHighlight ? "Insucesso" : ride.loading_status === "finished" ? "Finalizado" : ride.loading_status === "cancelled" ? "Cancelado" : "Carregado";
          rows.push([tbr.code, idx === 0 ? (ride.driver_name ?? "") : "", hora, status, idx === 0 ? String(ride.sequence_number ?? "") : ""]);
        });
      }
    });
    const csvContent = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Carregamento_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragStart = (rideId: string) => {
    if (!managerSession) return;
    setDraggedRideId(rideId);
  };

  const handleDragOver = (e: React.DragEvent, rideId: string) => {
    if (!managerSession) return;
    e.preventDefault();
    if (draggedRideId !== rideId) {
      setDragOverRideId(rideId);
    }
  };

  const handleDrop = async (targetRideId: string) => {
    if (!managerSession || !draggedRideId || draggedRideId === targetRideId) {
      setDraggedRideId(null);
      setDragOverRideId(null);
      return;
    }

    const currentRides = [...displayRides];
    const draggedIdx = currentRides.findIndex(r => r.id === draggedRideId);
    const targetIdx = currentRides.findIndex(r => r.id === targetRideId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    // LOCAL REORDER
    const [draggedRide] = currentRides.splice(draggedIdx, 1);
    currentRides.splice(targetIdx, 0, draggedRide);

    // PERSIST NEW SEQUENCES
    // Ensure we only update rides that actually changed their position to save RPCs/Requests
    const updates = currentRides.map((r, index) => {
      const newSeq = index + 1;
      return { id: r.id, sequence_number: newSeq };
    }).filter((upd, idx) => {
      // Find the original ride at this position
      return displayRides[idx]?.id !== upd.id || displayRides[idx]?.sequence_number !== upd.sequence_number;
    });

    // Optimistic Update
    setRides(prev => {
      const updated = [...prev];
      currentRides.forEach((r, idx) => {
        const foundIdx = updated.findIndex(u => u.id === r.id);
        if (foundIdx !== -1) updated[foundIdx] = { ...updated[foundIdx], sequence_number: idx + 1 };
      });
      return updated.sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
    });

    setDraggedRideId(null);
    setDragOverRideId(null);

    // Database updates
    for (const upd of updates) {
      await supabase.from("driver_rides").update({ sequence_number: upd.sequence_number }).eq("id", upd.id);
    }

    fetchRides();
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

      // Persistent scan count (independent of local state timing)
      if (!scanCountsRef.current[rideId]) scanCountsRef.current[rideId] = {};
      const prevScanCount = scanCountsRef.current[rideId][code.toUpperCase()] || 0;
      const totalScans = prevScanCount + 1;
      scanCountsRef.current[rideId][code.toUpperCase()] = totalScans;

      if (totalScans === 1 && count === 0) {
        // OPTIMISTIC UPDATE FIRST — show TBR immediately
        processedCodesRef.current[rideId]?.add(code.toUpperCase());
        realtimeLockUntil.current = Date.now() + 3000;

        setTbrs((prev) => ({
          ...prev,
          [rideId]: [newTbr, ...(prev[rideId] ?? [])],
        }));
        setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
        setTimeout(() => { inputRefs.current[rideId]?.focus(); scrollTbrList(rideId); }, 50);

        // CALL NEW RPC (Consolidates all previous parallel calls)
        const { data: rpcRes, error: rpcError } = await (supabase as any).rpc('process_tbr_scan', {
          p_ride_id: rideId,
          p_code: code,
          p_unit_id: unitId
        });

        if (rpcError || (rpcRes && !(rpcRes as any).success)) {
          // ROLLBACK on error
          setTbrs((prev) => ({ ...prev, [rideId]: (prev[rideId] ?? []).filter(t => t.id !== tempId) }));
          processedCodesRef.current[rideId]?.delete(code.toUpperCase());
          scanCountsRef.current[rideId][code.toUpperCase()] = 0;
          playErrorBeep();

          let errorMsg = (rpcRes as any)?.error || rpcError?.message;
          console.log("Scan error received:", errorMsg);

          const isConflictError = 
            errorMsg?.includes("already exists") ||
            errorMsg?.includes("outro carregamento") ||
            errorMsg?.includes("Duplicate") ||
            errorMsg?.includes("ja esta vinculado") ||
            errorMsg?.includes("já está vinculado");

          if (isConflictError) {
            // Use in-memory rides/tbrs data to find the conflict (no RPC needed)
            const upperCode = code.toUpperCase().trim();
            let conflictRideId = "unknown";
            let driverName = "outro motorista";
            let conferenteName = "outro conferente";
            let conflictDate = format(new Date(), "dd/MM/yyyy HH:mm");

            // Search across all currently loaded rides for the conflicting TBR
            for (const otherRide of rides) {
              if (otherRide.id === rideId) continue;
              const otherRideTbrs = tbrs[otherRide.id] ?? [];
              const found = otherRideTbrs.find(t => t.code.toUpperCase().trim() === upperCode);
              if (found) {
                conflictRideId = otherRide.id;
                driverName = otherRide.driver_name || "Motorista Desconhecido";
                const conf = conferentes.find(c => c.id === otherRide.conferente_id);
                conferenteName = conf?.name || "Conferente Desconhecido";
                conflictDate = format(new Date(found.scanned_at || new Date()), "dd/MM/yyyy HH:mm");
                break;
              }
            }

            setTransferData({
              code: upperCode,
              newRideId: rideId,
              oldRideId: conflictRideId,
              driverName,
              conferenteName,
              date: conflictDate,
            });
            setShowTransferModal(true);
            return;
          }

          const { toast } = await import("@/hooks/use-toast");
          toast({ title: "Erro ao salvar TBR", description: errorMsg, variant: "destructive" });
          return;
        }

        // Handle success results from RPC
        const result = rpcRes as any;
        if (result.is_duplicate) {
          // RPC says it was already in this ride, but local state might have been stale
          // Just cleanup the temp entry if it's already there
          setTbrs((prev) => ({ ...prev, [rideId]: (prev[rideId] ?? []).filter(t => t.id !== tempId) }));
        } else if (result.trip_number > 1) {
          playReincidenceBeep();
          setTbrs((prev) => ({
            ...prev,
            [rideId]: (prev[rideId] ?? []).map(t => t.id === tempId ? { ...t, trip_number: result.trip_number } : t)
          }));
        } else {
          playSuccessBeep();
        }

        // Guarantee: always close any open insucesso (piso_entry) and rto_entry for this TBR.
        // This ensures the insucesso list is cleaned up even if the DB function version
        // on Lovable Cloud doesn't include this logic.
        if (unitId) {
          const codeUpper = code.trim().toUpperCase();
          await supabase
            .from('piso_entries' as any)
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .ilike('tbr_code', codeUpper)
            .eq('status', 'open')
            .eq('unit_id', unitId);
          await supabase
            .from('rto_entries' as any)
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .ilike('tbr_code', codeUpper)
            .eq('status', 'open')
            .eq('unit_id', unitId);
        }
      } else if (totalScans >= 2 && totalScans < 5) {
        // 2nd-4th beep: temporary red warning, NO yellow — accidental double-scan is common
        newTbr._duplicate = true;
        realtimeLockUntil.current = Date.now() + 15000;
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
      } else if (totalScans >= 5) {
        // 5x beep: don't add the 5th TBR at all. Remove duplicates, keep the REAL (oldest) entry as yellow.
        playErrorBeep();
        const sorted = [...occurrences].sort((a, b) =>
          new Date(a.scanned_at || 0).getTime() - new Date(b.scanned_at || 0).getTime()
        );
        const realEntry = sorted[0]; // oldest = real DB entry
        const duplicateIds = sorted.slice(1).map(t => t.id);
        if (realEntry?.id) {
          supabase.from("ride_tbrs").update({ highlight: "yellow" }).eq("id", realEntry.id).then(() => { });
        }
        for (const dupId of duplicateIds) {
          if (dupId) supabase.from("ride_tbrs").delete().eq("id", dupId).then(() => { });
        }
        realtimeLockUntil.current = Date.now() + 15000;
        const idsToRemove = new Set(duplicateIds.filter(Boolean));
        setTbrs((prev) => {
          const list = prev[rideId] ?? [];
          const filtered = list
            .filter(t => !idsToRemove.has(t.id))
            .map(t => t.id === realEntry?.id ? { ...t, _triplicate: false, _duplicate: false, _yellowHighlight: true } : t);
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

  fetchRidesRef.current = fetchRides;
  fetchOpenRtosRef.current = fetchOpenRtos;

  // Instant duplicate detection BEFORE queue — synchronous, no DB calls
  const handleDuplicateInstant = useCallback((rideId: string, code: string): boolean => {
    const upper = code.toUpperCase();
    if (!upper.startsWith("TBR")) return false;

    const alreadyTracked = processedCodesRef.current[rideId]?.has(upper);
    const currentTbrs = tbrs[rideId] ?? [];
    const existsInList = currentTbrs.some(t => t.code.toUpperCase() === upper && !t._duplicate);

    if (!alreadyTracked && !existsInList) return false; // new code — not a duplicate

    // It's a duplicate — handle instantly
    if (!scanCountsRef.current[rideId]) scanCountsRef.current[rideId] = {};
    const prevCount = scanCountsRef.current[rideId][upper] || 1; // at least 1 since it exists
    const totalScans = prevCount + 1;
    scanCountsRef.current[rideId][upper] = totalScans;

    playErrorBeep();

    if (totalScans >= 5) {
      // 3rd+ scan: mark original as yellow permanently
      const occurrences = currentTbrs.filter(t => t.code.toUpperCase() === upper);
      const sorted = [...occurrences].sort((a, b) =>
        new Date(a.scanned_at || 0).getTime() - new Date(b.scanned_at || 0).getTime()
      );
      const realEntry = sorted[0];
      const duplicateIds = sorted.slice(1).map(t => t.id);

      if (realEntry?.id) {
        supabase.from("ride_tbrs").update({ highlight: "yellow" }).eq("id", realEntry.id).then(() => { });
      }
      for (const dupId of duplicateIds) {
        if (dupId) supabase.from("ride_tbrs").delete().eq("id", dupId).then(() => { });
      }

      realtimeLockUntil.current = Date.now() + 15000;

      const idsToRemove = new Set(duplicateIds.filter(Boolean));
      setTbrs((prev) => {
        const list = prev[rideId] ?? [];
        const filtered = list
          .filter(t => !idsToRemove.has(t.id))
          .map(t => t.id === realEntry?.id ? { ...t, _triplicate: false, _duplicate: false, _yellowHighlight: true } : t);
        return { ...prev, [rideId]: filtered };
      });
    } else {
      // 2nd scan: temporary red flash
      const tempId = crypto.randomUUID();
      const tempTbr: Tbr = { id: tempId, code, scanned_at: new Date().toISOString(), _duplicate: true };

      realtimeLockUntil.current = Date.now() + 15000;

      setTbrs((prev) => {
        const updated = (prev[rideId] ?? []).map(t =>
          t.code.toUpperCase() === upper ? { ...t, _duplicate: true } : t
        );
        return { ...prev, [rideId]: [tempTbr, ...updated] };
      });

      setTimeout(() => {
        setTbrs((prev) => {
          const list = prev[rideId] ?? [];
          const filtered = list
            .filter(t => t.id !== tempId)
            .map(t => t.code.toUpperCase() === upper ? { ...t, _duplicate: false } : t);
          return { ...prev, [rideId]: filtered };
        });
      }, 1000);
    }

    return true; // was a duplicate — don't enqueue
  }, [tbrs]);

  const processQueue = useCallback(async (rideId: string) => {
    if (processingQueueRef.current[rideId]) return;
    processingQueueRef.current[rideId] = true;

    while (queueRef.current[rideId]?.length > 0) {
      // Delay to accumulate extremely fast scanner inputs (e.g. 100-300ms window)
      await new Promise(r => setTimeout(r, 200));

      const batchCodes = queueRef.current[rideId].splice(0, 20); // up to 20 at a time
      if (batchCodes.length === 0) continue;

      try {
        // Since `saveTbr` does complex individual logic (trip_number, dupes, toast errors),
        // we execute them in parallel via Promise.all for the batch, but they still resolve individually.
        // This is a middle-ground batching approach to not break the intricate floor/return logic of a single scan.
        await Promise.all(batchCodes.map(code => saveTbrRef.current?.(rideId, code)));
      } catch (err) {
        console.error("Queue processing error:", err);
      }
    }

    processingQueueRef.current[rideId] = false;
    // Sync with DB only once after all queued items are processed
    fetchRidesRef.current(false);
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

      // Check for duplicate INSTANTLY before enqueuing
      if (handleDuplicateInstant(rideId, code)) return;

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
        // Check for duplicate INSTANTLY before saving
        if (handleDuplicateInstant(rideId, value)) {
          setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
          setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
          return;
        }
        saveTbr(rideId, value);
      }
    }
  };

  // Cancel loading
  const handleConfirmCall = async () => {
    if (!selectedQueueIdForCall) return;
    const callerName = conferenteSession?.name || managerSession?.name || "Conferente";
    
    setCallingDriverId(selectedQueueIdForCall);
    
    await supabase.from("queue_entries").update({ 
      called_at: new Date().toISOString(), 
      called_by_name: callerName,
      parking_spot: parkingSpotInput.trim()
    }).eq("id", selectedQueueIdForCall);
    
    const { toast } = await import("@/hooks/use-toast");
    toast({ title: "Motorista chamado!", description: `Vaga ${parkingSpotInput} informada ao painel.` });
    
    setParkingModalOpen(false);
    setSelectedQueueIdForCall(null);
    setParkingSpotInput("");
    
    setTimeout(() => setCallingDriverId(null), 2000);
  };

  const handleOpenCancelModal = (rideId: string) => {
    setCancelRideId(rideId);
    setCancelPassword("");
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelRideId || !unitId) return;
    setCancelLoading(true);

    // Validate manager password server-side
    const { validateManagerPassword } = await import("@/lib/validate-manager-password");
    const { valid: passwordValid } = await validateManagerPassword(unitId, cancelPassword);
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

    // Validate manager password server-side
    const { validateManagerPassword } = await import("@/lib/validate-manager-password");
    const { valid: passwordValid } = await validateManagerPassword(unitId, deletePassword);
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
    .filter(r => !conferenteFilter || r.conferente_id === conferenteFilter)
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
    const { data: driver } = await supabase.from("drivers_public").select("id, name, avatar_url, car_model, car_plate, car_color, cpf, whatsapp, email, address, emergency_contact_1, emergency_contact_2, birth_date").eq("id", driverId).maybeSingle();
    const { count: ridesCount } = await supabase.from("driver_rides").select("id", { count: "exact", head: true }).eq("driver_id", driverId);
    const { data: driverRides } = await supabase.from("driver_rides").select("id").eq("driver_id", driverId);
    let tbrsCount = 0;
    if (driverRides && driverRides.length > 0) {
      const rIds = driverRides.map(r => r.id);
      const { count } = await supabase.from("ride_tbrs").select("id", { count: "exact", head: true }).in("ride_id", rIds);
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

  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRealtimeFetch = useCallback(() => {
    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = setTimeout(() => {
      fetchRides(false);
    }, 20000); // 20s debounce
  }, [fetchRides]);

  // Subscribe to driver_rides and ride_tbrs changes for REALTIME KPI UPDATES
  useEffect(() => {
    if (!unitId) return;

    const channel = supabase
      .channel("carregamento-realtime-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_rides", filter: `unit_id=eq.${unitId}` }, () => {
        debouncedRealtimeFetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_tbrs" }, (payload: any) => {
        // Since ride_tbrs doesn't have unit_id directly, we check if the ride_id belongs to the current unit's rides
        if (payload.new && currentRideIdsRef.current.includes(payload.new.ride_id)) {
          debouncedRealtimeFetch();
        } else if (payload.old && currentRideIdsRef.current.includes(payload.old.ride_id)) {
          debouncedRealtimeFetch();
        }
      })
      .subscribe();

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [unitId, debouncedRealtimeFetch]);

  // Cycle logic (same as CiclosPage) - Realtime as it depends on displayRides/displayTbrs
  const cycleMetrics = useMemo(() => {
    const date = format(startDate, "yyyy-MM-dd");
    const cycle1Cutoff = `${date}T11:30:00.000Z`; // 08:30 BRT
    const cycle2Cutoff = `${date}T12:30:00.000Z`; // 09:30 BRT

    const ridesInC1 = displayRides.filter(r => r.loading_status !== "cancelled" && r.completed_at && r.completed_at <= cycle1Cutoff);
    const ridesInC2 = displayRides.filter(r => r.loading_status !== "cancelled" && r.completed_at && r.completed_at <= cycle2Cutoff);
    const ridesInC3 = displayRides.filter(r => r.loading_status !== "cancelled");

    const tbrsInC1 = ridesInC1.reduce((acc, r) => acc + (displayTbrs[r.id]?.length || 0), 0);
    const tbrsInC2 = ridesInC2.reduce((acc, r) => acc + (displayTbrs[r.id]?.length || 0), 0);
    const tbrsInC3 = ridesInC3.reduce((acc, r) => acc + (displayTbrs[r.id]?.length || 0), 0);

    return {
      c1: { rides: ridesInC1.length, tbrs: tbrsInC1 },
      c2: { rides: ridesInC2.length, tbrs: tbrsInC2 },
      c3: { rides: ridesInC3.length, tbrs: tbrsInC3 }
    };
  }, [displayRides, displayTbrs, startDate]);

  const getTbrItemClass = (tbr: Tbr, isInActiveRide?: boolean) => {
    if (tbr.is_rescue) return "bg-black text-white border-black";
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
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold italic shrink-0">Carregamento</h1>
          
          <div className="hidden lg:flex items-center gap-3">
            {/* Cycle info blocks */}
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg border bg-white shadow-sm min-w-[140px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Ciclo 1 (até 08:30)</span>
              <span className="text-lg font-bold text-primary leading-tight">{cycleMetrics.c1.rides}</span>
              <span className="text-[10px] text-muted-foreground">{cycleMetrics.c1.tbrs} TBRs</span>
            </div>
            
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg border bg-white shadow-sm min-w-[140px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Ciclo 2 (até 09:30)</span>
              <span className="text-lg font-bold text-primary leading-tight">{cycleMetrics.c2.rides}</span>
              <span className="text-[10px] text-muted-foreground">{cycleMetrics.c2.tbrs} TBRs</span>
            </div>
            
            <div className="flex flex-col items-center px-4 py-1.5 rounded-lg border bg-white shadow-sm min-w-[140px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Ciclo 3 (total)</span>
              <span className="text-lg font-bold text-primary leading-tight">{cycleMetrics.c3.rides}</span>
              <span className="text-[10px] text-muted-foreground">{cycleMetrics.c3.tbrs} TBRs</span>
            </div>
          </div>
        </div>
        
        {managerSession && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => {
              setShowRetroModal(true);
              setRetroDate(startDate); // Ensure it matches the dashboard view
              setRetroDriverSearch("");
              setRetroDriverResults([]);
              setRetroSelectedDriver(null);
            }}
          >
            <History className="h-3.5 w-3.5" />
            Retroativo
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative sm:w-1/5">
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

          <div className="relative sm:w-1/5">
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
              <Button variant="outline" className="sm:w-1/5 h-10 justify-start gap-2 font-normal">
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
          <Popover open={conferentePopoverOpen} onOpenChange={setConferentePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="sm:w-1/5 h-10 justify-start gap-2 font-normal">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{conferentes.find(c => c.id === conferenteFilter)?.name || "Conferente..."}</span>
                {conferenteFilter && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConferenteFilter(""); }}
                    className="ml-auto"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar conferente..." />
                <CommandList>
                  <CommandEmpty>Nenhum conferente encontrado.</CommandEmpty>
                  <CommandGroup>
                    {conferentes.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        onSelect={() => {
                          setConferenteFilter(c.id);
                          setConferentePopoverOpen(false);
                        }}
                      >
                        {c.name}
                        {conferenteFilter === c.id && <Check className="ml-auto h-4 w-4" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Popover open={routePopoverOpen} onOpenChange={setRoutePopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="sm:w-1/5 h-10 justify-start gap-2 font-normal">
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

        <div className="flex flex-row flex-wrap items-center gap-3">
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

          {/* KPI Cards next to dates */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white border-border/50 min-w-[100px] shadow-sm">
              <Users className="h-3.5 w-3.5 text-primary" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">DA's</span>
                <span className="text-sm font-bold leading-none">{displayRides.filter(r => r.loading_status !== "cancelled").length}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white border-border/50 min-w-[100px] shadow-sm">
              <ScanBarcode className="h-3.5 w-3.5 text-primary" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">TBRs</span>
                <span className="text-sm font-bold leading-none">
                  {displayRides.filter(r => r.loading_status !== "cancelled").reduce((acc, r) => acc + (displayTbrs[r.id]?.length || 0), 0)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-gray-50/50 border-gray-100 text-gray-500 min-w-[100px] shadow-sm">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 leading-none">Aguardando</span>
                <span className="text-sm font-bold leading-none">
                  {displayRides.filter(r => r.loading_status === "pending").length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-blue-50/50 border-blue-100 text-blue-700 min-w-[100px] shadow-sm">
              <Play className="h-3.5 w-3.5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 leading-none">Aberto</span>
                <span className="text-sm font-bold leading-none">
                  {displayRides.filter(r => r.loading_status === "loading").length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-green-50/50 border-green-100 text-green-700 min-w-[100px] shadow-sm">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70 leading-none">Fim</span>
                <span className="text-sm font-bold leading-none">
                  {displayRides.filter(r => r.loading_status === "finished").length}
                </span>
              </div>
            </div>
          </div>

          {/* CSV Export button */}
          {!isSearchActive && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-white border-border/50 shadow-sm hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              title="Exportar CSV de TBRs"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">CSV</span>
            </button>
          )}
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
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
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
              <span className="text-muted-foreground/40">|</span>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300" />
                <span>Finalizado</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-blue-300" />
                <span>Carregando</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-white border border-border" />
                <span>Aguardando</span>
              </div>
              <span className="text-muted-foreground/40">|</span>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-yellow-200 border border-yellow-300" />
                <span>5x bipes</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-black border border-black" />
                <span className="text-foreground">Socorrido</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-red-200 border border-red-300" />
                <span>Duplicado</span>
                <span
                  title="Atualiza os cards automaticamente"
                  className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded border border-border bg-muted text-muted-foreground font-mono font-bold tabular-nums shrink-0"
                  style={{ fontSize: 'inherit' }}
                >
                  {cardsCountdown}s
                </span>
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
                  <div 
                    key={ride.id} 
                    className={cn(
                      "w-[85vw] sm:w-[320px] shrink-0 transition-opacity",
                      draggedRideId === ride.id && "opacity-40",
                      dragOverRideId === ride.id && "ring-2 ring-primary ring-offset-2 rounded-xl"
                    )}
                    draggable={!!managerSession && !isSearchActive}
                    onDragStart={() => handleDragStart(ride.id)}
                    onDragOver={(e) => handleDragOver(e, ride.id)}
                    onDrop={() => handleDrop(ride.id)}
                    onDragEnd={() => { setDraggedRideId(null); setDragOverRideId(null); }}
                  >
                    <Card className={cn(
                      "relative overflow-hidden h-full transition-colors",
                      isLoadingStatus && "bg-blue-50 border-blue-200",
                      isFinished && "bg-green-50 border-green-200",
                      isCancelled && "bg-red-50 border-red-200"
                    )}>
                      <CardContent className="p-4 flex flex-col items-center gap-3">
                        {/* Drag handle for manager */}
                        {managerSession && !isSearchActive && (
                          <div className="absolute top-2 right-1/2 translate-x-1/2 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-primary transition-colors">
                            <GripVertical className="h-5 w-5" />
                          </div>
                        )}
                        {/* TBR Counter badge + Bell icon (top-left) */}
                        <div className="absolute top-2 left-2 flex flex-col items-center gap-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold gap-0.5" title="TBRs no carregamento">
                            <ScanBarcode className="h-2.5 w-2.5" />
                            {rideTbrs.length}
                          </Badge>
                          {ride.queue_entry_id && !isCancelled && !isFinished && (
                            <button
                              onClick={() => {
                                setSelectedQueueIdForCall(ride.queue_entry_id!);
                                setParkingModalOpen(true);
                                setParkingSpotInput("");
                              }}
                              className={cn("h-6 w-6 flex items-center justify-center rounded-full transition-colors", callingDriverId === ride.queue_entry_id ? "bg-yellow-400 text-yellow-900 animate-pulse" : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground")}
                              title="Chamar motorista"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          {isCancelled && (
                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Cancelado</Badge>
                          )}
                          {(() => {
                            if (!ride.completed_at) return null;
                            const rideDate = new Date(ride.completed_at);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            // Simple "Retroativo" logic: if it has no queue_entry_id, it is a manual entry
                            if (!ride.queue_entry_id) {
                              return (
                                <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-primary text-primary bg-primary/5 gap-1">
                                  <History className="h-3 w-3" /> Retroativo
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                          {isFinished && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                          {(() => {
                            const avg = driverAvgMap.get(ride.driver_id);
                            const currentTbrs = (tbrs[ride.id] ?? []).length;
                            if (avg === undefined || avg === 0) return null;
                            const ratio = currentTbrs / avg;
                            const color = ratio <= 1.0 ? "border-green-500 text-green-700 bg-green-500/10" : ratio <= 1.1 ? "border-amber-500 text-amber-700 bg-amber-500/10" : "border-red-500 text-red-700 bg-red-500/10";
                            return (
                              <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`} title={`Média: ${avg} TBRs/dia · Atual: ${currentTbrs} TBRs`}>
                                {avg}
                              </div>
                            );
                          })()}
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
                          <Avatar
                            className={cn("h-16 w-16 shrink-0", ride.driver_avatar && "cursor-pointer hover:ring-2 hover:ring-primary transition-all")}
                            onClick={() => ride.driver_avatar && setPhotoModalUrl(ride.driver_avatar)}
                          >
                            {ride.driver_avatar && <AvatarImage src={ride.driver_avatar} />}
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                              {(ride.driver_name ?? "M")[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <h3 className="text-lg font-bold">{shortName(ride.driver_name)}</h3>
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
                            {isLoadingStatus && !isMyRide && (
                              <div className="flex-1 flex items-center justify-center gap-1.5 py-1 px-3 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold border border-blue-200">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="truncate">Em conferência por {conferentes.find(c => c.id === ride.conferente_id)?.name || "outro"}</span>
                              </div>
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

                        {/* Cancel button (visible to all, password required for non-managers) */}
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold italic flex items-center gap-1">
                                <ScanBarcode className="h-3.5 w-3.5 text-primary" />
                                TBRs Lidos ({rideTbrs.length})
                              </p>
                              {(() => {
                                const reincidencias = rideTbrs.filter(t => t._yellowHighlight).length;
                                return reincidencias > 0 ? (
                                  <p className="text-xs font-bold italic flex items-center gap-1 text-yellow-600">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Pend. Coleta ({reincidencias})
                                  </p>
                                ) : null;
                              })()}
                              {isMyRide && getSelectedCount(ride.id) > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] px-2 gap-1 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                                  onClick={() => openBatchInsucessoModal(ride.id)}
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Insucesso ({getSelectedCount(ride.id)})
                                </Button>
                              )}
                              {isMyRide && rideTbrs.length > 0 && (
                                <button
                                  onClick={() => {
                                    setSelectedTbrsForDelete(prev => {
                                      const current = new Set(prev[ride.id] ?? []);
                                      const allSelected = rideTbrs.every(t => current.has(t.id));
                                      if (allSelected) {
                                        return { ...prev, [ride.id]: new Set() };
                                      } else {
                                        return { ...prev, [ride.id]: new Set(rideTbrs.map(t => t.id)) };
                                      }
                                    });
                                  }}
                                  className={cn("ml-auto h-6 w-6 flex items-center justify-center rounded transition-colors",
                                    rideTbrs.every(t => (selectedTbrsForDelete[ride.id] ?? new Set()).has(t.id))
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                  )}
                                  title="Selecionar todos os TBRs"
                                >
                                  <CheckSquare className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSearchLocateMode(prev => ({ ...prev, [ride.id]: !prev[ride.id] }));
                                  if (searchLocateMode[ride.id]) {
                                    setSearchLocateInput(prev => ({ ...prev, [ride.id]: "" }));
                                  }
                                }}
                                className={cn("ml-auto h-6 w-6 flex items-center justify-center rounded transition-colors", searchLocateMode[ride.id] ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground")}
                                title="Buscar e localizar TBR"
                              >
                                <Search className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            {searchLocateMode[ride.id] && (
                              <div className="flex gap-1 items-center">
                                <Input
                                  className="h-7 text-xs font-mono flex-1"
                                  placeholder="Bipe ou digite o TBR para localizar..."
                                  value={searchLocateInput[ride.id] ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchLocateInput(prev => ({ ...prev, [ride.id]: val }));
                                    // Auto-search with debounce
                                    if (val.trim().length >= 3) {
                                      const upper = val.trim().toUpperCase();
                                      const found = rideTbrs.find(t => t.code.toUpperCase() === upper);
                                      if (found) {
                                        // Auto-select the checkbox
                                        setSelectedTbrsForDelete(prev => {
                                          const current = new Set(prev[ride.id] ?? []);
                                          current.add(found.id);
                                          return { ...prev, [ride.id]: current };
                                        });
                                        // Scroll to the element
                                        const listEl = tbrListRefs.current[ride.id];
                                        if (listEl) {
                                          const idx = rideTbrs.findIndex(t => t.id === found.id);
                                          if (idx >= 0) {
                                            const itemEl = listEl.children[idx] as HTMLElement;
                                            itemEl?.scrollIntoView({ behavior: "smooth", block: "center" });
                                          }
                                        }
                                        // Clear input after short delay
                                        setTimeout(() => {
                                          setSearchLocateInput(prev => ({ ...prev, [ride.id]: "" }));
                                        }, 300);
                                      }
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const val = (searchLocateInput[ride.id] ?? "").trim().toUpperCase();
                                      const found = rideTbrs.find(t => t.code.toUpperCase() === val);
                                      if (found) {
                                        setSelectedTbrsForDelete(prev => {
                                          const current = new Set(prev[ride.id] ?? []);
                                          current.add(found.id);
                                          return { ...prev, [ride.id]: current };
                                        });
                                        const listEl = tbrListRefs.current[ride.id];
                                        if (listEl) {
                                          const idx = rideTbrs.findIndex(t => t.id === found.id);
                                          if (idx >= 0) {
                                            const itemEl = listEl.children[idx] as HTMLElement;
                                            itemEl?.scrollIntoView({ behavior: "smooth", block: "center" });
                                          }
                                        }
                                        setSearchLocateInput(prev => ({ ...prev, [ride.id]: "" }));
                                      }
                                    }
                                  }}
                                  autoFocus
                                />
                              </div>
                            )}
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
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
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
                      {(() => {
                        const avg = driverAvgMap.get(ride.driver_id);
                        const currentTbrs = focusedTbrs.length;
                        if (avg === undefined || avg === 0) return null;
                        const ratio = currentTbrs / avg;
                        const color = ratio <= 1.0 ? "border-green-500 text-green-700 bg-green-500/10" : ratio <= 1.1 ? "border-amber-500 text-amber-700 bg-amber-500/10" : "border-red-500 text-red-700 bg-red-500/10";
                        return (
                          <div className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`} title={`Média: ${avg} TBRs/dia · Atual: ${currentTbrs} TBRs`}>
                            {avg}
                          </div>
                        );
                      })()}
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
                    <Avatar
                      className={cn("h-16 w-16 shrink-0", ride.driver_avatar && "cursor-pointer hover:ring-2 hover:ring-primary transition-all")}
                      onClick={() => ride.driver_avatar && setPhotoModalUrl(ride.driver_avatar)}
                    >
                      {ride.driver_avatar && <AvatarImage src={ride.driver_avatar} />}
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                        {(ride.driver_name ?? "M")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="text-lg font-bold">{shortName(ride.driver_name)}</h3>
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
                        TBRs Lidos ({focusedTbrs.length})
                      </p>
                      {(() => {
                        const reincidencias = focusedTbrs.filter(t => t._yellowHighlight).length;
                        return reincidencias > 0 ? (
                          <p className="text-xs font-bold italic flex items-center gap-1 text-yellow-600">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Pend. Coleta ({reincidencias})
                          </p>
                        ) : null;
                      })()}
                      {getSelectedCount(ride.id) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 gap-1 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                          onClick={() => openBatchInsucessoModal(ride.id)}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Insucesso ({getSelectedCount(ride.id)})
                        </Button>
                      )}
                      {focusedTbrs.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedTbrsForDelete(prev => {
                              const current = new Set(prev[ride.id] ?? []);
                              const allSelected = focusedTbrs.every(t => current.has(t.id));
                              if (allSelected) {
                                return { ...prev, [ride.id]: new Set() };
                              } else {
                                return { ...prev, [ride.id]: new Set(focusedTbrs.map(t => t.id)) };
                              }
                            });
                          }}
                          className={cn("ml-auto h-6 w-6 flex items-center justify-center rounded transition-colors",
                            focusedTbrs.every(t => (selectedTbrsForDelete[ride.id] ?? new Set()).has(t.id))
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80 text-muted-foreground"
                          )}
                          title="Selecionar todos os TBRs"
                        >
                          <CheckSquare className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {/* Lupa de busca no focus mode */}
                      <button
                        onClick={() => {
                          setFocusSearchActive(prev => !prev);
                          setFocusSearchInput("");
                        }}
                        className={cn("h-6 w-6 flex items-center justify-center rounded transition-colors", focusSearchActive ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground")}
                        title="Buscar TBR"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {focusSearchActive && (
                      <div className="flex gap-1 items-center">
                        <Input
                          className="h-7 text-xs font-mono flex-1"
                          placeholder="Bipar ou digitar TBR para localizar..."
                          value={focusSearchInput}
                          onChange={e => {
                            const val = e.target.value;
                            setFocusSearchInput(val);
                            if (val.trim().length >= 3) {
                              const upper = val.trim().toUpperCase();
                              const found = focusedTbrs.find(t => t.code.toUpperCase() === upper);
                              if (found) {
                                setSelectedTbrsForDelete(prev => {
                                  const current = new Set(prev[ride.id] ?? []);
                                  current.add(found.id);
                                  return { ...prev, [ride.id]: current };
                                });
                                // Scroll into view
                                const listEl = tbrListRefs.current[`focus-${ride.id}`];
                                if (listEl) {
                                  const visibleFocus = val.trim().length > 0
                                    ? focusedTbrs.filter(t => t.code.toUpperCase().includes(val.trim().toUpperCase()))
                                    : focusedTbrs;
                                  const idx = visibleFocus.findIndex(t => t.id === found.id);
                                  if (idx >= 0 && listEl.children[idx]) {
                                    (listEl.children[idx] as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
                                  }
                                }
                                setTimeout(() => setFocusSearchInput(""), 300);
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = focusSearchInput.trim().toUpperCase();
                              const found = focusedTbrs.find(t => t.code.toUpperCase() === val);
                              if (found) {
                                setSelectedTbrsForDelete(prev => {
                                  const current = new Set(prev[ride.id] ?? []);
                                  current.add(found.id);
                                  return { ...prev, [ride.id]: current };
                                });
                                const listEl = tbrListRefs.current[`focus-${ride.id}`];
                                if (listEl) {
                                  // Find index in focusedTbrs to get the proper child index if unfiltered
                                  // or just get the index from the visible subset.
                                  // Since we filter the list based on focusSearchInput, it might be the only item.
                                  const visibleFocus = focusSearchInput.trim().length > 0
                                    ? focusedTbrs.filter(t => t.code.toUpperCase().includes(focusSearchInput.trim().toUpperCase()))
                                    : focusedTbrs;
                                  const idx = visibleFocus.findIndex(t => t.id === found.id);
                                  if (idx >= 0 && listEl.children[idx]) {
                                    const itemEl = listEl.children[idx] as HTMLElement;
                                    itemEl?.scrollIntoView({ behavior: "smooth", block: "center" });
                                  }
                                }
                                setFocusSearchInput("");
                              }
                            }
                          }}
                          autoFocus
                        />
                      </div>
                    )}
                    {focusedTbrs.length > 0 && (() => {
                      const visibleFocus = focusSearchActive && focusSearchInput.trim().length > 0
                        ? focusedTbrs.filter(t => t.code.toUpperCase().includes(focusSearchInput.trim().toUpperCase()))
                        : focusedTbrs;
                      return (
                        <div ref={(el) => { tbrListRefs.current[`focus-${ride.id}`] = el; }} className="max-h-48 overflow-y-auto space-y-1">
                          {visibleFocus.map((t, i) => (
                          <div key={t.id} className={cn("flex items-center gap-2 text-xs rounded px-2 py-1 transition-colors", getTbrItemClass(t, true))}>
                            <span className="font-bold text-primary">{focusedTbrs.length - i}.</span>
                            <span className="font-mono">{t.code}</span>
                            {t.scanned_at && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {(() => {
                                  const d = new Date(t.scanned_at);
                                  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
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
                            </div>
                          </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* TBR Input — camera removed, only keyboard mode button */}
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
                <div><strong>Nascimento:</strong> {driverModalData.driver.birth_date ? new Date(driverModalData.driver.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</div>
                <div><strong>Emergência 1:</strong> {driverModalData.driver.emergency_contact_1 || "—"}</div>
                <div><strong>Emergência 2:</strong> {driverModalData.driver.emergency_contact_2 || "—"}</div>
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
                    const { validateManagerPassword } = await import("@/lib/validate-manager-password");
                    const { valid } = await validateManagerPassword(unitId!, swapPasswordInput);
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
                const { validateManagerPassword } = await import("@/lib/validate-manager-password");
                const { valid } = await validateManagerPassword(unitId!, swapPasswordInput);
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
              <QrViewfinder />
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
            const loginMissing = !ride?.login || !ride.login.trim();
            return (
              <div className="space-y-3 pt-2">
                <div className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TBRs bipados:</span>
                    <span className="font-bold text-lg">{rideTbrs.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Login do coletor:</span>
                    <span className={`font-bold font-mono ${loginMissing ? "text-destructive" : ""}`}>{ride?.login || "—"}</span>
                  </div>
                </div>
                {loginMissing && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Não é possível finalizar sem preencher o login do coletor. Volte ao card e preencha o campo de login.
                  </div>
                )}
                <p className="text-xs text-muted-foreground italic">
                  ⚠ Verifique se o login utilizado no coletor da Amazon é o mesmo que aparece no card de carregamento. Isso é importante pois define o valor de pagamento do motorista.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setFinalizarConfirmRideId(null)}>
                    Cancelar
                  </Button>
                  <Button variant="destructive" className="flex-1 font-bold" disabled={loginMissing} onClick={() => {
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

      {/* Batch Insucesso Modal */}
      <Dialog open={showBatchInsucessoModal} onOpenChange={(open) => { if (!open) setShowBatchInsucessoModal(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-5 w-5" /> Insucesso em Lote
            </DialogTitle>
            <DialogDescription>
              {(() => {
                const count = batchInsucessoRideId ? getSelectedCount(batchInsucessoRideId) : 0;
                return `Enviar ${count} TBR(s) selecionado(s) para insucessos. Escolha o motivo abaixo.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="font-semibold">Motivo do Insucesso</Label>
              <Select value={batchInsucessoReason} onValueChange={setBatchInsucessoReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {batchInsucessoReasons.map((reason) => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={confirmBatchInsucesso}
              disabled={!batchInsucessoReason || batchInsucessoLoading}
              className="w-full gap-2 font-bold italic"
            >
              {batchInsucessoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Confirmar Insucesso em Lote
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Retroactive Loading Modal */}
      <Dialog open={showRetroModal} onOpenChange={setShowRetroModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Carregamento Retroativo
            </DialogTitle>
            <DialogDescription>
              Crie um carregamento retroativo para um motorista em uma data passada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="font-semibold">Data do Carregamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start font-normal">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {retroDate ? format(retroDate, "dd/MM/yyyy") : "Selecionar data..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                  <Calendar mode="single" selected={retroDate} onSelect={setRetroDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Buscar Motorista</Label>
              <Input
                placeholder="Digite o nome..."
                value={retroDriverSearch}
                onChange={(e) => {
                  setRetroDriverSearch(e.target.value);
                  setRetroSelectedDriver(null);
                  if (retroDebounceRef.current) clearTimeout(retroDebounceRef.current);
                  if (e.target.value.trim()) {
                    retroDebounceRef.current = setTimeout(async () => {
                      setRetroSearchLoading(true);
                      const { data } = await supabase
                        .from("drivers_public")
                        .select("id, name, cpf, avatar_url, car_model, car_plate, car_color")
                        .ilike("name", `%${e.target.value.trim()}%`)
                        .eq("active", true)
                        .limit(10);
                      setRetroDriverResults((data ?? []) as SwapDriver[]);
                      setRetroSearchLoading(false);
                    }, 400);
                  } else {
                    setRetroDriverResults([]);
                  }
                }}
              />
              {retroSearchLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {retroDriverResults.length > 0 && !retroSelectedDriver && (
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-md p-1">
                  {retroDriverResults.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setRetroSelectedDriver(d); setRetroDriverResults([]); }}
                      className="w-full text-left p-2 rounded hover:bg-muted text-xs space-y-0.5"
                    >
                      <p className="font-bold">{d.name}</p>
                      <p className="text-muted-foreground">{d.car_model} {d.car_color || ""} · {d.car_plate}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {retroSelectedDriver && (
              <div className="p-3 rounded-lg border border-border bg-card space-y-1">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {retroSelectedDriver.avatar_url && <AvatarImage src={retroSelectedDriver.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{retroSelectedDriver.name[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold text-sm">{retroSelectedDriver.name}</p>
                    <p className="text-xs text-muted-foreground">{retroSelectedDriver.car_model} · {retroSelectedDriver.car_plate}</p>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={async () => {
                if (!retroSelectedDriver || !retroDate || !unitId) return;
                setRetroLoading(true);
                const now = new Date();
                const retroDateStr = new Date(retroDate.getFullYear(), retroDate.getMonth(), retroDate.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
                // Get next sequence number for that date
                const dayStart = new Date(retroDate.getFullYear(), retroDate.getMonth(), retroDate.getDate(), 0, 0, 0).toISOString();
                const dayEnd = new Date(retroDate.getFullYear(), retroDate.getMonth(), retroDate.getDate(), 23, 59, 59, 999).toISOString();
                const { data: existingRides } = await supabase
                  .from("driver_rides")
                  .select("sequence_number")
                  .eq("unit_id", unitId)
                  .gte("completed_at", dayStart)
                  .lte("completed_at", dayEnd)
                  .order("sequence_number", { ascending: false })
                  .limit(1);
                const nextSeq = ((existingRides ?? [])[0]?.sequence_number ?? 0) + 1;

                // Use direct fetch to bypass supabase.functions.invoke payload issues
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
                const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
                
                const response = await fetch(`${supabaseUrl}/functions/v1/create-ride-with-login`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseAnonKey}`
                  },
                  body: JSON.stringify({
                    driver_id: retroSelectedDriver.id,
                    unit_id: unitId,
                    override_date: retroDateStr,
                    session_token: conferenteSession?.session_token
                  })
                });

                const rideResult = await response.json();
                const insertError = !response.ok ? { message: rideResult.error || "Erro desconhecido" } : null;

                if (insertError || rideResult?.error) {
                  const { toast } = await import("@/hooks/use-toast");
                  toast({ title: "Erro ao criar carregamento", description: insertError?.message || rideResult?.error, variant: "destructive" });
                  setRetroLoading(false);
                  return;
                }

                setRetroLoading(false);
                setShowRetroModal(false);
                
                // Clear filters to ensure the card is visible
                setDriverNameFilter("");
                setLoginFilter("");
                setConferenteFilter("");
                setRouteFilter("");

                // Navigate to the retroactive date
                const finalSDate = new Date(retroDate.getFullYear(), retroDate.getMonth(), retroDate.getDate(), 0, 0, 0);
                const finalEDate = new Date(retroDate.getFullYear(), retroDate.getMonth(), retroDate.getDate(), 23, 59, 59, 999);
                setStartDate(finalSDate);
                setEndDate(finalEDate);
                
                // Fetch with explicit dates to bypass state delay
                await fetchRides(true, finalSDate, finalEDate);
                
                const { toast } = await import("@/hooks/use-toast");
                toast({ 
                  title: "Carregamento retroativo criado!", 
                  description: `Motorista ${retroSelectedDriver.name} adicionado com sucesso em ${format(retroDate, "dd/MM/yyyy")}` 
                });
                
                // Reset driver selection
                setRetroSearch("");
                setRetroSelectedDriver(null);
              }}
              disabled={retroLoading || !retroSelectedDriver || !retroDate}
              className="w-full font-bold italic gap-2"
            >
              {retroLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <History className="h-4 w-4" />
              Criar Carregamento Retroativo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Modal */}
      <Dialog open={!!photoModalUrl} onOpenChange={(open) => !open && setPhotoModalUrl(null)}>
        <DialogContent className="sm:max-w-md p-2 bg-transparent border-none shadow-none">
          <div className="relative">
            <img
              src={photoModalUrl || ""}
              alt="Foto do motorista"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setPhotoModalUrl(null)}
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={parkingModalOpen} onOpenChange={setParkingModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Chamar para Vaga
            </DialogTitle>
            <DialogDescription>
              Informe o número da vaga onde o motorista deve estacionar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parking_spot" className="text-right">Vaga</Label>
              <Input
                id="parking_spot"
                className="col-span-3 text-2xl font-black text-center"
                placeholder="Ex: 10"
                value={parkingSpotInput}
                onChange={(e) => setParkingSpotInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmCall(); }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setParkingModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmCall} disabled={!parkingSpotInput.trim()}>
              Confirmar Chamada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer TBR Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold italic flex items-center gap-2 text-primary">
              <ArrowRightLeft className="h-5 w-5" /> Transferir TBR
            </DialogTitle>
            <DialogDescription>
              Este pacote já pertence a outro carregamento ativo. Deseja transferi-lo?
            </DialogDescription>
          </DialogHeader>
          {transferData && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Pacote</span>
                  <span className="font-mono font-bold text-lg">{transferData.code}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Motorista Atual</p>
                    <p className="text-sm font-semibold italic">{transferData.driverName}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Conferente</p>
                    <p className="text-sm font-semibold italic">{transferData.conferenteName}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Data/Hora Leitura</p>
                    <p className="text-sm font-mono">{transferData.date}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowTransferModal(false); setTransferData(null); }} disabled={transferLoading}>
                  Não, cancelar
                </Button>
                <Button className="flex-1 font-bold italic gap-2" onClick={handleConfirmTransfer} disabled={transferLoading}>
                  {transferLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Sim, transferir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ConferenciaCarregamentoPage;
