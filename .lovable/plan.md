

# Plano de Implementacao - 7 Anexos

## Resumo

Este plano cobre 7 melhorias/correcoes distintas no sistema.

---

## 1. Funcionario com acesso completo a Fila e Programacao

**Problema:** O `QueuePanel` so aparece quando `managerSession` esta ativo (linha 41 de `DashboardLayout.tsx`).

**Solucao:**
- Em `DashboardLayout.tsx`, remover a condicao `{managerSession && <QueuePanel />}` e renderizar `<QueuePanel />` sempre.
- O `QueuePanel` ja possui toda a logica de aprovar, rejeitar, programar, mover e adicionar motoristas. Nao precisa de alteracao interna.

**Arquivos:** `src/components/dashboard/DashboardLayout.tsx`

---

## 2. Borda vermelha no botao da Fila (Anexo 1)

**Problema:** Quando ha motoristas na fila, o botao "Fila" nao tem indicacao visual de alerta alem do pulse.

**Solucao:**
- No `QueuePanel.tsx`, adicionar uma borda vermelha (`ring-2 ring-red-500`) ao botao quando `count > 0`, independentemente do pulse.

**Arquivos:** `src/components/dashboard/QueuePanel.tsx`

---

## 3. Travar dropdown de Conferente apos selecao (Anexo 2)

**Problema:** Na `ConferenciaCarregamentoPage.tsx` linha 1093, o `disabled` esta como `!!ride.conferente_id && !managerSession`. Isso funciona, mas o bug relatado sugere que nao esta travando imediatamente apos a selecao.

**Solucao:**
- Apos `handleSelectConferente`, a ride e re-buscada via `fetchRides()`. O estado atualizado com `conferente_id` preenchido vai desabilitar o Select para nao-gerentes.
- Adicionar atualizacao otimista: apos selecionar conferente, atualizar o estado local imediatamente (antes do `fetchRides`) para travar o dropdown instantaneamente.

**Arquivos:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

---

## 4. Corrigir exclusao de TBR (Anexo 3)

**Problema:** O botao X para excluir TBR nao esta funcionando corretamente - o item retorna a lista.

**Analise:** A funcao `handleDeleteTbr` (linha 418) faz:
1. Adiciona ao `deletingRef` para evitar duplo clique
2. Seta `skipRealtimeRef` para evitar que o Realtime reponha o item
3. Remove otimisticamente do estado
4. Deleta do banco
5. Chama `fetchRides()` que recarrega tudo

O problema e que o `fetchRides()` no final pode estar trazendo o TBR de volta antes do DELETE completar, ou o Realtime esta disparando antes do skip ser setado.

**Solucao:**
- Garantir que o `await supabase.from("ride_tbrs").delete()` complete ANTES de chamar `fetchRides()`.
- Adicionar um pequeno delay antes de resetar `skipRealtimeRef.current = false` para evitar race condition com Realtime.
- Verificar se o `delete` esta sendo executado corretamente (sem erros silenciosos).

**Arquivos:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

---

## 5. Otimizar velocidade de gravacao de TBR (Anexo 4)

**Problema:** A leitura do scanner grava TBR duplicado na mesma linha (ex: `TBR274690381TBR`), pois o debounce de 80ms nao e rapido o suficiente e o campo nao limpa instantaneamente.

**Solucao:**
- Reduzir debounce para 50ms
- Limpar o input IMEDIATAMENTE antes de qualquer operacao async (ja faz parcialmente, mas precisa ser sincrono)
- Adicionar um `processingRef` por ride que bloqueia novas entradas enquanto o TBR anterior esta sendo processado
- Usar `requestAnimationFrame` para garantir que o input limpe antes do proximo caractere do scanner entrar

**Arquivos:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

---

## 6. Corrigir alerta sonoro ao chamar motorista (Anexo 5)

**Problema:** O sino no card de carregamento atualiza `called_at` no banco, mas o som nao toca no lado do motorista.

**Analise:** O `DriverQueue.tsx` precisa ouvir mudancas em `queue_entries` via Realtime e, quando `called_at` mudar, tocar um alerta sonoro em loop.

