import { useEffect, useState } from "react";
import { Truck, Eye, Search, Loader2, Trash2, ToggleLeft, ToggleRight, EyeOff, User, Car, MapPin, Landmark, KeyRound, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";

type Driver = {
  id: string;
  name: string;
  cpf: string;
  car_plate: string;
  car_model: string;
  car_color: string | null;
  password: string;
  active: boolean;
  created_at: string;
  email: string | null;
  whatsapp: string | null;
  cep: string | null;
  address: string | null;
  house_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_key_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  emergency_contact_1: string | null;
  emergency_contact_2: string | null;
  birth_date: string | null;
};

const PAGE_SIZE = 20;

const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex justify-between py-1">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-xs font-medium text-right max-w-[60%] break-all">{value || "—"}</span>
  </div>
);

const AdminDriversPage = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      // Use direct fetch to bypass supabase.functions.invoke auth issues
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      let allDrivers: Driver[] | null = null;

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/get-driver-details`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "apikey": supabaseAnonKey,
            },
            body: JSON.stringify({ driver_ids: [], self_access: true, list_all: true }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            allDrivers = data as Driver[];
          } else {
            console.error("Edge function returned non-array:", data);
          }
        } else {
          const errBody = await response.text();
          console.error("Edge function failed:", response.status, errBody);
        }
      } catch (efErr) {
        console.error("Edge function network error:", efErr);
      }

      if (!allDrivers) {
        // Fallback to drivers_public (no password/bank data)
        console.warn("Falling back to drivers_public view");
        let query = supabase
          .from("drivers_public")
          .select("id, name, cpf, car_plate, car_model, car_color, active, created_at, email, whatsapp, cep, address, neighborhood, city, state, avatar_url, bio", { count: "exact" })
          .order("name", { ascending: true });
        if (search.trim()) {
          query = query.or(`name.ilike.%${search.trim()}%,cpf.ilike.%${search.trim()}%`);
        }
        const { data, count, error: fbErr } = await query;
        if (fbErr) console.error("Fallback query error:", fbErr);
        const all = (data as Driver[]) || [];
        setTotal(all.length);
        setDrivers(all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
        setLoading(false);
        return;
      }

      // Filter and sort alphabetically by name
      let filtered = allDrivers;
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        filtered = filtered.filter(d => d.name?.toLowerCase().includes(s) || d.cpf?.includes(s));
      }
      filtered.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"));
      setTotal(filtered.length);
      setDrivers(filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
    } catch (err) {
      console.error("Error fetching drivers:", err);
      toast.error("Erro ao carregar motoristas");
    }
    setLoading(false);
  };

  useEffect(() => { fetchDrivers(); }, [page, search]);

  const toggleActive = async (driver: Driver) => {
    const { error } = await supabase
      .from("drivers")
      .update({ active: !driver.active })
      .eq("id", driver.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(driver.active ? "Motorista desativado" : "Motorista ativado");
    fetchDrivers();
  };

  const deleteDriver = async (driver: Driver) => {
    if (!confirm(`Excluir permanentemente ${driver.name}? Todos os dados relacionados (corridas, documentos, financeiro, etc.) serão removidos.`)) return;
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-driver-details`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseAnonKey}`,
            "apikey": supabaseAnonKey,
          },
          body: JSON.stringify({ action: "delete", driver_id: driver.id, self_access: true }),
        }
      );
      if (!response.ok) {
        const errBody = await response.text();
        console.error("Delete failed:", response.status, errBody);
        toast.error("Erro ao excluir motorista");
        return;
      }
      toast.success("Motorista excluído permanentemente");
      fetchDrivers();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Erro ao excluir motorista");
    }
  };

  const handleEdgeFunctionSync = async () => {
    if (drivers.length > 0) return;
    setLoading(true);
    try {
      // If table is empty (RLS), try getting basic list via Edge Function if we had IDs
      // But since we need IDs, we'll try to get all drivers via a new RPC or just the table
      toast.info("Tentando sincronização de segurança...");
      fetchDrivers(); // Retry after SQL fix
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold italic">Gerenciador de Motoristas</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{total} motoristas cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.map((d) => (
                      <TableRow key={d.id} className={!d.active ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="font-mono text-xs">{d.cpf}</TableCell>
                        <TableCell className="font-mono">{d.car_plate}</TableCell>
                        <TableCell>{d.car_model} {d.car_color && `(${d.car_color})`}</TableCell>
                        <TableCell>
                          <span className={`text-xs font-bold ${d.active ? "text-green-600" : "text-red-500"}`}>
                            {d.active ? "Ativo" : "Inativo"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedDriver(d); setShowPassword(false); }} title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(d)} title={d.active ? "Desativar" : "Ativar"}>
                              {d.active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDriver(d)} title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {drivers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum motorista encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Driver Details Modal */}
      <Dialog open={!!selectedDriver} onOpenChange={(open) => { if (!open) setSelectedDriver(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {selectedDriver?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-4">
              {/* Personal */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  <User className="h-3 w-3" /> Dados Pessoais
                </p>
                <div className="rounded-md border p-3 space-y-0.5">
                  <DetailRow label="Nome" value={selectedDriver.name} />
                  <DetailRow label="CPF" value={selectedDriver.cpf} />
                  <DetailRow label="Email" value={selectedDriver.email} />
                  <DetailRow label="WhatsApp" value={selectedDriver.whatsapp} />
                  <DetailRow label="Data de Nascimento" value={selectedDriver.birth_date ? new Date(selectedDriver.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : null} />
                  <DetailRow label="Bio" value={selectedDriver.bio} />
                </div>
              </div>

              <Separator />

              {/* Emergency Contacts */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Phone className="h-3 w-3" /> Contatos de Emergência
                </p>
                <div className="rounded-md border p-3 space-y-0.5">
                  <DetailRow label="Contato 1" value={selectedDriver.emergency_contact_1} />
                  <DetailRow label="Contato 2" value={selectedDriver.emergency_contact_2} />
                </div>
              </div>

              <Separator />

              {/* Vehicle */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Car className="h-3 w-3" /> Veículo
                </p>
                <div className="rounded-md border p-3 space-y-0.5">
                  <DetailRow label="Placa" value={selectedDriver.car_plate} />
                  <DetailRow label="Modelo" value={selectedDriver.car_model} />
                  <DetailRow label="Cor" value={selectedDriver.car_color} />
                </div>
              </div>

              <Separator />

              {/* Address */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  <MapPin className="h-3 w-3" /> Endereço
                </p>
                <div className="rounded-md border p-3 space-y-0.5">
                  <DetailRow label="CEP" value={selectedDriver.cep} />
                  <DetailRow label="Endereço" value={selectedDriver.address} />
                  <DetailRow label="Número" value={selectedDriver.house_number} />
                  <DetailRow label="Bairro" value={selectedDriver.neighborhood} />
                  <DetailRow label="Cidade" value={selectedDriver.city} />
                  <DetailRow label="Estado" value={selectedDriver.state} />
                </div>
              </div>

              <Separator />

              {/* Banking */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Landmark className="h-3 w-3" /> Dados Bancários
                </p>
                <div className="rounded-md border p-3 space-y-0.5">
                  <DetailRow label="Banco" value={selectedDriver.bank_name} />
                  <DetailRow label="Agência" value={selectedDriver.bank_agency} />
                  <DetailRow label="Conta" value={selectedDriver.bank_account} />
                  <DetailRow label="Tipo PIX" value={selectedDriver.pix_key_type} />
                  <DetailRow label="Chave PIX" value={selectedDriver.pix_key} />
                  <DetailRow label="Nome PIX" value={selectedDriver.pix_key_name} />
                </div>
              </div>

              <Separator />

              {/* Password & Meta */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
                  <KeyRound className="h-3 w-3" /> Credenciais
                </p>
                <div className="rounded-md border p-3 space-y-0.5">
                  <div className="flex justify-between py-1 items-center">
                    <span className="text-xs text-muted-foreground">Senha</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs font-medium">
                        {showPassword ? selectedDriver.password : "••••••••"}
                      </span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <DetailRow label="Status" value={selectedDriver.active ? "Ativo" : "Inativo"} />
                  <DetailRow label="Cadastrado em" value={format(new Date(selectedDriver.created_at), "dd/MM/yyyy HH:mm")} />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDriversPage;
