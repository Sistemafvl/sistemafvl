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

    // Make visible for capture
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.display = "block";
    container.style.width = "794px"; // A4 width at 96dpi

    // Wait for render
    await new Promise(r => setTimeout(r, 300));

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const contentWidth = pdfWidth - margin * 2;

      // Capture each section (each direct child div is a "page")
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

        pdf.addImage(imgData, "PNG", margin, margin, contentWidth, imgHeight);
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
      {payrollData && (
        <div ref={reportRef} style={{ display: "none", background: "#fff", fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#111" }}>
          {/* PAGE 1 — Summary */}
          <div style={{ padding: "20px" }}>
            <h1 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "4px" }}>FOLHA DE PAGAMENTO</h1>
            <p style={{ fontSize: "13px", color: "#555", marginBottom: "12px" }}>
              {unitName} — {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
            </p>
            <p style={{ fontSize: "10px", color: "#888", marginBottom: "16px" }}>
              Valor por TBR: R$ {tbrValue.toFixed(2).replace(".", ",")} | Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
              <thead>
                <tr>
                  {["Motorista", "Dias", "Logins", "TBRs", "Retornos", "Concluídos", "Valor (R$)"].map(h => (
                    <th key={h} style={{ border: "1px solid #333", padding: "5px 8px", background: "#222", color: "#fff", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" as const, textAlign: "left" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollData.map((d) => (
                  <tr key={d.driver.id}>
                    <td style={{ border: "1px solid #333", padding: "5px 8px", fontWeight: 600 }}>{d.driver.name}</td>
                    <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{d.daysWorked}</td>
                    <td style={{ border: "1px solid #333", padding: "5px 8px", fontSize: "10px" }}>{d.loginsUsed.join(", ") || "—"}</td>
                    <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{d.totalTbrs}</td>
                    <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{d.totalReturns}</td>
                    <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{d.totalCompleted}</td>
                    <td style={{ border: "1px solid #333", padding: "5px 8px" }}>R$ {d.totalValue.toFixed(2).replace(".", ",")}</td>
                  </tr>
                ))}
                <tr style={{ background: "#f0f0f0", fontWeight: 700 }}>
                  <td style={{ border: "1px solid #333", padding: "5px 8px" }}>TOTAL</td>
                  <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{grandTotalDays}</td>
                  <td style={{ border: "1px solid #333", padding: "5px 8px" }}>—</td>
                  <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{grandTotalTbrs}</td>
                  <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{grandTotalReturns}</td>
                  <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{grandTotalCompleted}</td>
                  <td style={{ border: "1px solid #333", padding: "5px 8px" }}>R$ {grandTotalValue.toFixed(2).replace(".", ",")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Individual driver pages */}
          {payrollData.map((d) => {
            const maxTbrs = Math.max(...d.days.map(day => day.tbrCount), 1);
            const completionRate = d.totalTbrs > 0 ? ((d.totalCompleted / d.totalTbrs) * 100).toFixed(1) : "0.0";

            return (
              <div key={d.driver.id} style={{ padding: "20px" }}>
                <h2 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>FICHA INDIVIDUAL — {d.driver.name}</h2>
                <p style={{ fontSize: "11px", color: "#444", marginBottom: "12px" }}>
                  CPF: {formatCpf(d.driver.cpf)} | Placa: {d.driver.car_plate} | {d.driver.car_model}{d.driver.car_color ? ` ${d.driver.car_color}` : ""}
                </p>

                <div style={{ borderTop: "2px solid #222", margin: "12px 0" }} />

                <div style={{ marginBottom: "16px" }}>
                  {[
                    { value: d.totalTbrs, label: "Total TBRs" },
                    { value: d.totalReturns, label: "Retornos" },
                    { value: `${completionRate}%`, label: "Conclusão" },
                    { value: d.avgDaily, label: "Média Diária" },
                    { value: `R$ ${d.totalValue.toFixed(2).replace(".", ",")}`, label: "Valor Total" },
                  ].map(m => (
                    <div key={m.label} style={{ display: "inline-block", padding: "6px 12px", margin: "4px", border: "1px solid #ccc", borderRadius: "4px", textAlign: "center" as const }}>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "#111" }}>{m.value}</div>
                      <div style={{ fontSize: "9px", color: "#666", textTransform: "uppercase" as const }}>{m.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: "11px", marginBottom: "12px", padding: "8px", background: "#f8f8f8", borderRadius: "4px" }}>
                  <strong>Insights:</strong>
                  {d.bestDay && <span> Melhor dia: {formatDateBR(d.bestDay.date)} ({d.bestDay.tbrs} TBRs)</span>}
                  {d.worstDay && d.days.length > 1 && <span> | Pior dia: {formatDateBR(d.worstDay.date)} ({d.worstDay.tbrs} TBRs)</span>}
                  <span> | Dias trabalhados: {d.daysWorked}</span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
                  <thead>
                    <tr>
                      {["Data", "Login", "TBRs", "Retornos", "Valor (R$)", "Performance"].map(h => (
                        <th key={h} style={{ border: "1px solid #333", padding: "5px 8px", background: "#222", color: "#fff", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" as const, textAlign: "left" as const, ...(h === "Performance" ? { width: "30%" } : {}) }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.days.map((day) => (
                      <tr key={day.date}>
                        <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{formatDateBR(day.date)}</td>
                        <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{day.login || "—"}</td>
                        <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{day.tbrCount}</td>
                        <td style={{ border: "1px solid #333", padding: "5px 8px" }}>{day.returns}</td>
                        <td style={{ border: "1px solid #333", padding: "5px 8px" }}>R$ {day.value.toFixed(2).replace(".", ",")}</td>
                        <td style={{ border: "1px solid #333", padding: "5px 8px" }}>
                          <div style={{ display: "inline-block", height: "14px", background: "#2563eb", borderRadius: "2px", minWidth: "2px", width: `${(day.tbrCount / maxTbrs) * 100}%` }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default RelatoriosPage;
