import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const DriverInvoicePendingModal = () => {
    const { unitSession } = useAuthStore();
    const driverId = unitSession?.user_profile_id;
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (driverId && unitSession?.id && location.pathname !== "/motorista/recebiveis") {
            checkPendingInvoices();
        }
    }, [driverId, location.pathname]);

    const checkPendingInvoices = async () => {
        try {
            // Frequency limit: Removed per user request to show on every entry
            // const lastShown = localStorage.getItem("last_invoice_modal_shown");
            // const today = new Date().toISOString().slice(0, 10);
            // if (lastShown === today) return;

            // Fetch reports for this unit
            const { data: reports, error: reportsError } = await supabase
                .from("payroll_reports" as any)
                .select("id, report_data")
                .eq("unit_id", unitSession!.id);

            if (reportsError || !reports || reports.length === 0) return;

            // Fetch already uploaded invoices for this driver
            const { data: invoiceData, error: invoiceError } = await supabase
                .from("driver_invoices" as any)
                .select("payroll_report_id")
                .eq("driver_id", driverId!);

            if (invoiceError) return;

            const uploadedReportIds = new Set((invoiceData as any[])?.map(inv => inv.payroll_report_id));

            // Check if any report containing this driver is missing an invoice
            let pendingCount = 0;
            const hasPending = (reports as any[]).some(r => {
                const drivers = (r.report_data as any[]) || [];
                const isMyReport = drivers.some((d: any) => d.driver?.id === driverId);
                const isPending = isMyReport && !uploadedReportIds.has(r.id);
                if (isPending) pendingCount++;
                return isPending;
            });

            if (hasPending) {
                setIsOpen(true);
                // localStorage.setItem("last_invoice_modal_shown", today);
            }
        } catch (err) {
            console.error("Error checking pending invoices:", err);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md border-destructive/20 shadow-2xl">
                <DialogHeader className="flex flex-col items-center justify-center text-center space-y-3 pt-4">
                    <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                        <AlertCircle className="h-10 w-10 text-destructive animate-pulse" />
                    </div>
                    <DialogTitle className="text-2xl font-black italic text-destructive uppercase tracking-tighter">
                        NF Urgente!
                    </DialogTitle>
                    <DialogDescription className="text-base font-semibold text-foreground px-4">
                        Atenção! Identificamos que você possui fechamentos pendentes sem Nota Fiscal anexada.
                    </DialogDescription>
                    <div className="text-sm text-muted-foreground px-6 space-y-2 leading-relaxed">
                        <p>
                            O envio da NF é <span className="font-bold text-destructive">OBRIGATÓRIO</span> e <span className="font-bold text-destructive">URGENTE</span> para que seu pagamento não seja retido pela unidade.
                        </p>
                        <div className="bg-destructive/5 p-3 rounded-lg border border-destructive/20 mt-2">
                            <p className="font-black text-destructive uppercase text-xs">
                                ⚠️ Aviso Importante:
                            </p>
                            <p className="text-[11px] font-bold text-destructive/80">
                                Caso você acumule 2 ou mais NFs pendentes para anexar, você será AUTOMATICAMENTE BLOQUEADO de realizar novos carregamentos.
                            </p>
                        </div>
                    </div>
                </DialogHeader>
                <DialogFooter className="sm:justify-center mt-6 pb-4">
                    <Button 
                        type="button" 
                        variant="destructive" 
                        className="w-full h-12 text-md font-bold italic uppercase tracking-widest gap-3 shadow-[0_4px_20px_rgba(220,38,38,0.3)] hover:shadow-[0_4px_25px_rgba(220,38,38,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                        onClick={() => {
                            setIsOpen(false);
                            navigate("/motorista/recebiveis");
                        }}
                    >
                        <FileText className="h-5 w-5" />
                        Ir para Recebíveis Agora
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default DriverInvoicePendingModal;
