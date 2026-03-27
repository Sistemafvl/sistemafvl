import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const DriverContractPage = () => {
  const { unitSession } = useAuthStore();
  const driverId = unitSession?.id; // Assuming unitSession.id is the driver profile ID when type is 'driver'

  const [contract, setContract] = useState<any>(null);
  const [acceptance, setAcceptance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (driverId) {
      fetchData();
    }
  }, [driverId]);

  const fetchData = async () => {
    // Get latest contract
    const { data: latestContract } = await supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestContract) {
      setContract(latestContract);
      
      // Check if driver already accepted this version
      const { data: existingAcceptance } = await supabase
        .from("driver_contracts")
        .select("*")
        .eq("driver_id", driverId)
        .eq("contract_id", latestContract.id)
        .maybeSingle();
      
      setAcceptance(existingAcceptance);
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    setSubmitting(true);
    const { error } = await supabase.from("driver_contracts").insert([
      {
        driver_id: driverId,
        contract_id: contract.id,
        accepted_at: new Date().toISOString()
      }
    ]);

    if (error) {
      toast({ title: "Erro ao aceitar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contrato Aceito!", description: "Obrigado por sua parceria com a Favela Llog." });
      fetchData();
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-card"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  if (!contract) return (
    <div className="p-8 text-center space-y-4">
      <ShieldAlert className="h-12 w-12 text-muted-foreground mx-auto" />
      <h2 className="text-xl font-bold italic">Nenhum contrato disponível</h2>
      <p className="text-muted-foreground">A diretoria ainda não publicou os termos de parceria.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3 px-2">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-black italic uppercase tracking-tight">Termos de Parceria</h1>
          <p className="text-[10px] text-muted-foreground font-bold uppercase">Versão publicada em {format(new Date(contract.created_at), "dd/MM/yyyy")}</p>
        </div>
      </div>

      <Card className="border-2 border-primary/10 shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-muted/30 border-b p-6">
          <CardTitle className="text-lg font-bold italic text-slate-800">{contract.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="whitespace-pre-wrap font-sans leading-relaxed text-slate-700 text-sm sm:text-base">
            {contract.content}
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border flex justify-center z-50">
        <div className="w-full max-w-4xl flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            {acceptance ? (
              <div className="text-green-600 flex items-center gap-2 font-bold italic text-sm">
                <CheckCircle2 className="h-5 w-5" /> Aceito em {format(new Date(acceptance.accepted_at), "dd/MM/yyyy HH:mm")}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic max-w-xs">
                Ao clicar em aceitar, você concorda com todos os termos e condições descritos acima.
              </p>
            )}
          </div>
          
          <Button 
            size="lg" 
            className={`w-full sm:w-auto min-w-[200px] font-black italic uppercase italic h-12 shadow-lg ${acceptance ? 'bg-green-600 hover:bg-green-700' : ''}`}
            onClick={handleAccept}
            disabled={!!acceptance || submitting}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              acceptance ? "Contrato Já Aceito" : "Aceitar Termos e Condições"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DriverContractPage;
