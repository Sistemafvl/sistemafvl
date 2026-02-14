import { useAuthStore } from "@/stores/auth-store";
import { Clock, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const DashboardHome = () => {
  const { unitSession } = useAuthStore();
  const [dateTime, setDateTime] = useState(new Date());
  const [tbrSearch, setTbrSearch] = useState("");
  const [showTbrModal, setShowTbrModal] = useState(false);
  const [searchedTbr, setSearchedTbr] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTbrKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tbrSearch.trim()) {
      setSearchedTbr(tbrSearch.trim());
      setShowTbrModal(true);
    }
  };

  if (!unitSession) return null;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold italic text-foreground">Bem-vindo</h1>
          <p className="text-muted-foreground italic text-sm mt-1">
            {unitSession.domain_name} — {unitSession.name}
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-4 flex items-center gap-3 shrink-0">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-bold italic text-foreground">
              {dateTime.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p className="text-lg font-bold italic text-primary">
              {dateTime.toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>
      </div>

      {/* Campo de busca TBR */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={tbrSearch}
          onChange={(e) => setTbrSearch(e.target.value)}
          onKeyDown={handleTbrKeyDown}
          placeholder="Buscar TBR..."
          className="pl-10 h-12 text-base"
        />
      </div>

      {/* Modal de resultado TBR */}
      <Dialog open={showTbrModal} onOpenChange={setShowTbrModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold italic">Rastreamento TBR</DialogTitle>
            <DialogDescription>
              Código pesquisado: <span className="font-semibold text-foreground">{searchedTbr}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground italic">
              A funcionalidade de rastreamento de TBR será implementada em breve. Quando disponível, aqui serão exibidos o status, histórico e todos os dados do pacote.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardHome;
