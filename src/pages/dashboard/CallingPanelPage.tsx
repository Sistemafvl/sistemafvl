import React, { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { getBrazilTodayStr, getBrazilDayRange } from "@/lib/utils";
import { Clock, Users, Package, TruckIcon, Bell, MapPin, User, Maximize2, Minimize2, Star } from "lucide-react";
import QRCode from "qrcode";
import jsPDF from "jspdf";

/* ───────── Types ───────── */

interface CallData {
  id: string;
  driver_name: string;
  driver_avatar: string | null;
  called_at: string | null;
  called_by_name: string | null;
  sequence_number?: number;
  route?: string;
  parking_spot?: string;
}

interface CycleData {
  abertura_galpao: string | null;
  hora_inicio_descarregamento: string | null;
  hora_termino_descarregamento: string | null;
  qtd_pacotes: number | null;
  qtd_pacotes_informado: number | null;
}

interface QueueDriver {
  id: string;
  driver_name: string;
  status: string;
  joined_at: string;
}

interface RecentCall {
  id: string;
  driver_name: string;
  called_by_name: string | null;
  parking_spot: string | null;
  route: string | null;
  called_at: string;
}

/* ───────── Gentle ding-dong alert (sine wave, ~4s) ───────── */

const playDingDong = (): (() => void) => {
  try {
    const ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // 8 ding-dong sequences (~10s total)
    for (let i = 0; i < 8; i++) {
      const offset = i * 1.25;
      playNote(523.25, now + offset, 0.5);       // C5 (ding)
      playNote(659.25, now + offset + 0.35, 0.7); // E5 (dong)
    }

    const timeout = setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 11000);

    return () => {
      clearTimeout(timeout);
      try { ctx.close(); } catch {}
    };
  } catch {
    return () => {};
  }
};

/* ───────── Helper: format time string ───────── */
const fmtTime = (t: string | null) => t ? t.slice(0, 5) : "—";
const fmtCalledAt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
};

/* ═══════════════════════════════════════════════ */
/*              CallingPanelPage                   */
/* ═══════════════════════════════════════════════ */

