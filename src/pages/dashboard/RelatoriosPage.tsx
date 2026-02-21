import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, BarChart3, RotateCcw, Trophy, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { loadLogoBase64, generatePDFFromContainer, formatCurrency } from "./reports/pdf-utils";
import PayrollReportContent, { type DriverPayrollData } from "./reports/PayrollReportContent";
import DailySummaryReportContent, { type DailySummaryRow } from "./reports/DailySummaryReportContent";
import ReturnsReportContent, { type ReturnEntry } from "./reports/ReturnsReportContent";
import RankingReportContent, { type RankingRow } from "./reports/RankingReportContent";

const RelatoriosPage = () => {
  const { unitSession } = useAuthStore();
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  });
  const [loading, setLoading] = useState<string | null>(null);

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

  // ── Payroll ──
  const fetchPayroll = async () => {
    if (!unitId) return;
    setLoading("payroll");
    try {
      const common = await ensureCommon();
      if (!common) return;

      const { data: rides } = await supabase.from("driver_rides").select("*").eq("unit_id", unitId)
        .gte("completed_at", startDate.toISOString()).lte("completed_at", endDate.toISOString());

      if (!rides?.length) { toast({ title: "Sem dados", description: "Nenhum carregamento no período.", variant: "destructive" }); setLoading(null); return; }

      const driverIds = [...new Set(rides.map(r => r.driver_id))];
      const rideIds = rides.map(r => r.id);

      const [driversRes, tbrsRes, pisoRes, psRes, rtoRes] = await Promise.all([
        supabase.from("drivers_public").select("id, name, cpf, car_plate, car_model, car_color").in("id", driverIds),
        supabase.from("ride_tbrs").select("ride_id, code").in("ride_id", rideIds),
        supabase.from("piso_entries").select("ride_id, tbr_code").in("ride_id", rideIds),
        supabase.from("ps_entries").select("ride_id, tbr_code").in("ride_id", rideIds),
        supabase.from("rto_entries").select("ride_id, tbr_code").in("ride_id", rideIds),
      ]);

      const drivers = driversRes.data ?? [];
      const allTbrs = tbrsRes.data ?? [];
      const allPiso = pisoRes.data ?? [];
      const allPs = psRes.data ?? [];
      const allRto = rtoRes.data ?? [];
      const driverMap = new Map(drivers.map(d => [d.id, d]));

      // Fetch discounted DNRs for the period
      const { data: dnrData } = await supabase
        .from("dnr_entries")
        .select("driver_id, dnr_value")
        .eq("unit_id", unitId)
        .eq("status", "closed")
        .eq("discounted", true)
        .gte("closed_at", startDate.toISOString())
        .lte("closed_at", endDate.toISOString());

      const dnrByDriver = new Map<string, number>();
      (dnrData ?? []).forEach((d: any) => {
        if (d.driver_id) {
          dnrByDriver.set(d.driver_id, (dnrByDriver.get(d.driver_id) ?? 0) + Number(d.dnr_value));
        }
      });

      const result: DriverPayrollData[] = driverIds.map(driverId => {
        const driver = driverMap.get(driverId)!;
        const driverRides = rides.filter(r => r.driver_id === driverId);
        const dayMap = new Map<string, { login: string | null; rideIds: string[] }>();
        driverRides.forEach(r => {
          const dayKey = format(new Date(r.completed_at), "yyyy-MM-dd");
          const existing = dayMap.get(dayKey);
          if (existing) { existing.rideIds.push(r.id); if (r.login && !existing.login) existing.login = r.login; }
          else dayMap.set(dayKey, { login: r.login, rideIds: [r.id] });
        });

        const days = Array.from(dayMap.entries()).sort().map(([date, info]) => {
          const rTbrs = allTbrs.filter(t => info.rideIds.includes(t.ride_id));
          // Unique tbr_code returns
          const returnTbrSet = new Set<string>();
          [...allPiso, ...allPs, ...allRto].forEach((p: any) => {
            if (p.ride_id && info.rideIds.includes(p.ride_id) && p.tbr_code) returnTbrSet.add(p.tbr_code);
          });
          const rReturns = returnTbrSet.size;
          return { date, login: info.login, tbrCount: rTbrs.length, returns: rReturns, value: (rTbrs.length - rReturns) * common.tVal };
        });

        const totalTbrs = days.reduce((s, d) => s + d.tbrCount, 0);
        const totalReturns = days.reduce((s, d) => s + d.returns, 0);
        const totalCompleted = totalTbrs - totalReturns;
        const loginsUsed = [...new Set(driverRides.map(r => r.login).filter(Boolean) as string[])];
        const bestDay = days.length ? days.reduce((a, b) => a.tbrCount > b.tbrCount ? a : b) : null;
        const worstDay = days.length ? days.reduce((a, b) => a.tbrCount < b.tbrCount ? a : b) : null;
        const dnrDiscount = dnrByDriver.get(driverId) ?? 0;

        return {
          driver: { id: driver.id, name: driver.name, cpf: driver.cpf, car_plate: driver.car_plate, car_model: driver.car_model, car_color: driver.car_color },
          days, totalTbrs, totalReturns, totalCompleted, 
          totalValue: (totalCompleted * common.tVal) - dnrDiscount,
          dnrDiscount,
          daysWorked: days.length, loginsUsed,
          bestDay: bestDay ? { date: bestDay.date, tbrs: bestDay.tbrCount } : null,
          worstDay: worstDay ? { date: worstDay.date, tbrs: worstDay.tbrCount } : null,
          avgDaily: days.length ? Math.round(totalTbrs / days.length) : 0,
        };
      }).sort((a, b) => b.totalTbrs - a.totalTbrs);

      setPayrollData(result);
      setTimeout(async () => {
        if (payrollRef.current) {
          await generatePDFFromContainer(payrollRef.current, `folha_pagamento_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.pdf`);
          toast({ title: "PDF gerado!", description: "Folha de pagamento baixada com sucesso." });
        }
      }, 500);
    } catch { toast({ title: "Erro", description: "Erro ao gerar relatório.", variant: "destructive" }); }
    setLoading(null);
  };

  // ── Daily Summary ──
  const fetchDailySummary = async () => {
    if (!unitId) return;
    setLoading("daily");
    try {
      const common = await ensureCommon();
      if (!common) return;

      const [ridesRes, pisoRes, psRes, rtoRes] = await Promise.all([
        supabase.from("driver_rides").select("id, completed_at, driver_id").eq("unit_id", unitId)
          .gte("completed_at", startDate.toISOString()).lte("completed_at", endDate.toISOString()),
        supabase.from("piso_entries").select("id, created_at").eq("unit_id", unitId)
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
        supabase.from("ps_entries").select("id, created_at").eq("unit_id", unitId)
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
        supabase.from("rto_entries").select("id, created_at").eq("unit_id", unitId)
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
      ]);

      const rides = ridesRes.data ?? [];
      const rideIds = rides.map(r => r.id);

      const tbrsRes = rideIds.length > 0
        ? await supabase.from("ride_tbrs").select("ride_id").in("ride_id", rideIds)
        : { data: [] };

      const allTbrs = tbrsRes.data ?? [];
      const piso = pisoRes.data ?? [];
      const ps = psRes.data ?? [];
      const rto = rtoRes.data ?? [];

      // Group by day
      const dayMap = new Map<string, DailySummaryRow>();
      rides.forEach(r => {
        const day = format(new Date(r.completed_at), "yyyy-MM-dd");
        if (!dayMap.has(day)) dayMap.set(day, { date: day, loadings: 0, tbrs: 0, piso: 0, ps: 0, rto: 0, totalReturns: 0, activeDrivers: 0 });
        dayMap.get(day)!.loadings++;
      });

      // Count TBRs per day via ride
      const rideToDay = new Map<string, string>();
      rides.forEach(r => rideToDay.set(r.id, format(new Date(r.completed_at), "yyyy-MM-dd")));
      allTbrs.forEach(t => {
        const day = rideToDay.get(t.ride_id);
        if (day && dayMap.has(day)) dayMap.get(day)!.tbrs++;
      });

      // Returns per day
      piso.forEach(p => { const day = format(new Date(p.created_at), "yyyy-MM-dd"); if (dayMap.has(day)) dayMap.get(day)!.piso++; });
      ps.forEach(p => { const day = format(new Date(p.created_at), "yyyy-MM-dd"); if (dayMap.has(day)) dayMap.get(day)!.ps++; });
      rto.forEach(p => { const day = format(new Date(p.created_at), "yyyy-MM-dd"); if (dayMap.has(day)) dayMap.get(day)!.rto++; });

      // Active drivers per day
      const dayDrivers = new Map<string, Set<string>>();
      rides.forEach(r => {
        const day = format(new Date(r.completed_at), "yyyy-MM-dd");
        if (!dayDrivers.has(day)) dayDrivers.set(day, new Set());
        dayDrivers.get(day)!.add(r.driver_id);
      });
      dayDrivers.forEach((set, day) => { if (dayMap.has(day)) dayMap.get(day)!.activeDrivers = set.size; });

      // Total returns
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

      const [pisoRes, psRes, rtoRes] = await Promise.all([
        supabase.from("piso_entries").select("tbr_code, reason, driver_name, route, created_at").eq("unit_id", unitId)
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
        supabase.from("ps_entries").select("tbr_code, description, driver_name, route, created_at").eq("unit_id", unitId)
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
        supabase.from("rto_entries").select("tbr_code, description, driver_name, route, created_at, cep").eq("unit_id", unitId)
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
      ]);

      const pisoEntries: ReturnEntry[] = (pisoRes.data ?? []).map(e => ({ tbr_code: e.tbr_code, description: e.reason, driver_name: e.driver_name, route: e.route, date: e.created_at }));
      const psEntries: ReturnEntry[] = (psRes.data ?? []).map(e => ({ tbr_code: e.tbr_code, description: e.description, driver_name: e.driver_name, route: e.route, date: e.created_at }));
      const rtoEntries: ReturnEntry[] = (rtoRes.data ?? []).map(e => ({ tbr_code: e.tbr_code, description: e.description, driver_name: e.driver_name, route: e.route, date: e.created_at, cep: e.cep }));

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

      const [driversRes, tbrsRes, pisoRes, psRes, rtoRes] = await Promise.all([
        supabase.from("drivers_public").select("id, name").in("id", driverIds),
        supabase.from("ride_tbrs").select("ride_id").in("ride_id", rideIds),
        supabase.from("piso_entries").select("ride_id, tbr_code").in("ride_id", rideIds),
        supabase.from("ps_entries").select("ride_id, tbr_code").in("ride_id", rideIds),
        supabase.from("rto_entries").select("ride_id, tbr_code").in("ride_id", rideIds),
      ]);

      const drivers = driversRes.data ?? [];
      const driverMap = new Map(drivers.map(d => [d.id, d.name]));
      const allTbrs = tbrsRes.data ?? [];
      const allReturns = [...(pisoRes.data ?? []), ...(psRes.data ?? []), ...(rtoRes.data ?? [])];

      const ranking: RankingRow[] = driverIds.map(did => {
        const driverRides = rides.filter(r => r.driver_id === did);
        const driverRideIds = driverRides.map(r => r.id);
        const tbrs = allTbrs.filter(t => driverRideIds.includes(t.ride_id)).length;
        // Unique tbr_code returns
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

  const reportCards = [
    { key: "payroll", title: "Folha de Pagamento", description: "Ficha individual por motorista com design profissional", icon: FileText, action: fetchPayroll },
    { key: "daily", title: "Resumo Diário", description: "Consolidado operacional por dia do período", icon: BarChart3, action: fetchDailySummary },
    { key: "returns", title: "Relatório de Retornos", description: "Todos os retornos (Piso, PS, RTO) do período", icon: RotateCcw, action: fetchReturns },
    { key: "performance", title: "Ranking Performance", description: "Classificação dos motoristas por desempenho", icon: Trophy, action: fetchRanking },
  ];

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
                <Button className="w-full gap-2" onClick={r.action} disabled={loading === r.key}>
                  {loading === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Gerar PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Off-screen report containers — permanently fixed off-screen so browser calculates layout before html2canvas capture */}
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
    </>
  );
};

export default RelatoriosPage;
