import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";

export type FormatOptionType = "pdf" | "excel" | "pdf_resumo" | "pdf_completo";

interface FormatOption {
  id: FormatOptionType;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}

interface FormatChoiceModalProps {
  open: boolean;
  onClose: () => void;
  onChoose: (format: FormatOptionType) => void;
  title?: string;
  loading?: boolean;
  options?: FormatOptionType[];
}

const FormatChoiceModal = ({
  open,
  onClose,
  onChoose,
  title = "Escolha o formato",
  loading = false,
  options = ["pdf", "excel"],
}: FormatChoiceModalProps) => {
  const availableOptions: Record<FormatOptionType, FormatOption> = {
    pdf: { id: "pdf", label: "PDF", icon: <FileText className="h-6 w-6 text-destructive" />, colorClass: "text-destructive" },
    pdf_resumo: { id: "pdf_resumo", label: "PDF Resumido", icon: <FileText className="h-6 w-6 text-orange-500" />, colorClass: "text-orange-500" },
    pdf_completo: { id: "pdf_completo", label: "PDF Completo", icon: <FileText className="h-6 w-6 text-destructive" />, colorClass: "text-destructive" },
    excel: { id: "excel", label: "Excel", icon: <FileSpreadsheet className="h-6 w-6 text-green-600" />, colorClass: "text-green-600" }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            Em qual formato deseja baixar o relatório?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-3 mt-2">
          {options.map((optId) => {
            const opt = availableOptions[optId];
            if (!opt) return null;
            return (
              <Button
                key={opt.id}
                variant="outline"
                className="flex-1 min-w-[100px] h-24 flex-col gap-2 relative"
                onClick={() => onChoose(opt.id)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  opt.icon
                )}
                <span className="font-semibold text-xs text-center leading-tight sm:text-sm">{opt.label}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FormatChoiceModal;
