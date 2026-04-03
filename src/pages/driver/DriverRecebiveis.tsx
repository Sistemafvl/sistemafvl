import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Upload, CheckCircle, Loader2, FileText, Pencil, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

interface PayrollEntry {
  reportId: string;
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
  createdAt: string;
  driverData: any;
  totalCommon: number;
  totalMinimum: number;
  commonInvoice?: any;
  minimumInvoice?: any;
}

const formatCurrency = (val: number) => val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatCnpj = (cnpj: string) => {
  const d = cnpj.replace(/\D/g, "");
  if (d.length === 14)
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return cnpj;
};

const DriverRecebiveis = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [managerCnpj, setManagerCnpj] = useState<string | null>(null);

  useEffect(() => {
    if (driverId) loadEntries();
    if (unitSession?.id) loadManagerCnpj();
  }, [driverId]);

  const loadManagerCnpj = async () => {
    if (!unitSession?.id) return;
    const { data } = await supabase
      .from("managers")
      .select("cnpj")
      .eq("unit_id", unitSession.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (data) setManagerCnpj((data as any).cnpj);
  };

  const loadEntries = async () => {
    if (!driverId) return;

    // Fetch all payroll_reports, filter those containing this driver
    const unitId = unitSession?.id;
    const { data: reports } = await supabase
      .from("payroll_reports" as any)
      .select("id, period_start, period_end, generated_by, created_at, report_data, status")
      .eq("unit_id", unitId!)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (!reports) { setLoading(false); return; }

    // Get all invoices for this driver
    const { data: invoiceData } = await supabase
      .from("driver_invoices" as any)
      .select("id, payroll_report_id, file_name, file_url")
      .eq("driver_id", driverId);

    // Map invoices by payroll_report_id and type (determined by file_name prefix)
    const invoiceMap = new Map<string, { common?: any; minimum?: any }>();
    ((invoiceData as any[]) ?? []).forEach((inv: any) => {
      const existing = invoiceMap.get(inv.payroll_report_id) || {};
      if (inv.file_name?.startsWith("MIN_")) {
        existing.minimum = inv;
      } else {
        existing.common = inv;
      }
      invoiceMap.set(inv.payroll_report_id, existing);
    });

    const result: any[] = [];
    (reports as any[]).forEach((r: any) => {
      const drivers = r.report_data as any[];
      const myData = drivers.find((d: any) => d.driver?.id === driverId);
      if (myData) {
        const invs = invoiceMap.get(r.id);
        
        // Calculate split totals
        const totalCommon = myData.days.reduce((s: number, day: any) => {
          const tbrVal = myData.tbrValueUsed || 0;
          // New logic (from 01/04/2026): completed is physical, minPkgDifference is adjustment
          if (day.completed !== undefined) {
             return s + (day.completed * tbrVal);
          }
          // Old logic: minPkgApplied meant the whole day was minimum
          return s + (day.minPkgApplied ? 0 : day.value);
        }, 0) + (myData.bonus || 0) + (myData.reativoTotal || 0);

        const totalMinimum = myData.days.reduce((s: number, day: any) => {
          const tbrVal = myData.tbrValueUsed || 0;
          // New logic: minPkgDifference is the adjustment value to be shown in the second card
          if (day.minPkgDifference !== undefined) {
            return s + (day.minPkgDifference * tbrVal);
          }
          // Old logic: minPkgApplied meant the whole day was minimum
          return s + (day.minPkgApplied ? day.value : 0);
        }, 0);

        result.push({
          reportId: r.id,
          periodStart: r.period_start,
          periodEnd: r.period_end,
          generatedBy: r.generated_by,
          createdAt: r.created_at,
          driverData: myData,
          totalCommon,
          totalMinimum,
          commonInvoice: invs?.common,
          minimumInvoice: invs?.minimum,
        });
      }
    });

    setEntries(result);
    setLoading(false);
  };

  const handleUpload = async (reportId: string, file: File, type: "common" | "minimum") => {
    if (!driverId || !unitSession) return;
    const uploadKey = `${reportId}_${type}`;
    setUploading(uploadKey);

    const prefix = type === "minimum" ? "MIN_" : "COM_";
    const fileName = `${prefix}${file.name}`;
    const filePath = `${driverId}/nf_${reportId}_${type}_${Date.now()}_${file.name}`;
    
    const { error: uploadError } = await supabase.storage.from("driver-documents").upload(filePath, file);

    if (uploadError) {
      toast({ title: "Erro", description: "Erro ao fazer upload do arquivo.", variant: "destructive" });
      setUploading(null);
      return;
    }

    const fileUrl = filePath;

    // Check if invoice record of this type already exists
    // Since we use the prefix in file_name to distinguish, we fetch based on report and prefix
    const { data: allInvoices } = await supabase
      .from("driver_invoices" as any)
      .select("id, file_name")
      .eq("payroll_report_id", reportId)
      .eq("driver_id", driverId) as { data: any[] | null };
    
    const existing = allInvoices?.find((inv: any) => 
      type === "minimum" ? inv.file_name?.startsWith("MIN_") : !inv.file_name?.startsWith("MIN_")
    );

    if (existing) {
      await supabase.from("driver_invoices" as any)
        .update({ file_url: fileUrl, file_name: fileName, uploaded_at: new Date().toISOString() } as any)
        .eq("id", existing.id);
    } else {
      await supabase.from("driver_invoices" as any).insert({
        payroll_report_id: reportId,
        driver_id: driverId,
        unit_id: unitSession.id,
        file_url: fileUrl,
        file_name: fileName,
        uploaded_at: new Date().toISOString(),
      } as any);
    }

    toast({ title: "NF Anexada!", description: `Nota fiscal (${type === 'minimum' ? 'Mínimo' : 'Comum'}) enviada com sucesso.` });
    setUploading(null);
    loadEntries();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold italic flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" /> Recebíveis
      </h1>

      {/* NF instruction alert */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 flex gap-3 items-start">
        <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-blue-700 dark:text-blue-400">Importante: Emissão de Nota Fiscal</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Emita sua NF dentro do prazo estipulado e confira atentamente as seguintes informações antes do envio:
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5 mt-1">
            <li><strong>CNPJ:</strong> {managerCnpj ? formatCnpj(managerCnpj) : <span className="text-muted-foreground italic">Carregando...</span>}</li>
            <li><strong>Código de Prestação de Serviço:</strong> 16.02.01</li>
            <li><strong>Valor dos Serviços:</strong> deve corresponder ao valor do relatório</li>
          </ul>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Em caso de divergência nessas informações, o pagamento ficará retido até a devida correção da nota fiscal.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground italic">Nenhum relatório de pagamento disponível.</p>
            <p className="text-xs text-muted-foreground mt-1">Quando o gerente gerar um relatório, ele aparecerá aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const d = entry.driverData;
            // Only show split if both exist
            const hasCommon = entry.totalCommon > 0;
            const hasMinimum = entry.totalMinimum > 0;

            const renderNfField = (type: "common" | "minimum", value: number, invoice: any) => {
              const inputId = `file-${entry.reportId}-${type}`;
              const isUploading = uploading === `${entry.reportId}_${type}`;
              
              const triggerFileInput = () => {
                if (uploading) return;
                const el = document.getElementById(inputId) as HTMLInputElement;
                if (el) { el.value = ""; el.click(); }
              };

              const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(entry.reportId, file, type);
              };

              return (
                <div className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-semibold">
                      {type === "minimum" ? "TBRs Mínimo" : "TBRs Comuns"}
                    </span>
                    <span className="font-bold text-primary">{formatCurrency(value)}</span>
                  </div>

                  <input id={inputId} type="file" className="hidden" onChange={onFileChange} />
                  
                  <div className="flex items-center gap-2 pt-2 border-t border-dashed">
                    {invoice ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="text-[10px] text-green-600 font-medium truncate">
                             {invoice.file_name?.replace(/^(MIN_|COM_)/, "")}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!!uploading} onClick={triggerFileInput} type="button">
                          {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3 text-muted-foreground" />}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <Badge variant="outline" className="text-[10px] py-0 h-5 border-yellow-500/50 text-yellow-600 bg-yellow-50/50">Pendente</Badge>
                        <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2" disabled={!!uploading} onClick={triggerFileInput} type="button">
                          {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          Anexar NF
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <Card key={entry.reportId}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-sm">
                        {format(new Date(entry.periodStart + "T12:00:00"), "dd/MM/yyyy")} — {format(new Date(entry.periodEnd + "T12:00:00"), "dd/MM/yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">Gerado por {entry.generatedBy}</p>
                    </div>
                    <p className="font-bold text-lg text-primary">{formatCurrency(d.totalValue ?? 0)}</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>TBRs: <strong>{d.totalTbrs}</strong></div>
                    <div>Retornos: <strong>{d.totalReturns}</strong></div>
                    <div>Dias: <strong>{d.daysWorked}</strong></div>
                    {d.dnrDiscount > 0 && <div className="text-destructive">DNR: <strong>-{formatCurrency(d.dnrDiscount)}</strong></div>}
                    {d.bonus > 0 && <div className="text-primary">Bônus: <strong>+{formatCurrency(d.bonus)}</strong></div>}
                    {(d.reativoTotal ?? 0) > 0 && <div className="text-amber-600">Reativo: <strong>+{formatCurrency(d.reativoTotal)}</strong></div>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {hasCommon && renderNfField("common", entry.totalCommon, entry.commonInvoice)}
                    {hasMinimum && renderNfField("minimum", entry.totalMinimum, entry.minimumInvoice)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DriverRecebiveis;
