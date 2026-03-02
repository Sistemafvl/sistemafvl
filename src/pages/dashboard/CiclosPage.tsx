import { useState, useEffect, useRef, useCallback } from "react";
import { OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw, CalendarIcon, Loader2, Save, FileText,
  Truck, Package, Clock, TrendingUp, TrendingDown, ArrowUp, ArrowDown,
  Timer, CheckCircle, RotateCcw, BarChart3
} from "lucide-react";
import { format, subDays, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getBrazilDayRange, getBrazilNow } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Types
interface CycleRecord {
  qtd_pacotes: number;
  qtd_pacotes_informado: number;
  abertura_galpao: string | null;
  hora_inicio_descarregamento: string | null;
  hora_termino_descarregamento: string | null;
}

interface DayMetrics {
  totalRides: number;
  totalTbrs: number;
  totalReturns: number;
  finishedRides: number;
  avgLoadingMinutes: number | null;
  avgPerTbr: number | null;
  cycle1: number;
  cycle2: number;
  cycle3: number;
  cycle1Tbrs: number;
  cycle2Tbrs: number;
  cycle3Tbrs: number;
}

const EMPTY_RECORD: CycleRecord = {
  qtd_pacotes: 0,
  qtd_pacotes_informado: 0,
  abertura_galpao: null,
  hora_inicio_descarregamento: null,
  hora_termino_descarregamento: null,
};

