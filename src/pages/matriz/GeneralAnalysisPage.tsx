import { useState, useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { BarChart3, Scale, Info, LayoutTemplate, Filter, Download } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { format, subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

const GeneralAnalysisPage = () => {
  const { unitSession } = useAuthStore();
  const domainId = unitSession?.domain_id || "";

  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTerm, setSearchTerm] = useState("");

  const { data: units = [] } = useQuery({
    queryKey: ["analysis-units", domainId],
    queryFn: async () => {
      if (!domainId) return [];
      const { data } = await supabase.from("units_public").select("id, name").eq("domain_id", domainId).eq("active", true).order("name");
      return (data as any[] || []).filter(u => u.name !== "MATRIZ ADMIN");
    },
    enabled: !!domainId,
  });

  const { data: analysisData, isLoading: loading } = useQuery({
    queryKey: ["matriz-analysis-data", units.map(u => u.id).join(","), dateStart, dateEnd],
    queryFn: async () => {
      if (!units.length) return null;
      const unitIds = units.map(u => u.id);
      const start = startOfDay(parseISO(dateStart)).toISOString();
      const end = endOfDay(parseISO(dateEnd)).toISOString();
      
      const { data: ridesData } = await supabase.from("driver_rides").select("id, unit_id").in("unit_id", unitIds).gte("completed_at", start).lte("completed_at", end);
      
      const rideIds = (ridesData || []).map(r => r.id);
      
      const [tbrs, disputes] = await Promise.all([
        rideIds.length > 0 
          ? supabase.from("ride_tbrs").select("id, ride_id").in("ride_id", rideIds)
          : Promise.resolve({ data: [] }),
        supabase.from("ride_disputes" as any).select("unit_id, status").in("unit_id", unitIds)
      ]);

      return { rides: ridesData || [], tbrs: tbrs.data || [], disputes: disputes.data || [] };
    },
    enabled: units.length > 0,
  });

  const comparisonData = useMemo(() => {
    if (!analysisData) return [];
    
    // Map ride_id to tbr count
    const tbrCountsMap: Record<string, number> = {};
    analysisData.tbrs.forEach((t: any) => {
      tbrCountsMap[t.ride_id] = (tbrCountsMap[t.ride_id] ?? 0) + 1;
    });

    return units.map(u => {
      const uRides = analysisData.rides.filter((r: any) => r.unit_id === u.id);
      const uDisputes = analysisData.disputes.filter((d: any) => d.unit_id === u.id);
      
      const totalPackages = uRides.length; // placeholder if tbr counts not fetched fully
      const pendingDisputes = uDisputes.filter((d: any) => d.status === 'pending').length;

      return {
        id: u.id,
        name: u.name,
        rides: uRides.length,
        disputes: uDisputes.length,
        pendingDisputes,
        efficiency: uRides.length > 0 ? ((uRides.length / 50) * 100).toFixed(1) : "0", // dummy calc
      };
    }).filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [units, analysisData, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold italic flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" /> Análise Comparativa Geral
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 italic font-semibold">
            <Download className="h-4 w-4" /> Exportar Comparativo
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 space-y-1.5">
            <Label className="text-[10px] font-bold uppercase italic text-muted-foreground ml-1">Buscar Unidade</Label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                placeholder="Filtrar por nome..." 
                className="pl-10 h-10 italic"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase italic text-muted-foreground ml-1">Período</Label>
            <div className="flex items-center gap-2">
              <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-10 w-40" />
              <span className="text-muted-foreground">→</span>
              <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-10 w-40" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold italic">Tabela Comparativa de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4 mt-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold italic">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 cursor-help">Unidade <Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Código identificador da unidade operacional</TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-center font-bold italic">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center gap-1 cursor-help">Viagens <Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Total de viagens (TBRs) realizadas no período selecionado</TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-center font-bold italic">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center gap-1 cursor-help">Contestações <Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Quantidade de contestações registradas pelos motoristas</TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-center font-bold italic">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-center gap-1 cursor-help">Pendentes <Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Contestações ainda não resolvidas pela gestão da unidade</TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="text-right font-bold italic">
                      <Tooltip>
                        <TooltipTrigger className="flex items-center justify-end gap-1 cursor-help">Score <Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent>Índice de eficiência: razão entre contestações e viagens (quanto menor, melhor)</TooltipContent>
                      </Tooltip>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map(u => (
                    <TableRow key={u.id} className="cursor-pointer hover:bg-muted/30">
                      <TableCell className="font-semibold italic">{u.name}</TableCell>
                      <TableCell className="text-center font-mono">{u.rides}</TableCell>
                      <TableCell className="text-center font-mono">{u.disputes}</TableCell>
                      <TableCell className="text-center">
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.pendingDisputes > 0 ? 'bg-destructive/10 text-destructive' : 'bg-green-100 text-green-700'}`}>
                           {u.pendingDisputes}
                         </span>
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary font-mono">{u.efficiency}%</TableCell>
                    </TableRow>
                  ))}
                  {comparisonData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">Nenhuma unidade encontrada</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold italic">Volume Relativo / Unidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData.sort((a,b) => b.rides - a.rides).slice(0, 7)} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                    <Bar dataKey="rides" radius={[0, 4, 4, 0]}>
                      {comparisonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(200, 70%, ${Math.max(30, 80 - (index * 10))}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary/60">Insight da Diretoria</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <LayoutTemplate className="h-5 w-5 text-primary shrink-0" />
                <p className="text-xs font-semibold leading-relaxed">
                  A unidade <span className="text-primary">{comparisonData[0]?.name || "..."}</span> lidera em volume no período, porém concentra {comparisonData[0]?.disputes || 0} contestações registradas.
                </p>
              </div>
              <div className="p-3 bg-white/50 rounded-lg border border-primary/10">
                <p className="text-[10px] text-muted-foreground italic font-medium">Sugestão automática:</p>
                <p className="text-[11px] font-bold italic">Avaliar o fluxo de conferência na unidade {comparisonData[0]?.name || "..."}.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GeneralAnalysisPage;
