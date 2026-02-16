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
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface DriverPayrollData {
  driver: {
    id: string;
    name: string;
    cpf: string;
    car_plate: string;
    car_model: string;
    car_color: string | null;
  };
  days: {
    date: string;
    login: string | null;
    tbrCount: number;
    returns: number;
    value: number;
  }[];
  totalTbrs: number;
  totalReturns: number;
  totalCompleted: number;
  totalValue: number;
  daysWorked: number;
  loginsUsed: string[];
  bestDay: { date: string; tbrs: number } | null;
  worstDay: { date: string; tbrs: number } | null;
  avgDaily: number;
}

const RelatoriosPage = () => {
  const { unitSession } = useAuthStore();
  const [startDate, setStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [payrollData, setPayrollData] = useState<DriverPayrollData[] | null>(null);
  const [unitName, setUnitName] = useState("");
  const [tbrValue, setTbrValue] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);

  const unitId = unitSession?.id;

  const formatCpf = (cpf: string) =>
    cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

  const formatDateBR = (dateStr: string) =>
    format(new Date(dateStr + "T12:00:00"), "dd/MM", { locale: ptBR });

  const generatePDFFromData = useCallback(async (data: DriverPayrollData[], uName: string, tVal: number) => {
    const container = reportRef.current;
    if (!container) return;

    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.display = "block";
    container.style.width = "1122px"; // A4 landscape at 96dpi

    await new Promise(r => setTimeout(r, 300));

    try {
      const pdf = new jsPDF("l", "mm", "a4"); // landscape
      const pdfWidth = 297;
      const pdfHeight = 210;
      const margin = 8;
      const contentWidth = pdfWidth - margin * 2;

      const sections = container.querySelectorAll<HTMLElement>(":scope > div");

      for (let i = 0; i < sections.length; i++) {
        if (i > 0) pdf.addPage();

        const canvas = await html2canvas(sections[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgHeight = (canvas.height * contentWidth) / canvas.width;

        pdf.addImage(imgData, "PNG", margin, margin, contentWidth, Math.min(imgHeight, pdfHeight - margin * 2));
      }

      const fileName = `folha_pagamento_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.pdf`;
      pdf.save(fileName);

      toast({ title: "PDF gerado!", description: `Arquivo ${fileName} baixado com sucesso.` });
    } catch (err) {
      console.error("PDF generation error:", err);
      toast({ title: "Erro", description: "Erro ao gerar o PDF.", variant: "destructive" });
    } finally {
      container.style.display = "none";
    }
  }, [startDate, endDate]);

  const fetchPayrollData = async () => {
    if (!unitId) return;
    setLoading("payroll");

    try {
      const { data: unitData } = await supabase.from("units").select("name").eq("id", unitId).maybeSingle();
      const uName = unitData?.name ?? "";
      setUnitName(uName);

      const { data: settings } = await supabase.from("unit_settings").select("tbr_value").eq("unit_id", unitId).maybeSingle();
      const tbrVal = Number(settings?.tbr_value ?? 0);
      setTbrValue(tbrVal);

      const { data: rides } = await supabase
        .from("driver_rides")
        .select("*")
        .eq("unit_id", unitId)
        .gte("completed_at", startDate.toISOString())
        .lte("completed_at", endDate.toISOString());

      if (!rides || rides.length === 0) {
        toast({ title: "Sem dados", description: "Nenhum carregamento encontrado no período selecionado.", variant: "destructive" });
        setLoading(null);
        return;
      }

      const driverIds = [...new Set(rides.map(r => r.driver_id))];
      const rideIds = rides.map(r => r.id);

      const [driversRes, tbrsRes, pisoRes, psRes, rtoRes] = await Promise.all([
        supabase.from("drivers").select("id, name, cpf, car_plate, car_model, car_color").in("id", driverIds),
        supabase.from("ride_tbrs").select("ride_id, code").in("ride_id", rideIds),
        supabase.from("piso_entries").select("ride_id").in("ride_id", rideIds),
        supabase.from("ps_entries").select("ride_id").in("ride_id", rideIds),
        supabase.from("rto_entries").select("ride_id").in("ride_id", rideIds),
      ]);

      const drivers = driversRes.data ?? [];
      const allTbrs = tbrsRes.data ?? [];
      const allPiso = pisoRes.data ?? [];
      const allPs = psRes.data ?? [];
      const allRto = rtoRes.data ?? [];

      const driverMap = new Map(drivers.map(d => [d.id, d]));

      const result: DriverPayrollData[] = driverIds.map(driverId => {
        const driver = driverMap.get(driverId)!;
        const driverRides = rides.filter(r => r.driver_id === driverId);

        const dayMap = new Map<string, { login: string | null; rideIds: string[] }>();
        driverRides.forEach(r => {
          const dayKey = format(new Date(r.completed_at), "yyyy-MM-dd");
          const existing = dayMap.get(dayKey);
          if (existing) {
            existing.rideIds.push(r.id);
            if (r.login && !existing.login) existing.login = r.login;
          } else {
            dayMap.set(dayKey, { login: r.login, rideIds: [r.id] });
          }
        });

        const days = Array.from(dayMap.entries()).sort().map(([date, info]) => {
          const rTbrs = allTbrs.filter(t => info.rideIds.includes(t.ride_id));
          const rReturns = [
            ...allPiso.filter(p => p.ride_id && info.rideIds.includes(p.ride_id)),
            ...allPs.filter(p => p.ride_id && info.rideIds.includes(p.ride_id)),
            ...allRto.filter(p => p.ride_id && info.rideIds.includes(p.ride_id)),
          ].length;
          return { date, login: info.login, tbrCount: rTbrs.length, returns: rReturns, value: (rTbrs.length - rReturns) * tbrVal };
        });

        const totalTbrs = days.reduce((s, d) => s + d.tbrCount, 0);
        const totalReturns = days.reduce((s, d) => s + d.returns, 0);
        const totalCompleted = totalTbrs - totalReturns;
        const totalValue = totalCompleted * tbrVal;
        const loginsUsed = [...new Set(driverRides.map(r => r.login).filter(Boolean) as string[])];
        const bestDay = days.length ? days.reduce((a, b) => a.tbrCount > b.tbrCount ? a : b) : null;
        const worstDay = days.length ? days.reduce((a, b) => a.tbrCount < b.tbrCount ? a : b) : null;
        const avgDaily = days.length ? Math.round(totalTbrs / days.length) : 0;

        return {
          driver: { id: driver.id, name: driver.name, cpf: driver.cpf, car_plate: driver.car_plate, car_model: driver.car_model, car_color: driver.car_color },
          days, totalTbrs, totalReturns, totalCompleted, totalValue, daysWorked: days.length, loginsUsed,
          bestDay: bestDay ? { date: bestDay.date, tbrs: bestDay.tbrCount } : null,
          worstDay: worstDay ? { date: worstDay.date, tbrs: worstDay.tbrCount } : null,
          avgDaily,
        };
      }).sort((a, b) => b.totalTbrs - a.totalTbrs);

      setPayrollData(result);

      // Generate PDF after state renders
      setTimeout(() => generatePDFFromData(result, uName, tbrVal), 400);
    } catch (err) {
      toast({ title: "Erro", description: "Erro ao gerar relatório.", variant: "destructive" });
    }
    setLoading(null);
  };

  const grandTotalTbrs = payrollData?.reduce((s, d) => s + d.totalTbrs, 0) ?? 0;
  const grandTotalReturns = payrollData?.reduce((s, d) => s + d.totalReturns, 0) ?? 0;
  const grandTotalCompleted = payrollData?.reduce((s, d) => s + d.totalCompleted, 0) ?? 0;
  const grandTotalValue = payrollData?.reduce((s, d) => s + d.totalValue, 0) ?? 0;
  const grandTotalDays = payrollData?.reduce((s, d) => s + d.daysWorked, 0) ?? 0;

  const reportCards = [
    { key: "payroll", title: "Folha de Pagamento", description: "Relatório detalhado com ficha individual por motorista", icon: FileText, action: fetchPayrollData },
    { key: "daily", title: "Resumo Diário", description: "Consolidado da operação do dia selecionado", icon: BarChart3, action: () => toast({ title: "Em breve", description: "Relatório em desenvolvimento." }) },
    { key: "returns", title: "Relatório de Retornos", description: "Todos os retornos (Piso, PS, RTO) do período", icon: RotateCcw, action: () => toast({ title: "Em breve", description: "Relatório em desenvolvimento." }) },
    { key: "performance", title: "Ranking Performance", description: "Classificação dos motoristas por desempenho", icon: Trophy, action: () => toast({ title: "Em breve", description: "Relatório em desenvolvimento." }) },
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

      {/* Off-screen report content for PDF capture */}
      {payrollData && (() => {
        // Build sorted unique dates across all drivers
        const allDates = [...new Set(payrollData.flatMap(d => d.days.map(day => day.date)))].sort();
        const cellStyle: React.CSSProperties = { border: "1px solid #333", padding: "4px 6px", fontSize: "9px", textAlign: "center" };
        const headerStyle: React.CSSProperties = { ...cellStyle, background: "#222", color: "#fff", fontWeight: 700, textTransform: "uppercase", fontSize: "8px" };

        return (
          <div ref={reportRef} style={{ display: "none", background: "#fff", fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#111" }}>
            {/* Individual driver pages */}
            {payrollData.map((d) => {
              // Group by login: for each login, show TBRs per day
              const loginDayMap = new Map<string, Map<string, { tbrs: number; returns: number }>>();
              d.days.forEach(day => {
                const login = day.login || "Sem login";
                if (!loginDayMap.has(login)) loginDayMap.set(login, new Map());
                loginDayMap.get(login)!.set(day.date, { tbrs: day.tbrCount, returns: day.returns });
              });
              const logins = [...loginDayMap.keys()].sort();
              const completionRate = d.totalTbrs > 0 ? ((d.totalCompleted / d.totalTbrs) * 100).toFixed(1) : "0.0";

              return (
                <div key={d.driver.id} style={{ padding: "16px" }}>
                  <h2 style={{ fontSize: "14px", fontWeight: 800, marginBottom: "2px" }}>FOLHA DE PAGAMENTO — {d.driver.name}</h2>
                  <p style={{ fontSize: "10px", color: "#444", marginBottom: "2px" }}>
                    CPF: {formatCpf(d.driver.cpf)} | Placa: {d.driver.car_plate} | {d.driver.car_model}{d.driver.car_color ? ` ${d.driver.car_color}` : ""}
                  </p>
                  <p style={{ fontSize: "9px", color: "#888", marginBottom: "10px" }}>
                    Período: {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")} | Valor TBR: R$ {tbrValue.toFixed(2).replace(".", ",")}
                  </p>

                  <div style={{ marginBottom: "10px" }}>
                    {[
                      { value: d.totalTbrs, label: "TBRs" },
                      { value: d.totalReturns, label: "Retornos" },
                      { value: d.totalCompleted, label: "Concluídos" },
                      { value: `${completionRate}%`, label: "Taxa" },
                      { value: d.avgDaily, label: "Média/Dia" },
                      { value: `R$ ${d.totalValue.toFixed(2).replace(".", ",")}`, label: "Valor Total" },
                    ].map(m => (
                      <div key={m.label} style={{ display: "inline-block", padding: "4px 10px", margin: "2px", border: "1px solid #ccc", borderRadius: "4px", textAlign: "center" }}>
                        <div style={{ fontSize: "16px", fontWeight: 800 }}>{m.value}</div>
                        <div style={{ fontSize: "7px", color: "#666", textTransform: "uppercase" }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={headerStyle}>Login</th>
                        {allDates.map(date => (
                          <th key={date} style={headerStyle}>{formatDateBR(date)}</th>
                        ))}
                        <th style={headerStyle}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logins.map(login => {
                        const dayData = loginDayMap.get(login)!;
                        const loginTotal = allDates.reduce((s, date) => s + (dayData.get(date)?.tbrs ?? 0), 0);
                        return (
                          <tr key={login}>
                            <td style={{ ...cellStyle, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{login}</td>
                            {allDates.map(date => {
                              const val = dayData.get(date)?.tbrs ?? 0;
                              return <td key={date} style={{ ...cellStyle, background: val > 0 ? "#f0fdf4" : "#fafafa" }}>{val || "—"}</td>;
                            })}
                            <td style={{ ...cellStyle, fontWeight: 700, background: "#f5f5f5" }}>{loginTotal}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ fontWeight: 700, background: "#f0f0f0" }}>
                        <td style={cellStyle}>TOTAL</td>
                        {allDates.map(date => {
                          const dayTotal = d.days.find(day => day.date === date)?.tbrCount ?? 0;
                          return <td key={date} style={cellStyle}>{dayTotal || "—"}</td>;
                        })}
                        <td style={{ ...cellStyle, fontWeight: 800 }}>{d.totalTbrs}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Last page — General summary */}
            <div style={{ padding: "16px" }}>
              <h2 style={{ fontSize: "14px", fontWeight: 800, marginBottom: "2px" }}>RESUMO GERAL — FOLHA DE PAGAMENTO</h2>
              <p style={{ fontSize: "10px", color: "#444", marginBottom: "2px" }}>
                {unitName} — {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
              </p>
              <p style={{ fontSize: "9px", color: "#888", marginBottom: "10px" }}>
                Valor por TBR: R$ {tbrValue.toFixed(2).replace(".", ",")} | Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}
              </p>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={headerStyle}>Motorista</th>
                    {allDates.map(date => (
                      <th key={date} style={headerStyle}>{formatDateBR(date)}</th>
                    ))}
                    <th style={headerStyle}>TBRs</th>
                    <th style={headerStyle}>Ret.</th>
                    <th style={headerStyle}>Conc.</th>
                    <th style={headerStyle}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollData.map(d => (
                    <tr key={d.driver.id}>
                      <td style={{ ...cellStyle, fontWeight: 600, textAlign: "left", whiteSpace: "nowrap" }}>{d.driver.name}</td>
                      {allDates.map(date => {
                        const val = d.days.find(day => day.date === date)?.tbrCount ?? 0;
                        return <td key={date} style={{ ...cellStyle, background: val > 0 ? "#f0fdf4" : "#fafafa" }}>{val || "—"}</td>;
                      })}
                      <td style={cellStyle}>{d.totalTbrs}</td>
                      <td style={cellStyle}>{d.totalReturns}</td>
                      <td style={cellStyle}>{d.totalCompleted}</td>
                      <td style={{ ...cellStyle, fontWeight: 600 }}>R$ {d.totalValue.toFixed(2).replace(".", ",")}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: "#f0f0f0" }}>
                    <td style={cellStyle}>TOTAL</td>
                    {allDates.map(date => {
                      const dayTotal = payrollData.reduce((s, d) => s + (d.days.find(day => day.date === date)?.tbrCount ?? 0), 0);
                      return <td key={date} style={cellStyle}>{dayTotal || "—"}</td>;
                    })}
                    <td style={cellStyle}>{grandTotalTbrs}</td>
                    <td style={cellStyle}>{grandTotalReturns}</td>
                    <td style={cellStyle}>{grandTotalCompleted}</td>
                    <td style={{ ...cellStyle, fontWeight: 800 }}>R$ {grandTotalValue.toFixed(2).replace(".", ",")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default RelatoriosPage;
