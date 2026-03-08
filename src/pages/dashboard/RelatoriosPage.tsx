import { useState, useRef, useCallback } from "react";
import { OPERATIONAL_PISO_REASONS } from "@/lib/status-labels";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, BarChart3, RotateCcw, Trophy, Loader2, Search, X, Eye, Download, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { loadLogoBase64, generatePDFFromContainer, formatCurrency } from "./reports/pdf-utils";
import PayrollReportContent, { type DriverPayrollData } from "./reports/PayrollReportContent";
import DailySummaryReportContent, { type DailySummaryRow } from "./reports/DailySummaryReportContent";
import ReturnsReportContent, { type ReturnEntry } from "./reports/ReturnsReportContent";
import RankingReportContent, { type RankingRow } from "./reports/RankingReportContent";
import FormatChoiceModal from "@/components/dashboard/FormatChoiceModal";
import { generatePayrollExcel } from "./reports/generatePayrollExcel";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

const RelatoriosPage = () => {
  const { unitSession } = useAuthStore();
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [payrollSearch, setPayrollSearch] = useState("");

  // Modal state
  const [payrollMode, setPayrollMode] = useState<"consult" | "espelho" | "gerar" | null>(null);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [formatChoiceOpen, setFormatChoiceOpen] = useState(false);
  const [formatChoiceAction, setFormatChoiceAction] = useState<"espelho" | "gerar" | null>(null);

  // Payroll state
  const [payrollData, setPayrollData] = useState<DriverPayrollData[] | null>(null);
  const [unitName, setUnitName] = useState("");
  const [tbrValue, setTbrValue] = useState(0);
  const [logoBase64, setLogoBase64] = useState("");
  const payrollRef = useRef<HTMLDivElement>(null);

  // Daily summary state
  const [dailyData, setDailyData] = useState<DailySummaryRow[] | null>(null);
  const dailyRef = useRef<HTMLDivElement>(null);

  // Returns state
  const [returnsData, setReturnsData] = useState<{ piso: ReturnEntry[]; ps: ReturnEntry[]; rto: ReturnEntry[] } | null>(null);
  const returnsRef = useRef<HTMLDivElement>(null);

  // Ranking state
  const [rankingData, setRankingData] = useState<RankingRow[] | null>(null);
  const rankingRef = useRef<HTMLDivElement>(null);

  // Expanded driver in modal
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  const unitId = unitSession?.id;
  const generatedBy = unitSession?.user_name || "Sistema";

  const ensureCommon = async () => {
    if (!unitId) return null;
    const logo = await loadLogoBase64();
    setLogoBase64(logo);
    const { data: unitData } = await supabase.from("units").select("name").eq("id", unitId).maybeSingle();
    const uName = unitData?.name ?? "";
    setUnitName(uName);
    const { data: settings } = await supabase.from("unit_settings").select("tbr_value").eq("unit_id", unitId).maybeSingle();
    const tVal = Number(settings?.tbr_value ?? 0);
    setTbrValue(tVal);
    return { uName, tVal, logo };
  };

  // Open modal for Espelho or Gerar (fetch data first, then show modal)
  const openPayrollModal = async (mode: "consult" | "espelho" | "gerar") => {
    if (!unitId) return;
    setLoading(mode === "consult" ? "consult" : mode === "espelho" ? "espelho" : "payroll");
    try {
      const common = await ensureCommon();
      if (!common) { setLoading(null); return; }
      const result = await fetchPayrollData(common);
      if (!result) { setLoading(null); return; }
      setPayrollMode(mode);
    } catch {
      toast({ title: "Erro", description: "Erro ao buscar dados.", variant: "destructive" });
    }
    setLoading(null);
  };

  // Save to DB + mark DNRs + generate PDF
  const handleConfirmAndGenerate = async () => {
    if (!unitId || !payrollData) return;
    setSavingPayroll(true);
    try {
      // Save to payroll_reports
      const { data: savedReport } = await supabase.from("payroll_reports" as any).insert({
        unit_id: unitId,
        generated_by: generatedBy,
        period_start: format(startDate, "yyyy-MM-dd"),
        period_end: format(endDate, "yyyy-MM-dd"),
        report_data: payrollData,
      } as any).select("id").single();

      // Mark DNRs as reported in this payroll
      if (savedReport && (savedReport as any).id) {
        const reportId = (savedReport as any).id;
        const { data: usedDnrs } = await supabase.from("dnr_entries")
          .select("id")
          .eq("unit_id", unitId)
          .eq("status", "closed")
          .eq("discounted", true)
          .is("reported_in_payroll_id" as any, null)
          .gte("closed_at", startDate.toISOString())
          .lte("closed_at", endDate.toISOString());
        if (usedDnrs?.length) {
          for (const dnr of usedDnrs) {
            await supabase.from("dnr_entries")
              .update({ reported_in_payroll_id: reportId } as any)
              .eq("id", dnr.id);
          }
        }
      }

      // Generate PDF
      await new Promise((r) => setTimeout(r, 500));
      if (payrollRef.current) {
        await generatePDFFromContainer(payrollRef.current, `folha_pagamento_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.pdf`);
        toast({ title: "PDF gerado!", description: "Folha de pagamento salva e baixada com sucesso." });
      }
      setPayrollMode(null);
    } catch {
      toast({ title: "Erro", description: "Erro ao gerar relatório.", variant: "destructive" });
    }
    setSavingPayroll(false);
  };

  // Generate PDF only (espelho, no save)
  const handleDownloadPDF = async () => {
    setSavingPayroll(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      if (payrollRef.current) {
        await generatePDFFromContainer(payrollRef.current, `espelho_folha_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.pdf`);
        toast({ title: "Espelho gerado!", description: "PDF de consulta baixado com sucesso." });
      }
    } catch {
      toast({ title: "Erro", description: "Erro ao gerar PDF.", variant: "destructive" });
    }
    setSavingPayroll(false);
  };

  // ── Daily Summary ──
  const fetchDailySummary = async () => {
    if (!unitId) return;
    setLoading("daily");
    try {
      const common = await ensureCommon();
      if (!common) return;

      const { fetchAllRows } = await import("@/lib/supabase-helpers");
      const [ridesRes, pisoData, psData, rtoData] = await Promise.all([
        supabase.from("driver_rides").select("id, completed_at, driver_id").eq("unit_id", unitId)
          .gte("completed_at", startDate.toISOString()).lte("completed_at", endDate.toISOString()),
        fetchAllRows<{ id: string; created_at: string }>((from, to) =>
          supabase.from("piso_entries").select("id, created_at").eq("unit_id", unitId)
            .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()).order("id").range(from, to)
        ),
        fetchAllRows<{ id: string; created_at: string }>((from, to) =>
          supabase.from("ps_entries").select("id, created_at").eq("unit_id", unitId)
            .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()).order("id").range(from, to)
        ),
        fetchAllRows<{ id: string; created_at: string }>((from, to) =>
          supabase.from("rto_entries").select("id, created_at").eq("unit_id", unitId)
            .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()).order("id").range(from, to)
        ),
      ]);

      const rides = ridesRes.data ?? [];
      const rideIds = rides.map(r => r.id);

      const { fetchAllRowsWithIn } = await import("@/lib/supabase-helpers");
      const allTbrs = rideIds.length > 0
        ? await fetchAllRowsWithIn<{ ride_id: string }>(
            (ids) => (from, to) => supabase.from("ride_tbrs").select("ride_id").in("ride_id", ids).order("id").range(from, to),
            rideIds)
        : [];
      const piso = pisoData;
      const ps = psData;
      const rto = rtoData;

      const dayMap = new Map<string, DailySummaryRow>();
      rides.forEach(r => {
        const day = format(new Date(r.completed_at), "yyyy-MM-dd");
        if (!dayMap.has(day)) dayMap.set(day, { date: day, loadings: 0, tbrs: 0, piso: 0, ps: 0, rto: 0, totalReturns: 0, activeDrivers: 0 });
        dayMap.get(day)!.loadings++;
      });

      const rideToDay = new Map<string, string>();
      rides.forEach(r => rideToDay.set(r.id, format(new Date(r.completed_at), "yyyy-MM-dd")));
      allTbrs.forEach(t => {
        const day = rideToDay.get(t.ride_id);
        if (day && dayMap.has(day)) dayMap.get(day)!.tbrs++;
      });

      piso.forEach(p => { const day = format(new Date(p.created_at), "yyyy-MM-dd"); if (dayMap.has(day)) dayMap.get(day)!.piso++; });
      ps.forEach(p => { const day = format(new Date(p.created_at), "yyyy-MM-dd"); if (dayMap.has(day)) dayMap.get(day)!.ps++; });
      rto.forEach(p => { const day = format(new Date(p.created_at), "yyyy-MM-dd"); if (dayMap.has(day)) dayMap.get(day)!.rto++; });

      const dayDrivers = new Map<string, Set<string>>();
      rides.forEach(r => {
        const day = format(new Date(r.completed_at), "yyyy-MM-dd");
        if (!dayDrivers.has(day)) dayDrivers.set(day, new Set());
        dayDrivers.get(day)!.add(r.driver_id);
      });
      dayDrivers.forEach((set, day) => { if (dayMap.has(day)) dayMap.get(day)!.activeDrivers = set.size; });

      dayMap.forEach(row => { row.totalReturns = row.piso + row.ps + row.rto; });

      const rows = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
      if (!rows.length) { toast({ title: "Sem dados", description: "Nenhum dado no período.", variant: "destructive" }); setLoading(null); return; }

      setDailyData(rows);
      setTimeout(async () => {
        if (dailyRef.current) {
          await generatePDFFromContainer(dailyRef.current, `resumo_diario_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.pdf`);
          toast({ title: "PDF gerado!", description: "Resumo diário baixado com sucesso." });
        }
      }, 500);
    } catch { toast({ title: "Erro", description: "Erro ao gerar relatório.", variant: "destructive" }); }
    setLoading(null);
  };

  // ── Returns ──
  const fetchReturns = async () => {
    if (!unitId) return;
    setLoading("returns");
    try {
      const common = await ensureCommon();
      if (!common) return;

      const { fetchAllRows } = await import("@/lib/supabase-helpers");
      const [pisoRaw, psRaw, rtoRaw] = await Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase.from("piso_entries").select("tbr_code, reason, driver_name, route, created_at").eq("unit_id", unitId)
            .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()).order("id").range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
          supabase.from("ps_entries").select("tbr_code, description, driver_name, route, created_at").eq("unit_id", unitId)
            .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()).order("id").range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
          supabase.from("rto_entries").select("tbr_code, description, driver_name, route, created_at, cep").eq("unit_id", unitId)
            .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()).order("id").range(from, to)
        ),
      ]);

      const pisoEntries: ReturnEntry[] = pisoRaw.map(e => ({ tbr_code: e.tbr_code, description: e.reason, driver_name: e.driver_name, route: e.route, date: e.created_at }));
      const psEntries: ReturnEntry[] = psRaw.map(e => ({ tbr_code: e.tbr_code, description: e.description, driver_name: e.driver_name, route: e.route, date: e.created_at }));
      const rtoEntries: ReturnEntry[] = rtoRaw.map(e => ({ tbr_code: e.tbr_code, description: e.description, driver_name: e.driver_name, route: e.route, date: e.created_at, cep: e.cep }));

      if (!pisoEntries.length && !psEntries.length && !rtoEntries.length) {
        toast({ title: "Sem dados", description: "Nenhum retorno no período.", variant: "destructive" }); setLoading(null); return;
      }

      setReturnsData({ piso: pisoEntries, ps: psEntries, rto: rtoEntries });
      setTimeout(async () => {
        if (returnsRef.current) {
          await generatePDFFromContainer(returnsRef.current, `retornos_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.pdf`);
          toast({ title: "PDF gerado!", description: "Relatório de retornos baixado com sucesso." });
        }
      }, 500);
    } catch { toast({ title: "Erro", description: "Erro ao gerar relatório.", variant: "destructive" }); }
    setLoading(null);
  };

  // ── Ranking ──
  const fetchRanking = async () => {
    if (!unitId) return;
    setLoading("performance");
    try {
      const common = await ensureCommon();
      if (!common) return;

      const { data: rides } = await supabase.from("driver_rides").select("id, driver_id, completed_at").eq("unit_id", unitId)
        .gte("completed_at", startDate.toISOString()).lte("completed_at", endDate.toISOString());

      if (!rides?.length) { toast({ title: "Sem dados", description: "Nenhum carregamento no período.", variant: "destructive" }); setLoading(null); return; }

      const driverIds = [...new Set(rides.map(r => r.driver_id))];
      const rideIds = rides.map(r => r.id);

      const { fetchAllRowsWithIn } = await import("@/lib/supabase-helpers");
      const [driversRes, pisoRaw, psRankData, rtoRankData] = await Promise.all([
        supabase.from("drivers_public").select("id, name").in("id", driverIds),
        fetchAllRowsWithIn<{ ride_id: string; tbr_code: string; reason: string | null }>(
          (ids) => (from, to) => supabase.from("piso_entries").select("ride_id, tbr_code, reason").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<{ ride_id: string; tbr_code: string }>(
          (ids) => (from, to) => supabase.from("ps_entries").select("ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
        fetchAllRowsWithIn<{ ride_id: string; tbr_code: string }>(
          (ids) => (from, to) => supabase.from("rto_entries").select("ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
          rideIds
        ),
      ]);
      const tbrsData = await fetchAllRowsWithIn<{ ride_id: string }>(
        (ids) => (from, to) => supabase.from("ride_tbrs").select("ride_id").in("ride_id", ids).order("id").range(from, to),
        rideIds
      );

      const drivers = driversRes.data ?? [];
      const driverMap = new Map(drivers.map(d => [d.id, d.name]));
      const allTbrs = tbrsData;
      const pisoRankData = pisoRaw.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));
      const allReturns = [...pisoRankData, ...psRankData, ...rtoRankData];

      const ranking: RankingRow[] = driverIds.map(did => {
        const driverRides = rides.filter(r => r.driver_id === did);
        const driverRideIds = driverRides.map(r => r.id);
        const tbrs = allTbrs.filter(t => driverRideIds.includes(t.ride_id)).length;
        const returnTbrSet = new Set<string>();
        allReturns.forEach((r: any) => { if (r.ride_id && driverRideIds.includes(r.ride_id) && r.tbr_code) returnTbrSet.add(r.tbr_code); });
        const returns = returnTbrSet.size;
        const completed = tbrs - returns;
        const daysWorked = new Set(driverRides.map(r => format(new Date(r.completed_at), "yyyy-MM-dd"))).size;
        return {
          position: 0,
          name: driverMap.get(did) || "—",
          tbrs, returns,
          completionRate: tbrs > 0 ? ((completed / tbrs) * 100).toFixed(1) : "0.0",
          daysWorked,
          avgDaily: daysWorked > 0 ? Math.round(tbrs / daysWorked) : 0,
          value: completed * common.tVal,
        };
      }).sort((a, b) => b.tbrs - a.tbrs).map((r, i) => ({ ...r, position: i + 1 }));

      setRankingData(ranking);
      setTimeout(async () => {
        if (rankingRef.current) {
          await generatePDFFromContainer(rankingRef.current, `ranking_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.pdf`);
          toast({ title: "PDF gerado!", description: "Ranking de performance baixado com sucesso." });
        }
      }, 500);
    } catch { toast({ title: "Erro", description: "Erro ao gerar relatório.", variant: "destructive" }); }
    setLoading(null);
  };

  // Separated data fetching for reuse
  const fetchPayrollData = async (common: { uName: string; tVal: number; logo: string }) => {
    const { data: rides } = await supabase.from("driver_rides").select("*").eq("unit_id", unitId!)
      .gte("completed_at", startDate.toISOString()).lte("completed_at", endDate.toISOString());
    if (!rides?.length) { toast({ title: "Sem dados", description: "Nenhum carregamento no período.", variant: "destructive" }); return; }

    const driverIds = [...new Set(rides.map(r => r.driver_id))];
    const rideIds = rides.map(r => r.id);

    const { fetchAllRowsWithIn } = await import("@/lib/supabase-helpers");
    const [driversRes, allPisoRaw, allPs, allRto, customValuesRes, bonusRes, minPkgRes, fixedValuesRes] = await Promise.all([
      supabase.from("drivers_public").select("id, name, cpf, car_plate, car_model, car_color").in("id", driverIds),
      fetchAllRowsWithIn<{ ride_id: string; tbr_code: string; reason: string | null }>(
        (ids) => (from, to) => supabase.from("piso_entries").select("ride_id, tbr_code, reason").in("ride_id", ids).order("id").range(from, to),
        rideIds
      ),
      fetchAllRowsWithIn<{ ride_id: string; tbr_code: string }>(
        (ids) => (from, to) => supabase.from("ps_entries").select("ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
        rideIds
      ),
      fetchAllRowsWithIn<{ ride_id: string; tbr_code: string }>(
        (ids) => (from, to) => supabase.from("rto_entries").select("ride_id, tbr_code").in("ride_id", ids).order("id").range(from, to),
        rideIds
      ),
      supabase.from("driver_custom_values").select("driver_id, custom_tbr_value").eq("unit_id", unitId!),
      supabase.from("driver_bonus").select("driver_id, amount, description, period_start").eq("unit_id", unitId!)
        .gte("period_start", format(startDate, "yyyy-MM-dd")).lte("period_start", format(endDate, "yyyy-MM-dd")),
      supabase.from("driver_minimum_packages" as any).select("driver_id, min_packages").eq("unit_id", unitId!),
      supabase.from("driver_fixed_values" as any).select("driver_id, target_date, fixed_value").eq("unit_id", unitId!)
        .gte("target_date", format(startDate, "yyyy-MM-dd")).lte("target_date", format(endDate, "yyyy-MM-dd")),
    ]);
    const tbrsData = await fetchAllRowsWithIn<{ ride_id: string; code: string }>(
      (ids) => (from, to) => supabase.from("ride_tbrs").select("ride_id, code").in("ride_id", ids).order("id").range(from, to),
      rideIds
    );

    const drivers = driversRes.data ?? [];
    const allPiso = allPisoRaw.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));
    const allTbrs = tbrsData;
    const driverMap = new Map(drivers.map(d => [d.id, d]));
    const customValueMap = new Map<string, number>();
    (customValuesRes.data ?? []).forEach((cv: any) => { customValueMap.set(cv.driver_id, Number(cv.custom_tbr_value)); });
    const bonusByDriver = new Map<string, number>();
    (bonusRes.data ?? []).forEach((b: any) => { bonusByDriver.set(b.driver_id, (bonusByDriver.get(b.driver_id) ?? 0) + Number(b.amount)); });
    const minPkgMap = new Map<string, number>();
    ((minPkgRes.data as any[]) ?? []).forEach((mp: any) => { minPkgMap.set(mp.driver_id, Number(mp.min_packages)); });
    const fixedValueMap = new Map<string, number>();
    ((fixedValuesRes as any)?.data ?? []).forEach((fv: any) => { fixedValueMap.set(`${fv.driver_id}_${fv.target_date}`, Number(fv.fixed_value)); });

    const { data: dnrData } = await supabase.from("dnr_entries").select("id, driver_id, dnr_value")
      .eq("unit_id", unitId!).eq("status", "closed").eq("discounted", true)
      .is("reported_in_payroll_id" as any, null)
      .gte("closed_at", startDate.toISOString()).lte("closed_at", endDate.toISOString());
    const dnrByDriver = new Map<string, number>();
    (dnrData ?? []).forEach((d: any) => { 
      if (d.driver_id) {
        dnrByDriver.set(d.driver_id, (dnrByDriver.get(d.driver_id) ?? 0) + Number(d.dnr_value));
      }
    });

    // Fetch reativo entries for the period
    const { data: reativoData } = await supabase.from("reativo_entries")
      .select("driver_id, reativo_value")
      .eq("unit_id", unitId!)
      .eq("status", "active")
      .gte("activated_at", startDate.toISOString())
      .lte("activated_at", endDate.toISOString());
    const reativoByDriver = new Map<string, number>();
    (reativoData ?? []).forEach((r: any) => {
      if (r.driver_id) {
        reativoByDriver.set(r.driver_id, (reativoByDriver.get(r.driver_id) ?? 0) + Number(r.reativo_value));
      }
    });

    const pixByDriver = new Map<string, string>();
    await Promise.all(driverIds.map(async (did) => {
      try {
        const { data } = await supabase.functions.invoke("get-driver-details", { body: { driver_id: did, self_access: true } });
        if (data?.pix_key) pixByDriver.set(did, data.pix_key);
      } catch {}
    }));

    const result: DriverPayrollData[] = driverIds.map(driverId => {
      const driver = driverMap.get(driverId)!;
      const driverRides = rides.filter(r => r.driver_id === driverId);
      const tbrVal = customValueMap.get(driverId) ?? common.tVal;
      const dayMap = new Map<string, { login: string | null; rideIds: string[] }>();
      driverRides.forEach(r => {
        const dayKey = format(new Date(r.completed_at), "yyyy-MM-dd");
        const existing = dayMap.get(dayKey);
        if (existing) { existing.rideIds.push(r.id); if (r.login && !existing.login) existing.login = r.login; }
        else dayMap.set(dayKey, { login: r.login, rideIds: [r.id] });
      });

      const days = Array.from(dayMap.entries()).sort().map(([date, info]) => {
        const rTbrs = allTbrs.filter(t => info.rideIds.includes(t.ride_id));

        const returnCodesForDay = new Set<string>();
        [...allPiso, ...allPs, ...allRto].forEach((p: any) => {
          if (p.ride_id && info.rideIds.includes(p.ride_id) && p.tbr_code) {
            returnCodesForDay.add(p.tbr_code.toUpperCase());
          }
        });

        const sortedDayRides = driverRides
          .filter(r => info.rideIds.includes(r.id))
          .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());

        const netReturns = new Set<string>();
        returnCodesForDay.forEach(codeUpper => {
          let lastRideId: string | null = null;
          for (const ride of sortedDayRides) {
            if (rTbrs.some((t: any) => t.ride_id === ride.id && t.code.toUpperCase() === codeUpper)) {
              lastRideId = ride.id;
            }
          }
          if (lastRideId) {
            const hasReturnInLast = [...allPiso, ...allPs, ...allRto].some(
              (p: any) => p.ride_id === lastRideId && p.tbr_code.toUpperCase() === codeUpper
            );
            if (hasReturnInLast) netReturns.add(codeUpper);
          }
        });

        let tbrCount = rTbrs.length;
        const returns = netReturns.size;
        const minPkg = minPkgMap.get(driverId) ?? 0;
        if (minPkg > 0 && tbrCount < minPkg) tbrCount = minPkg;
        const completed = tbrCount - returns;
        const fixedKey = `${driverId}_${date}`;
        const fixedVal = fixedValueMap.get(fixedKey);
        return { date, login: info.login, tbrCount, returns, completed, value: fixedVal !== undefined ? fixedVal : completed * tbrVal };
      });

      const totalTbrs = days.reduce((s, d) => s + d.tbrCount, 0);
      const totalReturns = days.reduce((s, d) => s + d.returns, 0);
      const totalCompleted = totalTbrs - totalReturns;
      const loginsUsed = [...new Set(driverRides.map(r => r.login).filter(Boolean) as string[])];
      const bestDay = days.length ? days.reduce((a, b) => a.tbrCount > b.tbrCount ? a : b) : null;
      const worstDay = days.length ? days.reduce((a, b) => a.tbrCount < b.tbrCount ? a : b) : null;
      const dnrDiscount = dnrByDriver.get(driverId) ?? 0;
      const bonusAmount = bonusByDriver.get(driverId) ?? 0;
      const reativoTotal = reativoByDriver.get(driverId) ?? 0;

      return {
        driver: {
          id: driver.id, name: driver.name, cpf: driver.cpf,
          car_plate: driver.car_plate, car_model: driver.car_model, car_color: driver.car_color,
          pixKey: pixByDriver.get(driverId) ?? null,
        },
        days, totalTbrs, totalReturns, totalCompleted,
        tbrValueUsed: tbrVal, bonus: bonusAmount, reativoTotal,
        totalValue: days.reduce((s, d) => s + d.value, 0) - dnrDiscount + bonusAmount + reativoTotal,
        dnrDiscount, daysWorked: days.length, loginsUsed,
        bestDay: bestDay ? { date: bestDay.date, tbrs: bestDay.tbrCount } : null,
        worstDay: worstDay ? { date: worstDay.date, tbrs: worstDay.tbrCount } : null,
        avgDaily: days.length ? Math.round(totalTbrs / days.length) : 0,
      };
    }).sort((a, b) => b.totalTbrs - a.totalTbrs);

    setPayrollData(result);
    return result;
  };

  const reportCards = [
    { key: "payroll", title: "Folha de Pagamento", description: "Ficha individual por motorista com design profissional", icon: FileText,
      action: () => openPayrollModal("gerar"),
      secondAction: () => openPayrollModal("consult"),
      espelhoAction: () => openPayrollModal("espelho"),
    },
    { key: "daily", title: "Resumo Diário", description: "Consolidado operacional por dia do período", icon: BarChart3, action: fetchDailySummary },
    { key: "returns", title: "Relatório de Retornos", description: "Todos os retornos (Piso, PS, RTO) do período", icon: RotateCcw, action: fetchReturns },
    { key: "performance", title: "Ranking Performance", description: "Classificação dos motoristas por desempenho", icon: Trophy, action: fetchRanking },
  ];

  const filteredPayroll = payrollData?.filter((d) => {
    if (!payrollSearch.trim()) return true;
    const q = payrollSearch.toLowerCase();
    return (
      d.driver.name?.toLowerCase().includes(q) ||
      d.driver.cpf?.toLowerCase().includes(q) ||
      d.driver.car_plate?.toLowerCase().includes(q) ||
      d.driver.car_model?.toLowerCase().includes(q) ||
      d.driver.pixKey?.toLowerCase().includes(q)
    );
  }) ?? [];

  const modalTitle = payrollMode === "gerar" ? "Gerar — Folha de Pagamento"
    : payrollMode === "espelho" ? "Espelho — Folha de Pagamento"
    : "Consulta — Folha de Pagamento";

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold italic">Relatórios</h1>

        <div className="flex flex-wrap gap-3 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 justify-start">
                <CalendarIcon className="h-4 w-4" />
                {format(startDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={(d) => { if (d) { d.setHours(0, 0, 0, 0); setStartDate(d); } }} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground font-semibold">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 justify-start">
                <CalendarIcon className="h-4 w-4" />
                {format(endDate, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={endDate} onSelect={(d) => { if (d) { d.setHours(23, 59, 59, 999); setEndDate(d); } }} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reportCards.map((r) => (
            <Card key={r.key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <r.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold italic">{r.title}</CardTitle>
                    <CardDescription className="text-xs">{r.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {r.secondAction ? (
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs px-2" onClick={r.secondAction} disabled={loading === "consult"}>
                      {loading === "consult" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      Consultar
                    </Button>
                    {(r as any).espelhoAction && (
                      <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs px-2" onClick={(r as any).espelhoAction} disabled={loading === "espelho"}>
                        {loading === "espelho" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        Espelho
                      </Button>
                    )}
                    <Button size="sm" className="flex-1 gap-1 text-xs px-2" onClick={r.action} disabled={loading === r.key || loading === "payroll"}>
                      {(loading === r.key || loading === "payroll") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      Gerar
                    </Button>
                  </div>
                ) : (
                  <Button className="w-full gap-2" onClick={r.action} disabled={loading === r.key}>
                    {loading === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Gerar PDF
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Off-screen report containers */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, width: "1122px", zIndex: -1 }}>
        {payrollData && (
          <PayrollReportContent ref={payrollRef} data={payrollData} unitName={unitName} tbrValue={tbrValue}
            startDate={startDate} endDate={endDate} generatedBy={generatedBy} logoBase64={logoBase64} />
        )}
        {dailyData && (
          <DailySummaryReportContent ref={dailyRef} data={dailyData} unitName={unitName}
            startDate={startDate} endDate={endDate} generatedBy={generatedBy} logoBase64={logoBase64} />
        )}
        {returnsData && (
          <ReturnsReportContent ref={returnsRef} pisoEntries={returnsData.piso} psEntries={returnsData.ps} rtoEntries={returnsData.rto}
            unitName={unitName} startDate={startDate} endDate={endDate} generatedBy={generatedBy} logoBase64={logoBase64} />
        )}
        {rankingData && (
          <RankingReportContent ref={rankingRef} data={rankingData} unitName={unitName} tbrValue={tbrValue}
            startDate={startDate} endDate={endDate} generatedBy={generatedBy} logoBase64={logoBase64} />
        )}
      </div>

      {/* Payroll Preview Modal */}
      {payrollMode && payrollData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={() => { if (!savingPayroll) setPayrollMode(null); }} />
          <div className="relative z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto border bg-background p-6 shadow-lg sm:rounded-lg animate-in fade-in-0 zoom-in-95">
            <button onClick={() => { if (!savingPayroll) setPayrollMode(null); }} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>

            {/* Header with action button */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex-1">
                <h2 className="text-lg font-bold italic">{modalTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {format(startDate, "dd/MM/yyyy")} até {format(endDate, "dd/MM/yyyy")} • {payrollData.length} motorista(s)
                </p>
              </div>
              {payrollMode === "espelho" && (
                <Button size="sm" className="gap-2 shrink-0" onClick={() => { setFormatChoiceAction("espelho"); setFormatChoiceOpen(true); }} disabled={savingPayroll}>
                  {savingPayroll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Baixar Relatório
                </Button>
              )}
              {payrollMode === "gerar" && (
                <Button size="sm" className="gap-2 shrink-0" onClick={() => { setFormatChoiceAction("gerar"); setFormatChoiceOpen(true); }} disabled={savingPayroll}>
                  {savingPayroll ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Confirmar e Gerar
                </Button>
              )}
            </div>

            {payrollMode === "gerar" && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 mb-4">
                ⚠️ Ao confirmar, será gerado um relatório final. Os motoristas serão notificados para envio da NF.
              </p>
            )}

            <Input
              value={payrollSearch}
              onChange={(e) => setPayrollSearch(e.target.value)}
              placeholder="Buscar por nome, CPF, placa..."
              className="mb-4 h-9 text-sm"
            />

            {/* Summary totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Total TBRs</p>
                <p className="font-bold">{payrollData.reduce((s, d) => s + d.totalTbrs, 0)}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Retornos</p>
                <p className="font-bold">{payrollData.reduce((s, d) => s + d.totalReturns, 0)}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Concluídos</p>
                <p className="font-bold">{payrollData.reduce((s, d) => s + d.totalCompleted, 0)}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="font-bold text-primary">{formatCurrency(payrollData.reduce((s, d) => s + d.totalValue, 0))}</p>
              </div>
            </div>

            {/* Driver cards with expandable daily detail */}
            <div className="space-y-3">
              {filteredPayroll.map((d) => (
                <Card key={d.driver.id}>
                  <CardContent className="p-4">
                    <div
                      className="flex justify-between items-start cursor-pointer"
                      onClick={() => setExpandedDriver(expandedDriver === d.driver.id ? null : d.driver.id)}
                    >
                      <div>
                        <p className="font-bold">{d.driver.name}</p>
                        <p className="text-xs text-muted-foreground">{d.driver.cpf} • {d.driver.car_plate}</p>
                        {d.driver.pixKey && <p className="text-xs text-muted-foreground">PIX: {d.driver.pixKey}</p>}
                      </div>
                      <p className="font-bold text-lg text-primary">{formatCurrency(d.totalValue)}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                      <div><span className="text-muted-foreground">TBRs:</span> <strong>{d.totalTbrs}</strong></div>
                      <div><span className="text-muted-foreground">Retornos:</span> <strong>{d.totalReturns}</strong></div>
                      <div><span className="text-muted-foreground">Dias:</span> <strong>{d.daysWorked}</strong></div>
                      <div><span className="text-muted-foreground">Valor/TBR:</span> <strong>{formatCurrency(d.tbrValueUsed)}</strong></div>
                      {(d.dnrDiscount ?? 0) > 0 && <div><span className="text-destructive">DNR:</span> <strong className="text-destructive">-{formatCurrency(d.dnrDiscount!)}</strong></div>}
                      {(d.bonus ?? 0) > 0 && <div><span className="text-primary">Bônus:</span> <strong className="text-primary">+{formatCurrency(d.bonus!)}</strong></div>}
                      {(d.reativoTotal ?? 0) > 0 && <div><span className="text-amber-600">Reativo:</span> <strong className="text-amber-600">+{formatCurrency(d.reativoTotal!)}</strong></div>}
                    </div>

                    {/* Expandable daily detail table */}
                    {expandedDriver === d.driver.id && d.days.length > 0 && (
                      <div className="mt-3 border-t pt-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Detalhamento por dia</p>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs h-8 px-2">Data</TableHead>
                                <TableHead className="text-xs h-8 px-2">Login</TableHead>
                                <TableHead className="text-xs h-8 px-2 text-right">TBRs</TableHead>
                                <TableHead className="text-xs h-8 px-2 text-right">Retornos</TableHead>
                                <TableHead className="text-xs h-8 px-2 text-right">Concluídos</TableHead>
                                <TableHead className="text-xs h-8 px-2 text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {d.days.map((day) => (
                                <TableRow key={day.date}>
                                  <TableCell className="text-xs px-2 py-1.5">{format(new Date(day.date + "T12:00:00"), "dd/MM")}</TableCell>
                                  <TableCell className="text-xs px-2 py-1.5">{day.login || "—"}</TableCell>
                                  <TableCell className="text-xs px-2 py-1.5 text-right font-medium">{day.tbrCount}</TableCell>
                                  <TableCell className="text-xs px-2 py-1.5 text-right">{day.returns}</TableCell>
                                  <TableCell className="text-xs px-2 py-1.5 text-right font-medium">{day.completed}</TableCell>
                                  <TableCell className="text-xs px-2 py-1.5 text-right">{formatCurrency(day.value)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground mt-2 cursor-pointer hover:underline"
                       onClick={() => setExpandedDriver(expandedDriver === d.driver.id ? null : d.driver.id)}>
                      {expandedDriver === d.driver.id ? "▲ Recolher detalhes" : "▼ Ver detalhes por dia"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Format Choice Modal */}
      <FormatChoiceModal
        open={formatChoiceOpen}
        onClose={() => { setFormatChoiceOpen(false); setFormatChoiceAction(null); }}
        onChoose={async (fmt) => {
          setFormatChoiceOpen(false);
          if (fmt === "excel" && payrollData) {
            generatePayrollExcel(payrollData, unitName, startDate, endDate);
            toast({ title: "Excel gerado!", description: "Planilha baixada com sucesso." });
            if (formatChoiceAction === "gerar") {
              // Still save to DB + mark DNRs for "gerar" mode
              await handleConfirmAndGenerateDB();
            }
          } else {
            if (formatChoiceAction === "espelho") {
              await handleDownloadPDF();
            } else if (formatChoiceAction === "gerar") {
              await handleConfirmAndGenerate();
            }
          }
          setFormatChoiceAction(null);
        }}
        title={formatChoiceAction === "gerar" ? "Formato da Folha" : "Formato do Espelho"}
      />
    </>
  );
};

export default RelatoriosPage;
