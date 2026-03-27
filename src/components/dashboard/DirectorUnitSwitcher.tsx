import { Crown } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

const DirectorUnitSwitcher = () => {
  const { unitSession } = useAuthStore();

  if (!unitSession || unitSession.sessionType !== "matriz") return null;

  return (
    <div className="px-3 pb-2 space-y-2">
      {/* Director Card - No dropdown as requested */}
      <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
        <Crown className="h-4 w-4 text-amber-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold italic truncate">{unitSession.user_name}</p>
          <p className="text-[10px] text-muted-foreground">Diretor • {unitSession.domain_name}</p>
        </div>
      </div>
    </div>
  );
};

export default DirectorUnitSwitcher;
