import { useEffect, useState } from "react";
import { Database, HardDrive, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const TABLE_NAMES = [
  "drivers",
  "driver_rides",
  "ride_tbrs",
  "queue_entries",
  "ps_entries",
  "rto_entries",
  "piso_entries",
  "dnr_entries",
  "reativo_entries",
  "rescue_entries",
  "reversa_batches",
  "domains",
  "units",
  "managers",
  "directors",
  "user_profiles",
  "conferente_sessions",
  "unit_logins",
  "unit_settings",
  "unit_reviews",
  "payroll_reports",
  "driver_documents",
  "driver_invoices",
  "driver_bonus",
  "driver_fixed_values",
  "driver_custom_values",
  "driver_minimum_packages",
  "cycle_records",
  "system_updates",
  "ps_reasons",
  "piso_reasons",
] as const;

type TableCount = { name: string; count: number };

const DatabasePage = () => {
  const [tables, setTables] = useState<TableCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRows, setTotalRows] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      const results: TableCount[] = [];
      await Promise.all(
        TABLE_NAMES.map(async (name) => {
          const { count } = await supabase
            .from(name)
            .select("*", { count: "exact", head: true });
          results.push({ name, count: count ?? 0 });
        })
      );
      results.sort((a, b) => b.count - a.count);
      setTables(results);
      setTotalRows(results.reduce((s, t) => s + t.count, 0));
      setLoading(false);
    };
    fetchCounts();
  }, []);

  // Rough estimate: ~1KB per row avg, 500MB limit
  const estimatedMB = (totalRows * 1) / 1024;
  const usagePercent = Math.min((estimatedMB / 500) * 100, 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold italic">Banco de Dados</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-4 w-4" />
            Uso Estimado de Armazenamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={usagePercent} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{estimatedMB.toFixed(1)} MB estimados</span>
            <span>500 MB (limite Lovable Cloud)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Total de registros: <strong>{totalRows.toLocaleString("pt-BR")}</strong>
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tables.map((t) => (
            <Card key={t.name} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold italic">{t.name}</p>
                  <p className="text-xs text-muted-foreground">tabela</p>
                </div>
                <span className="text-lg font-bold text-primary">
                  {t.count.toLocaleString("pt-BR")}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DatabasePage;
