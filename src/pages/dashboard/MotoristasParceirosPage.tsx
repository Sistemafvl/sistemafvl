import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Truck, Eye, Search, Download, Loader2, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DriverGlobal {
  id: string;
  name: string;
  cpf: string;
  car_model: string;
  car_plate: string;
  car_color: string | null;
  avatar_url: string | null;
  email: string | null;
  whatsapp: string | null;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  created_at: string;
  lastOperation: string | null;
}

interface BankData {
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  pix_key_name: string | null;
  pix_key_type: string | null;
}

interface DriverDoc {
  id: string;
  doc_type: string;
  file_url: string;
  file_name: string;
}

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskPlate = (v: string) => v.length > 3 ? v.slice(0, 3) + "-" + v.slice(3) : v;

const maskWhatsApp = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const PIX_TYPE_LABELS: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Chave Aleatória",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  cnh: "CNH", crlv: "CRLV", comprovante_endereco: "Comprovante de Endereço",
};

const ITEMS_PER_PAGE = 50;

const MotoristasParceirosPage = () => {
  const { unitSession } = useAuthStore();
  const [allDrivers, setAllDrivers] = useState<DriverGlobal[]>([]);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");
  const [filterCep, setFilterCep] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [domainUnits, setDomainUnits] = useState<{ id: string; name: string }[]>([]);
  const [unitDriverIds, setUnitDriverIds] = useState<Set<string> | null>(null);
  const [viewDriver, setViewDriver] = useState<DriverGlobal | null>(null);
  const [loading, setLoading] = useState(true);
  const [bankData, setBankData] = useState<BankData | null>(null);
  const [driverDocs, setDriverDocs] = useState<DriverDoc[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [sortConfig, setSortConfig] = useState<{ key: keyof DriverGlobal; direction: "asc" | "desc" } | null>({ key: "name", direction: "asc" });

  useEffect(() => {
    if (unitSession) {
      loadDrivers();
      // Load domain units
      supabase.from("units_public").select("id, name").eq("domain_id", unitSession.domain_id).eq("active", true).order("name")
        .then(({ data }) => { if (data) setDomainUnits((data as any[]).filter(u => u.id && u.name)); });
    }
  }, [unitSession]);

  // When filterUnit changes, fetch driver IDs that operated in that unit
  useEffect(() => {
    if (!filterUnit) { setUnitDriverIds(null); return; }
    (async () => {
      const { fetchAllRows } = await import("@/lib/supabase-helpers");
      const rides = await fetchAllRows<{ driver_id: string }>((from, to) =>
        supabase.from("driver_rides").select("driver_id").eq("unit_id", filterUnit).order("id").range(from, to)
      );
      setUnitDriverIds(new Set(rides.map(r => r.driver_id)));
    })();
  }, [filterUnit]);

  useEffect(() => {
    if (!viewDriver) { setBankData(null); setDriverDocs([]); return; }
    const fetchExtra = async () => {
      const [bankRes, docsRes] = await Promise.all([
        supabase.functions.invoke("get-driver-details", { body: { driver_id: viewDriver.id, self_access: true } }),
        supabase.from("driver_documents").select("id, doc_type, file_url, file_name").eq("driver_id", viewDriver.id),
      ]);
      setBankData(bankRes.data ?? null);
      setDriverDocs((docsRes.data as any) ?? []);
    };
    fetchExtra();
  }, [viewDriver?.id]);

  const loadDrivers = async () => {
    setLoading(true);
    const { data: driversData } = await supabase
      .from("drivers_public")
      .select("id, name, cpf, car_model, car_plate, car_color, avatar_url, email, whatsapp, cep, address, neighborhood, city, state, active, created_at")
      .order("name");

    if (!driversData) { setAllDrivers([]); setLoading(false); return; }

    // Fetch ALL last operations (since driver count is small)
    const { data: lastOps } = await supabase
      .from("driver_rides")
      .select("driver_id, completed_at")
      .order("completed_at", { ascending: false });

    const lastOpMap = new Map<string, string>();
    (lastOps ?? []).forEach(r => {
      if (!lastOpMap.has(r.driver_id)) lastOpMap.set(r.driver_id, r.completed_at);
    });

    setAllDrivers(driversData.map(d => ({
      ...d,
      id: d.id!,
      name: d.name!,
      cpf: d.cpf!,
      car_model: d.car_model!,
      car_plate: d.car_plate!,
      active: d.active!,
      created_at: d.created_at!,
      lastOperation: lastOpMap.get(d.id!) || null,
    })));
    setLoading(false);
  };



  const handleDownloadZip = async () => {
    if (driverDocs.length === 0) {
      toast({ title: "Sem documentos", description: "Este motorista não possui documentos enviados.", variant: "destructive" });
      return;
    }
    setDownloadingZip(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const doc of driverDocs) {
        try {
          const { data: signedData } = await supabase.functions.invoke("get-signed-url", {
            body: { path: doc.file_url, bucket: "driver-documents", driver_id: viewDriver?.id },
          });
          if (!signedData?.signedUrl) continue;
          const res = await fetch(signedData.signedUrl);
          const blob = await res.blob();
          const ext = doc.file_name.split(".").pop() || "pdf";
          zip.file(`${DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}.${ext}`, blob);
        } catch {}
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documentos_${viewDriver?.name?.replace(/\s+/g, "_") ?? "motorista"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download concluído!" });
    } catch {
      toast({ title: "Erro ao gerar ZIP", variant: "destructive" });
    }
    setDownloadingZip(false);
  };

  // Get unique values for filters
  const states = [...new Set(allDrivers.map(d => d.state?.toUpperCase()).filter(Boolean) as string[])].sort();
  const cities = [...new Set(allDrivers.filter(d => !filterState || d.state?.toUpperCase() === filterState.toUpperCase()).map(d => d.city).filter(Boolean) as string[])].sort();
  const neighborhoods = [...new Set(allDrivers.filter(d => (!filterState || d.state?.toUpperCase() === filterState.toUpperCase()) && (!filterCity || d.city === filterCity)).map(d => d.neighborhood).filter(Boolean) as string[])].sort();

  const filtered = allDrivers.filter(d => {
    if (search) {
      const cleanSearch = search.toLowerCase();
      const numSearch = search.replace(/\D/g, "");
      
      const matchName = (d.name ?? "").toLowerCase().includes(cleanSearch);
      const matchPlat = (d.car_plate ?? "").toLowerCase().includes(cleanSearch);
      const matchCpf = numSearch ? (d.cpf ?? "").includes(numSearch) : false;

      if (!(matchName || matchPlat || matchCpf)) return false;
    }
    if (filterState && d.state?.toUpperCase() !== filterState.toUpperCase()) return false;
    if (filterCity && d.city !== filterCity) return false;
    if (filterNeighborhood && d.neighborhood !== filterNeighborhood) return false;
    if (filterCep && !(d.cep ?? "").includes(filterCep.replace(/\D/g, ""))) return false;
    if (unitDriverIds && !unitDriverIds.has(d.id)) return false;

    // Metric card filters
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const isActive = d.lastOperation && new Date(d.lastOperation) >= fifteenDaysAgo;

    if (statusFilter === "active" && !isActive) return false;
    if (statusFilter === "inactive" && isActive) return false;

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    let aVal = a[key] ?? "";
    let bVal = b[key] ?? "";

    if (typeof aVal === "string" && typeof bVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);


  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, filterState, filterCity, filterNeighborhood, filterCep, filterUnit, unitDriverIds, statusFilter, sortConfig]);

  const onSort = (key: keyof DriverGlobal) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const SortIcon = ({ column }: { column: keyof DriverGlobal }) => {
    if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const hasBankData = bankData && (bankData.bank_name || bankData.pix_key);

  // Card metrics
  const totalDrivers = allDrivers.length;
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const activeDrivers = allDrivers.filter(d => d.lastOperation && new Date(d.lastOperation) >= fifteenDaysAgo).length;
  const inactiveDrivers = totalDrivers - activeDrivers;
  const uniqueStates = states.length;

  return (
    <div className="space-y-4">
      {/* Indicator Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card 
          className={cn("cursor-pointer transition-all hover:border-primary/50", statusFilter === "all" && "border-primary bg-primary/5 shadow-sm")} 
          onClick={() => setStatusFilter("all")}
        >
          <CardContent className="p-4 text-center space-y-1">
            <Truck className="h-4 w-4 mx-auto text-primary" />
            {loading ? <Skeleton className="h-8 w-16 mx-auto" /> : <p className="text-2xl font-bold">{totalDrivers}</p>}
            <p className="text-[10px] text-muted-foreground">Total Cadastrados</p>
          </CardContent>
        </Card>
        <Card 
          className={cn("cursor-pointer transition-all hover:border-green-600/50", statusFilter === "active" && "border-green-600 bg-green-50 shadow-sm")} 
          onClick={() => setStatusFilter("active")}
        >
          <CardContent className="p-4 text-center space-y-1">
            <Eye className="h-4 w-4 mx-auto text-green-600" />
            {loading ? <Skeleton className="h-8 w-16 mx-auto" /> : <p className="text-2xl font-bold text-green-600">{activeDrivers}</p>}
            <p className="text-[10px] text-muted-foreground">Ativos (15d)</p>
          </CardContent>
        </Card>
        <Card 
          className={cn("cursor-pointer transition-all hover:border-muted-foreground/50", statusFilter === "inactive" && "border-muted-foreground bg-muted shadow-sm")} 
          onClick={() => setStatusFilter("inactive")}
        >
          <CardContent className="p-4 text-center space-y-1">
            <Truck className="h-4 w-4 mx-auto text-muted-foreground" />
            {loading ? <Skeleton className="h-8 w-16 mx-auto" /> : <p className="text-2xl font-bold text-muted-foreground">{inactiveDrivers}</p>}
            <p className="text-[10px] text-muted-foreground">Inativos (15d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center space-y-1">
            <Search className="h-4 w-4 mx-auto text-primary" />
            {loading ? <Skeleton className="h-8 w-16 mx-auto" /> : <p className="text-2xl font-bold">{uniqueStates}</p>}
            <p className="text-[10px] text-muted-foreground">Estados</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <Truck className="h-5 w-5 text-primary" />
            Motoristas Parceiros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select value={filterUnit} onValueChange={(v) => setFilterUnit(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Unidades</SelectItem>
                {domainUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterState} onValueChange={(v) => { setFilterState(v === "all" ? "" : v); setFilterCity(""); setFilterNeighborhood(""); }}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Estados</SelectItem>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCity} onValueChange={(v) => { setFilterCity(v === "all" ? "" : v); setFilterNeighborhood(""); }}>
              <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Cidades</SelectItem>
                {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterNeighborhood} onValueChange={(v) => setFilterNeighborhood(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Bairro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Bairros</SelectItem>
                {neighborhoods.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={filterCep} onChange={(e) => setFilterCep(e.target.value)} placeholder="CEP..." className="h-10" />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF ou placa..." className="pl-9 h-11" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSort("name")}>
                        <div className="flex items-center">Nome <SortIcon column="name" /></div>
                      </TableHead>
                      <TableHead className="font-bold cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSort("cpf")}>
                        <div className="flex items-center">CPF <SortIcon column="cpf" /></div>
                      </TableHead>
                      <TableHead className="font-bold cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSort("car_plate")}>
                        <div className="flex items-center">Placa <SortIcon column="car_plate" /></div>
                      </TableHead>
                      <TableHead className="font-bold cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSort("city")}>
                        <div className="flex items-center">Cidade <SortIcon column="city" /></div>
                      </TableHead>
                      <TableHead className="font-bold cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSort("state")}>
                        <div className="flex items-center">UF <SortIcon column="state" /></div>
                      </TableHead>
                      <TableHead className="font-bold cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onSort("lastOperation")}>
                        <div className="flex items-center">Última Operação <SortIcon column="lastOperation" /></div>
                      </TableHead>
                      <TableHead className="font-bold text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground italic py-8">
                          Nenhum motorista encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-semibold">{d.name}</TableCell>
                          <TableCell className="text-xs">{maskCPF(d.cpf)}</TableCell>
                          <TableCell className="uppercase">{maskPlate(d.car_plate)}</TableCell>
                          <TableCell>{d.city ?? "-"}</TableCell>
                          <TableCell>{d.state?.toUpperCase() ?? "-"}</TableCell>
                          <TableCell className="text-xs">
                            {d.lastOperation ? new Date(d.lastOperation).toLocaleDateString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewDriver(d)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">Página {page} de {totalPages} ({filtered.length} motoristas)</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      Próxima <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewDriver} onOpenChange={(open) => !open && setViewDriver(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Truck className="h-5 w-5 text-primary" /> Dados do Motorista
            </DialogTitle>
            <DialogDescription>Informações de cadastro do motorista parceiro.</DialogDescription>
          </DialogHeader>
          {viewDriver && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-center pb-2">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={viewDriver.avatar_url ?? undefined} alt={viewDriver.name || "Motorista"} />
                  <AvatarFallback className="text-2xl font-bold">{(viewDriver.name || "M").charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
              <div><span className="font-semibold text-muted-foreground">Nome:</span> <span className="font-bold">{viewDriver.name}</span></div>
              <div><span className="font-semibold text-muted-foreground">CPF:</span> {maskCPF(viewDriver.cpf)}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="font-semibold text-muted-foreground">Placa:</span> {maskPlate(viewDriver.car_plate)}</div>
                <div><span className="font-semibold text-muted-foreground">Modelo:</span> {viewDriver.car_model}</div>
                {viewDriver.car_color && <div><span className="font-semibold text-muted-foreground">Cor:</span> {viewDriver.car_color}</div>}
              </div>
              {viewDriver.email && <div><span className="font-semibold text-muted-foreground">Email:</span> {viewDriver.email}</div>}
              {viewDriver.whatsapp && <div><span className="font-semibold text-muted-foreground">WhatsApp:</span> {maskWhatsApp(viewDriver.whatsapp)}</div>}
              {(viewDriver as any).birth_date && (
                <div><span className="font-semibold text-muted-foreground">Data de Nascimento:</span> {new Date((viewDriver as any).birth_date + "T12:00:00").toLocaleDateString("pt-BR")}</div>
              )}
              {(viewDriver.address || viewDriver.city) && (
                <div>
                  <span className="font-semibold text-muted-foreground">Endereço:</span>{" "}
                  {[viewDriver.address, viewDriver.neighborhood, viewDriver.city, viewDriver.state].filter(Boolean).join(", ")}
                  {viewDriver.cep && ` - CEP: ${viewDriver.cep}`}
                </div>
              )}
              <div className="pt-2 border-t space-y-1">
                <p className="font-bold text-xs uppercase text-muted-foreground">Contatos de Emergência</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-muted-foreground">Contato 1:</span> {(viewDriver as any).emergency_contact_1 ? maskWhatsApp((viewDriver as any).emergency_contact_1) : "—"}</div>
                  <div><span className="text-muted-foreground">Contato 2:</span> {(viewDriver as any).emergency_contact_2 ? maskWhatsApp((viewDriver as any).emergency_contact_2) : "—"}</div>
                </div>
              </div>
              <div><span className="font-semibold text-muted-foreground">Última Operação:</span> {viewDriver.lastOperation ? new Date(viewDriver.lastOperation).toLocaleDateString("pt-BR") : "Sem registros"}</div>

              <div><span className="font-semibold text-muted-foreground">Cadastrado em:</span> {new Date(viewDriver.created_at).toLocaleString("pt-BR")}</div>

              {hasBankData && (
                <div className="pt-2 border-t space-y-1">
                  <p className="font-bold text-xs uppercase text-muted-foreground">Dados Bancários</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {bankData.bank_name && <div><span className="text-muted-foreground">Banco:</span> {bankData.bank_name}</div>}
                    {bankData.bank_agency && <div><span className="text-muted-foreground">Agência:</span> {bankData.bank_agency}</div>}
                    {bankData.bank_account && <div><span className="text-muted-foreground">Conta:</span> {bankData.bank_account}</div>}
                    {bankData.pix_key_type && <div><span className="text-muted-foreground">Tipo Pix:</span> {PIX_TYPE_LABELS[bankData.pix_key_type] ?? bankData.pix_key_type}</div>}
                    {bankData.pix_key && <div><span className="text-muted-foreground">Chave Pix:</span> {bankData.pix_key}</div>}
                    {bankData.pix_key_name && <div><span className="text-muted-foreground">Titular:</span> {bankData.pix_key_name}</div>}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={handleDownloadZip}
                disabled={downloadingZip || driverDocs.length === 0}
              >
                {downloadingZip ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                {driverDocs.length > 0 ? `Baixar Documentos (${driverDocs.length})` : "Sem documentos"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MotoristasParceirosPage;
