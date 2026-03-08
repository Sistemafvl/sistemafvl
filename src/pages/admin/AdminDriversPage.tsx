import { useEffect, useState } from "react";
import { Truck, Eye, EyeOff, Search, Loader2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

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
};

const PAGE_SIZE = 20;

const AdminDriversPage = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  const fetchDrivers = async () => {
    setLoading(true);
    let query = supabase
      .from("drivers")
      .select("id, name, cpf, car_plate, car_model, car_color, password, active, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,cpf.ilike.%${search.trim()}%`);
    }

    const { data, count, error } = await query;
    if (error) {
      toast.error("Erro ao carregar motoristas");
      console.error(error);
    }
    setDrivers((data as Driver[]) || []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchDrivers(); }, [page, search]);

  const togglePassword = (id: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
    if (!confirm(`Excluir permanentemente ${driver.name}?`)) return;
    const { error } = await supabase.from("drivers").delete().eq("id", driver.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Motorista excluído");
    fetchDrivers();
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
          <CardTitle className="text-base flex items-center justify-between">
            <span>{total} motoristas cadastrados</span>
          </CardTitle>
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
                      <TableHead>Senha</TableHead>
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
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs">
                              {visiblePasswords.has(d.id) ? d.password : "••••••"}
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePassword(d.id)}>
                              {visiblePasswords.has(d.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-bold ${d.active ? "text-green-600" : "text-red-500"}`}>
                            {d.active ? "Ativo" : "Inativo"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
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
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum motorista encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      Anterior
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDriversPage;
