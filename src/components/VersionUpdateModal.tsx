import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Zap } from "lucide-react";

interface VersionUpdateModalProps {
  isOpen: boolean;
  onUpdate: () => void;
}

const VersionUpdateModal = ({ isOpen, onUpdate }: VersionUpdateModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[400px] border-primary/20 shadow-2xl bg-background/95 backdrop-blur-md [&>button]:hidden">
        <DialogHeader className="flex flex-col items-center justify-center text-center space-y-4 pt-4">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-2 relative">
            <div className="absolute inset-0 rounded-full bg-primary/5 animate-ping" />
            <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          </div>
          
          <div className="space-y-1">
            <DialogTitle className="text-2xl font-black italic text-primary uppercase tracking-tighter flex items-center justify-center gap-2">
              <Zap className="h-5 w-5 fill-primary" />
              NOVA ATUALIZAÇÃO!
            </DialogTitle>
            <DialogDescription className="text-base font-semibold text-foreground px-6">
              Uma nova versão do sistema FVL está disponível com melhorias e correções importantes.
            </DialogDescription>
          </div>

          <div className="w-full bg-primary/5 p-4 rounded-xl border border-primary/10">
            <p className="text-sm font-bold text-primary/80 italic">
              Clique no botão abaixo para atualizar seu aplicativo instantaneamente.
            </p>
          </div>
        </DialogHeader>

        <DialogFooter className="sm:justify-center mt-6 pb-4">
          <Button 
            className="w-full h-14 text-lg font-black italic uppercase tracking-widest gap-3 shadow-[0_4px_25px_rgba(var(--primary),0.4)] hover:shadow-[0_4px_30px_rgba(var(--primary),0.5)] transition-all group relative overflow-hidden"
            onClick={onUpdate}
          >
            <RefreshCw className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" />
            ATUALIZAR AGORA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VersionUpdateModal;