**Solucao:**
- No componente do painel do motorista (`DriverQueue.tsx` ou `DriverHome.tsx`), adicionar listener Realtime para `queue_entries` do motorista
- Quando `called_at` for atualizado, iniciar audio em loop (usando Web Audio API ou `<audio>` com loop)
- Exibir toast persistente que o motorista precisa fechar manualmente para parar o som

**Arquivos:** `src/pages/driver/DriverQueue.tsx`

---

## 7. Criar modulo DNR (Anexo 6)

### 7.1 Banco de Dados

Criar tabela `dnr_entries`:

| Coluna | Tipo | Default |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| unit_id | uuid NOT NULL | - |
| tbr_code | text NOT NULL | - |
| driver_id | uuid | - |
| driver_name | text | - |
| car_model | text | - |
| car_plate | text | - |
| car_color | text | - |
| ride_id | uuid | - |
| route | text | - |
| login | text | - |
| conferente_name | text | - |
| loaded_at | timestamptz | - |
| dnr_value | numeric NOT NULL | 0 |
| observations | text | - |
| status | text NOT NULL | 'open' |
| created_by_name | text | - |
| approved_at | timestamptz | - |
| closed_at | timestamptz | - |
| created_at | timestamptz | now() |

Status: `open` -> `analyzing` (gerente aprova) -> `closed` (gerente finaliza)

RLS: SELECT/INSERT/UPDATE para todos (anon), DELETE para authenticated.
Habilitar Realtime.

### 7.2 Pagina DNR Funcionario (`src/pages/dashboard/DNRPage.tsx`)

- Formulario de registro:
  - Campo TBR code (ao digitar, busca historico do TBR automaticamente)
  - Exibe info do TBR: motorista, carro, placa, data carregamento, rota, conferente
  - Campo valor DNR (numerico)
  - Campo observacoes (textarea)
  - Botao "Registrar DNR" (status = 'open')
- Lista de DNRs da unidade com filtro por status

### 7.3 Pagina DNR Gerente

- Mesma rota `/dashboard/dnr`, mas quando `managerSession` esta ativo, exibe:
  - Lista de DNRs pendentes (status = 'open') com botao "Aprovar" (muda para 'analyzing')
  - Lista de DNRs em analise (status = 'analyzing') com botao "Finalizar" (muda para 'closed')
  - Historico completo

### 7.4 Pagina DNR Motorista (`src/pages/driver/DriverDNR.tsx`)

- Lista de DNRs do motorista com status = 'analyzing' (aprovados pelo gerente)
- Exibe: data do carregamento, dia, conferente, valor DNR, urgencia
- NAO exibe o codigo TBR

### 7.5 Cards na Visao Geral

**Motorista (DriverHome.tsx):** 2 cards apos "Media TBR" e "Total Retornos":
- "DNRs Abertos" com quantidade e valor total
- "DNRs Finalizados" com quantidade

**Unidade (DashboardHome.tsx):** 3 cards:
- "DNRs Abertos" com valor
- "DNRs Analisando" com valor
- "DNRs Finalizados"

### 7.6 Menu

- Adicionar "DNR" no `DashboardSidebar.tsx` (menu geral, visivel para todos)
- Adicionar "DNR" no `DriverSidebar.tsx`
- Registrar rotas em `App.tsx`

---

## Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabela `dnr_entries` + RLS + Realtime |
| `src/components/dashboard/DashboardLayout.tsx` | Remover condicao managerSession do QueuePanel |
| `src/components/dashboard/QueuePanel.tsx` | Borda vermelha quando count > 0 |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Fix conferente lock, fix TBR delete, otimizar scanner |
| `src/pages/driver/DriverQueue.tsx` | Alerta sonoro ao ser chamado |
| `src/pages/dashboard/DNRPage.tsx` | Novo - pagina DNR funcionario/gerente |
| `src/pages/driver/DriverDNR.tsx` | Novo - pagina DNR motorista |
| `src/pages/dashboard/DashboardHome.tsx` | Cards DNR na visao geral da unidade |
| `src/pages/driver/DriverHome.tsx` | Cards DNR na visao geral do motorista |
| `src/components/dashboard/DashboardSidebar.tsx` | Menu DNR |
| `src/components/dashboard/DriverSidebar.tsx` | Menu DNR |
| `src/App.tsx` | Rotas DNR |

