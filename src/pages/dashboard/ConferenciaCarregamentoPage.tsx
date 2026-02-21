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
import { Car, MapPin, User, Hash, KeyRound, Play, CheckCircle, RotateCcw, ScanBarcode, UserCheck, Clock, Search, X, CalendarIcon, Timer, Pencil, ChevronLeft, ChevronRight, Eye, Lightbulb, Keyboard, Ban, ArrowRightLeft, Loader2, Bell, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { format, differenceInMinutes } from "date-fns";
import { cn } from "@/lib/utils";
import useEmblaCarousel from "embla-carousel-react";

interface RideWithDriver {
  id: string;
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
  const { unitSession, managerSession } = useAuthStore();
  const [rides, setRides] = useState<RideWithDriver[]>([]);
  const [conferentes, setConferentes] = useState<Conferente[]>([]);
  const [tbrs, setTbrs] = useState<Record<string, Tbr[]>>({});
  const [tbrInputs, setTbrInputs] = useState<Record<string, string>>({});
  const [tbrSearch, setTbrSearch] = useState("");
  const [tbrSearchCommitted, setTbrSearchCommitted] = useState("");
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
  const skipRealtimeRef = useRef(false);
  const unitId = unitSession?.id;
  const [openRtos, setOpenRtos] = useState<OpenRto[]>([]);
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps", dragFree: true });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

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

  // Call driver
  const [callingDriverId, setCallingDriverId] = useState<string | null>(null);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => { emblaApi.off("select", onSelect); emblaApi.off("reInit", onSelect); };
  }, [emblaApi]);

  const [searchRides, setSearchRides] = useState<RideWithDriver[]>([]);
  const [searchTbrs, setSearchTbrs] = useState<Record<string, Tbr[]>>({});

  const fetchRides = useCallback(async () => {
    if (!unitId) return;

    const { data } = await supabase
      .from("driver_rides")
      .select("*")
      .eq("unit_id", unitId)
      .gte("completed_at", startDate.toISOString())
      .lte("completed_at", endDate.toISOString())
      .order("sequence_number", { ascending: true });

    if (!data) { setRides([]); setIsLoading(false); return; }

    const driverIds = [...new Set(data.map((r) => r.driver_id))];
    const { data: drivers } = await supabase
      .from("drivers_public")
      .select("id, name, avatar_url, car_model, car_plate, car_color")
      .in("id", driverIds);

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

    const rideIds = mapped.map((r) => r.id);
    if (rideIds.length > 0) {
      const { data: tbrData } = await supabase
        .from("ride_tbrs")
        .select("*")
        .in("ride_id", rideIds)
        .order("scanned_at", { ascending: true });

      const grouped: Record<string, Tbr[]> = {};
      (tbrData ?? []).forEach((t: any) => {
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
    } else {
      setTbrs({});
    }
    setIsLoading(false);
  }, [unitId, startDate, endDate]);

  const fetchSearchResults = useCallback(async (searchTerm: string) => {
    if (!unitId || !searchTerm.trim()) {
      setSearchRides([]);
      setSearchTbrs({});
      return;
    }

    const { data: allUnitRides } = await supabase
      .from("driver_rides")
      .select("id")
      .eq("unit_id", unitId);

    if (!allUnitRides || allUnitRides.length === 0) { setSearchRides([]); setSearchTbrs({}); return; }

    const allRideIds = allUnitRides.map(r => r.id);
    const { data: matchingTbrs } = await supabase
      .from("ride_tbrs")
      .select("*")
      .in("ride_id", allRideIds)
      .ilike("code", `%${searchTerm.trim()}%`)
      .order("scanned_at", { ascending: true });

    if (!matchingTbrs || matchingTbrs.length === 0) { setSearchRides([]); setSearchTbrs({}); return; }

    const matchingRideIds = [...new Set(matchingTbrs.map(t => t.ride_id))];

    const { data: ridesData } = await supabase
      .from("driver_rides")
      .select("*")
      .in("id", matchingRideIds)
      .order("sequence_number", { ascending: true });

    if (!ridesData) { setSearchRides([]); setSearchTbrs({}); return; }

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
      .order("scanned_at", { ascending: true });

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

  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("conferencia-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_rides", filter: `unit_id=eq.${unitId}` }, () => { if (!skipRealtimeRef.current) fetchRides(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_tbrs" }, () => { if (!skipRealtimeRef.current) fetchRides(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchRides]);

  const handleSelectConferente = async (rideId: string, conferenteId: string) => {
    // Optimistic update to lock dropdown immediately
    setRides((prev) => prev.map((r) => r.id === rideId ? { ...r, conferente_id: conferenteId } : r));
    await supabase.from("driver_rides").update({ conferente_id: conferenteId } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleIniciar = async (rideId: string) => {
    await supabase.from("driver_rides").update({ loading_status: "loading", started_at: new Date().toISOString() } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleFinalizar = async (rideId: string) => {
    await supabase.from("driver_rides").update({ loading_status: "finished", finished_at: new Date().toISOString() } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleRetornar = async (rideId: string) => {
    await supabase.from("driver_rides").update({ loading_status: "loading", finished_at: null } as any).eq("id", rideId);
    await fetchRides();
  };

  const handleDeleteTbr = async (tbrId: string, rideId: string) => {
    if (deletingRef.current.has(tbrId)) return;
    deletingRef.current.add(tbrId);
    skipRealtimeRef.current = true;

    const tbrToDelete = (tbrs[rideId] ?? []).find(t => t.id === tbrId);

    setTbrs((prev) => ({
      ...prev,
      [rideId]: (prev[rideId] ?? []).filter((t) => t.id !== tbrId),
    }));

    const { error } = await supabase.from("ride_tbrs").delete().eq("id", tbrId);
    if (error) console.error("Delete TBR error:", error);

    if (tbrToDelete) {
      const { data: rtoMatch } = await supabase
        .from("rto_entries")
        .select("id")
        .eq("tbr_code", tbrToDelete.code)
        .eq("status", "closed")
        .eq("unit_id", unitId)
        .maybeSingle();
      if (rtoMatch) {
        await supabase
          .from("rto_entries")
          .update({ status: "open", closed_at: null })
          .eq("id", rtoMatch.id);
      }
    }

    await fetchOpenRtos();
    deletingRef.current.delete(tbrId);
    // Delay resetting skipRealtime to avoid race condition with Realtime
    setTimeout(() => {
      skipRealtimeRef.current = false;
      fetchRides();
    }, 2000);
  };

  const scrollTbrList = (rideId: string) => {
    setTimeout(() => {
      const el = tbrListRefs.current[rideId];
      if (el) el.scrollTop = el.scrollHeight;
    }, 100);
  };

  // Save TBR logic (shared between scanner debounce and manual Enter)
  const saveTbr = async (rideId: string, code: string) => {
    if (!code.trim()) return;
    if (code.toUpperCase().startsWith("TBR")) {
      const currentTbrs = tbrs[rideId] ?? [];
      const occurrences = currentTbrs.filter(t => t.code.toUpperCase() === code.toUpperCase());
      const count = occurrences.length;

      const tempId = crypto.randomUUID();
      const newTbr: Tbr = { id: tempId, code, scanned_at: new Date().toISOString() };

      if (count === 0) {
        const { data: previousTbrs } = await supabase
          .from("ride_tbrs")
          .select("id")
          .eq("code", code)
          .neq("ride_id", rideId);

        let tripNumber = 1;

        if (previousTbrs && previousTbrs.length > 0) {
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

          await supabase
            .from("piso_entries")
            .update({ status: "closed", closed_at: new Date().toISOString() } as any)
            .eq("tbr_code", code)
            .eq("status", "open");

          await supabase
            .from("rto_entries")
            .update({ status: "closed", closed_at: new Date().toISOString() } as any)
            .eq("tbr_code", code)
            .eq("status", "open");

          playReincidenceBeep();
        }

        newTbr.trip_number = tripNumber;

        setTbrs((prev) => ({
          ...prev,
          [rideId]: [...(prev[rideId] ?? []), newTbr],
        }));
        setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
        setTimeout(() => { inputRefs.current[rideId]?.focus(); scrollTbrList(rideId); }, 50);
        await supabase.from("ride_tbrs").insert({ ride_id: rideId, code, trip_number: tripNumber } as any);
        fetchRides();
      } else if (count === 1) {
        newTbr._duplicate = true;
        setTbrs((prev) => {
          const updated = (prev[rideId] ?? []).map(t =>
            t.code.toUpperCase() === code.toUpperCase() ? { ...t, _duplicate: true } : t
          );
          return { ...prev, [rideId]: [...updated, newTbr] };
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
        newTbr._triplicate = true;
        setTbrs((prev) => {
          const updated = (prev[rideId] ?? []).map(t =>
            t.code.toUpperCase() === code.toUpperCase() ? { ...t, _triplicate: true, _duplicate: false } : t
          );
          return { ...prev, [rideId]: [...updated, newTbr] };
        });
        playErrorBeep();

        const firstTbr = occurrences[0];
        const secondId = occurrences[1]?.id;
        setTimeout(async () => {
          if (firstTbr?.id) {
            await supabase.from("ride_tbrs").update({ highlight: "yellow" } as any).eq("id", firstTbr.id);
          }
          setTbrs((prev) => {
            const list = prev[rideId] ?? [];
            const matching = list.filter(t => t.code.toUpperCase() === code.toUpperCase());
            const first = matching[0];
            const idsToRemove = new Set([tempId, secondId].filter(Boolean));
            const filtered = list
              .filter(t => !idsToRemove.has(t.id))
              .map(t => t.id === first?.id ? { ...t, _triplicate: false, _duplicate: false, _yellowHighlight: true } : t);
            return { ...prev, [rideId]: filtered };
          });
        }, 1000);
        setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
        setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
      }
    } else {
      playErrorBeep();
      setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
      setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
    }
  };

  // Processing lock per ride to prevent double-reads
  const processingRef = useRef<Record<string, boolean>>({});

  // Auto-save TBR with debounce (scanner mode) or Enter (manual mode)
  const handleTbrInputChange = (rideId: string, value: string) => {
    if (value.length > 15) return;

    // Block input while processing previous TBR
    if (processingRef.current[rideId]) return;

    setTbrInputs((prev) => ({ ...prev, [rideId]: value }));

    if (debounceTimers.current[rideId]) {
      clearTimeout(debounceTimers.current[rideId]);
    }

    if (!value.trim()) return;

    // In manual mode, don't auto-save
    if (manualMode[rideId]) return;

    // Scanner mode: fast 50ms debounce
    debounceTimers.current[rideId] = setTimeout(async () => {
      const code = value.trim();
      // Lock processing and clear input immediately
      processingRef.current[rideId] = true;
      setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
      // Force DOM update before async work
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await saveTbr(rideId, code);
      processingRef.current[rideId] = false;
    }, 50);
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = tbrSearch.trim();
      setTbrSearchCommitted(val);
      if (val) {
        fetchSearchResults(val);
      }
    }
  };

  const handleClearSearch = () => {
    setTbrSearch("");
    setTbrSearchCommitted("");
    setSearchRides([]);
    setSearchTbrs({});
  };

  const isSearchActive = tbrSearchCommitted.trim().length > 0;
  const displayRides = isSearchActive ? searchRides : rides;
  const displayTbrs = isSearchActive ? searchTbrs : tbrs;

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) { date.setHours(0, 0, 0, 0); setStartDate(date); }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) { date.setHours(23, 59, 59, 999); setEndDate(date); }
  };

  const renderEditableField = (ride: RideWithDriver, field: "route" | "login" | "password", icon: React.ReactNode, label: string) => {
    const value = ride[field];
    const isEditing = editingField?.rideId === ride.id && editingField?.field === field;

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

    if (!value && !managerSession) return null;

    return (
      <div className="flex items-center gap-2">
        {icon}
        <span><strong>{label}:</strong> {value || "—"}</span>
        {managerSession && (
          <button
            onClick={() => { setEditingField({ rideId: ride.id, field }); setEditValue(value ?? ""); }}
            className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
            title={`Editar ${label.toLowerCase()}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
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

  const getTbrItemClass = (tbr: Tbr) => {
    if (tbr._duplicate || tbr._triplicate) return "bg-red-100 text-red-700 border-red-300";
    if (tbr._yellowHighlight) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (tbrSearchCommitted.trim() && tbr.code.toLowerCase().includes(tbrSearchCommitted.trim().toLowerCase())) {
      return "bg-green-100 border-green-400 text-green-800";
    }
    if (tbr.trip_number && tbr.trip_number >= 3) return "bg-orange-100 text-orange-700 border-orange-300";
    if (tbr.trip_number === 2) return "bg-purple-100 text-purple-700 border-purple-300";
    return "bg-muted/50";
  };

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-x-hidden">
      <h1 className="text-2xl font-bold italic">Conferência Carregamento</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-10"
            placeholder="Buscar TBR... (Enter para buscar)"
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

      {isLoading ? (
        <div className="flex gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : displayRides.length === 0 ? (
        <p className="text-muted-foreground italic text-center py-12">
          {isSearchActive ? "Nenhum resultado encontrado." : "Nenhum carregamento programado hoje."}
        </p>
      ) : (
        <div>
          <div className="flex items-center justify-start gap-2 mb-3 flex-wrap">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => emblaApi?.scrollPrev()} disabled={!canScrollPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => emblaApi?.scrollNext()} disabled={!canScrollNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-3 ml-2 text-[10px] text-muted-foreground">
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

          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex">
              {displayRides.map((ride) => {
                const status = ride.loading_status ?? "pending";
                const rideTbrs = displayTbrs[ride.id] ?? [];
                const isLoadingStatus = status === "loading";
                const isFinished = status === "finished";
                const isCancelled = status === "cancelled";

                return (
                  <div key={ride.id} className="flex-[0_0_85vw] sm:flex-[0_0_320px] min-w-0 pl-4 first:pl-0">
                    <Card className={cn(
                      "relative overflow-hidden h-full transition-colors",
                      isLoadingStatus && "bg-blue-50 border-blue-200",
                      isFinished && "bg-green-50 border-green-200",
                      isCancelled && "bg-red-50 border-red-200"
                    )}>
                      <CardContent className="p-4 flex flex-col items-center gap-3">
                        {/* TBR Counter badge + Bell icon (top-left) */}
                        <div className="absolute top-3 left-3 flex flex-col items-center gap-1">
                          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-bold gap-1">
                            <ScanBarcode className="h-3 w-3" />
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

                        <Avatar className="h-16 w-16 mt-2">
                          {ride.driver_avatar && <AvatarImage src={ride.driver_avatar} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                            {(ride.driver_name ?? "M")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <h3 className="text-lg font-bold text-center">{ride.driver_name}</h3>

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

                        {/* Conferente Select */}
                        <div className="w-full">
                          <Select 
                            value={ride.conferente_id ?? ""} 
                            onValueChange={(val) => handleSelectConferente(ride.id, val)}
                            disabled={!!ride.conferente_id && !managerSession}
                          >
                            <SelectTrigger className="w-full h-9 text-sm">
                              <div className="flex items-center gap-2">
                                <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                                <SelectValue placeholder="Selecionar Conferente" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {conferentes.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Action Buttons */}
                        {!isCancelled && (
                          <div className="w-full flex gap-2">
                            {!isLoadingStatus && !isFinished && (
                              <Button size="sm" className="flex-1 gap-1" onClick={() => handleIniciar(ride.id)}>
                                <Play className="h-3.5 w-3.5" /> Iniciar
                              </Button>
                            )}
                            {isLoadingStatus && (
                              <Button size="sm" variant="destructive" className="flex-1 gap-1" onClick={() => handleFinalizar(ride.id)}>
                                <CheckCircle className="h-3.5 w-3.5" /> Finalizar
                              </Button>
                            )}
                            {isFinished && (
                              <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => handleRetornar(ride.id)}>
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
                            <p className="text-xs font-bold italic flex items-center gap-1">
                              <ScanBarcode className="h-3.5 w-3.5 text-primary" />
                              TBRs Lidos ({rideTbrs.length})
                            </p>
                            {rideTbrs.length > 0 && (
                              <div ref={(el) => { tbrListRefs.current[ride.id] = el; }} className="max-h-32 overflow-y-auto space-y-1">
                                {rideTbrs.map((t, i) => (
                                  <div key={t.id} className={cn("flex items-center gap-2 text-xs rounded px-2 py-1 transition-colors", getTbrItemClass(t))}>
                                    <span className="font-bold text-primary">{i + 1}.</span>
                                    <span className="font-mono flex-1">{t.code}</span>
                                    <button
                                      onClick={() => handleDeleteTbr(t.id, ride.id)}
                                      className="text-destructive hover:text-destructive/80 shrink-0"
                                      title="Excluir TBR"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {isLoadingStatus && (
                              <div className="flex gap-1">
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
    </div>
  );
};

export default ConferenciaCarregamentoPage;
