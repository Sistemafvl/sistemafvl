import { Shield, ShieldCheck, ShieldAlert, Lock, Unlock, Server, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// Hardcoded security audit based on known system state
const TABLES_WITH_RLS = [
  { name: "drivers", rls: true },
  { name: "driver_rides", rls: true },
  { name: "ride_tbrs", rls: true },
  { name: "queue_entries", rls: true },
  { name: "ps_entries", rls: true },
  { name: "rto_entries", rls: true },
  { name: "piso_entries", rls: true },
  { name: "dnr_entries", rls: true },
  { name: "reativo_entries", rls: true },
  { name: "rescue_entries", rls: true },
  { name: "reversa_batches", rls: true },
  { name: "domains", rls: true },
  { name: "units", rls: true },
  { name: "managers", rls: true },
  { name: "directors", rls: true },
  { name: "user_profiles", rls: true },
  { name: "conferente_sessions", rls: true },
  { name: "unit_logins", rls: true },
  { name: "unit_settings", rls: true },
  { name: "unit_reviews", rls: true },
  { name: "payroll_reports", rls: true },
  { name: "driver_documents", rls: true },
  { name: "driver_invoices", rls: true },
  { name: "driver_bonus", rls: true },
  { name: "driver_fixed_values", rls: true },
  { name: "driver_custom_values", rls: true },
  { name: "driver_minimum_packages", rls: true },
  { name: "cycle_records", rls: true },
  { name: "system_updates", rls: true },
  { name: "ps_reasons", rls: true },
  { name: "piso_reasons", rls: true },
  { name: "user_roles", rls: true },
];

const EDGE_FUNCTIONS = [
  { name: "admin-validate", jwt: false },
  { name: "authenticate-unit", jwt: false },
  { name: "create-ride-with-login", jwt: false },
  { name: "geocode-address", jwt: false },
  { name: "get-driver-details", jwt: false },
  { name: "get-signed-url", jwt: false },
  { name: "get-manager-details", jwt: false },
];

const STORAGE_BUCKETS = [
  { name: "driver-avatars", public: true },
  { name: "driver-documents", public: false },
  { name: "ps-photos", public: true },
];

const VIEWS_NO_RLS = [
  "drivers_public",
  "directors_public",
  "managers_public",
  "units_public",
  "unit_logins_public",
];

const SecurityPage = () => {
  const rlsCount = TABLES_WITH_RLS.filter((t) => t.rls).length;
  const rlsTotal = TABLES_WITH_RLS.length;
  const rlsPercent = Math.round((rlsCount / rlsTotal) * 100);

  const jwtCount = EDGE_FUNCTIONS.filter((f) => f.jwt).length;
  const privateBuckets = STORAGE_BUCKETS.filter((b) => !b.public).length;

  // Score: 50% RLS, 30% JWT, 20% storage
  const score = Math.round(
    rlsPercent * 0.5 +
    (jwtCount / EDGE_FUNCTIONS.length) * 100 * 0.3 +
    (privateBuckets / STORAGE_BUCKETS.length) * 100 * 0.2
  );

  const vulnerabilities: string[] = [];
  EDGE_FUNCTIONS.forEach((f) => {
    if (!f.jwt) vulnerabilities.push(`Edge Function "${f.name}" sem verificação JWT`);
  });
  STORAGE_BUCKETS.forEach((b) => {
    if (b.public) vulnerabilities.push(`Bucket "${b.name}" é público`);
  });
  if (VIEWS_NO_RLS.length > 0) {
    vulnerabilities.push(`${VIEWS_NO_RLS.length} views sem RLS (por design — ofuscam PII)`);
  }

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
            <span className={`text-4xl font-black ${score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600"}`}>
              {score}%
            </span>
            <span className="text-sm text-muted-foreground pb-1">conformidade geral</span>
          </div>
          <Progress value={score} className="h-3" />
          <div className="grid grid-cols-3 gap-4 pt-2 text-center">
            <div>
              <p className="text-lg font-bold">{rlsCount}/{rlsTotal}</p>
              <p className="text-xs text-muted-foreground">Tabelas com RLS</p>
            </div>
            <div>
              <p className="text-lg font-bold">{jwtCount}/{EDGE_FUNCTIONS.length}</p>
              <p className="text-xs text-muted-foreground">Funções com JWT</p>
            </div>
            <div>
              <p className="text-lg font-bold">{privateBuckets}/{STORAGE_BUCKETS.length}</p>
              <p className="text-xs text-muted-foreground">Buckets privados</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vulnerabilities */}
      {vulnerabilities.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
              <ShieldAlert className="h-4 w-4" />
              Alertas ({vulnerabilities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {vulnerabilities.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-yellow-500 mt-0.5">⚠</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
            {TABLES_WITH_RLS.map((t) => (
              <div key={t.name} className="flex items-center gap-2 p-2 rounded-md border text-xs">
                {t.rls ? (
                  <Lock className="h-3 w-3 text-green-600 shrink-0" />
                ) : (
                  <Unlock className="h-3 w-3 text-red-500 shrink-0" />
                )}
                <span className="truncate font-mono">{t.name}</span>
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
                <Badge variant={f.jwt ? "default" : "secondary"}>
                  {f.jwt ? "JWT ativo" : "JWT desativado"}
                </Badge>
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
                <Badge variant={b.public ? "destructive" : "default"}>
                  {b.public ? "Público" : "Privado"}
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