const CiclosPage = () => {
  const { unitSession } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState<Date>(() => getBrazilNow());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<CycleRecord>(EMPTY_RECORD);
  const [metrics, setMetrics] = useState<DayMetrics | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<DayMetrics | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const computeMetrics = useCallback(async (date: string, unitId: string): Promise<DayMetrics> => {
    const { start: dayStart, end: dayEnd } = getBrazilDayRange(date);

    const { data: rides } = await supabase
      .from("driver_rides")
      .select("id, completed_at, started_at, finished_at, loading_status")
      .eq("unit_id", unitId)
      .gte("completed_at", dayStart)
      .lte("completed_at", dayEnd);

    const rideList = rides ?? [];
    const rideIds = rideList.map(r => r.id);

    let totalTbrs = 0;
    let totalReturns = 0;
    let allTbrsData: { ride_id: string; code: string }[] = [];

    if (rideIds.length > 0) {
      const { fetchAllRows } = await import("@/lib/supabase-helpers");
      const [tbrsData, pisoRaw, psData, rtoData] = await Promise.all([
        fetchAllRows<{ ride_id: string; code: string }>((from, to) =>
          supabase.from("ride_tbrs").select("ride_id, code").in("ride_id", rideIds).range(from, to)
        ),
        fetchAllRows<{ ride_id: string; tbr_code: string; reason: string | null }>((from, to) =>
          supabase.from("piso_entries").select("ride_id, tbr_code, reason").in("ride_id", rideIds).range(from, to)
        ),
        fetchAllRows<{ ride_id: string; tbr_code: string }>((from, to) =>
          supabase.from("ps_entries").select("ride_id, tbr_code").in("ride_id", rideIds).range(from, to)
        ),
        fetchAllRows<{ ride_id: string; tbr_code: string }>((from, to) =>
          supabase.from("rto_entries").select("ride_id, tbr_code").in("ride_id", rideIds).range(from, to)
        ),
      ]);

      allTbrsData = tbrsData;
      totalTbrs = tbrsData.length;
      const pisoData = pisoRaw.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));

      // Build set of TBR codes per ride
      const tbrCodesByRide: Record<string, Set<string>> = {};
      tbrsData.forEach((t) => {
        if (!tbrCodesByRide[t.ride_id]) tbrCodesByRide[t.ride_id] = new Set();
        tbrCodesByRide[t.ride_id].add(t.code);
      });

      // Only count as return if TBR is still in ride_tbrs
      const returnSet = new Set<string>();
      [...pisoData, ...psData, ...rtoData].forEach((e: any) => {
        if (e.ride_id && e.tbr_code && tbrCodesByRide[e.ride_id]?.has(e.tbr_code)) {
          returnSet.add(`${e.ride_id}:${e.tbr_code}`);
        }
      });
      totalReturns = returnSet.size;
    }

    // Avg loading time
    const loadingTimes = rideList
      .filter(r => r.started_at && r.finished_at)
      .map(r => differenceInMinutes(new Date(r.finished_at!), new Date(r.started_at!)))
      .filter(m => m >= 0);

    const avgLoadingMinutes = loadingTimes.length > 0
      ? loadingTimes.reduce((a, b) => a + b, 0) / loadingTimes.length
      : null;

    const totalLoadingMin = loadingTimes.reduce((a, b) => a + b, 0);
    const avgPerTbr = totalTbrs > 0 ? totalLoadingMin / totalTbrs : null;

    const finishedRides = rideList.filter(r => r.finished_at != null).length;

    // Cycles
    const cycle1Cutoff = `${date}T11:30:00.000Z`; // 08:30 BRT
    const cycle2Cutoff = `${date}T12:30:00.000Z`; // 09:30 BRT

    const cycle1 = rideList.filter(r => r.completed_at <= cycle1Cutoff).length;
    const cycle2 = rideList.filter(r => r.completed_at <= cycle2Cutoff).length;
    const cycle3 = rideList.length;

    // TBRs per cycle
    const cycle1RideIds = new Set(rideList.filter(r => r.completed_at <= cycle1Cutoff).map(r => r.id));
    const cycle2RideIds = new Set(rideList.filter(r => r.completed_at <= cycle2Cutoff).map(r => r.id));

    const cycle1Tbrs = allTbrsData.filter(t => cycle1RideIds.has(t.ride_id)).length;
    const cycle2Tbrs = allTbrsData.filter(t => cycle2RideIds.has(t.ride_id)).length;
    const cycle3Tbrs = totalTbrs;

    return {
      totalRides: rideList.length,
      totalTbrs,
      totalReturns,
      finishedRides,
      avgLoadingMinutes,
      avgPerTbr,
      cycle1,
      cycle2,
      cycle3,
      cycle1Tbrs,
      cycle2Tbrs,
      cycle3Tbrs,
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!unitSession) return;
    setLoading(true);

    // Load cycle_record for this date
    const { data: cycleData } = await supabase
      .from("cycle_records" as any)
      .select("*")
      .eq("unit_id", unitSession.id)
      .eq("record_date", dateStr)
      .maybeSingle();

    if (cycleData) {
      setRecord({
        qtd_pacotes: (cycleData as any).qtd_pacotes ?? 0,
        qtd_pacotes_informado: (cycleData as any).qtd_pacotes_informado ?? 0,
        abertura_galpao: (cycleData as any).abertura_galpao ?? null,
        hora_inicio_descarregamento: (cycleData as any).hora_inicio_descarregamento ?? null,
        hora_termino_descarregamento: (cycleData as any).hora_termino_descarregamento ?? null,
      });
    } else {
      setRecord(EMPTY_RECORD);
    }

    // Compute metrics for today and yesterday in parallel
    const prevDateStr = format(subDays(selectedDate, 1), "yyyy-MM-dd");
    const [todayM, prevM] = await Promise.all([
      computeMetrics(dateStr, unitSession.id),
      computeMetrics(prevDateStr, unitSession.id),
    ]);

    setMetrics(todayM);
    setPrevMetrics(prevM);
    setLoading(false);
  }, [unitSession, dateStr, selectedDate, computeMetrics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!unitSession) return;
    setSaving(true);

    const payload = {
      unit_id: unitSession.id,
      record_date: dateStr,
      qtd_pacotes: record.qtd_pacotes,
      qtd_pacotes_informado: record.qtd_pacotes_informado,
      abertura_galpao: record.abertura_galpao || null,
      hora_inicio_descarregamento: record.hora_inicio_descarregamento || null,
      hora_termino_descarregamento: record.hora_termino_descarregamento || null,
    };

    const { error } = await (supabase.from("cycle_records" as any) as any)
      .upsert(payload, { onConflict: "unit_id,record_date" });

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar");
    } else {
      toast.success("Dados salvos com sucesso!");
    }
  };

  const delta = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const DeltaBadge = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const positive = value > 0;
    return (
      <Badge variant="outline" className={cn("text-[10px] gap-0.5", positive ? "text-green-600 border-green-200" : "text-destructive border-destructive/20")}>
        {positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </Badge>
    );
  };

  const formatMin = (min: number | null) => {
    if (min == null) return "—";
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}min`;
  };

  const handleGeneratePdf = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgRatio = canvas.width / canvas.height;
      const pdfRatio = pdfWidth / pdfHeight;

      let finalWidth = pdfWidth;
      let finalHeight = pdfWidth / imgRatio;

      if (finalHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = pdfHeight * imgRatio;
      }

      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight);
      pdf.save(`Resumo_Operacao_${dateStr}.pdf`);
    } catch {
      toast.error("Erro ao gerar PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const taxaConclusao = metrics && metrics.totalTbrs > 0
    ? (((metrics.totalTbrs - metrics.totalReturns) / metrics.totalTbrs) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 font-bold italic">
              <RefreshCw className="h-5 w-5 text-primary" />
              Ciclos
            </CardTitle>
            <Button variant="outline" className="gap-2 font-semibold italic" onClick={() => setReportOpen(true)}>
              <FileText className="h-4 w-4" />
              Relatório
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Manual fields */}
              <div className="rounded-lg border p-4 space-y-4">
                <h3 className="font-bold italic text-sm">Informações Complementares</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Qtd Pacotes</Label>
                    <Input
                      type="number"
                      value={record.qtd_pacotes || ""}
                      onChange={(e) => setRecord({ ...record, qtd_pacotes: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Qtd Pacotes Informado</Label>
                    <Input
                      type="number"
                      value={record.qtd_pacotes_informado || ""}
                      onChange={(e) => setRecord({ ...record, qtd_pacotes_informado: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Abertura Galpão</Label>
                    <Input
                      type="time"
                      value={record.abertura_galpao ?? ""}
                      onChange={(e) => setRecord({ ...record, abertura_galpao: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Início Descarregamento</Label>
                    <Input
                      type="time"
                      value={record.hora_inicio_descarregamento ?? ""}
                      onChange={(e) => setRecord({ ...record, hora_inicio_descarregamento: e.target.value || null })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Término Descarregamento</Label>
                    <Input
                      type="time"
                      value={record.hora_termino_descarregamento ?? ""}
                      onChange={(e) => setRecord({ ...record, hora_termino_descarregamento: e.target.value || null })}
                    />
                  </div>
                </div>
                <Button className="gap-2" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar
                </Button>
              </div>

              {/* Cycle cards */}
              {metrics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-card p-4 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      <h4 className="font-bold italic text-sm">Ciclo 1</h4>
                    </div>
                    <p className="text-3xl font-bold text-primary">{metrics.cycle1}</p>
                    <p className="text-xs text-muted-foreground">Até 08:30</p>
                    <Badge variant="outline" className="text-xs">{metrics.cycle1} carregamentos</Badge>
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span className="font-semibold text-foreground">{metrics.cycle1Tbrs}</span> TBRs lidos
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-4 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      <h4 className="font-bold italic text-sm">Ciclo 2</h4>
                    </div>
                    <p className="text-3xl font-bold text-primary">{metrics.cycle2}</p>
                    <p className="text-xs text-muted-foreground">Até 09:30 (acumulado)</p>
                    <Badge variant="outline" className="text-xs">+{metrics.cycle2 - metrics.cycle1} no ciclo</Badge>
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span className="font-semibold text-foreground">{metrics.cycle2Tbrs}</span> TBRs lidos
                    </div>
                  </div>
                  <div className="rounded-lg border bg-card p-4 text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" />
                      <h4 className="font-bold italic text-sm">Ciclo 3</h4>
                    </div>
                    <p className="text-3xl font-bold text-primary">{metrics.cycle3}</p>
                    <p className="text-xs text-muted-foreground">Total do dia</p>
                    <Badge variant="outline" className="text-xs">+{metrics.cycle3 - metrics.cycle2} no ciclo</Badge>
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span className="font-semibold text-foreground">{metrics.cycle3Tbrs}</span> TBRs lidos
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Report Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <BarChart3 className="h-5 w-5 text-primary" />
              Resumo Operação {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>

          {/* PDF capture container */}
          <div ref={reportRef} className="space-y-2 p-3 bg-background">
            {/* Header for PDF */}
            <div className="text-center pb-1 border-b">
              <h2 className="text-base font-bold italic">Resumo Operação — {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}</h2>
              <p className="text-xs text-muted-foreground">{unitSession?.name} • {unitSession?.domain_name}</p>
            </div>

            {metrics && (
              <>
                {/* BI Indicators */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="rounded-lg border p-2 text-center space-y-0.5">
                    <Clock className="h-3 w-3 mx-auto text-primary" />
                    <p className="text-base font-bold">{formatMin(metrics.avgLoadingMinutes)}</p>
                    <p className="text-[9px] text-muted-foreground">Tempo Médio Carreg.</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center space-y-0.5">
                    <Package className="h-3 w-3 mx-auto text-primary" />
                    <p className="text-base font-bold">{metrics.totalTbrs}</p>
                    <p className="text-[9px] text-muted-foreground">Total TBRs Lidos</p>
                    {prevMetrics && <DeltaBadge value={delta(metrics.totalTbrs, prevMetrics.totalTbrs)} />}
                  </div>
                  <div className="rounded-lg border p-2 text-center space-y-0.5">
                    <Truck className="h-3 w-3 mx-auto text-primary" />
                    <p className="text-base font-bold">{metrics.totalRides}</p>
                    <p className="text-[9px] text-muted-foreground">Total Carregamentos</p>
                    {prevMetrics && <DeltaBadge value={delta(metrics.totalRides, prevMetrics.totalRides)} />}
                  </div>
                  <div className="rounded-lg border p-2 text-center space-y-0.5">
                    <CheckCircle className="h-3 w-3 mx-auto text-green-600" />
                    <p className="text-base font-bold">{metrics.finishedRides}</p>
                    <p className="text-[9px] text-muted-foreground">Liberação Motorista</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center space-y-0.5">
                    <TrendingUp className="h-3 w-3 mx-auto text-green-600" />
                    <p className="text-base font-bold">{taxaConclusao}%</p>
                    <p className="text-[9px] text-muted-foreground">Taxa de Conclusão</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center space-y-0.5">
                    <RotateCcw className="h-3 w-3 mx-auto text-destructive" />
                    <p className="text-base font-bold">{metrics.totalReturns}</p>
                    <p className="text-[9px] text-muted-foreground">Total Retornos</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center space-y-0.5">
                    <Timer className="h-3 w-3 mx-auto text-primary" />
                    <p className="text-base font-bold">{formatMin(metrics.avgPerTbr)}</p>
                    <p className="text-[9px] text-muted-foreground">Tempo Médio/TBR</p>
                  </div>
                  <div className="rounded-lg border p-2 text-center space-y-0.5">
                    {prevMetrics && metrics.totalRides >= prevMetrics.totalRides ? (
                      <TrendingUp className="h-3 w-3 mx-auto text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mx-auto text-destructive" />
                    )}
                    <p className="text-base font-bold">
                      {prevMetrics ? (
                        prevMetrics.totalRides === 0
                          ? (metrics.totalRides > 0 ? "+100%" : "0%")
                          : `${delta(metrics.totalRides, prevMetrics.totalRides) >= 0 ? "+" : ""}${delta(metrics.totalRides, prevMetrics.totalRides).toFixed(1)}%`
                      ) : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Carreg. Dia Anterior</p>
                  </div>
                </div>

                {/* Manual data */}
                <div className="rounded-lg border p-2 space-y-1">
                  <h4 className="font-bold italic text-xs">Informações Complementares</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Qtd Pacotes</p>
                      <p className="font-bold">{record.qtd_pacotes || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Qtd Informado</p>
                      <p className="font-bold">{record.qtd_pacotes_informado || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Diferença</p>
                      {(() => {
                        const diff = (record.qtd_pacotes_informado || 0) - (record.qtd_pacotes || 0);
                        return (
                          <p className={cn("font-bold", diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : "")}>
                            {diff > 0 ? `+${diff}` : diff === 0 ? "0" : String(diff)}
                          </p>
                        );
                      })()}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Abertura Galpão</p>
                      <p className="font-bold">{record.abertura_galpao ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Início Descarreg.</p>
                      <p className="font-bold">{record.hora_inicio_descarregamento ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Término Descarreg.</p>
                      <p className="font-bold">{record.hora_termino_descarregamento ?? "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Cycles summary */}
                <div className="rounded-lg border p-2 space-y-1">
                  <h4 className="font-bold italic text-xs">Ciclos</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center rounded-md border p-1.5">
                      <p className="text-xs text-muted-foreground">Ciclo 1 (até 08:30)</p>
                      <p className="text-lg font-bold text-primary">{metrics.cycle1}</p>
                      <p className="text-[10px] text-muted-foreground">{metrics.cycle1Tbrs} TBRs</p>
                    </div>
                    <div className="text-center rounded-md border p-1.5">
                      <p className="text-xs text-muted-foreground">Ciclo 2 (até 09:30)</p>
                      <p className="text-lg font-bold text-primary">{metrics.cycle2}</p>
                      <p className="text-[10px] text-muted-foreground">{metrics.cycle2Tbrs} TBRs</p>
                    </div>
                    <div className="text-center rounded-md border p-1.5">
                      <p className="text-xs text-muted-foreground">Ciclo 3 (total)</p>
                      <p className="text-lg font-bold text-primary">{metrics.cycle3}</p>
                      <p className="text-[10px] text-muted-foreground">{metrics.cycle3Tbrs} TBRs</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button className="gap-2" onClick={handleGeneratePdf} disabled={generatingPdf}>
              {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Gerar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CiclosPage;
