import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Eye, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface DriverWithStats {
  id: string;
  name: string;
  cpf: string;
  car_model: string;
  car_plate: string;
  car_color: string | null;
  email: string | null;
  whatsapp: string | null;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  created_at: string;
  totalRides: number;
  finished: number;
  returned: number;
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

const MotoristasParceirosPage = () => {
  const { unitSession } = useAuthStore();
  const [drivers, setDrivers] = useState<DriverWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [viewDriver, setViewDriver] = useState<DriverWithStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (unitSession) loadDrivers();
  }, [unitSession]);

  const loadDrivers = async () => {
    if (!unitSession) return;
    setLoading(true);

    // Get all rides for this unit
    const { data: rides } = await supabase
      .from("driver_rides")
      .select("driver_id, loading_status")
      .eq("unit_id", unitSession.id);

    if (!rides || rides.length === 0) {
      setDrivers([]);
      setLoading(false);
      return;
    }

    // Aggregate stats per driver
    const statsMap: Record<string, { total: number; finished: number; returned: number }> = {};
    rides.forEach((r) => {
      if (!statsMap[r.driver_id]) statsMap[r.driver_id] = { total: 0, finished: 0, returned: 0 };
      statsMap[r.driver_id].total++;
      if (r.loading_status === "finished") statsMap[r.driver_id].finished++;
      if (r.loading_status === "returned") statsMap[r.driver_id].returned++;
    });

    const driverIds = Object.keys(statsMap);
    const { data: driversData } = await supabase
      .from("drivers")
      .select("*")
      .in("id", driverIds)
      .order("name");

    if (driversData) {
      setDrivers(
        driversData.map((d) => ({
          ...d,
          totalRides: statsMap[d.id]?.total ?? 0,
          finished: statsMap[d.id]?.finished ?? 0,
          returned: statsMap[d.id]?.returned ?? 0,
        }))
      );
    }
    setLoading(false);
  };

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.cpf.includes(search.replace(/\D/g, "")) ||
      d.car_plate.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <Truck className="h-5 w-5 text-primary" />
            Motoristas Parceiros que passaram por sua unidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, CPF ou placa..." className="pl-9 h-11" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Nome</TableHead>
                    <TableHead className="font-bold">CPF</TableHead>
                    <TableHead className="font-bold">Placa</TableHead>
                    <TableHead className="font-bold">Modelo</TableHead>
                    <TableHead className="font-bold text-center">Corridas</TableHead>
                    <TableHead className="font-bold text-center">Entregues</TableHead>
                    <TableHead className="font-bold text-center">Devolvidos</TableHead>
                    <TableHead className="font-bold text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground italic py-8">
                        Nenhum motorista encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-semibold">{d.name}</TableCell>
                        <TableCell className="text-xs">{maskCPF(d.cpf)}</TableCell>
                        <TableCell className="uppercase">{maskPlate(d.car_plate)}</TableCell>
                        <TableCell>{d.car_model}</TableCell>
                        <TableCell className="text-center font-semibold">{d.totalRides}</TableCell>
                        <TableCell className="text-center font-semibold text-green-600">{d.finished}</TableCell>
                        <TableCell className="text-center font-semibold text-orange-500">{d.returned}</TableCell>
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
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewDriver} onOpenChange={(open) => !open && setViewDriver(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Truck className="h-5 w-5 text-primary" /> Dados do Motorista
            </DialogTitle>
            <DialogDescription>Informações de cadastro do motorista parceiro.</DialogDescription>
          </DialogHeader>
          {viewDriver && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-center pb-2">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                  <Truck className="h-8 w-8 text-muted-foreground" />
                </div>
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
              {(viewDriver.address || viewDriver.city) && (
                <div>
                  <span className="font-semibold text-muted-foreground">Endereço:</span>{" "}
                  {[viewDriver.address, viewDriver.neighborhood, viewDriver.city, viewDriver.state].filter(Boolean).join(", ")}
                  {viewDriver.cep && ` - CEP: ${viewDriver.cep}`}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                <div className="text-center"><span className="text-xs text-muted-foreground block">Corridas</span><span className="font-bold">{viewDriver.totalRides}</span></div>
                <div className="text-center"><span className="text-xs text-muted-foreground block">Entregues</span><span className="font-bold text-green-600">{viewDriver.finished}</span></div>
                <div className="text-center"><span className="text-xs text-muted-foreground block">Devolvidos</span><span className="font-bold text-orange-500">{viewDriver.returned}</span></div>
              </div>
              <div><span className="font-semibold text-muted-foreground">Cadastrado em:</span> {new Date(viewDriver.created_at).toLocaleString("pt-BR")}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MotoristasParceirosPage;
