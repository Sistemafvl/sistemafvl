import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Car, MapPin, User, Hash, KeyRound, Play, CheckCircle, RotateCcw, ScanBarcode, UserCheck, Clock, Search, X, CalendarIcon, Timer, Pencil, ChevronLeft, ChevronRight, Eye } from "lucide-react";
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
  // Driver info modal
  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [driverModalData, setDriverModalData] = useState<any>(null);
  const [driverModalLoading, setDriverModalLoading] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const unitId = unitSession?.id;

  // Carousel
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", containScroll: "trimSnaps", dragFree: true });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

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

  // Search-specific rides (ignoring date filter)
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
      .from("drivers")
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
      // Map highlight from DB
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

  // Search TBR ignoring date filter (item 3)
  const fetchSearchResults = useCallback(async (searchTerm: string) => {
    if (!unitId || !searchTerm.trim()) {
      setSearchRides([]);
      setSearchTbrs({});
      return;
    }

    // Find all ride_tbrs matching the search for this unit's rides
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
      .from("drivers")
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

    // Fetch ALL tbrs for these rides
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

  useEffect(() => { fetchRides(); }, [fetchRides]);

  useEffect(() => {
    if (!unitId) return;
    const channel = supabase
      .channel("conferencia-" + unitId)
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_rides", filter: `unit_id=eq.${unitId}` }, () => { fetchRides(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "ride_tbrs" }, () => { fetchRides(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unitId, fetchRides]);

  const handleSelectConferente = async (rideId: string, conferenteId: string) => {
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
    setTbrs((prev) => ({
      ...prev,
      [rideId]: (prev[rideId] ?? []).filter((t) => t.id !== tbrId),
    }));
    await supabase.from("ride_tbrs").delete().eq("id", tbrId);
    fetchRides();
  };

  // Auto-save TBR with debounce + optimistic insert + duplicate/triplicate detection
  const handleTbrInputChange = (rideId: string, value: string) => {
    if (value.length > 15) return;
    setTbrInputs((prev) => ({ ...prev, [rideId]: value }));

    if (debounceTimers.current[rideId]) {
      clearTimeout(debounceTimers.current[rideId]);
    }

    if (!value.trim()) return;

    debounceTimers.current[rideId] = setTimeout(async () => {
      const code = value.trim();
      if (code.toUpperCase().startsWith("TBR")) {
        const currentTbrs = tbrs[rideId] ?? [];
        const occurrences = currentTbrs.filter(t => t.code.toUpperCase() === code.toUpperCase());
        const count = occurrences.length;

        // Optimistic insert
        const tempId = crypto.randomUUID();
        const newTbr: Tbr = { id: tempId, code, scanned_at: new Date().toISOString() };

        if (count === 0) {
          // Check lifecycle: does this TBR exist in other rides?
          const { data: previousTbrs } = await supabase
            .from("ride_tbrs")
            .select("id")
            .eq("code", code)
            .neq("ride_id", rideId);

          let tripNumber = 1;

          if (previousTbrs && previousTbrs.length > 0) {
            // TBR existed before — check if it went through Retorno Piso
            const { data: closedPiso } = await supabase
              .from("piso_entries")
              .select("id")
              .eq("tbr_code", code)
              .eq("status", "closed");

            if (!closedPiso || closedPiso.length === 0) {
              // Block: TBR needs to go through Retorno Piso first
              playErrorBeep();
              const { toast } = await import("@/hooks/use-toast");
              toast({
                title: "TBR bloqueado",
                description: "Este TBR precisa ser registrado no Retorno Piso antes de sair novamente.",
                variant: "destructive",
              });
              setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
              setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
              return;
            }

            tripNumber = previousTbrs.length + 1;

            // Close any open piso_entries for this TBR
            await supabase
              .from("piso_entries")
              .update({ status: "closed", closed_at: new Date().toISOString() } as any)
              .eq("tbr_code", code)
              .eq("status", "open");

            playReincidenceBeep();
          }

          newTbr.trip_number = tripNumber;

          // Normal insert — add to state + DB
          setTbrs((prev) => ({
            ...prev,
            [rideId]: [...(prev[rideId] ?? []), newTbr],
          }));
          setTbrInputs((prev) => ({ ...prev, [rideId]: "" }));
          setTimeout(() => inputRefs.current[rideId]?.focus(), 50);
          await supabase.from("ride_tbrs").insert({ ride_id: rideId, code, trip_number: tripNumber } as any);
          fetchRides();
        } else if (count === 1) {
          // Duplicate (2nd read) — LOCAL ONLY, do NOT insert in DB
          newTbr._duplicate = true;
          setTbrs((prev) => {
            const updated = (prev[rideId] ?? []).map(t =>
              t.code.toUpperCase() === code.toUpperCase() ? { ...t, _duplicate: true } : t
            );
            return { ...prev, [rideId]: [...updated, newTbr] };
          });
          playErrorBeep();

          // Auto-remove 2nd from state after 1s, clear duplicate flag on 1st
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
          // Triplicate (3rd read) — LOCAL ONLY, do NOT insert in DB
          newTbr._triplicate = true;
          setTbrs((prev) => {
            const updated = (prev[rideId] ?? []).map(t =>
              t.code.toUpperCase() === code.toUpperCase() ? { ...t, _triplicate: true, _duplicate: false } : t
            );
            return { ...prev, [rideId]: [...updated, newTbr] };
          });
          playErrorBeep();

          // After 1s: remove 2nd and 3rd from state, highlight 1st yellow permanently + persist to DB
          const firstTbr = occurrences[0];
          const secondId = occurrences[1]?.id;
          setTimeout(async () => {
            // Persist yellow highlight to DB
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
    }, 300);
  };

  const handleSaveEdit = async (rideId: string, field: string, value: string) => {
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

  // Handle search by Enter (item 2)
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

  // Determine which rides/tbrs to display
  const isSearchActive = tbrSearchCommitted.trim().length > 0;
  const displayRides = isSearchActive ? searchRides : rides;
  const displayTbrs = isSearchActive ? searchTbrs : tbrs;

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      date.setHours(0, 0, 0, 0);
      setStartDate(date);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999);
      setEndDate(date);
    }
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
    const { data: driver } = await supabase.from("drivers").select("*").eq("id", driverId).maybeSingle();
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
    // Green highlight when search matches
    if (tbrSearchCommitted.trim() && tbr.code.toLowerCase().includes(tbrSearchCommitted.trim().toLowerCase())) {
      return "bg-green-100 border-green-400 text-green-800";
    }
    // Reincidence colors
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
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={handleStartDateSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
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
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={handleEndDateSelect}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
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
          {/* Carousel navigation arrows - between filters and cards, right-aligned */}
          <div className="flex items-center justify-start gap-2 mb-3 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={!canScrollPrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => emblaApi?.scrollNext()}
              disabled={!canScrollNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {/* Legend */}
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

                return (
                  <div key={ride.id} className="flex-[0_0_85vw] sm:flex-[0_0_320px] min-w-0 pl-4 first:pl-0">
                    <Card className={cn("relative overflow-hidden h-full transition-colors", isLoadingStatus && "bg-blue-50 border-blue-200", isFinished && "bg-green-50 border-green-200")}>
                      <CardContent className="p-4 flex flex-col items-center gap-3">
                        {/* TBR Counter badge (top-left) */}
                        <Badge variant="secondary" className="absolute top-3 left-3 text-xs px-2 py-0.5 font-bold gap-1">
                          <ScanBarcode className="h-3 w-3" />
                          {rideTbrs.length}
                        </Badge>

                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
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
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold">{ride.car_plate}</span>
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

                        {/* TBR Area */}
                        {(isLoadingStatus || isFinished) && (
                          <div className="w-full space-y-2 border-t pt-3">
                            <p className="text-xs font-bold italic flex items-center gap-1">
                              <ScanBarcode className="h-3.5 w-3.5 text-primary" />
                              TBRs Lidos ({rideTbrs.length})
                            </p>
                            {rideTbrs.length > 0 && (
                              <div className="max-h-32 overflow-y-auto space-y-1">
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
                              <div className="flex gap-2">
                                <Input
                                  ref={(el) => { inputRefs.current[ride.id] = el; }}
                                  className="h-8 text-sm font-mono"
                                  placeholder="Escanear TBR..."
                                  value={tbrInputs[ride.id] ?? ""}
                                  onChange={(e) => handleTbrInputChange(ride.id, e.target.value)}
                                  autoFocus
                                />
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
    </div>
  );
};

export default ConferenciaCarregamentoPage;
