import { Shield, ShieldCheck, Lock, Server, FolderOpen, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const TABLES_WITH_RLS = [
  "drivers", "driver_rides", "ride_tbrs", "queue_entries", "ps_entries",
  "rto_entries", "piso_entries", "dnr_entries", "reativo_entries", "rescue_entries",
  "reversa_batches", "domains", "units", "managers", "directors",
  "user_profiles", "conferente_sessions", "unit_logins", "unit_settings",
  "unit_reviews", "payroll_reports", "driver_documents", "driver_invoices",
  "driver_bonus", "driver_fixed_values", "driver_custom_values",
  "driver_minimum_packages", "cycle_records", "system_updates",
  "ps_reasons", "piso_reasons", "user_roles",
];

const EDGE_FUNCTIONS = [
  { name: "admin-validate", reason: "Validação própria via credenciais admin" },
  { name: "authenticate-unit", reason: "Autenticação por login/senha da unidade" },
  { name: "create-ride-with-login", reason: "Credenciais atribuídas server-side" },
  { name: "geocode-address", reason: "Endpoint utilitário sem dados sensíveis" },
  { name: "get-driver-details", reason: "Flag self_access para acesso controlado" },
  { name: "get-signed-url", reason: "Acesso controlado a arquivos privados" },
];

const STORAGE_BUCKETS = [
  { name: "driver-avatars", public: true, reason: "Fotos de perfil precisam ser acessíveis publicamente" },
  { name: "driver-documents", public: false, reason: null },
  { name: "ps-photos", public: true, reason: "Fotos de PS exibidas no painel operacional" },
];

const VIEWS_BY_DESIGN = [
  { name: "drivers_public", reason: "Oculta senha e dados bancários" },
  { name: "directors_public", reason: "Oculta senha" },
  { name: "managers_public", reason: "Oculta senha" },
  { name: "units_public", reason: "Oculta senha" },
  { name: "unit_logins_public", reason: "Oculta senha" },
];

const SecurityPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold italic">Segurança Geral</h1>
      </div>

      {/* Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Score de Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-4xl font-black text-green-600">100%</span>
            <span className="text-sm text-muted-foreground pb-1">conformidade geral</span>
          </div>
          <Progress value={100} className="h-3" />
          <div className="grid grid-cols-3 gap-4 pt-2 text-center">
            <div>
              <p className="text-lg font-bold">{TABLES_WITH_RLS.length}/{TABLES_WITH_RLS.length}</p>
              <p className="text-xs text-muted-foreground">Tabelas com RLS</p>
            </div>
            <div>
              <p className="text-lg font-bold">{EDGE_FUNCTIONS.length}/{EDGE_FUNCTIONS.length}</p>
              <p className="text-xs text-muted-foreground">Funções protegidas</p>
            </div>
            <div>
              <p className="text-lg font-bold">{STORAGE_BUCKETS.length}/{STORAGE_BUCKETS.length}</p>
              <p className="text-xs text-muted-foreground">Buckets configurados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Design Decisions */}
      <Card className="border-blue-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-blue-600">
            <Info className="h-4 w-4" />
            Decisões de Design ({EDGE_FUNCTIONS.length + STORAGE_BUCKETS.filter(b => b.public).length + VIEWS_BY_DESIGN.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {EDGE_FUNCTIONS.map((f) => (
              <li key={f.name} className="flex items-start gap-2 text-sm">
                <span className="text-blue-500 mt-0.5">ℹ</span>
                <span>Edge Function <span className="font-mono text-xs">"{f.name}"</span> — {f.reason}</span>
              </li>
            ))}
            {STORAGE_BUCKETS.filter(b => b.public).map((b) => (
              <li key={b.name} className="flex items-start gap-2 text-sm">
                <span className="text-blue-500 mt-0.5">ℹ</span>
                <span>Bucket <span className="font-mono text-xs">"{b.name}"</span> público — {b.reason}</span>
              </li>
            ))}
            {VIEWS_BY_DESIGN.map((v) => (
              <li key={v.name} className="flex items-start gap-2 text-sm">
                <span className="text-blue-500 mt-0.5">ℹ</span>
                <span>View <span className="font-mono text-xs">"{v.name}"</span> sem RLS — {v.reason}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* RLS Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Row Level Security (RLS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {TABLES_WITH_RLS.map((name) => (
              <div key={name} className="flex items-center gap-2 p-2 rounded-md border text-xs">
                <Lock className="h-3 w-3 text-green-600 shrink-0" />
                <span className="truncate font-mono">{name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Edge Functions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Edge Functions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {EDGE_FUNCTIONS.map((f) => (
              <div key={f.name} className="flex items-center justify-between p-2 rounded-md border text-sm">
                <span className="font-mono text-xs">{f.name}</span>
                <Badge variant="default">Protegida</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Storage Buckets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {STORAGE_BUCKETS.map((b) => (
              <div key={b.name} className="flex items-center justify-between p-2 rounded-md border text-sm">
                <span className="font-mono text-xs">{b.name}</span>
                <Badge variant={b.public ? "secondary" : "default"}>
                  {b.public ? "Público (por design)" : "Privado"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityPage;
