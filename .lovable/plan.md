

# Revisao Completa de Visibilidade de Dados Apos Seguranca

## Resumo da Analise

Revisando todos os arquivos do frontend e as Edge Functions, identifiquei **problemas reais** onde dados podem deixar de aparecer para usuarios autorizados, e tambem pontos onde a seguranca ainda nao esta totalmente aplicada.

---

## Problemas Encontrados

### 1. ManagersPage.tsx - Consulta direta na tabela `managers` (CRITICO)

**Arquivo:** `src/pages/admin/ManagersPage.tsx` (linha 66)

A pagina de gerenciadores ainda faz `supabase.from("managers").select("*")`, o que retorna `password` e `manager_password` diretamente. Isso funciona APENAS porque o Master Admin esta autenticado via Supabase Auth e a RLS permite `SELECT` para `authenticated`.

**Problema:** Se o RLS da tabela `managers` for restringido para bloquear SELECT direto (como previsto no plano), a pagina vai quebrar. Alem disso, senhas estao sendo trafegadas no frontend desnecessariamente.

**Correcao:** Alterar para consultar `managers_public` para a listagem e usar a Edge Function `get-manager-details` apenas quando o admin clica em "Visualizar" para ver senhas.

---

### 2. AdminDriversPage.tsx - Consulta direta na tabela `drivers` com `select("*")` (CRITICO)

**Arquivo:** `src/pages/admin/AdminDriversPage.tsx` (linha 78)

A pagina faz `supabase.from("drivers").select("*")` que inclui `password` e todos os campos sensiveis. Funciona porque o admin esta autenticado, mas trafega senhas no frontend.

**Problema:** A interface `Driver` (linha 38) inclui `password: string` e o modal de visualizacao NAO mostra a senha, mas ela esta no objeto. Alem disso, o formulario de edicao permite alterar a senha diretamente na tabela `drivers`.

**Correcao:** Consultar `drivers_public` para listagem. Para ver/editar senha, usar `get-driver-details` com `include_password: true`.

---

### 3. DomainsUnitsPage.tsx - Consulta `units` com `select("*")` (MODERADO)

**Arquivo:** `src/pages/admin/DomainsUnitsPage.tsx` (linhas 31, 36)

Consulta `units` com `select("*")`, o que inclui `password`. A senha da unidade nao e exibida na interface, mas esta sendo trafegada.

**Correcao:** Alterar para `units_public` ou selecionar campos especificos sem `password`.

---

### 4. DriverDocuments.tsx - Motorista consulta `drivers` diretamente para dados bancarios (FUNCIONAL)

**Arquivo:** `src/pages/driver/DriverDocuments.tsx` (linha 58)

O motorista faz `supabase.from("drivers").select("bank_name, bank_agency, bank_account, pix_key, pix_key_name, pix_key_type")` para carregar seus proprios dados bancarios. Isso funciona porque o RLS permite SELECT para anon na tabela `drivers`.

**Problema:** Se restringirmos o SELECT da tabela `drivers` no futuro, essa consulta vai quebrar. A view `drivers_public` NAO inclui campos bancarios.

**Impacto:** O motorista deixaria de ver seus dados bancarios. **Precisa manter funcionando.**

**Correcao:** Manter a consulta atual por enquanto (funciona com RLS atual), OU criar uma Edge Function dedicada para o motorista consultar seus proprios dados.

---

