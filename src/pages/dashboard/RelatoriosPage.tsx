import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, BarChart3, RotateCcw, Trophy, Loader2 } from "lucide-react";
import { format, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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
  const printRef = useRef<HTMLDivElement>(null);

  const unitId = unitSession?.id;

  const fetchPayrollData = async () => {
    if (!unitId) return;
    setLoading("payroll");

    try {
      // Fetch unit name
      const { data: unitData } = await supabase.from("units").select("name").eq("id", unitId).maybeSingle();
      setUnitName(unitData?.name ?? "");

      // Fetch TBR value
      const { data: settings } = await supabase.from("unit_settings").select("tbr_value").eq("unit_id", unitId).maybeSingle();
      const tbrVal = Number(settings?.tbr_value ?? 0);
      setTbrValue(tbrVal);

      // Fetch rides in period
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

      // Fetch drivers, tbrs, returns in parallel
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

      // Group data per driver
      const driverMap = new Map(drivers.map(d => [d.id, d]));

      const result: DriverPayrollData[] = driverIds.map(driverId => {
        const driver = driverMap.get(driverId)!;
        const driverRides = rides.filter(r => r.driver_id === driverId);

        // Group by day
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
          return {
            date,
            login: info.login,
            tbrCount: rTbrs.length,
            returns: rReturns,
            value: (rTbrs.length - rReturns) * tbrVal,
          };
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
          driver: {
            id: driver.id,
            name: driver.name,
            cpf: driver.cpf,
            car_plate: driver.car_plate,
            car_model: driver.car_model,
            car_color: driver.car_color,
          },
          days,
          totalTbrs,
          totalReturns,
          totalCompleted,
          totalValue,
          daysWorked: days.length,
          loginsUsed,
          bestDay: bestDay ? { date: bestDay.date, tbrs: bestDay.tbrCount } : null,
          worstDay: worstDay ? { date: worstDay.date, tbrs: worstDay.tbrCount } : null,
          avgDaily,
        };
      }).sort((a, b) => b.totalTbrs - a.totalTbrs);

      setPayrollData(result);

      // Print after state update
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err) {
      toast({ title: "Erro", description: "Erro ao gerar relatório.", variant: "destructive" });
    }
    setLoading(null);
  };

  const formatCpf = (cpf: string) =>
    cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

  const formatDateBR = (dateStr: string) =>
    format(new Date(dateStr + "T12:00:00"), "dd/MM", { locale: ptBR });

  const grandTotalTbrs = payrollData?.reduce((s, d) => s + d.totalTbrs, 0) ?? 0;
  const grandTotalReturns = payrollData?.reduce((s, d) => s + d.totalReturns, 0) ?? 0;
  const grandTotalCompleted = payrollData?.reduce((s, d) => s + d.totalCompleted, 0) ?? 0;
  const grandTotalValue = payrollData?.reduce((s, d) => s + d.totalValue, 0) ?? 0;
  const grandTotalDays = payrollData?.reduce((s, d) => s + d.daysWorked, 0) ?? 0;

  const reportCards = [
    {
      key: "payroll",
      title: "Folha de Pagamento",
      description: "Relatório detalhado com ficha individual por motorista",
      icon: FileText,
      action: fetchPayrollData,
    },
    {
      key: "daily",
      title: "Resumo Diário",
      description: "Consolidado da operação do dia selecionado",
      icon: BarChart3,
      action: () => toast({ title: "Em breve", description: "Relatório em desenvolvimento." }),
    },
    {
      key: "returns",
      title: "Relatório de Retornos",
      description: "Todos os retornos (Piso, PS, RTO) do período",
      icon: RotateCcw,
      action: () => toast({ title: "Em breve", description: "Relatório em desenvolvimento." }),
    },
    {
      key: "performance",
      title: "Ranking Performance",
      description: "Classificação dos motoristas por desempenho",
      icon: Trophy,
      action: () => toast({ title: "Em breve", description: "Relatório em desenvolvimento." }),
    },
  ];

  return (
    <>
      <div className="p-4 md:p-6 space-y-6 print:hidden">
        <h1 className="text-2xl font-bold italic">Relatórios</h1>

        {/* Date filters */}
        <div className="flex flex-wrap gap-3 items-center">
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
                onSelect={(d) => { if (d) { d.setHours(0, 0, 0, 0); setStartDate(d); } }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
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
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(d) => { if (d) { d.setHours(23, 59, 59, 999); setEndDate(d); } }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Report cards */}
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
                <Button
                  className="w-full gap-2"
                  onClick={r.action}
                  disabled={loading === r.key}
                >
                  {loading === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Gerar PDF
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Print-only content */}
      {payrollData && (
        <div ref={printRef} className="hidden print:block print-area">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-area, .print-area * { visibility: visible; }
              .print-area { position: absolute; left: 0; top: 0; width: 100%; }
              .page-break { page-break-before: always; }
              @page { margin: 15mm; size: A4; }
            }
            .print-area { font-family: 'Arial', sans-serif; font-size: 11px; color: #111; }
            .print-area h1 { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
            .print-area h2 { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
            .print-area table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            .print-area th, .print-area td { border: 1px solid #333; padding: 5px 8px; text-align: left; }
            .print-area th { background: #222; color: #fff; font-weight: 700; font-size: 10px; text-transform: uppercase; }
            .print-area .total-row { background: #f0f0f0; font-weight: 700; }
            .print-area .metric-box { display: inline-block; padding: 6px 12px; margin: 4px; border: 1px solid #ccc; border-radius: 4px; text-align: center; }
            .print-area .metric-value { font-size: 20px; font-weight: 800; color: #111; }
            .print-area .metric-label { font-size: 9px; color: #666; text-transform: uppercase; }
            .print-area .bar { display: inline-block; height: 14px; background: #2563eb; border-radius: 2px; min-width: 2px; }
            .print-area .section-divider { border-top: 2px solid #222; margin: 12px 0; }
          `}</style>

          {/* PAGE 1 — Summary */}
          <div>
            <h1>FOLHA DE PAGAMENTO</h1>
            <p style={{ fontSize: "13px", color: "#555", marginBottom: "12px" }}>
              {unitName} — {format(startDate, "dd/MM/yyyy")} a {format(endDate, "dd/MM/yyyy")}
            </p>
            <p style={{ fontSize: "10px", color: "#888", marginBottom: "16px" }}>
              Valor por TBR: R$ {tbrValue.toFixed(2).replace(".", ",")} | Gerado em: {format(new Date(), "dd/MM/yyyy HH:mm")}
            </p>

            <table>
              <thead>
                <tr>
                  <th>Motorista</th>
                  <th>Dias</th>
                  <th>Logins</th>
                  <th>TBRs</th>
                  <th>Retornos</th>
                  <th>Concluídos</th>
                  <th>Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {payrollData.map((d) => (
                  <tr key={d.driver.id}>
                    <td style={{ fontWeight: 600 }}>{d.driver.name}</td>
                    <td>{d.daysWorked}</td>
                    <td style={{ fontSize: "10px" }}>{d.loginsUsed.join(", ") || "—"}</td>
                    <td>{d.totalTbrs}</td>
                    <td>{d.totalReturns}</td>
                    <td>{d.totalCompleted}</td>
                    <td>R$ {d.totalValue.toFixed(2).replace(".", ",")}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>TOTAL</td>
                  <td>{grandTotalDays}</td>
                  <td>—</td>
                  <td>{grandTotalTbrs}</td>
                  <td>{grandTotalReturns}</td>
                  <td>{grandTotalCompleted}</td>
                  <td>R$ {grandTotalValue.toFixed(2).replace(".", ",")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Individual driver pages */}
          {payrollData.map((d) => {
            const maxTbrs = Math.max(...d.days.map(day => day.tbrCount), 1);
            const completionRate = d.totalTbrs > 0 ? ((d.totalCompleted / d.totalTbrs) * 100).toFixed(1) : "0.0";

            return (
              <div key={d.driver.id} className="page-break">
                <h2>FICHA INDIVIDUAL — {d.driver.name}</h2>
                <p style={{ fontSize: "11px", color: "#444", marginBottom: "12px" }}>
                  CPF: {formatCpf(d.driver.cpf)} | Placa: {d.driver.car_plate} | {d.driver.car_model}{d.driver.car_color ? ` ${d.driver.car_color}` : ""}
                </p>

                <div className="section-divider" />

                {/* Metrics */}
                <div style={{ marginBottom: "16px" }}>
                  <div className="metric-box">
                    <div className="metric-value">{d.totalTbrs}</div>
                    <div className="metric-label">Total TBRs</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-value">{d.totalReturns}</div>
                    <div className="metric-label">Retornos</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-value">{completionRate}%</div>
                    <div className="metric-label">Conclusão</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-value">{d.avgDaily}</div>
                    <div className="metric-label">Média Diária</div>
                  </div>
                  <div className="metric-box">
                    <div className="metric-value">R$ {d.totalValue.toFixed(2).replace(".", ",")}</div>
                    <div className="metric-label">Valor Total</div>
                  </div>
                </div>

                {/* Insights */}
                <div style={{ fontSize: "11px", marginBottom: "12px", padding: "8px", background: "#f8f8f8", borderRadius: "4px" }}>
                  <strong>Insights:</strong>
                  {d.bestDay && <span> Melhor dia: {formatDateBR(d.bestDay.date)} ({d.bestDay.tbrs} TBRs)</span>}
                  {d.worstDay && d.days.length > 1 && <span> | Pior dia: {formatDateBR(d.worstDay.date)} ({d.worstDay.tbrs} TBRs)</span>}
                  <span> | Dias trabalhados: {d.daysWorked}</span>
                </div>

                {/* Daily breakdown table */}
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Login</th>
                      <th>TBRs</th>
                      <th>Retornos</th>
                      <th>Valor (R$)</th>
                      <th style={{ width: "30%" }}>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.days.map((day) => (
                      <tr key={day.date}>
                        <td>{formatDateBR(day.date)}</td>
                        <td>{day.login || "—"}</td>
                        <td>{day.tbrCount}</td>
                        <td>{day.returns}</td>
                        <td>R$ {day.value.toFixed(2).replace(".", ",")}</td>
                        <td>
                          <span
                            className="bar"
                            style={{ width: `${(day.tbrCount / maxTbrs) * 100}%` }}
                          />
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
