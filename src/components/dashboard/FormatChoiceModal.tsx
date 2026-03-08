import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, FileSpreadsheet } from "lucide-react";

interface FormatChoiceModalProps {
  open: boolean;
  onClose: () => void;
  onChoose: (format: "pdf" | "excel") => void;
  title?: string;
}

const FormatChoiceModal = ({
  open,
  onClose,
  onChoose,
  title = "Escolha o formato",
}: FormatChoiceModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            Em qual formato deseja baixar o relatório?
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            className="flex-1 h-20 flex-col gap-2"
            onClick={() => onChoose("pdf")}
          >
            <FileText className="h-6 w-6 text-destructive" />
            <span className="font-semibold">PDF</span>
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-20 flex-col gap-2"
            onClick={() => onChoose("excel")}
          >
            <FileSpreadsheet className="h-6 w-6 text-green-600" />
            <span className="font-semibold">Excel</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FormatChoiceModal;
