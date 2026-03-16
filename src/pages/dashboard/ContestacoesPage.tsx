import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Scale, 
  UserCheck, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft,
  User,
  Calendar,
  Package,
  Route,
  KeyRound,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Dispute {
  id: string;
  ride_id: string;
  unit_id: string;
  driver_id: string;
  conferente_id: string | null;
  dispute_type: string;
  observation: string | null;
  status: string;
  created_at: string;
  driver_name: string;
  conferente_name: string;
  ride_data: any;
}

interface ConferenteSummary {
  id: string;
  name: string;
  pendingCount: number;
}

const ContestacoesPage = () => {
  const { unitSession } = useAuthStore();
  const [summaries, setSummaries] = useState<ConferenteSummary[]>([]);
  const [selectedConferenteId, setSelectedConferenteId] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"summary" | "list">("summary");

  useEffect(() => {
    if (!unitSession?.id) return;
    fetchSummaries();
  }, [unitSession?.id]);

  const fetchSummaries = async () => {
    setLoading(true);
    try {
      // Fetch all disputes for the unit
      const { data: allDisputes, error } = await supabase
        .from("ride_disputes" as any)
        .select(`
          id, 
          status,
          conferente_id,
          conferente:conferente_id(id, name)
        `)
        .eq("unit_id", unitSession!.id);

      if (error) throw error;

      // Group by conferente
      const summaryMap = new Map<string, ConferenteSummary>();
      
      // Also fetch all unit conferentes to show empty ones if needed
      const { data: allConferentes } = await supabase
        .from("user_profiles")
        .select("id, name")
        .eq("unit_id", unitSession!.id)
        .eq("active", true);

      (allConferentes || []).forEach(c => {
        summaryMap.set(c.id, { id: c.id, name: c.name, pendingCount: 0 });
      });

      (allDisputes || []).forEach((d: any) => {
        if (d.conferente_id && d.status === "pending") {
          const s = summaryMap.get(d.conferente_id);
          if (s) {
            s.pendingCount += 1;
          }
        }
      });

      setSummaries(Array.from(summaryMap.values()).sort((a, b) => b.pendingCount - a.pendingCount));
    } catch (err: any) {
      toast({ title: "Erro ao carregar sumário", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDisputesForConferente = async (conferenteId: string) => {
    setLoading(true);
    try {
      // 1. Fetch disputes
      const { data, error } = await supabase
        .from("ride_disputes" as any)
        .select("*")
        .eq("unit_id", unitSession!.id)
        .eq("conferente_id", conferenteId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const disputeList = data || [];

      // 2. Fetch driver names
      const driverIds = [...new Set(disputeList.map((d: any) => d.driver_id).filter(Boolean))];
      const rideIds = [...new Set(disputeList.map((d: any) => d.ride_id).filter(Boolean))];

      const [driversRes, ridesRes, confsRes, tbrCountsRes] = await Promise.all([
        driverIds.length > 0
          ? supabase.from("drivers_public").select("id, name").in("id", driverIds)
          : Promise.resolve({ data: [] }),
        rideIds.length > 0
          ? supabase.from("driver_rides").select("id, completed_at, login, route, password").in("id", rideIds)
          : Promise.resolve({ data: [] }),
        conferenteId
          ? supabase.from("user_profiles").select("id, name").eq("id", conferenteId).maybeSingle()
          : Promise.resolve({ data: null }),
        rideIds.length > 0
          ? supabase.from("ride_tbrs").select("ride_id").in("ride_id", rideIds)
          : Promise.resolve({ data: [] }),
      ]);

      const driverMap = new Map((driversRes.data ?? []).map((d: any) => [d.id, d.name]));
      const rideMap = new Map((ridesRes.data ?? []).map((r: any) => [r.id, r]));

      // Count TBRs per ride
      const tbrCountMap = new Map<string, number>();
      (tbrCountsRes.data ?? []).forEach((t: any) => {
        tbrCountMap.set(t.ride_id, (tbrCountMap.get(t.ride_id) ?? 0) + 1);
      });

      const formatted = disputeList.map((d: any) => ({
        ...d,
        driver_name: driverMap.get(d.driver_id) || "Desconhecido",
        conferente_name: (confsRes as any).data?.name || "Sem conferente",
        ride_data: rideMap.has(d.ride_id)
          ? { ...rideMap.get(d.ride_id), tbrCount: tbrCountMap.get(d.ride_id) ?? 0 }
          : null,
      }));

      setDisputes(formatted);
      setSelectedConferenteId(conferenteId);
      setView("list");
    } catch (err: any) {
      toast({ title: "Erro ao carregar contestações", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const markAsResolved = async (disputeId: string) => {
    try {
      const { error } = await supabase
        .from("ride_disputes" as any)
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", disputeId);

      if (error) throw error;

      toast({ title: "Sucesso", description: "Contestação marcada como resolvida!" });
      
      // Update local state
      setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status: "resolved" } : d));
      
      // Update summary counts locally
      if (selectedConferenteId) {
        setSummaries(prev => prev.map(s => s.id === selectedConferenteId ? { ...s, pendingCount: Math.max(0, s.pendingCount - 1) } : s));
      }
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    }
  };

  const getDisputeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      package_count: "Quantidade de pacotes",
      login_error: "Erro de login",
      value_error: "Erro de valor",
      other: "Outro erro"
    };
    return labels[type] || type;
  };

  const conferenteName = summaries.find(s => s.id === selectedConferenteId)?.name || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view === "list" && (
            <Button variant="ghost" size="icon" onClick={() => setView("summary")} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <h1 className="text-2xl font-bold italic flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Contestações
          </h1>
        </div>
        {view === "summary" && (
           <Button variant="outline" size="sm" onClick={fetchSummaries} disabled={loading} className="gap-2">
             <Clock className={loading ? "animate-spin h-3.5 w-3.5" : "h-3.5 w-3.5"} />
             Atualizar
           </Button>
        )}
      </div>

      {loading && view === "summary" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card/50 animate-pulse" />
          ))}
        </div>
      ) : view === "summary" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaries.map((s) => (
            <Card 
              key={s.id} 
              className="hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
              onClick={() => fetchDisputesForConferente(s.id)}
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-lg italic">{s.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {s.pendingCount > 0 ? (
                        <span className="text-destructive font-bold flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {s.pendingCount} pendentes
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Tudo em dia
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
          {summaries.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Scale className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground italic">Nenhum conferente com contestações encontrado.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 px-1">
            <UserCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold italic">Relação de Contestações: <span className="text-primary">{conferenteName}</span></h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {disputes.map((d) => (
              <Card key={d.id} className={cn(
                "overflow-hidden border-l-4",
                d.status === "resolved" ? "border-l-emerald-500" : "border-l-amber-500"
              )}>
                <CardHeader className="pb-2 border-b border-border/50 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-background border border-border flex items-center justify-center font-bold text-sm">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold italic">{d.driver_name}</CardTitle>
                        <p className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 uppercase tracking-wider">
                          <Calendar className="h-3 w-3" />
                          Relatado em {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    {d.status === "pending" ? (
                      <Button size="sm" onClick={() => markAsResolved(d.id)} className="h-8 gap-1 font-bold text-xs bg-emerald-600 hover:bg-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        FEITO
                      </Button>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold uppercase tracking-widest text-[10px]">
                        Resolvido
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          Natureza da Contestação
                        </p>
                        <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20 inline-flex items-center gap-2">
                           <AlertCircle className="h-4 w-4 text-destructive" />
                           <span className="text-sm font-bold text-destructive">{getDisputeTypeLabel(d.dispute_type)}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          Observação do Motorista
                        </p>
                        <div className="p-3 rounded-lg bg-muted/30 border border-border italic text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {d.observation || "Sem observações adicionais."}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          Dados da Corrida (Histórico)
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs">
                          <div><span className="text-muted-foreground">Original:</span> <strong>{d.ride_data?.completed_at ? (() => { try { return format(new Date(d.ride_data.completed_at), "dd/MM/yyyy HH:mm"); } catch { return "—"; } })() : "—"}</strong></div>
                          <div><span className="text-muted-foreground">Login:</span> <strong>{d.ride_data?.login || "—"}</strong></div>
                          <div><span className="text-muted-foreground">Rota:</span> <strong>{d.ride_data?.route || "—"}</strong></div>
                          <div><span className="text-muted-foreground">TBRs:</span> <strong>{d.ride_data?.tbrCount ?? 0}</strong></div>
                          {d.ride_data?.password && <div><span className="text-muted-foreground">Senha:</span> <strong>{d.ride_data.password}</strong></div>}
                        </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {disputes.length === 0 && (
              <div className="py-20 text-center space-y-3 italic text-muted-foreground">
                <p>Nenhuma contestação encontrada para este conferente.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContestacoesPage;
