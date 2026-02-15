import { useAuthStore } from "@/stores/auth-store";
import { Clock, Search, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const MAX_TBR_LENGTH = 15;

interface TbrResult {
  code: string;
  scanned_at: string;
  ride_id: string;
  driver_name: string;
  route: string | null;
  login: string | null;
  unit_name: string;
  conferente_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  loading_status: string | null;
  sequence_number: number | null;
  all_scans: { code: string; scanned_at: string }[];
}

const DashboardHome = () => {
  const { unitSession } = useAuthStore();
  const [dateTime, setDateTime] = useState(new Date());
  const [tbrSearch, setTbrSearch] = useState("");
  const [showTbrModal, setShowTbrModal] = useState(false);
  const [searchedTbr, setSearchedTbr] = useState("");
  const [tbrResult, setTbrResult] = useState<TbrResult | null>(null);
  const [tbrLoading, setTbrLoading] = useState(false);
  const [tbrNotFound, setTbrNotFound] = useState(false);
  const [tbrError, setTbrError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setDateTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTbrKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tbrSearch.trim()) {
      const code = tbrSearch.trim();

      if (code.length > MAX_TBR_LENGTH) {
        setTbrError(`TBR deve ter no máximo ${MAX_TBR_LENGTH} caracteres.`);
        setShowTbrModal(true);
        setSearchedTbr(code);
        setTbrLoading(false);
        setTbrResult(null);
        setTbrNotFound(false);
        return;
      }

      setTbrError("");
      setSearchedTbr(code);
      setShowTbrModal(true);
      setTbrLoading(true);
      setTbrResult(null);
      setTbrNotFound(false);

      // Search ride_tbrs
      const { data: tbrData } = await supabase
        .from("ride_tbrs")
        .select("*")
        .ilike("code", `%${code}%`)
        .order("scanned_at", { ascending: true })
        .limit(1);

      if (!tbrData || tbrData.length === 0) {
        setTbrNotFound(true);
        setTbrLoading(false);
        return;
      }

      const tbr = tbrData[0];
      const rideId = tbr.ride_id;

      // Get all scans for this ride
      const { data: allScans } = await supabase
        .from("ride_tbrs")
        .select("code, scanned_at")
        .eq("ride_id", rideId)
        .order("scanned_at", { ascending: true });

      // Get ride details
      const { data: ride } = await supabase
        .from("driver_rides")
        .select("*")
        .eq("id", rideId)
        .maybeSingle();

      if (!ride) {
        setTbrNotFound(true);
        setTbrLoading(false);
        return;
      }

      // Get driver
      const { data: driver } = await supabase
        .from("drivers")
        .select("name")
        .eq("id", ride.driver_id)
        .maybeSingle();

      // Get unit
      const { data: unit } = await supabase
        .from("units")
        .select("name")
        .eq("id", ride.unit_id)
        .maybeSingle();

      // Get conferente
      let conferenteName: string | null = null;
      if (ride.conferente_id) {
        const { data: conf } = await supabase
          .from("user_profiles")
          .select("name")
          .eq("id", ride.conferente_id)
          .maybeSingle();
        conferenteName = conf?.name ?? null;
      }

      setTbrResult({
        code: tbr.code,
        scanned_at: tbr.scanned_at ?? "",
        ride_id: rideId,
        driver_name: driver?.name ?? "Desconhecido",
        route: ride.route,
        login: ride.login,
        unit_name: unit?.name ?? "—",
        conferente_name: conferenteName,
        started_at: ride.started_at,
        finished_at: ride.finished_at,
        loading_status: ride.loading_status,
        sequence_number: ride.sequence_number,
        all_scans: allScans ?? [],
      });
      setTbrLoading(false);
    }
  };

  const closeModal = () => {
    setShowTbrModal(false);
    setTbrSearch("");
    setTbrError("");
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
          maxLength={MAX_TBR_LENGTH}
        />
      </div>

      {/* Modal de resultado TBR — custom overlay, not Radix Dialog */}
      {showTbrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/80" onClick={closeModal} />
          <div className="relative z-50 w-full max-w-lg border bg-background p-6 shadow-lg sm:rounded-lg animate-in fade-in-0 zoom-in-95">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none z-10"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </button>
            <div className="flex flex-col space-y-1.5 text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight font-bold italic">Rastreamento TBR</h2>
              <p className="text-sm text-muted-foreground">
                Código pesquisado: <span className="font-semibold text-foreground">{searchedTbr}</span>
              </p>
            </div>
            <div className="space-y-4 py-4">
              {tbrError ? (
                <p className="text-sm text-destructive italic text-center py-4">{tbrError}</p>
              ) : tbrLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : tbrNotFound ? (
                <p className="text-sm text-muted-foreground italic text-center py-4">
                  TBR não encontrado.
                </p>
              ) : tbrResult ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><strong>Motorista:</strong> {tbrResult.driver_name}</div>
                    <div><strong>Rota:</strong> {tbrResult.route || "—"}</div>
                    <div><strong>Login:</strong> {tbrResult.login || "—"}</div>
                    <div><strong>Unidade:</strong> {tbrResult.unit_name}</div>
                    <div><strong>Conferente:</strong> {tbrResult.conferente_name || "—"}</div>
                    <div><strong>Sequência:</strong> {tbrResult.sequence_number ?? "—"}º</div>
                    <div><strong>Status:</strong> {tbrResult.loading_status || "—"}</div>
                    <div><strong>Início:</strong> {tbrResult.started_at ? format(new Date(tbrResult.started_at), "dd/MM/yyyy HH:mm") : "—"}</div>
                    <div><strong>Término:</strong> {tbrResult.finished_at ? format(new Date(tbrResult.finished_at), "dd/MM/yyyy HH:mm") : "—"}</div>
                  </div>
                  <div className="border-t pt-3">
                    <p className="font-bold italic text-xs mb-2">Movimentos ({tbrResult.all_scans.length} TBRs neste carregamento)</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {tbrResult.all_scans.map((s, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${s.code.toUpperCase() === searchedTbr.toUpperCase() ? "bg-green-100 text-green-800 font-semibold" : "bg-muted/50"}`}>
                          <span className="font-bold text-primary">{i + 1}.</span>
                          <span className="font-mono flex-1">{s.code}</span>
                          <span className="text-muted-foreground">{s.scanned_at ? format(new Date(s.scanned_at), "dd/MM HH:mm:ss") : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
