import { WifiOff, RefreshCw, CloudOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { cn } from "@/lib/utils";

const OfflineIndicator = () => {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
        !isOnline
          ? "bg-orange-500 text-white"
          : "bg-blue-500 text-white"
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Modo Offline — dados serão sincronizados ao reconectar</span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : (
        <>
          <CloudOff className="h-4 w-4" />
          <span>Operações pendentes</span>
        </>
      )}
      {pendingCount > 0 && (
        <Badge className="bg-white/20 text-white hover:bg-white/30 ml-1">
          {pendingCount}
        </Badge>
      )}
    </div>
  );
};

export default OfflineIndicator;
