import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, ChevronLeft, FileText, CheckCircle, Clock, Download, CalendarIcon, Search, Users, TrendingUp, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

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
  const [allInvoiceCounts, setAllInvoiceCounts] = useState<Record<string, number>>({});
  const [searchFilter, setSearchFilter] = useState("");
  const [filterStart, setFilterStart] = useState<Date | undefined>(undefined);
  const [filterEnd, setFilterEnd] = useState<Date | undefined>(undefined);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Delete modal state
  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

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
    const reportsData = (data as any) ?? [];
    setReports(reportsData);

    const { data: allInvoices } = await supabase
      .from("driver_invoices" as any)
      .select("payroll_report_id, file_url")
      .eq("unit_id", unitId);

    const counts: Record<string, number> = {};
    ((allInvoices as any[]) ?? []).forEach((inv: any) => {
      if (inv.file_url) {
        counts[inv.payroll_report_id] = (counts[inv.payroll_report_id] ?? 0) + 1;
      }
    });
    setAllInvoiceCounts(counts);
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

  const handleDownload = async (driverId: string) => {
    const inv = invoices[driverId];
    if (!inv) return;
    setDownloading(driverId);
    try {
      let storagePath = inv.file_url;
      if (storagePath.startsWith("http")) {
        const match = storagePath.match(/driver-documents\/(.+?)(\?|$)/);
        if (match) {
          storagePath = decodeURIComponent(match[1]);
        } else {
          toast({ title: "Erro", description: "Não foi possível localizar o arquivo.", variant: "destructive" });
          setDownloading(null);
          return;
        }
      }
      const { data, error } = await supabase.functions.invoke("get-signed-url", {
        body: { bucket: "driver-documents", path: storagePath, driver_id: driverId },
      });
      if (error || !data?.signedUrl) {
        toast({ title: "Erro", description: "Erro ao gerar link de download.", variant: "destructive" });
      } else {
        window.open(data.signedUrl, "_blank");
      }
    } catch {
      toast({ title: "Erro", description: "Erro ao baixar arquivo.", variant: "destructive" });
    }
    setDownloading(null);
  };

  const handleDeleteReport = async () => {
    if (!deleteReportId || !unitId) return;
    setDeleting(true);
    try {
      // Validate manager password
      const { data: managers } = await supabase
        .from("managers")
        .select("manager_password")
        .eq("unit_id", unitId)
        .eq("active", true);

      const valid = (managers ?? []).some((m: any) => m.manager_password === deletePassword);
      if (!valid) {
        toast({ title: "Erro", description: "Senha do gerente inválida.", variant: "destructive" });
        setDeleting(false);
        return;
      }

      // 1. Delete driver_invoices
      await (supabase
        .from("driver_invoices") as any)
        .delete()
        .eq("payroll_report_id", deleteReportId);

      // 2. Clear reported_in_payroll_id on dnr_entries
      await (supabase
        .from("dnr_entries") as any)
        .update({ reported_in_payroll_id: null })
        .eq("reported_in_payroll_id", deleteReportId);

      // 3. Delete the payroll_report
      await supabase
        .from("payroll_reports" as any)
        .delete()
        .eq("id", deleteReportId);

      toast({ title: "Relatório excluído", description: "Relatório e registros associados foram removidos." });
      setDeleteReportId(null);
      setDeletePassword("");
      setSelectedReport(null);
      setInvoices({});
      await loadReports();
    } catch {
      toast({ title: "Erro", description: "Erro ao excluir relatório.", variant: "destructive" });
    }
    setDeleting(false);
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterStart) {
        const rStart = new Date(r.period_start + "T00:00:00");
        if (rStart < filterStart) return false;
      }
      if (filterEnd) {
        const rEnd = new Date(r.period_end + "T23:59:59");
        if (rEnd > filterEnd) return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const drivers = r.report_data as any[];
        const matchesDriver = drivers.some((d: any) =>
          d.driver?.name?.toLowerCase().includes(q) ||
          d.driver?.cpf?.toLowerCase().includes(q) ||
          d.driver?.car_plate?.toLowerCase().includes(q)
        );
        const matchesMeta = r.generated_by?.toLowerCase().includes(q);
        return matchesDriver || matchesMeta;
      }
      return true;
    });
  }, [reports, searchFilter, filterStart, filterEnd]);

  const totalReportsValue = useMemo(() => {
    return filteredReports.reduce((sum, r) => {
      const drivers = r.report_data as any[];
      return sum + drivers.reduce((s: number, d: any) => s + (d.totalValue ?? 0), 0);
    }, 0);
  }, [filteredReports]);

  const totalDrivers = useMemo(() => {
    const ids = new Set<string>();
    filteredReports.forEach((r) => {
      (r.report_data as any[]).forEach((d: any) => { if (d.driver?.id) ids.add(d.driver.id); });
    });
    return ids.size;
  }, [filteredReports]);

  if (selectedReport) {
    const drivers = selectedReport.report_data as any[];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedReport(null); setInvoices({}); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl font-bold italic flex-1">
            Relatório {format(new Date(selectedReport.period_start + "T12:00:00"), "dd/MM/yyyy")} — {format(new Date(selectedReport.period_end + "T12:00:00"), "dd/MM/yyyy")}
          </h1>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setDeleteReportId(selectedReport.id)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
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
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="ml-auto"
                          disabled={downloading === d.driver?.id}
                          onClick={() => handleDownload(d.driver?.id)}
                        >
                          {downloading === d.driver?.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3 mr-1" />
                          )}
                          Baixar
                        </Button>
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

        {/* Delete confirmation modal */}
        {deleteReportId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/80" onClick={() => { setDeleteReportId(null); setDeletePassword(""); }} />
            <div className="relative z-50 w-full max-w-sm border bg-background p-6 shadow-lg rounded-lg animate-in fade-in-0 zoom-in-95">
              <h3 className="text-lg font-bold mb-2">Excluir Relatório</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Esta ação removerá o relatório, as NFs associadas e liberará os DNRs marcados. Digite a senha do gerente para confirmar.
              </p>
              <Input
                type="password"
                placeholder="Senha do gerente"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="mb-4"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setDeleteReportId(null); setDeletePassword(""); }}>
                  Cancelar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={handleDeleteReport} disabled={!deletePassword || deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold italic flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" /> Financeiro
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Relatórios</p>
              <p className="text-lg font-bold">{filteredReports.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Motoristas</p>
              <p className="text-lg font-bold">{totalDrivers}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{formatCurrency(totalReportsValue)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              {filterStart ? format(filterStart, "dd/MM/yyyy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterStart} onSelect={(d) => { if (d) { d.setHours(0,0,0,0); setFilterStart(d); } }} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              {filterEnd ? format(filterEnd, "dd/MM/yyyy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filterEnd} onSelect={(d) => { if (d) { d.setHours(23,59,59,999); setFilterEnd(d); } }} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {(filterStart || filterEnd) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStart(undefined); setFilterEnd(undefined); }} className="text-xs text-muted-foreground">
            Limpar datas
          </Button>
        )}
        <Input
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder="Buscar por motorista, CPF, placa..."
          className="h-8 text-sm flex-1 min-w-[200px]"
        />
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filteredReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground italic">
              {reports.length === 0 ? "Nenhum relatório gerado ainda." : "Nenhum relatório encontrado com os filtros aplicados."}
            </p>
            {reports.length === 0 && <p className="text-xs text-muted-foreground mt-1">Gere um PDF na seção Relatórios para criar registros aqui.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredReports.map((r) => {
            const drivers = r.report_data as any[];
            const totalValue = drivers.reduce((s: number, d: any) => s + (d.totalValue ?? 0), 0);
            const totalDriversInReport = drivers.length;
            const nfReceived = allInvoiceCounts[r.id] ?? 0;
            const allNfDone = nfReceived >= totalDriversInReport && totalDriversInReport > 0;
            return (
              <div
                key={r.id}
                className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => handleSelectReport(r)}
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">
                    {format(new Date(r.period_start + "T12:00:00"), "dd/MM/yyyy")} — {format(new Date(r.period_end + "T12:00:00"), "dd/MM/yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">Gerado por {r.generated_by}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="font-bold text-sm text-primary">{formatCurrency(totalValue)}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM HH:mm")}</p>
                </div>
                <div className="shrink-0 flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium">NF Receb.</span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      allNfDone 
                        ? "border-green-500 text-green-600 bg-green-50" 
                        : "border-yellow-500 text-yellow-600"
                    )}
                  >
                    {nfReceived}/{totalDriversInReport}
                  </Badge>
                </div>
                <button
                  className="shrink-0 p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                  title="Excluir relatório"
                  onClick={(e) => { e.stopPropagation(); setDeleteReportId(r.id); }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteReportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={() => { setDeleteReportId(null); setDeletePassword(""); }} />
          <div className="relative z-50 w-full max-w-sm border bg-background p-6 shadow-lg rounded-lg animate-in fade-in-0 zoom-in-95">
            <h3 className="text-lg font-bold mb-2">Excluir Relatório</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esta ação removerá o relatório, as NFs associadas e liberará os DNRs marcados. Digite a senha do gerente para confirmar.
            </p>
            <Input
              type="password"
              placeholder="Senha do gerente"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="mb-4"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDeleteReportId(null); setDeletePassword(""); }}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeleteReport} disabled={!deletePassword || deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroPage;
