import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Truck, Eye, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Driver {
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
}

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const maskPlate = (v: string) => {
  if (v.length > 3) return v.slice(0, 3) + "-" + v.slice(3);
  return v;
};

const maskWhatsApp = (v: string) => {
  const d = v.replace(/\D/g, "");
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const MotoristasParceirosPage = () => {
  const { unitSession } = useAuthStore();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [viewDriver, setViewDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("drivers")
      .select("*")
      .eq("active", true)
      .order("name");
    if (data) setDrivers(data);
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
            Motoristas Parceiros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF ou placa..."
              className="pl-9 h-11"
            />
          </div>

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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground italic py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
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
                      <TableCell className="text-center text-muted-foreground">0</TableCell>
                      <TableCell className="text-center text-muted-foreground">0</TableCell>
                      <TableCell className="text-center text-muted-foreground">0</TableCell>
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
        </CardContent>
      </Card>

      {/* Driver Details Modal */}
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
              <div><span className="font-semibold text-muted-foreground">Cadastrado em:</span> {new Date(viewDriver.created_at).toLocaleString("pt-BR")}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MotoristasParceirosPage;
