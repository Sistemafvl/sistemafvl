import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { useDisputeStore } from "@/stores/use-dispute-store";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  X,
  Calendar,
  ShieldAlert
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface PendingDispute {
  id: string;
  created_at: string;
}

const DisputeNotificationModal = () => {
  const navigate = useNavigate();
  const { unitSession, conferenteSession } = useAuthStore();
  const { showDisputeModal, setShowDisputeModal, needsCheck, setNeedsCheck } = useDisputeStore();
  
  const [pendingDisputes, setPendingDisputes] = useState<PendingDispute[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (needsCheck && unitSession?.id) {
      fetchPendingDisputes();
    }
  }, [needsCheck, unitSession?.id, conferenteSession?.id]);

  const fetchPendingDisputes = async () => {
    setLoading(true);
    try {
      const conferenteId = conferenteSession?.id;
      
      let query = supabase
        .from("ride_disputes" as any)
        .select("id, created_at")
        .eq("unit_id", unitSession!.id)
        .eq("status", "pending");

      if (conferenteId) {
        query = query.eq("conferente_id", conferenteId);
      } else if (unitSession?.sessionType === "user") {
          // If it's a manager (sessionType 'user'), maybe show all pending for the unit?
          // The request said "conferente", but managers also work.
          // For now, if no specific conferente is selected, we check all for the unit.
      } else {
          // Director or something else, maybe no check.
          setNeedsCheck(false);
          setLoading(false);
          return;
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        setPendingDisputes(data as any);
        setShowDisputeModal(true);
      } else {
        setPendingDisputes([]);
      }
      
      setNeedsCheck(false);
    } catch (err) {
      console.error("Error fetching pending disputes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDisputes = () => {
    setShowDisputeModal(false);
    navigate("/dashboard/contestacoes");
  };

  if (pendingDisputes.length === 0) return null;

  return (
    <Dialog open={showDisputeModal} onOpenChange={setShowDisputeModal}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none bg-transparent shadow-none">
        <div className="relative bg-card border border-border rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-destructive/20 via-primary/10 to-transparent p-6 pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive animate-pulse">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black italic tracking-tight text-foreground uppercase">
                  Atenção Urgente
                </h2>
                <p className="text-sm font-bold text-destructive italic">
                  Você possui {pendingDisputes.length} contestação{pendingDisputes.length > 1 ? "es" : ""} pendente{pendingDisputes.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 pt-2 space-y-4">
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-muted/50 border border-border/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Clock className="h-12 w-12" />
                </div>
                <p className="text-sm font-semibold leading-relaxed">
                  Identificamos que existem pendências que precisam da sua atenção imediata.
                </p>
                <p className="text-sm font-bold text-primary mt-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Resolver obrigatoriamente antes do fechamento da quinzena!
                </p>
              </div>

              <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  <Calendar className="h-3.5 w-3.5 text-destructive" />
                  Regra de Resolução
                </div>
                <p className="text-sm">
                  As contestações devem ser resolvidas em até <span className="font-bold text-destructive">5 dias</span> após a abertura pelo motorista.
                </p>
              </div>
            </div>

            {/* Day counters list */}
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
              {pendingDisputes.map((d, i) => {
                const days = differenceInDays(new Date(), parseISO(d.created_at));
                const isUrgent = days >= 3;
                return (
                  <div key={d.id} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border text-sm transition-all",
                    isUrgent ? "bg-red-50 border-red-200 text-red-700 font-bold" : "bg-muted/30 border-border"
                  )}>
                    <span className="flex items-center gap-2 italic">
                      Contestação #{i + 1}
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 border border-current/20">
                      <Clock className="h-3.5 w-3.5" />
                      {days === 0 ? "Hoje" : days === 1 ? "1 dia pendente" : `${days} dias pendentes`}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button 
                onClick={handleGoToDisputes}
                className="flex-1 h-12 rounded-xl font-bold italic gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                IR PARA CONTESTAÇÕES
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline"
                onClick={() => setShowDisputeModal(false)}
                className="flex-1 h-12 rounded-xl font-bold italic border-border hover:bg-muted transition-all"
              >
                FECHAR AGORA
              </Button>
            </div>
          </div>

          {/* Close button top right */}
          <button 
            onClick={() => setShowDisputeModal(false)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DisputeNotificationModal;
