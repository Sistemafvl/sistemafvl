import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Upload, CheckCircle, Loader2, FileText, Pencil } from "lucide-react";
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
  invoiceUploaded: boolean;
  invoiceFileName?: string;
}

const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`;

const DriverRecebiveis = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.user_profile_id;
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (driverId) loadEntries();
  }, [driverId]);

  const loadEntries = async () => {
    if (!driverId) return;

    // Fetch all payroll_reports, filter those containing this driver
    const unitId = unitSession?.id;
    const { data: reports } = await supabase
      .from("payroll_reports" as any)
      .select("*")
      .eq("unit_id", unitId!)
      .order("created_at", { ascending: false });

    if (!reports) { setLoading(false); return; }

    // Get invoices for this driver
    const { data: invoiceData } = await supabase
      .from("driver_invoices" as any)
      .select("payroll_report_id, file_name, file_url")
      .eq("driver_id", driverId);

    const invoiceMap = new Map<string, { file_name: string; file_url: string }>();
    ((invoiceData as any[]) ?? []).forEach((inv: any) => {
      if (inv.file_url) invoiceMap.set(inv.payroll_report_id, { file_name: inv.file_name, file_url: inv.file_url });
    });

    const result: PayrollEntry[] = [];
    (reports as any[]).forEach((r: any) => {
      const drivers = r.report_data as any[];
      const myData = drivers.find((d: any) => d.driver?.id === driverId);
      if (myData) {
        const inv = invoiceMap.get(r.id);
        result.push({
          reportId: r.id,
          periodStart: r.period_start,
          periodEnd: r.period_end,
          generatedBy: r.generated_by,
          createdAt: r.created_at,
          driverData: myData,
          invoiceUploaded: !!inv,
          invoiceFileName: inv?.file_name,
        });
      }
    });

    setEntries(result);
    setLoading(false);
  };

  const handleUpload = async (reportId: string, file: File) => {
    if (!driverId || !unitSession) return;
    setUploading(reportId);

    const filePath = `${driverId}/nf_${reportId}_${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("driver-documents").upload(filePath, file);

    if (uploadError) {
      toast({ title: "Erro", description: "Erro ao fazer upload do arquivo.", variant: "destructive" });
      setUploading(null);
      return;
    }

    const { data: urlData } = await supabase.functions.invoke("get-signed-url", {
      body: { bucket: "driver-documents", path: filePath, driver_id: driverId },
    });

    // Store only the storage path, not the signed URL (signed URLs expire)
    const fileUrl = filePath;

    // Check if invoice record already exists
    const { data: existing } = await supabase
      .from("driver_invoices" as any)
      .select("id")
      .eq("payroll_report_id", reportId)
      .eq("driver_id", driverId)
      .maybeSingle();

    if (existing) {
      await supabase.from("driver_invoices" as any)
        .update({ file_url: fileUrl, file_name: file.name, uploaded_at: new Date().toISOString() } as any)
        .eq("id", (existing as any).id);
    } else {
      await supabase.from("driver_invoices" as any).insert({
        payroll_report_id: reportId,
        driver_id: driverId,
        unit_id: unitSession.id,
        file_url: fileUrl,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      } as any);
    }

    toast({ title: "NF Anexada!", description: "Nota fiscal enviada com sucesso." });
    setUploading(null);
    loadEntries();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold italic flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" /> Recebíveis
      </h1>

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
            return (
              <Card key={entry.reportId}>
                <CardContent className="p-4 space-y-3">
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
                    <div>Valor/TBR: <strong>{formatCurrency(d.tbrValueUsed ?? 0)}</strong></div>
                    {d.dnrDiscount > 0 && <div className="text-destructive">DNR: <strong>-{formatCurrency(d.dnrDiscount)}</strong></div>}
                    {d.bonus > 0 && <div className="text-primary">Bônus: <strong>+{formatCurrency(d.bonus)}</strong></div>}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    {entry.invoiceUploaded ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-green-600 font-semibold">NF Enviada: {entry.invoiceFileName}</span>
                        </div>
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(entry.reportId, file);
                            }}
                          />
                          <Button variant="ghost" size="sm" asChild disabled={uploading === entry.reportId}>
                            <span>
                              {uploading === entry.reportId ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Pencil className="h-3 w-3" />
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">NF Pendente</Badge>
                        <label className="ml-auto cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(entry.reportId, file);
                            }}
                          />
                          <Button variant="outline" size="sm" asChild disabled={uploading === entry.reportId}>
                            <span>
                              {uploading === entry.reportId ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Upload className="h-3 w-3 mr-1" />
                              )}
                              Anexar NF
                            </span>
                          </Button>
                        </label>
                      </>
                    )}
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
