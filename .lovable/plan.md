

# Plano de Seguranca - Sistema FVL

## Contexto de Negocios

O sistema FVL e um sistema interno onde:
- **Master Admin** precisa ver senhas de gerentes e unidades (recuperacao de senha)
- **Gerentes** precisam ver dados dos motoristas (nome, placa, CPF, dados bancarios)
- **Colaboradores** precisam ver dados operacionais (carregamentos, TBRs, etc.)

O problema NAO e a visibilidade interna. O problema e que **qualquer pessoa externa** com a chave anonima (visivel no F12 do navegador) pode acessar e destruir TUDO.

## Vulnerabilidades Criticas Encontradas

### 1. Senhas expostas publicamente
Qualquer pessoa pode abrir o console do navegador e executar:
```text
// Com a anon key visivel no F12:
fetch('https://[url]/rest/v1/drivers?select=name,cpf,password', { headers: { apikey: '[anon_key]' }})
fetch('https://[url]/rest/v1/managers?select=name,cnpj,password,manager_password', ...)
fetch('https://[url]/rest/v1/units?select=name,password', ...)
```
Resultado: todas as senhas do sistema ficam expostas.

### 2. Dados podem ser deletados por qualquer pessoa
```text
fetch('https://[url]/rest/v1/driver_rides', { method: 'DELETE', headers: { apikey: '[anon_key]' }})
```
Qualquer pessoa pode apagar TODOS os carregamentos, TBRs, motoristas, etc.

### 3. Master Admin via localStorage
Qualquer pessoa pode digitar no console:
```text
localStorage.setItem('fvl-auth', '{"state":{"isMasterAdmin":true}}')
```
E ganhar acesso total ao painel de administracao.

### 4. Dados pessoais expostos (CPF, WhatsApp, email, PIX, documentos)
Acessiveis via API anonima sem nenhuma restricao.

---

## Plano de Correcao (por prioridade)

### Fase 1: Proteger senhas (CRITICO)

**Criar views publicas que escondem campos senssiveis**

Para cada tabela que contem senha, criar uma view sem o campo password:

- `drivers_public` - sem `password` (usada pelo frontend em listagens)
- `managers_public` - sem `password` e `manager_password`
- `units_public` - sem `password`

O frontend passara a consultar as views em vez das tabelas diretamente. Apenas edge functions (com service_role_key) acessarao as tabelas com senhas.

**Restringir SELECT na tabela base** para que anon nao consiga ler senhas diretamente:
- Tabela `drivers`: SELECT anon via view (sem password)
- Tabela `managers`: SELECT anon via view (sem passwords)  
- Tabela `units`: SELECT anon via view (sem password)

O Master Admin continuara vendo senhas pois acessara via edge function autenticada.

### Fase 2: Proteger contra DELETE/UPDATE malicioso

**Restringir operacoes destrutivas** em todas as tabelas:

- DELETE: somente via edge function ou usuario autenticado (Supabase Auth)
- UPDATE em campos criticos (password, active): somente via edge function
- INSERT em tabelas operacionais (driver_rides, ride_tbrs, etc.): manter aberto (necessario para operacao)

Tabelas que precisam de DELETE protegido:
- `drivers`, `managers`, `units`, `domains`
- `driver_rides`, `ride_tbrs`
- `queue_entries`, `unit_logins`, `user_profiles`
- `piso_entries`, `ps_entries`, `rto_entries`

### Fase 3: Validar Master Admin no servidor

**Criar edge function `validate-admin`** que:
1. Recebe o token JWT do Supabase Auth
2. Verifica se o usuario e admin real (via tabela `user_roles` ou checagem de email)
3. Retorna confirmacao

**Alterar `AdminLoginModal.tsx`**:
- Apos `signInWithPassword`, chamar a edge function para validar
- Nao confiar apenas no localStorage

**Alterar `AdminLayout.tsx`**:
- Ao montar, verificar sessao ativa com Supabase Auth
- Se nao houver sessao valida, redirecionar para login

### Fase 4: Proteger documentos no Storage

**Bucket `driver-documents`**: mudar de publico para privado
- Acesso somente via URLs assinadas (signed URLs) geradas por edge function
- Motorista so acessa seus proprios documentos
- Gerente acessa documentos dos motoristas da sua unidade

