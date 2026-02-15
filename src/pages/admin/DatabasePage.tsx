import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Database,
  Users,
  Truck,
  Building2,
  Package,
  FileText,
  AlertTriangle,
  BarChart3,
  Activity,
  Loader2,
  RefreshCw,
  HardDrive,
  Table2,
  KeyRound,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TableStats {
  name: string;
  icon: React.ElementType;
  count: number;
  label: string;
}

const DB_LIMIT_MB = 500; // Free tier ~500MB

const DatabasePage = () => {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<TableStats[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [estimatedSizeMB, setEstimatedSizeMB] = useState(0);

  const fetchStats = async () => {
    setLoading(true);

    const queries = [
      { name: "domains", icon: Building2, label: "Domínios" },
      { name: "units", icon: Building2, label: "Unidades" },
      { name: "managers", icon: Users, label: "Gerenciadores" },
      { name: "drivers", icon: Truck, label: "Motoristas" },
      { name: "user_profiles", icon: Users, label: "Conferentes" },
      { name: "queue_entries", icon: ClipboardList, label: "Fila" },
      { name: "driver_rides", icon: FileText, label: "Carregamentos" },
      { name: "ride_tbrs", icon: Package, label: "TBRs" },
      { name: "piso_entries", icon: AlertTriangle, label: "Retorno Piso" },
      { name: "ps_entries", icon: AlertTriangle, label: "PS" },
      { name: "rto_entries", icon: AlertTriangle, label: "RTO" },
      { name: "unit_logins", icon: KeyRound, label: "Logins" },
      { name: "unit_settings", icon: Activity, label: "Configurações" },
      { name: "piso_reasons", icon: FileText, label: "Motivos Piso" },
    ];

    const results = await Promise.all(
      queries.map(async (q) => {
        const { count } = await supabase
          .from(q.name as any)
          .select("*", { count: "exact", head: true });
        return { ...q, count: count ?? 0 };
      })
    );

    const total = results.reduce((s, r) => s + r.count, 0);
    // Rough estimate: ~0.5KB per row average
    const sizeMB = (total * 0.5) / 1024;

    setTables(results);
    setTotalRows(total);
    setEstimatedSizeMB(sizeMB);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const usagePercent = Math.min((estimatedSizeMB / DB_LIMIT_MB) * 100, 100);

  const topTables = [...tables].sort((a, b) => b.count - a.count).slice(0, 5);

  // Additional derived metrics
  const activeTables = tables.filter((t) => t.count > 0).length;
  const emptyTables = tables.filter((t) => t.count === 0).length;
  const avgRowsPerTable = tables.length > 0 ? Math.round(totalRows / tables.length) : 0;

  // Piso/PS/RTO open counts
  const pisoCount = tables.find((t) => t.name === "piso_entries")?.count ?? 0;
  const psCount = tables.find((t) => t.name === "ps_entries")?.count ?? 0;
  const rtoCount = tables.find((t) => t.name === "rto_entries")?.count ?? 0;
  const totalIssues = pisoCount + psCount + rtoCount;

  const driversCount = tables.find((t) => t.name === "drivers")?.count ?? 0;
  const ridesCount = tables.find((t) => t.name === "driver_rides")?.count ?? 0;
  const tbrsCount = tables.find((t) => t.name === "ride_tbrs")?.count ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold italic flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Banco de Dados
        </h1>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
      </div>

      {/* Usage bar */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold italic flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Uso do Banco de Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {estimatedSizeMB.toFixed(2)} MB / {DB_LIMIT_MB} MB
            </span>
            <Badge
              variant={usagePercent > 80 ? "destructive" : usagePercent > 50 ? "secondary" : "outline"}
            >
              {usagePercent.toFixed(1)}%
            </Badge>
          </div>
          <Progress value={usagePercent} className="h-4" />
          <p className="text-xs text-muted-foreground">
            Estimativa baseada em {totalRows.toLocaleString("pt-BR")} registros totais
          </p>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Table2 className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{tables.length}</p>
            <p className="text-xs text-muted-foreground">Tabelas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalRows.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Registros totais</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{activeTables}</p>
            <p className="text-xs text-muted-foreground">Tabelas ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Database className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{emptyTables}</p>
            <p className="text-xs text-muted-foreground">Tabelas vazias</p>
          </CardContent>
        </Card>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Truck className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{driversCount}</p>
            <p className="text-xs text-muted-foreground">Motoristas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{ridesCount}</p>
            <p className="text-xs text-muted-foreground">Carregamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{tbrsCount}</p>
            <p className="text-xs text-muted-foreground">TBRs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto text-destructive mb-1" />
            <p className="text-xl font-bold">{totalIssues}</p>
            <p className="text-xs text-muted-foreground">Pendências</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-xl font-bold">{avgRowsPerTable}</p>
            <p className="text-xs text-muted-foreground">Média/tabela</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 tables */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold italic">
            Top 5 Tabelas (por registros)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topTables.map((t, i) => {
            const pct = totalRows > 0 ? (t.count / totalRows) * 100 : 0;
            return (
              <div key={t.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-muted-foreground">#{i + 1}</span>
                    <t.icon className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{t.label}</span>
                    <span className="text-muted-foreground text-xs">({t.name})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{t.count.toLocaleString("pt-BR")}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {pct.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Full table list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold italic">
            Todas as Tabelas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold">Tabela</th>
                  <th className="text-right p-3 font-semibold">Registros</th>
                  <th className="text-right p-3 font-semibold">% Total</th>
                  <th className="text-center p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {tables.map((t) => {
                  const pct = totalRows > 0 ? (t.count / totalRows) * 100 : 0;
                  return (
                    <tr key={t.name} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <t.icon className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <p className="font-semibold">{t.label}</p>
                            <p className="text-xs text-muted-foreground">{t.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold tabular-nums">
                        {t.count.toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 text-right text-muted-foreground tabular-nums">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={t.count > 0 ? "default" : "secondary"} className="text-[10px]">
                          {t.count > 0 ? "Ativa" : "Vazia"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabasePage;