const CallingPanelPage = () => {
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get("unit_id");

  // Call state
  const [currentCall, setCurrentCall] = useState<CallData | null>(null);
  const [showCall, setShowCall] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const stopSoundRef = useRef<(() => void) | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sidebar data
  const [cycleData, setCycleData] = useState<CycleData | null>(null);
  const [tbrCount, setTbrCount] = useState(0);
  const [ridesFinished, setRidesFinished] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [cycleMetrics, setCycleMetrics] = useState<{ c1: { rides: number; tbrs: number }; c2: { rides: number; tbrs: number }; c3: { rides: number; tbrs: number } }>({
    c1: { rides: 0, tbrs: 0 }, c2: { rides: 0, tbrs: 0 }, c3: { rides: 0, tbrs: 0 },
  });

  // Right column
  const [clock, setClock] = useState(new Date());
  const [unitName, setUnitName] = useState("");
  const [queueList, setQueueList] = useState<QueueDriver[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [reviewStats, setReviewStats] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Idle logos
  const logos = ["/logos/favela_llog.png", "/logos/cufa.png", "/logos/fvl.png"];
  const [logoIndex, setLogoIndex] = useState(0);

  // ── Clock ──
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Logo rotation (idle only) ──
  useEffect(() => {
    if (showCall) return;
    const t = setInterval(() => setLogoIndex((p) => (p + 1) % logos.length), 5000);
    return () => clearInterval(t);
  }, [showCall]);

  // ── Fetch unit name ──
  useEffect(() => {
    if (!unitId) return;
    supabase.from("units").select("name").eq("id", unitId).single().then(({ data }) => {
      if (data) setUnitName(data.name);
    });
  }, [unitId]);

  // ── Fetch sidebar data (cycles + metrics) — poll every 30s ──
  const fetchSidebarData = useCallback(async () => {
    if (!unitId) return;
    const today = getBrazilTodayStr();
    const { start, end } = getBrazilDayRange(today);

    // Cycle record
    const { data: cycle } = await supabase
      .from("cycle_records" as any)
      .select("abertura_galpao, hora_inicio_descarregamento, hora_termino_descarregamento, qtd_pacotes, qtd_pacotes_informado")
      .eq("unit_id", unitId)
      .eq("record_date", today)
      .maybeSingle();
    setCycleData((cycle as any) as CycleData | null);

    // TBR count via RPC
    const { data: tbrData } = await supabase.rpc("get_unit_tbr_count", {
      p_unit_id: unitId, p_start: start, p_end: end,
    });
    setTbrCount(typeof tbrData === "number" ? tbrData : 0);

    // Rides finished today (for metrics + cycle calc)
    const { data: ridesData } = await supabase
      .from("driver_rides")
      .select("id, completed_at")
      .eq("unit_id", unitId)
      .eq("loading_status", "finished")
      .gte("completed_at", start)
      .lte("completed_at", end);
    const rides = ridesData || [];
    setRidesFinished(rides.length);

    // Cycle metrics (C1/C2/C3) based on completed_at BRT cutoffs
    const datePrefix = today; // YYYY-MM-DD
    const c1Cut = new Date(`${datePrefix}T11:30:00.000Z`); // 08:30 BRT
    const c2Cut = new Date(`${datePrefix}T12:30:00.000Z`); // 09:30 BRT

    const c1Rides = rides.filter(r => new Date(r.completed_at) <= c1Cut);
    const c2Rides = rides.filter(r => new Date(r.completed_at) <= c2Cut);

    // Get TBR counts per ride via RPC
    const rideIds = rides.map(r => r.id);
    let tbrMap: Record<string, number> = {};
    if (rideIds.length > 0) {
      const { data: tbrCounts } = await supabase.rpc("get_ride_tbr_counts", { p_ride_ids: rideIds });
      if (tbrCounts) {
        for (const row of tbrCounts) {
          tbrMap[row.ride_id] = Number(row.tbr_count);
        }
      }
    }

    const sumTbrs = (rideList: typeof rides) => rideList.reduce((acc, r) => acc + (tbrMap[r.id] || 0), 0);
    setCycleMetrics({
      c1: { rides: c1Rides.length, tbrs: sumTbrs(c1Rides) },
      c2: { rides: c2Rides.length, tbrs: sumTbrs(c2Rides) },
      c3: { rides: rides.length, tbrs: sumTbrs(rides) },
    });

    // Queue count
    const { count: qc } = await supabase
      .from("queue_entries")
      .select("id", { count: "exact", head: true })
      .eq("unit_id", unitId)
      .in("status", ["waiting", "approved"]);
    setQueueCount(qc ?? 0);

    // Review stats
    const { data: reviews } = await supabase
      .from("unit_reviews")
      .select("rating")
      .eq("unit_id", unitId);
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      setReviewStats({ avg, count: reviews.length });
    } else {
      setReviewStats({ avg: 0, count: 0 });
    }
  }, [unitId]);

  useEffect(() => {
    fetchSidebarData();
    const t = setInterval(fetchSidebarData, 30000);
    return () => clearInterval(t);
  }, [fetchSidebarData]);

  // ── Fetch right column data (queue list + recent calls) — poll every 10s ──
  const fetchRightData = useCallback(async () => {
    if (!unitId) return;
    const today = getBrazilTodayStr();
    const { start } = getBrazilDayRange(today);

    // Queue list
    const { data: qList } = await supabase
      .from("queue_entries")
      .select("id, status, joined_at, driver:driver_id(name)")
      .eq("unit_id", unitId)
      .in("status", ["waiting", "approved"])
      .order("joined_at", { ascending: true })
      .limit(20) as any;

    if (qList) {
      setQueueList(qList.map((q: any, i: number) => ({
        id: q.id,
        driver_name: q.driver?.name || "Motorista",
        status: q.status,
        joined_at: q.joined_at,
      })));
    }

    // Recent calls (last 5 called today)
    const { data: rCalls } = await supabase
      .from("queue_entries")
      .select("id, called_at, called_by_name, parking_spot, driver:driver_id(name), rides:driver_rides(route)")
      .eq("unit_id", unitId)
      .not("called_at", "is", null)
      .gte("called_at", start)
      .order("called_at", { ascending: false })
      .limit(5) as any;

    if (rCalls) {
      setRecentCalls(rCalls.map((r: any) => ({
        id: r.id,
        driver_name: r.driver?.name || "Motorista",
        called_by_name: r.called_by_name,
        parking_spot: r.parking_spot,
        route: r.rides?.[0]?.route || null,
        called_at: r.called_at,
      })));
    }
  }, [unitId]);

  useEffect(() => {
    fetchRightData();
    const t = setInterval(fetchRightData, 10000);
    return () => clearInterval(t);
  }, [fetchRightData]);

  // ── Realtime for call trigger ──
  useEffect(() => {
    if (!unitId) return;

    const fetchRecentCall = async () => {
      const { data } = await supabase
        .from("queue_entries")
        .select("id, called_at, called_by_name, parking_spot, driver:driver_id(name, avatar_url), rides:driver_rides(sequence_number, route)")
        .eq("unit_id", unitId)
        .not("called_at", "is", null)
        .order("called_at", { ascending: false })
        .limit(1) as any;

      if (data && data.length > 0) {
        const entry = data[0];
        if (new Date(entry.called_at!).getTime() > Date.now() - 10000) {
          triggerCall(entry);
        }
      }
    };
    fetchRecentCall();

    const channel = supabase
      .channel("calling-panel")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "queue_entries", filter: `unit_id=eq.${unitId}` },
        async (payload) => {
          const newEntry = payload.new as any;
          if (newEntry.called_at && newEntry.called_at !== (payload.old as any)?.called_at) {
            const { data } = await supabase
              .from("queue_entries")
              .select("id, called_at, called_by_name, parking_spot, driver:driver_id(name, avatar_url), rides:driver_rides(sequence_number, route)")
              .eq("id", newEntry.id)
              .single() as any;
            if (data) triggerCall(data);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [unitId]);

  const triggerCall = useCallback((data: any) => {
    const formatted: CallData = {
      id: data.id,
      driver_name: data.driver?.name || "Motorista",
      driver_avatar: data.driver?.avatar_url,
      called_at: data.called_at,
      called_by_name: data.called_by_name,
      parking_spot: data.parking_spot,
      sequence_number: data.rides?.[0]?.sequence_number,
      route: data.rides?.[0]?.route,
    };
    setCurrentCall(formatted);
    setShowCall(true);
    setCountdown(10);
    if (stopSoundRef.current) stopSoundRef.current();
    if (countdownRef.current) clearInterval(countdownRef.current);
    stopSoundRef.current = playDingDong();
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimeout(() => {
      setShowCall(false);
      setCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
      fetchRightData();
      fetchSidebarData();
    }, 10000);
  }, [fetchRightData, fetchSidebarData]);

  const generateQrPdf = useCallback(async (turno: "madrugada" | "diurno") => {
    if (!unitId) return;
    const today = getBrazilTodayStr();
    const url = `${window.location.origin}/driver/queue?qr_turno=${turno}&qr_unit=${unitId}&qr_date=${today}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(url, { width: 600, margin: 2 });
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const title = turno === "madrugada" ? "FILA — TURNO MADRUGADA" : "FILA — TURNO DIURNO";
      const hours = turno === "madrugada" ? "00:00 às 05:00" : "05:01 às 23:59";
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.text(title, 105, 35, { align: "center" });
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Horário válido: " + hours, 105, 48, { align: "center" });
      doc.text("Unidade: " + (unitName || "—"), 105, 58, { align: "center" });
      doc.text("Data: " + today.split("-").reverse().join("/"), 105, 68, { align: "center" });
      doc.addImage(qrDataUrl, "PNG", 52.5, 85, 100, 100);
      doc.setFontSize(11);
      doc.setTextColor(120, 120, 120);
      doc.text("Escaneie este QR Code com a câmera do celular para entrar na fila.", 105, 200, { align: "center" });
      doc.text("Este QR é válido somente para a data e horário indicados acima.", 105, 208, { align: "center" });
      doc.save("qr_fila_" + turno + "_" + today + ".pdf");
    } catch (e) {
      console.error("Erro ao gerar QR PDF:", e);
    }
  }, [unitId, unitName]);

  useEffect(() => {
    return () => { if (stopSoundRef.current) stopSoundRef.current(); };
  }, []);

  // Fullscreen handlers
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const clockStr = clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" });

  /* ═══════════════ RENDER ═══════════════ */

  return (
    <div className="fixed inset-0 flex select-none font-sans overflow-hidden" style={{ background: "#f0f4f8" }}>
      {/* ── SIDEBAR ESQUERDA ── */}
      <div className="w-[260px] flex flex-col shrink-0" style={{ background: "#001529" }}>
        {/* Logo */}
        <div className="p-5 flex justify-center border-b border-white/10">
          <img src="/logos/favela_llog.png" alt="FavelaLLog" className="h-14 object-contain" />
        </div>

        {/* Ciclos C1/C2/C3 */}
        <div className="p-4 space-y-2 border-b border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Ciclos do Dia
          </h3>
          <CycleCard label="C1" subtitle="até 08:30" rides={cycleMetrics.c1.rides} tbrs={cycleMetrics.c1.tbrs} color="#22d3ee" />
          <CycleCard label="C2" subtitle="até 09:30" rides={cycleMetrics.c2.rides} tbrs={cycleMetrics.c2.tbrs} color="#38bdf8" />
          <CycleCard label="C3" subtitle="total" rides={cycleMetrics.c3.rides} tbrs={cycleMetrics.c3.tbrs} color="#818cf8" />
          {cycleData && (
            <div className="mt-2 space-y-1 text-[11px]">
              <CycleRow label="Abertura" value={fmtTime(cycleData.abertura_galpao)} />
              <CycleRow label="Início Desc." value={fmtTime(cycleData.hora_inicio_descarregamento)} />
              <CycleRow label="Término Desc." value={fmtTime(cycleData.hora_termino_descarregamento)} />
              <CycleRow label="Pacotes Info." value={cycleData.qtd_pacotes_informado?.toString() ?? "—"} />
            </div>
          )}
        </div>

        {/* Métricas */}
        <div className="p-4 space-y-2 border-b border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Métricas do Dia
          </h3>
          <MetricRow icon={<TruckIcon className="w-4 h-4 text-emerald-400" />} label="Saídas" value={ridesFinished} />
          <MetricRow icon={<Users className="w-4 h-4 text-amber-400" />} label="Na Fila" value={queueCount} />
        </div>

        {/* Avaliação da Unidade */}
        <div className="p-4 space-y-2 border-b border-white/10 flex-1">
          <h3 className="text-xs font-bold uppercase tracking-widest text-sky-400 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" /> Avaliação
          </h3>
          {reviewStats.count > 0 ? (
            <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-amber-400">{reviewStats.avg.toFixed(1)}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={`w-4 h-4 ${i <= Math.round(reviewStats.avg) ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-white/50 mt-1">{reviewStats.count} avaliação{reviewStats.count > 1 ? "ões" : ""}</p>
            </div>
          ) : (
            <p className="text-[11px] text-white/40 italic">Sem avaliações</p>
          )}
        </div>

        {/* QR Code buttons */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">QR Fila</p>
          <button
            onClick={() => generateQrPdf("madrugada")}
            className="w-full text-xs font-semibold py-2 px-3 rounded-md transition-colors"
            style={{ background: "rgba(255,255,255,0.08)", color: "#7dd3fc", border: "1px solid rgba(125,211,252,0.2)" }}
          >
            🌙 Madrugada (00–05h)
          </button>
          <button
            onClick={() => generateQrPdf("diurno")}
            className="w-full text-xs font-semibold py-2 px-3 rounded-md transition-colors"
            style={{ background: "rgba(255,255,255,0.08)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}
          >
            ☀️ Diurno (05–24h)
          </button>
        </div>

        {/* Logos parceiros */}
        <div className="p-4 flex items-center justify-center gap-4">
          <img src="/logos/cufa.png" alt="CUFA" className="h-8 object-contain opacity-60" style={{ filter: "brightness(0) invert(1)" }} />
          <img src="/logos/fvl.png" alt="FVL" className="h-8 object-contain opacity-60" />
        </div>
      </div>

      {/* ── ÁREA CENTRAL ── */}
      <div className="flex-1 relative flex items-center justify-center" style={{ background: showCall ? "#001529" : "#ffffff" }}>
        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 z-50 p-2 rounded-lg transition-colors hover:bg-black/10"
          style={{ color: showCall ? "#7dd3fc" : "#64748b" }}
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
        <AnimatePresence mode="wait">
          {showCall && currentCall ? (
            <motion.div
              key="call"
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1, y: -50 }}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
              className="w-full max-w-3xl flex flex-col items-center text-center gap-6 px-8"
            >
              {/* Sequence badge */}
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -top-3 -left-3 w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black z-10 border-4 border-white shadow-xl"
                  style={{ background: "#0095ff", color: "#fff" }}
                >
                  {currentCall.sequence_number || "—"}
                </motion.div>
                <div className="w-52 h-52 rounded-full border-[6px] p-1.5 shadow-[0_0_60px_rgba(0,149,255,0.4)]" style={{ borderColor: "#0095ff", background: "#001529" }}>
                  <Avatar className="w-full h-full">
                    {currentCall.driver_avatar && <AvatarImage src={currentCall.driver_avatar} className="object-cover" />}
                    <AvatarFallback className="text-6xl font-bold" style={{ background: "rgba(0,149,255,0.2)", color: "#0095ff" }}>
                      {currentCall.driver_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-col items-center gap-2"
              >
                <h1 className="text-7xl font-black italic tracking-tighter text-white">
                  SUA VEZ!
                </h1>
                {countdown > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold border-2" style={{ borderColor: "#0095ff", color: "#7dd3fc", background: "rgba(0,149,255,0.15)" }}>
                      {countdown}
                    </div>
                    <div className="h-1.5 w-32 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: "#0095ff" }}
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: 10, ease: "linear" }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-bold text-white uppercase"
              >
                {currentCall.driver_name}
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="flex flex-wrap justify-center gap-3 text-lg font-medium"
              >
                <InfoPill icon={<User className="w-4 h-4" />} label="Conferente" value={currentCall.called_by_name || "—"} />
                <InfoPill icon={<MapPin className="w-4 h-4" />} label="Vaga" value={currentCall.parking_spot || currentCall.sequence_number?.toString() || "—"} />
                <InfoPill icon={<TruckIcon className="w-4 h-4" />} label="Rota" value={currentCall.route || "Não definida"} />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={logoIndex}
                  src={logos[logoIndex]}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 1 }}
                  className="max-h-[55vh] max-w-[65vw] object-contain"
                />
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse overlay on call */}
        <AnimatePresence>
          {showCall && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.12 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute inset-0 animate-pulse" style={{ background: "linear-gradient(135deg, #0095ff 0%, transparent 70%)" }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── COLUNA DIREITA ── */}
      <div className="w-[280px] flex flex-col shrink-0 border-l" style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
        {/* Relógio + Unidade */}
        <div className="p-4 text-center border-b" style={{ borderColor: "#e2e8f0" }}>
          <div className="text-4xl font-mono font-bold tracking-wider" style={{ color: "#001529" }}>
            {clockStr}
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide mt-1" style={{ color: "#64748b" }}>
            {unitName || "Unidade"}
          </p>
        </div>

        {/* Fila atual */}
        <div className="flex-1 overflow-hidden flex flex-col border-b" style={{ borderColor: "#e2e8f0" }}>
          <div className="px-4 pt-3 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#0095ff" }}>
              <Users className="w-3.5 h-3.5" /> Fila de Espera ({queueList.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1">
            {queueList.length === 0 ? (
              <p className="text-xs italic px-1 py-4 text-center" style={{ color: "#94a3b8" }}>Fila vazia</p>
            ) : (
              queueList.map((q, i) => (
                <div key={q.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm" style={{ background: i % 2 === 0 ? "#f1f5f9" : "transparent" }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "#0095ff" }}>
                    {i + 1}
                  </span>
                  <span className="truncate font-medium" style={{ color: "#1e293b" }}>{q.driver_name}</span>
                  <span className="ml-auto text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded" style={{
                    background: q.status === "approved" ? "#dcfce7" : "#e0f2fe",
                    color: q.status === "approved" ? "#16a34a" : "#0284c7",
                  }}>
                    {q.status === "approved" ? "Aprovado" : "Aguardando"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Últimas chamadas */}
        <div className="max-h-[35%] overflow-hidden flex flex-col">
          <div className="px-4 pt-3 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#f59e0b" }}>
              <Bell className="w-3.5 h-3.5" /> Últimas Chamadas
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
            {recentCalls.length === 0 ? (
              <p className="text-xs italic px-1 py-3 text-center" style={{ color: "#94a3b8" }}>Nenhuma chamada</p>
            ) : (
              recentCalls.map((rc) => (
                <div key={rc.id} className="p-2 rounded-lg text-xs space-y-0.5" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div className="flex justify-between items-start">
                    <span className="font-bold truncate" style={{ color: "#1e293b" }}>{rc.driver_name}</span>
                    <span className="text-[10px] shrink-0 ml-1" style={{ color: "#94a3b8" }}>{fmtCalledAt(rc.called_at)}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap" style={{ color: "#64748b" }}>
                    {rc.called_by_name && <span>👤 {rc.called_by_name}</span>}
                    {rc.parking_spot && <span>📍 {rc.parking_spot}</span>}
                    {rc.route && <span>🚚 {rc.route}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────── Small sub-components ───────── */

const CycleCard = ({ label, subtitle, rides, tbrs, color }: { label: string; subtitle: string; rides: number; tbrs: number; color: string }) => (
  <div className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black shrink-0" style={{ background: `${color}22`, color }}>
      {label}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase text-white/40">{subtitle}</p>
      <div className="flex gap-3 text-sm">
        <span className="text-white font-bold">{rides} <span className="text-[10px] text-white/50 font-normal">saídas</span></span>
        <span style={{ color }} className="font-bold">{tbrs} <span className="text-[10px] opacity-60 font-normal">TBRs</span></span>
      </div>
    </div>
  </div>
);

const CycleRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center">
    <span className="text-white/60 text-xs">{label}</span>
    <span className="text-white font-semibold text-sm">{value}</span>
  </div>
);

const MetricRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) => (
  <div className="flex items-center gap-2 py-1.5">
    {icon}
    <span className="text-white/70 text-xs flex-1">{label}</span>
    <span className="text-white font-bold text-lg">{value}</span>
  </div>
);

const InfoPill = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl" style={{ background: "rgba(0,149,255,0.15)", border: "1px solid rgba(0,149,255,0.3)", color: "#7dd3fc" }}>
    {icon}
    <span className="text-white/60 text-sm">{label}:</span>
    <span className="text-white font-semibold">{value}</span>
  </div>
);

export default CallingPanelPage;
