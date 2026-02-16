import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Lock, Database, Cloud, HardDrive, Eye, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type StatusLevel = "active" | "alert" | "critical" | "info" | "ok";

interface SecurityItem {
  label: string;
  status: StatusLevel;
  detail: string;
}

const statusConfig: Record<StatusLevel, { badge: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  active: { badge: "Ativo", variant: "default", icon: CheckCircle2 },
  ok: { badge: "OK", variant: "default", icon: CheckCircle2 },
  alert: { badge: "Alerta", variant: "secondary", icon: AlertTriangle },
  critical: { badge: "Crítico", variant: "destructive", icon: XCircle },
  info: { badge: "Info", variant: "outline", icon: Info },
};

const StatusBadge = ({ status }: { status: StatusLevel }) => {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {cfg.badge}
    </Badge>
  );
};

const SecuritySection = ({ title, icon: Icon, items }: { title: string; icon: typeof Shield; items: SecurityItem[] }) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-lg flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/30">
          <div className="flex-1">
            <p className="font-medium text-sm">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
          </div>
          <StatusBadge status={item.status} />
        </div>
      ))}
    </CardContent>
  </Card>
);

const SecurityPage = () => {
  const authItems: SecurityItem[] = [
    { label: "Validação server-side do Master Admin", status: "active", detail: "Edge Function admin-validate verifica JWT + role 'admin' na tabela user_roles." },
    { label: "Roles em tabela separada (user_roles)", status: "active", detail: "Roles armazenados fora do perfil do usuário, prevenindo escalação de privilégios." },
    { label: "Função has_role com SECURITY DEFINER", status: "active", detail: "Função SQL com SECURITY DEFINER e search_path fixo para verificação segura de roles." },
    { label: "Senhas armazenadas em texto plano", status: "alert", detail: "Todas as senhas (drivers, managers, units) estão sem hashing. Requer refatoração completa do fluxo de autenticação." },
  ];

  const rlsItems: SecurityItem[] = [
    { label: "RLS ativo em todas as tabelas operacionais", status: "active", detail: "domains, drivers, managers, units, driver_rides, queue_entries, ps_entries, rto_entries, piso_entries, ride_tbrs, unit_logins, unit_reviews, user_profiles, unit_settings, driver_documents." },
    { label: "DELETE restrito para role anon", status: "active", detail: "Operações DELETE em tabelas críticas requerem role 'authenticated'. Anon não pode deletar dados." },
    { label: "Views públicas sem campos sensíveis", status: "active", detail: "drivers_public, managers_public, units_public e unit_logins_public ocultam senhas e dados bancários." },
    { label: "user_roles protegido por has_role", status: "active", detail: "Apenas admins autenticados podem ler, inserir ou deletar roles. UPDATE bloqueado para todos." },
  ];

  const edgeFunctionItems: SecurityItem[] = [
    { label: "admin-validate", status: "active", detail: "Protegida com JWT + verificação de role admin. CORS padronizado." },
    { label: "get-manager-details", status: "active", detail: "Requer JWT de admin autenticado para retornar senhas de gerenciadores." },
    { label: "get-driver-details", status: "active", detail: "Dados bancários requerem autenticação. Acesso self-service validado por driver_id. Senha requer role admin." },
    { label: "get-signed-url", status: "active", detail: "Validação de driver_id + path match para buckets privados. Admin autenticado tem acesso irrestrito." },
    { label: "authenticate-unit", status: "info", detail: "Autenticação de unidades via CNPJ + senha. Sem JWT (fluxo de login)." },
    { label: "geocode-address", status: "info", detail: "Função utilitária de geocodificação. Sem dados sensíveis." },
  ];

  const storageItems: SecurityItem[] = [
    { label: "Bucket driver-avatars (Público)", status: "ok", detail: "Intencionalmente público. Avatares são dados não sensíveis visíveis em listagens." },
    { label: "Bucket driver-documents (Privado)", status: "active", detail: "CNH, CRLV e comprovantes de residência são armazenados em bucket privado." },
    { label: "Acesso via Signed URLs", status: "active", detail: "Documentos privados são acessados exclusivamente por URLs temporárias (1 hora) geradas via Edge Function com validação." },
  ];

  const dataItems: SecurityItem[] = [
    { label: "Senhas não trafegam em listagens", status: "active", detail: "Frontend usa views públicas (drivers_public, managers_public, units_public) que excluem campos de senha." },
    { label: "Dados bancários via Edge Function", status: "active", detail: "Informações bancárias dos motoristas são carregadas sob demanda via get-driver-details com autenticação." },
    { label: "Documentos via Signed URLs", status: "active", detail: "Documentos sensíveis nunca têm URLs permanentes. Acesso temporário com validação de identidade." },
    { label: "QueuePanel usa Edge Function server-side", status: "active", detail: "Login e senha são atribuídos ao carregamento via Edge Function create-ride-with-login, sem trafegar senhas no frontend." },
  ];

  const recommendations = [
    { priority: "Alta", text: "Implementar hashing de senhas (bcrypt) em todas as tabelas com campo password.", status: "alert" as StatusLevel },
    { priority: "Alta", text: "Criar Edge Function para inserir rides com login/senha sem expor ao frontend (QueuePanel).", status: "alert" as StatusLevel },
    { priority: "Média", text: "Adicionar rate limiting nas Edge Functions para prevenir abuso.", status: "info" as StatusLevel },
    { priority: "Média", text: "Implementar logs de auditoria para ações administrativas (criação/edição/exclusão).", status: "info" as StatusLevel },
    { priority: "Baixa", text: "Adicionar 2FA para acesso do Master Admin.", status: "info" as StatusLevel },
  ];

  // Score calculation
  const allItems = [...authItems, ...rlsItems, ...edgeFunctionItems, ...storageItems, ...dataItems];
  const criticalCount = allItems.filter((i) => i.status === "critical").length;
  const alertCount = allItems.filter((i) => i.status === "alert").length;
  const activeCount = allItems.filter((i) => i.status === "active" || i.status === "ok").length;
  const total = allItems.length;
  const score = Math.round(((activeCount * 1 + alertCount * 0.5) / total) * 100);
  const scoreLevel = criticalCount > 0 ? "Fraco" : alertCount > 2 ? "Moderado" : "Forte";
  const scoreColor = criticalCount > 0 ? "text-red-500" : alertCount > 2 ? "text-yellow-500" : "text-green-500";
  const ScoreIcon = criticalCount > 0 ? ShieldX : alertCount > 2 ? ShieldAlert : ShieldCheck;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold italic">Segurança Geral</h1>
      </div>

      {/* Score Card */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <ScoreIcon className={`h-16 w-16 ${scoreColor}`} />
              <span className={`text-3xl font-bold mt-2 ${scoreColor}`}>{score}%</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl font-bold">Nível de Segurança:</h2>
                <Badge variant={criticalCount > 0 ? "destructive" : alertCount > 2 ? "secondary" : "default"} className="text-base px-3 py-1">
                  {scoreLevel}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-500" /> {activeCount} ativos</span>
                <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-yellow-500" /> {alertCount} alertas</span>
                <span className="flex items-center gap-1"><XCircle className="h-4 w-4 text-red-500" /> {criticalCount} críticos</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SecuritySection title="Autenticação e Acesso" icon={Lock} items={authItems} />
        <SecuritySection title="Row Level Security (RLS)" icon={Database} items={rlsItems} />
        <SecuritySection title="Edge Functions" icon={Cloud} items={edgeFunctionItems} />
        <SecuritySection title="Storage" icon={HardDrive} items={storageItems} />
      </div>

      <SecuritySection title="Dados Sensíveis" icon={Eye} items={dataItems} />

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Recomendações Prioritárias
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <Badge variant={rec.priority === "Alta" ? "destructive" : rec.priority === "Média" ? "secondary" : "outline"} className="shrink-0 mt-0.5">
                {rec.priority}
              </Badge>
              <p className="text-sm">{rec.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityPage;
