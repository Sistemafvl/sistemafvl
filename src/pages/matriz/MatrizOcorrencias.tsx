import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { AlertTriangle, ShieldCheck, RotateCcw, FileWarning } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const statusLabel: Record<string, string> = {
  open: "Aberto", analysis: "Analisando", closed: "Fechado", approved: "Aprovado",
};
const statusColor: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  open: "destructive", analysis: "outline", closed: "secondary", approved: "default",
};

const MatrizOcorrencias = () => {
  const { unitSession } = useAuthStore();
  const domainId = unitSession?.domain_id || "";

  const [dateStart, setDateStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterUnit, setFilterUnit] = useState("all");
  const [units, setUnits] = useState<any[]>([]);
  const [psEntries, setPsEntries] = useState<any[]>([]);
  const [rtoEntries, setRtoEntries] = useState<any[]>([]);
  const [pisoEntries, setPisoEntries] = useState<any[]>([]);
  const [dnrEntries, setDnrEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!domainId) return;
    supabase.from("units_public").select("id, name").eq("domain_id", domainId).eq("active", true).order("name")
      .then(({ data }) => { if (data) setUnits((data as any[]).filter(u => u.name !== "MATRIZ ADMIN")); });
  }, [domainId]);

  useEffect(() => {
    if (!units.length) return;
    const unitIds = filterUnit === "all" ? units.map(u => u.id) : [filterUnit];
    const start = startOfDay(new Date(dateStart)).toISOString();
    const end = endOfDay(new Date(dateEnd)).toISOString();
    setLoading(true);
    import("@/lib/supabase-helpers").then(({ fetchAllRows }) => {
      Promise.all([
        fetchAllRows<any>((from, to) =>
          supabase.from("ps_entries").select("id, unit_id, status, created_at, driver_name, tbr_code, description, route").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }).range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
          supabase.from("rto_entries").select("id, unit_id, status, created_at, driver_name, tbr_code, description, route").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }).range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
          supabase.from("piso_entries").select("id, unit_id, status, created_at, driver_name, tbr_code, reason, route").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }).range(from, to)
        ),
        fetchAllRows<any>((from, to) =>
          supabase.from("dnr_entries").select("id, unit_id, status, created_at, driver_name, tbr_code, dnr_value, route, observations").in("unit_id", unitIds).gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }).range(from, to)
        ),
      ]).then(([psData, rtoData, pisoData, dnrData]) => {
        setPsEntries(psData);
        setRtoEntries(rtoData);
        setPisoEntries(pisoData);
        setDnrEntries(dnrData);
        setLoading(false);
      });
    });
  }, [units, filterUnit, dateStart, dateEnd]);

  const summaryChart = useMemo(() =>
    units.map(u => ({
      name: u.name,
      PS: psEntries.filter(p => p.unit_id === u.id).length,
      RTO: rtoEntries.filter(r => r.unit_id === u.id).length,
      Piso: pisoEntries.filter(p => p.unit_id === u.id).length,
      DNR: dnrEntries.filter(d => d.unit_id === u.id).length,
    })),
  [units, psEntries, rtoEntries, pisoEntries, dnrEntries]);

  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || "—";

  const renderTable = (entries: any[], type: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Motorista</TableHead>
          <TableHead>TBR</TableHead>
          <TableHead>{type === "dnr" ? "Valor" : "Descrição"}</TableHead>
          <TableHead>Rota</TableHead>
          <TableHead className="text-center">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map(e => (
          <TableRow key={e.id}>
            <TableCell className="text-xs">{format(new Date(e.created_at), "dd/MM HH:mm")}</TableCell>
            <TableCell className="text-xs font-semibold italic">{getUnitName(e.unit_id)}</TableCell>
            <TableCell className="text-xs">{e.driver_name || "—"}</TableCell>
            <TableCell className="text-xs font-mono">{e.tbr_code}</TableCell>
            <TableCell className="text-xs max-w-[200px] truncate">
              {type === "dnr" ? Number(e.dnr_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : (e.description || e.reason || "—")}
            </TableCell>
            <TableCell className="text-xs">{e.route || "—"}</TableCell>
            <TableCell className="text-center">
              <Badge variant={statusColor[e.status] || "outline"} className="text-[10px]">
                {statusLabel[e.status] || e.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
        {entries.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-sm text-muted-foreground italic py-6">Nenhum registro</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs font-semibold italic">Data Início</Label>
          <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold italic">Data Fim</Label>
          <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold italic">Unidade</Label>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={ShieldCheck} label="PS" value={psEntries.length} open={psEntries.filter(p => p.status === "open").length} loading={loading} color="text-amber-500" />
        <KpiCard icon={AlertTriangle} label="RTO" value={rtoEntries.length} open={rtoEntries.filter(r => r.status === "open").length} loading={loading} color="text-orange-500" />
        <KpiCard icon={RotateCcw} label="Retorno Piso" value={pisoEntries.length} open={pisoEntries.filter(p => p.status === "open").length} loading={loading} color="text-violet-500" />
        <KpiCard icon={FileWarning} label="DNR" value={`${dnrEntries.length} (${dnrEntries.reduce((a, d) => a + Number(d.dnr_value || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`} open={dnrEntries.filter(d => d.status === "open").length} loading={loading} color="text-destructive" />
      </div>

      {/* Chart */}
      {filterUnit === "all" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-bold italic">Ocorrências por Unidade</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={summaryChart}><CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="PS" fill="#f59e0b" /><Bar dataKey="RTO" fill="#ef4444" />
                <Bar dataKey="Piso" fill="#8b5cf6" /><Bar dataKey="DNR" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Card>
        <CardContent className="pt-4">
          <Tabs defaultValue="ps">
            <TabsList className="grid grid-cols-4 w-full max-w-md">
              <TabsTrigger value="ps">PS ({psEntries.length})</TabsTrigger>
              <TabsTrigger value="rto">RTO ({rtoEntries.length})</TabsTrigger>
              <TabsTrigger value="piso">Piso ({pisoEntries.length})</TabsTrigger>
              <TabsTrigger value="dnr">DNR ({dnrEntries.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="ps" className="overflow-x-auto">{renderTable(psEntries, "ps")}</TabsContent>
            <TabsContent value="rto" className="overflow-x-auto">{renderTable(rtoEntries, "rto")}</TabsContent>
            <TabsContent value="piso" className="overflow-x-auto">{renderTable(pisoEntries, "piso")}</TabsContent>
            <TabsContent value="dnr" className="overflow-x-auto">{renderTable(dnrEntries, "dnr")}</TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

const KpiCard = ({ icon: Icon, label, value, open, loading, color }: any) => (
  <Card className="animate-slide-up">
    <CardContent className="p-4 flex items-center gap-3">
      <Icon className={`h-8 w-8 ${color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-semibold italic truncate">{label}</p>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-1" />
        ) : (
          <>
            <p className="text-lg font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{open} aberto(s)</p>
          </>
        )}
      </div>
    </CardContent>
  </Card>
);

export default MatrizOcorrencias;
