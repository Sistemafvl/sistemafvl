

# Plano de Blindagem de Segurança

## Contexto
O sistema possui 11 alertas de segurança identificados pelo scanner. O desafio principal: o sistema usa autenticação customizada (CPF/CNPJ + senha via Edge Functions), **sem Supabase Auth**. Todas as queries do frontend usam o role `anon`. Isso significa que não podemos simplesmente restringir RLS para `authenticated` sem quebrar todo o sistema.

A estratégia é: mover operações sensíveis para Edge Functions (server-side) e limitar a exposição de dados no client-side ao máximo possível.

---

## Etapa 1 — Edge Function `validate-manager-password`
**Impacto: Remove 3 dos 11 alertas (manager_password no client)**

Criar uma Edge Function que recebe `unit_id` + `password` e retorna `{ valid: boolean }`. Substituir todas as 6+ ocorrências no frontend que buscam `manager_password` do banco e comparam no JavaScript:
- `ConferenciaCarregamentoPage.tsx` (4 ocorrências)
- `FinanceiroPage.tsx` (1 ocorrência)
- `DashboardSidebar.tsx` (1 ocorrência)

**Nenhuma funcionalidade muda** — o gerente continua digitando a senha, mas ela é validada no servidor.

---

## Etapa 2 — Restringir leitura da tabela `drivers` para anon
**Impacto: Remove 2 alertas (PII + senhas expostas)**

O sistema já usa a view `drivers_public` em 20+ arquivos para ler dados de motoristas. Apenas 2 locais acessam a tabela `drivers` diretamente:
- `AdminOverviewPage.tsx` — só conta IDs (pode usar `drivers_public`)
- `DriverDocuments.tsx` — busca dados bancários do próprio motorista

Ações:
1. Migrar essas 2 queries para `drivers_public` (adicionar campos bancários à view, já que o motorista acessa seus próprios dados via sessão autenticada pelo edge function)
2. **Remover** a policy `"Anon can read drivers without password"` da tabela `drivers`
3. Manter acesso `anon` apenas via `drivers_public` (que já oculta senha e dados bancários)
4. Para dados bancários do motorista, criar uma Edge Function `get-driver-bank-details` que valida a sessão

---

## Etapa 3 — Proteger `driver-documents` bucket
**Impacto: Remove 1 alerta (documentos de identidade expostos)**

1. Alterar o bucket `driver-documents` de público para privado (via migration ou config)
2. No `get-signed-url`, remover o fallback anônimo — exigir que o `driver_id` na request corresponda ao motorista da sessão ativa

---

## Etapa 4 — Proteger `create-ride-with-login`
**Impacto: Remove 1 alerta (criação de rides sem autenticação)**

Adicionar validação obrigatória: exigir um `session_token` de `conferente_sessions` válido para a `unit_id`. O conferente já tem sessão ativa — basta passar o token na request e validar server-side.

---

## Etapa 5 — Restringir DELETE em tabelas críticas
**Impacto: Remove 2 alertas (DELETE anônimo + domínios/units)**

Tabelas que **precisam** de DELETE anon (operação do dia-a-dia por sessões não-persistentes): `ride_tbrs`, `piso_entries`, `ps_entries`, `rto_entries`, `dnr_entries`, `user_profiles`.

Tabelas que **não precisam** de DELETE anon e serão restritas:
- `domains` — remover INSERT/UPDATE/DELETE anon
- `units` — remover INSERT/UPDATE/DELETE anon
- `managers` — remover INSERT/UPDATE/DELETE anon
- `payroll_reports` — restringir DELETE
- `driver_bonus`, `driver_invoices` — restringir DELETE
- `conferente_sessions` — restringir DELETE

Para essas tabelas, o DELETE será feito via Edge Function (admin-only) quando necessário.

---

## Etapa 6 — Ignorar alertas que são decisões de design

Marcar como "ignorado com justificativa":
- `SUPA_auth_leaked_password_protection` — o sistema não usa Supabase Auth para login de usuários
- `SUPA_security_definer_view` — as views públicas são intencionais (ocultam senhas)
- `SUPA_rls_policy_always_true` — as policies SELECT(true) em tabelas operacionais são necessárias para o fluxo sem Supabase Auth

---

## Resumo de Impacto

| O que muda | Para o usuário |
|---|---|
| Senha do gerente validada no servidor | Zero diferença visual |
| Dados sensíveis de motoristas ocultados | Zero diferença (já usava views) |
| Documentos privados protegidos | Zero diferença (acesso via signed URL) |
| Criação de rides validada | Zero diferença (conferente já tem sessão) |
| DELETE restrito em tabelas admin | Zero diferença (admin usa Edge Functions) |

**Nenhuma funcionalidade do sistema será afetada.** Todas as telas, fluxos e operações continuam funcionando exatamente como antes.

## Arquivos alterados
- **Nova Edge Function**: `validate-manager-password`
- **Nova Edge Function**: `get-driver-bank-details`
- **Edge Function atualizada**: `create-ride-with-login` (adicionar validação de sessão)
- **Edge Function atualizada**: `get-signed-url` (remover fallback anon)
- **Migration SQL**: remover policies perigosas, restringir DELETE em tabelas admin
- **Frontend** (6 arquivos): substituir queries de `manager_password` por chamada à Edge Function
- **Frontend** (2 arquivos): migrar queries de `drivers` para `drivers_public` + Edge Function