### 5. DashboardHome.tsx - Consulta `units` e `drivers` para busca de TBR (MODERADO)

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx` (linhas 124-131)

Ao buscar TBR, faz `supabase.from("drivers").select("name, car_model, car_plate, car_color")` e `supabase.from("units").select("name")`. Seleciona apenas campos nao sensiveis, entao **esta OK** e nao precisa de alteracao. Continuara funcionando mesmo com restricoes futuras, pois seleciona campos que existem na view publica.

---

### 6. OperacaoPage.tsx - Consulta `drivers` com campos seguros (OK)

**Arquivo:** `src/pages/dashboard/OperacaoPage.tsx` (linha 85)

Faz `supabase.from("drivers").select("id, name, car_model, car_plate, car_color, avatar_url")`. Todos os campos selecionados existem na view `drivers_public`. **Nao quebra.** Mas seria mais seguro mudar para `drivers_public`.

---

### 7. ConferenciaCarregamentoPage.tsx - Consulta `drivers` com campos seguros (OK)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (linhas 190-193)

Faz `supabase.from("drivers").select("id, name, avatar_url, car_model, car_plate, car_color")`. Campos seguros. **Nao quebra.**

---

### 8. QueuePanel.tsx - Consulta `drivers` com campos seguros (OK)

**Arquivo:** `src/components/dashboard/QueuePanel.tsx` (linhas 74-77)

Faz `supabase.from("drivers").select("id, name, avatar_url, car_model, car_plate, car_color")`. Campos seguros. **Nao quebra.**

---

### 9. MotoristasParceirosPage.tsx - Consulta `drivers` com `email` e `whatsapp` (ATENCAO)

**Arquivo:** `src/pages/dashboard/MotoristasParceirosPage.tsx` (linha 128)

Faz `supabase.from("drivers").select("id, name, cpf, car_model, car_plate, car_color, email, whatsapp, cep, address, neighborhood, city, state, active, created_at, avatar_url, bio")`. Inclui `email` e `whatsapp`.

**Situacao:** A view `drivers_public` INCLUI `email` e `whatsapp` (conforme a view criada na migracao). Portanto **nao quebra**. Os gerentes precisam ver esses dados dos motoristas, entao e correto exibi-los.

---

### 10. QueuePanel.tsx - Consulta `unit_logins` com `password` (ATENCAO)

**Arquivo:** `src/components/dashboard/QueuePanel.tsx`

O painel de fila provavelmente consulta `unit_logins` para preencher login/senha ao programar um carregamento. Se a view `unit_logins_public` nao inclui `password`, o fluxo de programacao de carregamento pode quebrar.

**Correcao:** Verificar se o QueuePanel precisa da senha do login para atribuir ao carregamento. Se sim, manter consulta na tabela base (para usuarios autenticados) ou usar Edge Function.

---

## Resumo de Impacto

| Pagina | Consulta Atual | Quebra? | Acao Necessaria |
|---|---|---|---|
| ManagersPage | `managers.*` | Nao (RLS OK) | Migrar para `managers_public` + edge function para senhas |
| AdminDriversPage | `drivers.*` | Nao (RLS OK) | Migrar para `drivers_public` + edge function para senha |
| DomainsUnitsPage | `units.*` | Nao (RLS OK) | Migrar para `units_public` ou selecionar campos |
| DriverDocuments | `drivers.bank_*` | Nao (RLS OK) | Manter (motorista edita proprios dados) |
| MotoristasParceirosPage | campos seguros | Nao | Ja OK, usa edge function para bancarios |
| OperacaoPage | campos seguros | Nao | Opcional: trocar para `drivers_public` |
| ConferenciaCarregamentoPage | campos seguros | Nao | Opcional: trocar para `drivers_public` |
| QueuePanel | campos seguros | Nao | Opcional: trocar para `drivers_public` |
| DashboardHome | campos seguros | Nao | OK como esta |

---

## Plano de Correcao

### Etapa 1: ManagersPage.tsx
- Mudar `refreshManagers()` para consultar `managers_public` em vez de `managers`
- No modal "Visualizar", chamar `get-manager-details` para obter senhas (somente para Master Admin autenticado)
- Manter INSERT/UPDATE na tabela `managers` (admin autenticado pode)

### Etapa 2: AdminDriversPage.tsx
- Mudar `fetchDrivers()` para consultar `drivers_public` (ou `drivers` selecionando campos sem password)
- Remover `password` da interface `Driver`
- No modal "Visualizar", adicionar botao para carregar senha via `get-driver-details` com `include_password: true`
- No formulario de edicao, manter campo de senha (UPDATE direto na tabela `drivers` funciona para admin autenticado)

### Etapa 3: DomainsUnitsPage.tsx
- Mudar `fetchDomains()` para selecionar campos especificos: `id, name, active` (sem password)
- Mudar `fetchUnits()` para consultar `units_public` ou selecionar `id, domain_id, name, active` (sem password)

### Etapa 4: Paginas operacionais (opcional mas recomendado)
- OperacaoPage, ConferenciaCarregamentoPage, QueuePanel: trocar `from("drivers")` para `from("drivers_public")` para consistencia
- DashboardHome: ja seleciona campos seguros, pode manter

### Etapa 5: DriverDocuments.tsx
- Manter como esta: o motorista consulta e edita seus proprios dados bancarios diretamente na tabela `drivers`
- Funciona com RLS atual e e necessario para o fluxo do motorista

---

## O que NAO vai quebrar

- Dados operacionais (carregamentos, TBRs, fila, retornos) continuam vissiveis normalmente
- Gerentes continuam vendo nome, CPF, placa, modelo, email, WhatsApp dos motoristas
- Dados bancarios dos motoristas continuam acessiveis via Edge Function para gerentes
- Documentos acessiveis via signed URLs
- Motoristas continuam editando seus proprios dados bancarios e documentos
- Master Admin continua vendo senhas (via Edge Functions)
- Cadastro de motorista continua funcionando

## O que VAI mudar (melhoria)

- Senhas de gerentes nao serao mais trafegadas no frontend na listagem
- Senha do motorista nao sera mais trafegada no frontend na listagem do admin
- Senha da unidade nao sera mais trafegada ao listar unidades