**Bucket `driver-avatars`**: pode manter publico (nao e dado sensivel)

### Fase 5: Proteger dados pessoais

**Tabela `drivers`**: campos como `email`, `whatsapp`, `pix_key`, `bank_account` nao devem ser legiveis por anon diretamente.
- A view `drivers_public` incluira apenas: `id`, `name`, `cpf`, `car_model`, `car_plate`, `car_color`, `active`, `created_at`, `avatar_url`, `bio`
- Dados bancarios e contato serao acessiveis via edge function que valida sessao

---

## Detalhamento Tecnico

### Migracao SQL

```text
-- 1. View publica de drivers (sem password e dados sensiveis)
CREATE VIEW public.drivers_public WITH (security_invoker=on) AS
  SELECT id, name, cpf, car_model, car_plate, car_color, 
         active, created_at, avatar_url, bio, 
         state, city, neighborhood, address, cep
  FROM public.drivers;

-- 2. View publica de managers (sem passwords)
CREATE VIEW public.managers_public WITH (security_invoker=on) AS
  SELECT id, name, cnpj, active, unit_id, created_at
  FROM public.managers;

-- 3. View publica de units (sem password)
CREATE VIEW public.units_public WITH (security_invoker=on) AS
  SELECT id, name, domain_id, active, created_at,
         geofence_lat, geofence_lng, geofence_address, geofence_radius_meters
  FROM public.units;

-- 4. Restringir DELETE em tabelas criticas (remover policies de DELETE com USING(true) para anon)
-- 5. Manter INSERT/UPDATE abertos onde necessario para operacao
-- 6. Tabela user_roles para validar admin
```

### Edge Functions necessarias

1. **`get-driver-details`** - Retorna dados completos (incluindo bancarios) validando sessao
2. **`get-manager-details`** - Retorna dados do gerente incluindo senhas (somente para master admin autenticado)
3. **`admin-validate`** - Valida se sessao JWT pertence a um admin real
4. **`get-signed-url`** - Gera URL temporaria para documentos no storage privado

### Arquivos do frontend a alterar

| Arquivo | Alteracao |
|---|---|
| `MotoristasParceirosPage.tsx` | Consultar `drivers_public` + edge function para dados bancarios |
| `AdminDriversPage.tsx` | Consultar `drivers_public` + edge function para senha (master) |
| `ManagersPage.tsx` | Consultar `managers_public` + edge function para senhas (master) |
| `DomainsUnitsPage.tsx` | Consultar `units_public` |
| `ConferenciaCarregamentoPage.tsx` | Consultar `drivers_public` em vez de `drivers` |
| `OperacaoPage.tsx` | Consultar `drivers_public` |
| `AdminLayout.tsx` | Validar sessao Supabase Auth ao montar |
| `AdminLoginModal.tsx` | Chamar edge function de validacao |
| `auth-store.ts` | Adicionar verificacao de sessao JWT |
| `DriverDocuments.tsx` | Usar signed URLs para documentos |

### O que NAO muda

- Fluxo de login por CPF/CNPJ (ja usa edge function `authenticate-unit`)
- Visibilidade de dados operacionais (carregamentos, TBRs, fila) - necessario para operacao
- Gerente continua vendo dados dos motoristas (via sessao validada)
- Master continua vendo senhas (via edge function autenticada)
- Cadastro de motorista continua publico (formulario aberto)

---

## Ordem de Implementacao

1. Criar views publicas + migrar SELECT do frontend (impacto imediato, sem quebrar nada)
2. Restringir DELETE em todas as tabelas (protecao contra destruicao)
3. Criar edge function de validacao admin + alterar frontend
4. Tornar bucket de documentos privado + signed URLs
5. Criar edge functions para dados sensiveis (bancarios, senhas)

## Riscos e Observacoes

- A migracao precisa ser feita com cuidado para nao quebrar funcionalidades existentes
- O cadastro de motorista continuara inserindo senha em texto plano (hash pode ser fase futura)
- O sistema de autenticacao principal (CPF + senha da unidade) ja usa edge function, o que e bom
- As views precisam ter RLS habilitado com policies adequadas

