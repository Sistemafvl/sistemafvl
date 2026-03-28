import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import JSZip from "jszip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, ChevronLeft, FileText, CheckCircle, Clock, Download, CalendarIcon, Search, Users, TrendingUp, Loader2, Trash2 } from "lucide-react";
import InfoButton from "@/components/dashboard/InfoButton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface PayrollReport {
  id: string;
  generated_by: string;
  period_start: string;
  period_end: string;
  report_data: any[];
  status?: "pending" | "approved" | "rejected" | "published";
  created_at: string;
}

const formatCurrency = (val: number) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FinanceiroPage = () => {
  const { unitSession } = useAuthStore();
  const navigate = useNavigate();
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
  const [zipLoading, setZipLoading] = useState(false);

  const unitId = unitSession?.id;

  useEffect(() => {
    if (!unitId) return;
    loadReports();
  }, [unitId]);

  const loadReports = async () => {
    if (!unitId) return;
    const { fetchAllRows } = await import("@/lib/supabase-helpers");
    
    // 1. Try fetching with status first
    const { data: testData, error: statusError } = await supabase
      .from("payroll_reports" as any)
      .select("status")
      .limit(1);

    const useStatus = !statusError;

    const reportsData = await fetchAllRows<any>((from, to) => {
      const base = supabase.from("payroll_reports" as any);
      const query = useStatus 
        ? base.select("id, generated_by, period_start, period_end, report_data, status, created_at")
        : base.select("id, generated_by, period_start, period_end, report_data, created_at");
      
      return (query as any)
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to);
    });

    setReports(reportsData || []);

    const allInvoices = await fetchAllRows<any>((from, to) =>
      supabase.from("driver_invoices" as any).select("payroll_report_id, file_url").eq("unit_id", unitId).order("id").range(from, to)
    );

    const counts: Record<string, number> = {};
    allInvoices.forEach((inv: any) => {
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

  const handleDownloadAllZip = async () => {
    if (!selectedReport) return;
    setZipLoading(true);
    
    try {
      const zip = new JSZip();
      const driverEntries = selectedReport.report_data as any[];
      let addedFilesCount = 0;
      
      const downloadPromises = driverEntries.map(async (d) => {
        const inv = invoices[d.driver?.id];
        if (!inv) return;

        let storagePath = inv.file_url;
        if (storagePath.startsWith("http")) {
          const match = storagePath.match(/driver-documents\/(.+?)(\?|$)/);
          if (match) {
            storagePath = decodeURIComponent(match[1]);
          } else {
            return;
          }
        }

        const { data, error } = await supabase.functions.invoke("get-signed-url", {
          body: { bucket: "driver-documents", path: storagePath, driver_id: d.driver?.id },
        });

        if (data?.signedUrl) {
          try {
            const response = await fetch(data.signedUrl);
            if (!response.ok) throw new Error("Fetch failed");
            const blob = await response.blob();
            const cleanName = d.driver?.name?.replace(/[^a-z0-9]/gi, '_') || "motorista";
            const fileName = `${cleanName}_${inv.file_name}`;
            zip.file(fileName, blob);
            addedFilesCount++;
          } catch (fetchErr) {
            console.error(`Failed to fetch invoice for ${d.driver?.name}:`, fetchErr);
          }
        }
      });

      await Promise.all(downloadPromises);

      if (addedFilesCount === 0) {
        toast({ title: "Aviso", description: "Nenhuma NF encontrada para baixar.", variant: "destructive" });
        setZipLoading(false);
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      const reportDate = format(new Date(selectedReport.period_start + "T12:00:00"), "dd-MM-yyyy");
      link.download = `NFs_Relatorio_${reportDate}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Sucesso", description: `${addedFilesCount} NFs comprimidas e prontas para o download.` });
    } catch (err) {
        console.error("ZIP download error:", err);
        toast({ title: "Erro", description: "Erro ao gerar arquivo ZIP.", variant: "destructive" });
    } finally {
        setZipLoading(false);
    }
  };

  const handleUpdateStatus = async (reportId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("payroll_reports" as any)
        .update({ status: newStatus } as any)
        .eq("id", reportId);
      
      if (error) throw error;
      
      toast({ title: "Sucesso", description: `Relatório ${newStatus === 'approved' ? 'aprovado' : newStatus === 'rejected' ? 'recusado' : 'publicado'} com sucesso!` });
      loadReports();
    } catch (err) {
      console.error("Error updating report status:", err);
      toast({ 
        title: "Erro ao atualizar status", 
        description: "Certifique-se de que a migração do banco de dados foi aplicada. (Coluna 'status' em 'payroll_reports')", 
        variant: "destructive",
        duration: 8000
      });
    }
  };

  const handleExportCSV = (report: PayrollReport) => {
    if (!report.report_data || !Array.isArray(report.report_data)) return;
    
    const headers = ["Motorista", "CPF", "TBRs", "Retornos", "DNR", "Bônus", "Reativo", "Valor Total"];
    const rows = report.report_data.map(d => [
      d.driver?.name || "",
      d.driver?.cpf || "",
      d.totalTbrs || 0,
      d.totalReturns || 0,
      d.dnrDiscount || 0,
      d.bonus || 0,
      d.reativoTotal || 0,
      d.totalValue || 0
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(v => typeof v === 'string' ? `"${v}"` : v).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_pagamento_${report.period_start}_a_${report.period_end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteReport = async () => {
    if (!deleteReportId || !unitId) return;
    setDeleting(true);
    try {
      // Validate manager password server-side
      const { validateManagerPassword } = await import("@/lib/validate-manager-password");
      const { valid } = await validateManagerPassword(unitId, deletePassword);
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
            className="border-primary/30 hover:bg-primary/10 gap-2"
            onClick={handleDownloadAllZip}
            disabled={zipLoading || Object.values(invoices).filter(Boolean).length === 0}
          >
            {zipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar todas NFs (ZIP)
          </Button>
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
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-3">
          {unitSession?.sessionType === "matriz" && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 h-8 text-[10px] font-bold uppercase italic border-primary/20 hover:bg-primary/5"
              onClick={() => navigate("/dashboard/matriz/financeiro")}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Visão Consolidada
            </Button>
          )}
          <h1 className="text-2xl font-bold italic flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" /> Financeiro
          </h1>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center">Relatórios <InfoButton text="Quantidade total de relatórios de folha de pagamento gerados para esta unidade." /></p>
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
              <p className="text-xs text-muted-foreground flex items-center">Motoristas <InfoButton text="Número de motoristas distintos que aparecem nos relatórios financeiros." /></p>
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
              <p className="text-xs text-muted-foreground flex items-center">Total <InfoButton text="Valor total pago em todos os relatórios filtrados. Soma de TBRs concluídos, bônus e descontos DNR." /></p>
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
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm truncate">
                        {format(new Date(r.period_start + "T12:00:00"), "dd/MM/yyyy")} — {format(new Date(r.period_end + "T12:00:00"), "dd/MM/yyyy")}
                      </p>
                      {(!r.status || r.status === "pending") ? (
                        <Badge variant="outline" className="text-[10px] animate-pulse border-amber-500 text-amber-600 bg-amber-500/5 uppercase font-black">Pendente Aprovação</Badge>
                      ) : r.status === "approved" ? (
                        <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 bg-emerald-500/5 uppercase font-black">Aprovado pelo Diretor</Badge>
                      ) : r.status === "published" ? (
                        <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-600 bg-blue-500/5 uppercase font-black">Enviado aos Motoristas</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-destructive text-destructive bg-destructive/5 uppercase font-black">Recusado pelo Diretor</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate italic">Gerado por {r.generated_by}</p>
                    
                    {/* Approval actions for Director */}
                    {unitSession?.sessionType === "matriz" && (!r.status || r.status === "pending") && (
                      <div className="flex items-center gap-2 mt-3">
                        <Button 
                          size="sm" 
                          className="h-8 text-[10px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(r.id, "approved"); }}
                        >
                          <CheckCircle className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="h-8 text-[10px] font-bold uppercase gap-2"
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(r.id, "rejected"); }}
                        >
                          <Trash2 className="h-3 w-3" /> Recusar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="h-8 text-[10px] font-bold uppercase gap-2"
                          onClick={(e) => { e.stopPropagation(); handleExportCSV(r); }}
                        >
                          <Download className="h-3 w-3" /> Exportar Excel
                        </Button>
                      </div>
                    )}

                    {/* Manager actions: Publish after approval */}
                    {unitSession?.sessionType !== "matriz" && r.status === "approved" && (
                      <div className="mt-3">
                        <Button 
                          size="sm" 
                          className="h-8 text-[10px] font-bold uppercase bg-blue-600 hover:bg-blue-700 text-white gap-2"
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(r.id, "published"); }}
                        >
                          <Users className="h-3 w-3" /> Enviar aos Motoristas
                        </Button>
                        <p className="text-[9px] text-muted-foreground mt-1 italic italic">O diretor aprovou seu relatório! Agora você pode liberar a visão para os motoristas.</p>
                      </div>
                    )}
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
