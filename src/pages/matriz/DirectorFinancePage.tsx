import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Building2, ChevronRight, Wallet, Receipt, FileText, TrendingUp, Truck } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const DirectorFinancePage = () => {
  const { unitSession, setActiveUnit } = useAuthStore();
  const domainId = unitSession?.domain_id || "";
  const navigate = useNavigate();

  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: units = [] } = useQuery({
    queryKey: ["director-finance-units", domainId],
    queryFn: async () => {
      if (!domainId) return [];
      const { data } = await supabase.from("units_public").select("id, name").eq("domain_id", domainId).eq("active", true).order("name");
      return (data as any[] || []).filter(u => u.name !== "MATRIZ ADMIN");
    },
    enabled: !!domainId,
  });

  const { data: financialData, isLoading: loading } = useQuery({
    queryKey: ["director-finance-data", units.map(u => u.id).join(","), dateStart, dateEnd],
    queryFn: async () => {
      if (!units.length) return null;
      const unitIds = units.map(u => u.id);
      const start = startOfDay(parseISO(dateStart)).toISOString();
      const end = endOfDay(parseISO(dateEnd)).toISOString();

      // Aggregation for cards
      const { data: rides } = await supabase.from("driver_rides").select("id, unit_id").in("unit_id", unitIds).gte("completed_at", start).lte("completed_at", end);
      const { data: settings } = await supabase.from("unit_settings").select("unit_id, tbr_value").in("unit_id", unitIds);

      return { rides, settings };
    },
    enabled: units.length > 0,
  });

  const [unitReports, setUnitReports] = useState<Record<string, any>>({});
  const [loadingReports, setLoadingReports] = useState(true);

  // Fetch only the latest payroll_reports for each unit
  useEffect(() => {
    if (!units.length) return;
    const fetchLatestReports = async () => {
      setLoadingReports(true);
      const reportsMap: Record<string, any> = {};
      
      const fetchPromises = units.map(async (u) => {
        try {
          const { data, error } = await supabase
            .from("payroll_reports" as any)
            .select("id, period_start, period_end, report_data, status")
            .eq("unit_id", u.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (error) {
             // Fallback if status column doesn't exist yet
             const { data: fallbackData } = await supabase
               .from("payroll_reports" as any)
               .select("id, period_start, period_end, report_data")
               .eq("unit_id", u.id)
               .order("created_at", { ascending: false })
               .limit(1)
               .maybeSingle();
             if (fallbackData) reportsMap[u.id] = fallbackData;
          } else if (data) {
             reportsMap[u.id] = data;
          }
        } catch (err) {
          console.error(`Error fetching report for unit ${u.id}:`, err);
        }
      });

      await Promise.all(fetchPromises);
      setUnitReports(reportsMap);
      setLoadingReports(false);
    };

    fetchLatestReports();
  }, [units]);

  const unitStats = useMemo(() => {
    if (!financialData) return [];
    return units.map(u => {
      const uRides = financialData.rides?.filter((r: any) => r.unit_id === u.id) || [];
      const latestReport = unitReports[u.id];
      
      let reportTotal = 0;
      let totalTbrsInReport = 0;
      let mediaPacote = 0;

      if (latestReport?.report_data) {
        const drivers = latestReport.report_data as any[];
        reportTotal = drivers.reduce((sum, d) => sum + (d.totalValue || 0), 0);
        totalTbrsInReport = drivers.reduce((sum, d) => sum + (d.totalTbrs || 0), 0);
        mediaPacote = totalTbrsInReport > 0 ? (reportTotal / totalTbrsInReport) : 0;
      }

      return {
        ...u,
        rideCount: uRides.length,
        latestReport,
        reportTotal,
        mediaPacote,
      };
    });
  }, [units, financialData, unitReports]);

  const handleDrillDown = (unitId: string, unitName: string) => {
    setActiveUnit(unitId, unitName);
    navigate("/dashboard/financeiro");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold italic flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" /> Financeiro Consolidado
        </h1>
        <div className="flex items-center gap-2 bg-card p-1 rounded-lg border shadow-sm">
          <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-7 w-32 border-0 bg-transparent text-xs font-semibold focus-visible:ring-0" />
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Até</span>
          <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-7 w-32 border-0 bg-transparent text-xs font-semibold focus-visible:ring-0" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 italic font-semibold border-amber-500/30 text-amber-700 bg-amber-500/10 hover:bg-amber-500/20">
            <Receipt className="h-4 w-4" /> Contas a Pagar
          </Button>
          <Button variant="outline" size="sm" className="gap-2 italic font-semibold border-emerald-500/30 text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20">
            <Wallet className="h-4 w-4" /> Contas a Receber
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)
        ) : (
          unitStats.map(u => (
            <Card key={u.id} className="group relative overflow-hidden hover:shadow-xl transition-all duration-300 border-t-4 border-t-primary">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDrillDown(u.id, u.name)}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                <CardTitle className="text-lg font-bold italic mt-2">{u.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {u.latestReport ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-primary/5 p-2 rounded-md">
                       <p className="text-[10px] text-muted-foreground font-bold uppercase">Período</p>
                       <p className="text-xs font-black">
                         {format(new Date(u.latestReport.period_start + "T12:00:00"), "dd/MM")} — {format(new Date(u.latestReport.period_end + "T12:00:00"), "dd/MM")}
                       </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Valor Total
                        </p>
                        <p className="text-sm font-black text-primary">{formatBRL(u.reportTotal)}</p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1 justify-end">
                          <TrendingUp className="h-3 w-3" /> Média Pacote
                        </p>
                        <p className="text-sm font-black text-amber-600">{formatBRL(u.mediaPacote)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {(!u.latestReport.status || u.latestReport.status === "pending") ? (
                        <Badge className="bg-amber-500 text-white border-0 text-[10px] font-bold uppercase animate-pulse">Relatório para Aprovação</Badge>
                      ) : u.latestReport.status === "approved" ? (
                        <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-bold uppercase">Relatório Aprovado</Badge>
                      ) : u.latestReport.status === "published" ? (
                        <Badge className="bg-blue-600 text-white border-0 text-[10px] font-bold uppercase">Relatório Publicado</Badge>
                      ) : (
                        <Badge variant="destructive" className="border-0 text-[10px] font-bold uppercase">Relatório Recusado</Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-2 border-t border-dashed mt-2">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase text-center">Último Relatório Final</p>
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <p className="text-sm font-black text-muted-foreground italic">Nenhum relatório gerado</p>
                      <Badge variant="outline" className="text-[9px] uppercase border-muted text-muted-foreground">Aguardando Fechamento</Badge>
                    </div>
                  </div>
                )}
                <Button 
                  className="w-full mt-4 bg-primary/5 text-primary hover:bg-primary hover:text-white border-0 font-bold italic h-9"
                  onClick={() => handleDrillDown(u.id, u.name)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Detalhes da Unidade
                </Button>
              </CardContent>
              {/* Background accent */}
              <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
            </Card>
          ))
        )}

      </div>

    </div>
  );
};

export default DirectorFinancePage;
