import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Loader2, Package, AlertCircle, X } from "lucide-react";
import { format, subDays, addDays, startOfDay, getDate, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingDate {
  date: string;
  formattedText: string;
  value: string;
  isFilled: boolean;
}

const AmazonPackagesModal = () => {
  const { unitSession } = useAuthStore();
  const unitId = unitSession?.id;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dates, setDates] = useState<PendingDate[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!unitId || unitSession?.sessionType === "matriz") return;

    const checkPendingDates = async () => {
      setLoading(true);
      
      const today = startOfDay(new Date());
      const currentDay = getDate(today);
      const currentMonth = getMonth(today);
      const currentYear = getYear(today);

      let qStart: Date;
      let qEnd: Date;

      if (currentDay === 1) {
        // Dia 1: Mostra a quinzena anterior inteira (16 ao fim do mês anterior)
        const prevMonthDate = subDays(today, 1);
        qStart = new Date(getYear(prevMonthDate), getMonth(prevMonthDate), 16);
        qEnd = prevMonthDate;
      } else if (currentDay === 16) {
        // Dia 16: Mostra a quinzena anterior inteira (1 ao 15 do mês atual)
        qStart = new Date(currentYear, currentMonth, 1);
        qEnd = new Date(currentYear, currentMonth, 15);
      } else if (currentDay > 1 && currentDay < 16) {
        // Quinzena atual 1 a 15 (até ontem)
        qStart = new Date(currentYear, currentMonth, 1);
        qEnd = subDays(today, 1);
      } else {
        // Quinzena atual 16 ao fim do mês (até ontem)
        qStart = new Date(currentYear, currentMonth, 16);
        qEnd = subDays(today, 1);
      }

      const dateList: PendingDate[] = [];
      let iterDate = qStart;
      while (iterDate <= qEnd) {
        dateList.push({
          date: format(iterDate, "yyyy-MM-dd"),
          formattedText: format(iterDate, "dd/MM (EEEE)", { locale: ptBR }),
          value: "",
          isFilled: false
        });
        iterDate = addDays(iterDate, 1);
      }

      // Ordena de forma decrescente para mostrar os mais recentes primeiro
      dateList.sort((a, b) => b.date.localeCompare(a.date));

      if (dateList.length === 0) {
        setLoading(false);
        return;
      }

      const minDate = dateList[dateList.length - 1].date;
      const maxDate = dateList[0].date;

      try {
        const { data, error } = await supabase
          .from("amazon_daily_packages" as any)
          .select("reference_date, package_count")
          .eq("unit_id", unitId)
          .gte("reference_date", minDate)
          .lte("reference_date", maxDate);

        if (!error && data) {
          const dict = new Map<string, number>();
          data.forEach((r: any) => dict.set(r.reference_date, r.package_count));

          dateList.forEach(item => {
            if (dict.has(item.date)) {
              item.value = dict.get(item.date)!.toString();
              item.isFilled = true;
            }
          });
        }

        setDates(dateList);
        
        // Auto-open if there are any un-filled dates and not explicitly dismissed
        const hasPending = dateList.some(d => !d.isFilled);
        if (hasPending && !dismissed) {
          setOpen(true);
        }
      } catch (err) {
        console.error("Error fetching amazon packages:", err);
      } finally {
        setLoading(false);
      }
    };

    checkPendingDates();
  }, [unitId, dismissed]);

  const handleSave = async () => {
    if (!unitId) return;

    const toSave = dates.filter(d => !d.isFilled && d.value.trim() !== "");
    if (toSave.length === 0) {
      setOpen(false);
      setDismissed(true);
      return;
    }

    setSaving(true);
    try {
      const inserts = toSave.map(item => ({
        unit_id: unitId,
        reference_date: item.date,
        package_count: parseInt(item.value, 10)
      }));

      const { error } = await (supabase.from("amazon_daily_packages" as any) as any).upsert(inserts, {
        onConflict: "unit_id,reference_date"
      });

      if (error) throw error;

      toast({ title: "Sucesso!", description: "Dados de pacotes atualizados." });
      setOpen(false);
      setDismissed(true);

      // update local state
      setDates(prev => prev.map(d => {
        const savedItem = toSave.find(s => s.date === d.date);
        if (savedItem) return { ...d, isFilled: true };
        return d;
      }));
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro", description: err.message || "Não foi possível salvar os dados.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (date: string, val: string) => {
    // Only allow numbers
    const clean = val.replace(/\D/g, "");
    setDates(prev => prev.map(d => d.date === date ? { ...d, value: clean } : d));
  };

  const hasPending = dates.some(d => !d.isFilled);
  const pendingCount = dates.filter(d => !d.isFilled).length;

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => {
        if (!val) setDismissed(true);
        setOpen(val);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-orange-600">
              <Package className="h-5 w-5" />
              Pacotes Enviados pela Amazon
            </DialogTitle>
            <DialogDescription>
              A Amazon enviou o relatório de pacotes enviados para nossa unidade? 
              Por favor, preencha as quantidades dos dias anteriores para nosso balanço.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 py-2">
              {dates.map((item) => (
                <div key={item.date} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm capitalize">{item.formattedText}</span>
                    {item.isFilled ? (
                      <span className="text-xs text-green-600 font-medium">Preenchido</span>
                    ) : (
                      <span className="text-xs text-orange-500 font-medium">Pendente</span>
                    )}
                  </div>
                  <div>
                    <Input 
                      placeholder="Qtd." 
                      value={item.value} 
                      onChange={(e) => handleValueChange(item.date, e.target.value)}
                      disabled={item.isFilled}
                      className="w-24 text-center font-bold"
                      type="text"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setDismissed(true); }} disabled={saving}>
              Preencher depois
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
              Salvar Dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Balloon if closed but has pending */}
      {hasPending && !open && unitSession?.sessionType !== "matriz" && (
        <div className="fixed bottom-[180px] right-6 z-50 flex items-center gap-1">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-white shadow-lg hover:bg-orange-600 transition-all text-sm font-bold animate-pulse"
          >
            <AlertCircle className="h-4 w-4" />
            {pendingCount} Dia{pendingCount > 1 ? "s" : ""} Pendente{pendingCount > 1 ? "s" : ""} (Amazon)
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDates(dates.map(d => ({...d, isFilled: true}))); }}
            className="rounded-full bg-muted p-1 shadow hover:bg-muted-foreground/20 transition-colors"
            title="Ignorar avisos temporariamente"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}
    </>
  );
};

export default AmazonPackagesModal;
