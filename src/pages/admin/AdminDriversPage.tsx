import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Truck, Search, Eye, Pencil, Trash2, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Driver {
  id: string;
  name: string;
  cpf: string;
  car_plate: string;
  car_model: string;
  car_color: string | null;
  email: string | null;
  whatsapp: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  active: boolean;
  created_at: string;
}

const PAGE_SIZE = 20;

const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const AdminDriversPage = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [viewDriver, setViewDriver] = useState<Driver | null>(null);
  const [viewPassword, setViewPassword] = useState<string | null>(null);
  const [viewPasswordLoading, setViewPasswordLoading] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [deleteDriver, setDeleteDriver] = useState<Driver | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "", cpf: "", car_plate: "", car_model: "", car_color: "",
    email: "", whatsapp: "", address: "", neighborhood: "", city: "",
    state: "", cep: "", password: "",
  });

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const selectFields = "id, name, cpf, car_plate, car_model, car_color, email, whatsapp, address, neighborhood, city, state, cep, active, created_at";
    let query = supabase.from("drivers_public").select(selectFields, { count: "exact" });

    if (search.trim()) {
      const s = search.trim();
      const digits = s.replace(/\D/g, "");
      if (digits.length > 0) {
        query = query.or(`cpf.ilike.%${digits}%,car_plate.ilike.%${s}%,name.ilike.%${s}%`);
      } else {
        query = query.or(`name.ilike.%${s}%,car_plate.ilike.%${s}%`);
      }
    }

    const { data, count } = await query.order("name").range(from, to);
    setDrivers((data ?? []) as Driver[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openView = async (d: Driver) => {
    setViewDriver(d);
    setViewPassword(null);
    setViewPasswordLoading(true);
    const { data } = await supabase.functions.invoke("get-driver-details", {
      body: { driver_id: d.id, include_password: true },
    });
    setViewPassword(data?.password ?? null);
    setViewPasswordLoading(false);
  };

  const openEdit = (d: Driver) => {
    setEditDriver(d);
    setEditForm({
      name: d.name, cpf: maskCPF(d.cpf), car_plate: d.car_plate,
      car_model: d.car_model, car_color: d.car_color ?? "",
      email: d.email ?? "", whatsapp: d.whatsapp ?? "",
      address: d.address ?? "", neighborhood: d.neighborhood ?? "",
      city: d.city ?? "", state: d.state ?? "", cep: d.cep ?? "",
      password: "",
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDriver) return;
    setEditLoading(true);

    const updates: Record<string, string | null> = {
      name: editForm.name.trim(),
      cpf: editForm.cpf.replace(/\D/g, ""),
      car_plate: editForm.car_plate.trim().toUpperCase(),
      car_model: editForm.car_model.trim(),
      car_color: editForm.car_color.trim() || null,
      email: editForm.email.trim() || null,
      whatsapp: editForm.whatsapp.trim() || null,
      address: editForm.address.trim() || null,
      neighborhood: editForm.neighborhood.trim() || null,
      city: editForm.city.trim() || null,
      state: editForm.state.trim() || null,
      cep: editForm.cep.trim() || null,
    };
    if (editForm.password.trim()) {
      updates.password = editForm.password.trim();
    }

    const { error } = await supabase.from("drivers").update(updates).eq("id", editDriver.id);
    setEditLoading(false);

    if (error) return;
    setEditDriver(null);
    fetchDrivers();
  };

  const toggleActive = async (d: Driver) => {
    const { error } = await supabase.from("drivers").update({ active: !d.active }).eq("id", d.id);
    if (error) return;
    setDrivers((prev) => prev.map((x) => (x.id === d.id ? { ...x, active: !x.active } : x)));
  };

  const handleDelete = async () => {
    if (!deleteDriver) return;
    setDeleteLoading(true);
    const { error } = await supabase.from("drivers").delete().eq("id", deleteDriver.id);
    setDeleteLoading(false);
    if (error) return;
    setDeleteDriver(null);
    fetchDrivers();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold italic">
            <Truck className="h-5 w-5 text-primary" />
            Gerenciamento de Motoristas
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
                  <TableHead className="font-bold text-center">Status</TableHead>
                  <TableHead className="font-bold text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground italic py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : drivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground italic py-8">
                      Nenhum motorista encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  drivers.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-semibold">{d.name}</TableCell>
                      <TableCell className="text-xs">{maskCPF(d.cpf)}</TableCell>
                      <TableCell className="text-xs font-mono">{d.car_plate}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={d.active ? "default" : "secondary"}>
                          {d.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openView(d)} title="Ver info">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Switch checked={d.active} onCheckedChange={() => toggleActive(d)} className="scale-75" />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDriver(d)} title="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} motorista{total !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Modal */}
      <Dialog open={!!viewDriver} onOpenChange={(open) => { if (!open) { setViewDriver(null); setViewPassword(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Truck className="h-5 w-5 text-primary" /> Dados do Motorista
            </DialogTitle>
            <DialogDescription>Informações completas do motorista.</DialogDescription>
          </DialogHeader>
          {viewDriver && (
            <div className="space-y-2 text-sm">
              <div><span className="font-semibold text-muted-foreground">Nome:</span> <span className="font-bold">{viewDriver.name}</span></div>
              <div><span className="font-semibold text-muted-foreground">CPF:</span> {maskCPF(viewDriver.cpf)}</div>
              <div><span className="font-semibold text-muted-foreground">Placa:</span> {viewDriver.car_plate}</div>
              <div><span className="font-semibold text-muted-foreground">Modelo:</span> {viewDriver.car_model}</div>
              {viewDriver.car_color && <div><span className="font-semibold text-muted-foreground">Cor:</span> {viewDriver.car_color}</div>}
              {viewDriver.email && <div><span className="font-semibold text-muted-foreground">E-mail:</span> {viewDriver.email}</div>}
              {viewDriver.whatsapp && <div><span className="font-semibold text-muted-foreground">WhatsApp:</span> {viewDriver.whatsapp}</div>}
              {viewDriver.address && <div><span className="font-semibold text-muted-foreground">Endereço:</span> {viewDriver.address}</div>}
              {viewDriver.neighborhood && <div><span className="font-semibold text-muted-foreground">Bairro:</span> {viewDriver.neighborhood}</div>}
              {viewDriver.city && <div><span className="font-semibold text-muted-foreground">Cidade:</span> {viewDriver.city}{viewDriver.state ? ` - ${viewDriver.state}` : ""}</div>}
              {viewDriver.cep && <div><span className="font-semibold text-muted-foreground">CEP:</span> {viewDriver.cep}</div>}
              <div>
                <span className="font-semibold text-muted-foreground">Senha:</span>{" "}
                {viewPasswordLoading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : viewPassword ?? "—"}
              </div>
              <div><span className="font-semibold text-muted-foreground">Status:</span>{" "}
                <Badge variant={viewDriver.active ? "default" : "secondary"}>{viewDriver.active ? "Ativo" : "Inativo"}</Badge>
              </div>
              <div><span className="font-semibold text-muted-foreground">Cadastrado em:</span> {new Date(viewDriver.created_at).toLocaleString("pt-BR")}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editDriver} onOpenChange={(open) => !open && setEditDriver(null)}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold italic">
              <Pencil className="h-5 w-5 text-primary" /> Editar Motorista
            </DialogTitle>
            <DialogDescription>Altere os dados do motorista.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3">
            {([
              ["name", "Nome *", "text"],
              ["cpf", "CPF *", "text"],
              ["car_plate", "Placa *", "text"],
              ["car_model", "Modelo *", "text"],
              ["car_color", "Cor do Veículo", "text"],
              ["email", "E-mail", "email"],
              ["whatsapp", "WhatsApp", "text"],
              ["address", "Endereço", "text"],
              ["neighborhood", "Bairro", "text"],
              ["city", "Cidade", "text"],
              ["state", "Estado", "text"],
              ["cep", "CEP", "text"],
              ["password", "Nova Senha (deixe vazio para manter)", "password"],
            ] as const).map(([key, label, type]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs font-semibold">{label}</Label>
                <Input
                  type={type}
                  value={editForm[key as keyof typeof editForm]}
                  onChange={(e) => {
                    const val = key === "cpf" ? maskCPF(e.target.value) : e.target.value;
                    setEditForm((prev) => ({ ...prev, [key]: val }));
                  }}
                  className="h-10"
                />
              </div>
            ))}
            <Button type="submit" className="w-full" disabled={editLoading}>
              {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDriver} onOpenChange={(open) => !open && setDeleteDriver(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir motorista?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteDriver?.name}</strong>? Esta ação é permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDriversPage;
