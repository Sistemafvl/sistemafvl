import { useState, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  const unitStats = useMemo(() => {
    if (!financialData) return [];
    return units.map(u => {
      const uRides = financialData.rides?.filter((r: any) => r.unit_id === u.id) || [];
      return {
        ...u,
        rideCount: uRides.length,
      };
    });
  }, [units, financialData]);

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
              <CardContent>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Viagens (Período)
                    </p>
                    <p className="text-xl font-black">{u.rideCount}</p>
                  </div>
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

        <Card className="border-dashed border-2 flex flex-col items-center justify-center p-8 text-center bg-muted/20 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <DollarSign className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-bold italic text-muted-foreground">Adicionar Unidade/Fluxo</h3>
          <p className="text-xs text-muted-foreground mt-1">Implementações em breve</p>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Card className="flex-1 min-w-[300px] border-l-4 border-l-emerald-500">
           <CardHeader className="p-4">
             <CardTitle className="text-sm font-bold italic">Balanço Consolidado (Total Unidades)</CardTitle>
           </CardHeader>
           <CardContent className="p-4 pt-0">
             <p className="text-2xl font-black text-emerald-600 font-mono">
               {formatBRL(unitStats.reduce((sum, u) => {
                 const tbrVal = financialData?.settings?.find((s: any) => s.unit_id === u.id)?.tbr_value || 0;
                 return sum + (u.rideCount * Number(tbrVal));
               }, 0))}
             </p>
             <p className="text-[10px] text-muted-foreground font-semibold mt-1 italic">Soma das previsões baseadas em TBR de cada unidade</p>
           </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DirectorFinancePage;
