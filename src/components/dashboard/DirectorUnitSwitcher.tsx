import { useEffect } from "react";
import { Crown, Building2, ArrowLeftRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { ALL_UNITS_ID } from "@/lib/unit-filter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DirectorUnitSwitcher = () => {
  const { unitSession, domainUnits, setDomainUnits, setActiveUnit } = useAuthStore();

  useEffect(() => {
    if (!unitSession?.domain_id || unitSession.sessionType !== "matriz") return;
    supabase
      .from("units_public")
      .select("id, name")
      .eq("domain_id", unitSession.domain_id)
      .eq("active", true)
      .then(({ data }) => {
        if (data) {
          // Filter out the MATRIZ ADMIN unit and sort
          const filtered = data
            .filter((u) => u.id && u.name && !u.name.includes("MATRIZ"))
            .map((u) => ({ id: u.id!, name: u.name! }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setDomainUnits(filtered);

          // If current unit is the MATRIZ unit, auto-select first real unit
          if (filtered.length > 0 && unitSession.name.includes("MATRIZ")) {
            setActiveUnit(filtered[0].id, filtered[0].name);
          }
        }
      });
  }, [unitSession?.domain_id, unitSession?.sessionType]);

  if (!unitSession || unitSession.sessionType !== "matriz") return null;

  return (
    <div className="px-3 pb-2 space-y-2">
      {/* Director Card */}
      <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
        <Crown className="h-4 w-4 text-amber-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold italic truncate">{unitSession.user_name}</p>
          <p className="text-[10px] text-muted-foreground">Diretor • {unitSession.domain_name}</p>
        </div>
      </div>

      {/* Unit Switcher */}
      {domainUnits.length > 0 && (
        <Select
          value={unitSession.id}
          onValueChange={(val) => {
            const u = domainUnits.find((u) => u.id === val);
            if (u) setActiveUnit(u.id, u.name);
          }}
        >
          <SelectTrigger className="w-full text-xs gap-2 bg-muted/50 border-border">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <SelectValue placeholder="Selecionar Unidade" />
            <ArrowLeftRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
          </SelectTrigger>
          <SelectContent>
            {domainUnits.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default DirectorUnitSwitcher;
