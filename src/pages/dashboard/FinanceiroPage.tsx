import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ChevronLeft, FileText, CheckCircle, Clock, Download } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface PayrollReport {
  id: string;
  generated_by: string;
  period_start: string;
  period_end: string;
  report_data: any[];
  created_at: string;
}

const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;

const FinanceiroPage = () => {
  const { unitSession } = useAuthStore();
  const [reports, setReports] = useState<PayrollReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<PayrollReport | null>(null);
  const [invoices, setInvoices] = useState<Record<string, { file_url: string; file_name: string } | null>>({});

  const unitId = unitSession?.id;

  useEffect(() => {
    if (!unitId) return;
    loadReports();
  }, [unitId]);

  const loadReports = async () => {
    if (!unitId) return;
    const { data } = await supabase
      .from("payroll_reports" as any)
      .select("*")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });
    setReports((data as any) ?? []);
    setLoading(false);
  };

  const loadInvoices = async (reportId: string) => {
    const { data } = await supabase
      .from("driver_invoices" as any)
      .select("driver_id, file_url, file_name")
      .eq("payroll_report_id", reportId);
    const map: Record<string, { file_url: string; file_name: string } | null> = {};
    ((data as any[]) ?? []).forEach((inv: any) => {
      if (inv.file_url) map[inv.driver_id] = { file_url: inv.file_url, file_name: inv.file_name };
    });
    setInvoices(map);
  };

  const handleSelectReport = (report: PayrollReport) => {
    setSelectedReport(report);
    loadInvoices(report.id);
  };

  if (selectedReport) {
    const drivers = selectedReport.report_data as any[];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedReport(null); setInvoices({}); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl font-bold italic">
            Relatório {format(new Date(selectedReport.period_start + "T12:00:00"), "dd/MM/yyyy")} — {format(new Date(selectedReport.period_end + "T12:00:00"), "dd/MM/yyyy")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Gerado por {selectedReport.generated_by} em {format(new Date(selectedReport.created_at), "dd/MM/yyyy HH:mm")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((d: any) => {
            const inv = invoices[d.driver?.id];
            return (
              <Card key={d.driver?.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold">{d.driver?.name}</p>
                      <p className="text-xs text-muted-foreground">{d.driver?.car_plate}</p>
                    </div>
                    <p className="font-bold text-primary">{formatCurrency(d.totalValue ?? 0)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div>TBRs: <strong>{d.totalTbrs}</strong></div>
                    <div>Retornos: <strong>{d.totalReturns}</strong></div>
                    <div>Dias: <strong>{d.daysWorked}</strong></div>
                    <div>Corridas: <strong>{d.days?.length ?? 0}</strong></div>
                    {d.dnrDiscount > 0 && <div className="text-destructive">DNR: <strong>-{formatCurrency(d.dnrDiscount)}</strong></div>}
                    {d.bonus > 0 && <div className="text-primary">Bônus: <strong>+{formatCurrency(d.bonus)}</strong></div>}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    {inv ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-600 font-semibold">NF Anexada</span>
                        <a href={inv.file_url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                          <Button variant="outline" size="sm">
                            <Download className="h-3 w-3 mr-1" /> Baixar
                          </Button>
                        </a>
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 text-yellow-500" />
                        <span className="text-xs text-yellow-600 font-semibold">NF Pendente</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold italic flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" /> Financeiro
      </h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground italic">Nenhum relatório gerado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Gere um PDF na seção Relatórios para criar registros aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reports.map((r) => {
            const drivers = r.report_data as any[];
            const totalValue = drivers.reduce((s: number, d: any) => s + (d.totalValue ?? 0), 0);
            return (
              <Card key={r.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSelectReport(r)}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base font-bold italic">
                      {format(new Date(r.period_start + "T12:00:00"), "dd/MM/yyyy")} — {format(new Date(r.period_end + "T12:00:00"), "dd/MM/yyyy")}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">{drivers.length} motorista(s)</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total: <strong className="text-foreground">{formatCurrency(totalValue)}</strong></span>
                    <span className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Gerado por {r.generated_by}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FinanceiroPage;
