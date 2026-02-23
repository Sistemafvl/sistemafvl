
# Plano de Correção - Numeração, Duplicação e Cancelamentos

## Problemas Identificados

### 1. Numeração sequencial incorreta (começa em #3 ao invés de #1)
A edge function `create-ride-with-login` calcula o `sequence_number` contando TODOS os carregamentos do dia, incluindo cancelados. Quando existem carregamentos cancelados anteriores, o próximo carregamento recebe um número inflado (ex: 2 cancelados + 1 novo = #3).

### 2. Duplicação de cards e numeração repetida (#2 e #2)
O mesmo problema da contagem: como cancelados são incluidos na contagem, a numeração pula ou repete dependendo da ordem de criação.

### 3. Card "Carregamentos hoje" conta cancelados
Na Visao Geral (`DashboardMetrics.tsx`), o contador de carregamentos do dia usa `count: "exact"` sem filtrar `loading_status != 'cancelled'`.

### 4. Conferente ainda selecionavel após cancelamento
O select do conferente nao esta sendo travado quando o carregamento esta cancelado.

---

## Correções Planejadas

### A. Edge Function `create-ride-with-login/index.ts`
Alterar a query de contagem para excluir carregamentos cancelados:

```text
Antes:
  .eq("unit_id", unit_id)
  .gte("completed_at", today.toISOString())

Depois:
  .eq("unit_id", unit_id)
  .gte("completed_at", today.toISOString())
  .neq("loading_status", "cancelled")
```

### B. `DashboardMetrics.tsx` - Contador de carregamentos hoje
Adicionar filtro `.neq("loading_status", "cancelled")` na query que conta os carregamentos do dia (linha 89).

### C. `ConferenciaCarregamentoPage.tsx` - Conferente travado em cancelados
Na seção do conferente (linha ~1304), adicionar `isCancelled` como condição para travar o select, impedindo seleção quando o carregamento esta cancelado.

### D. Resequenciar carregamentos existentes
Nao sera necessaria migração. Os carregamentos futuros ja terao a numeração correta. Para os carregamentos existentes com numeração errada, os cards exibirao o `sequence_number` armazenado - se desejar corrigir, sera feito manualmente.

---

## Detalhes Tecnicos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/create-ride-with-login/index.ts` | Filtrar `cancelled` na contagem do sequence_number |
| `src/components/dashboard/DashboardMetrics.tsx` | Filtrar `cancelled` no todayRides |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Travar conferente quando `isCancelled` |

Todas as alterações sao cirurgicas e nao afetam layouts ou estruturas existentes.
