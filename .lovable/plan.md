

# Correção Definitiva: Sequência de Carregamento

## Causa Raiz

A edge function usa `COUNT` (quantidade) de corridas não-canceladas no dia para calcular a sequência. O problema:

1. Os carregamentos #4 e #5 já existiam com números inflados (bug antigo do timezone, já corrigido)
2. O `COUNT` retorna 2 (quantidade de corridas não-canceladas hoje)
3. Novo carregamento recebe `2 + 1 = #3`, que é MENOR que os existentes

Isso acontece porque `COUNT` não considera os números de sequência já atribuídos — apenas conta quantos registros existem.

## Solução

Trocar `COUNT` por `MAX(sequence_number)` na edge function. Assim:

- Se existem #4 e #5 → MAX = 5 → próximo = #6
- Se não existe nenhum → MAX = null → próximo = #1
- Cancelados são excluídos do MAX, então a sequência "pula" corretamente

Adicionalmente, corrigir os registros de hoje no banco (one-time fix):
- #4 → #1, #5 → #2, novo #3 → #3 (fica correto)

## Detalhes Técnicos

### Arquivo: `supabase/functions/create-ride-with-login/index.ts`

Substituir a query de COUNT por uma query que busca o MAX do sequence_number:

```typescript
// ANTES: COUNT (ignora números existentes)
const { count } = await supabase
  .from("driver_rides")
  .select("*", { count: "exact", head: true })
  .eq("unit_id", unit_id)
  .gte("completed_at", todayStart)
  .neq("loading_status", "cancelled");
const sequenceNumber = (count ?? 0) + 1;

// DEPOIS: MAX (respeita sequência existente)
const { data: maxData } = await supabase
  .from("driver_rides")
  .select("sequence_number")
  .eq("unit_id", unit_id)
  .gte("completed_at", todayStart)
  .neq("loading_status", "cancelled")
  .order("sequence_number", { ascending: false })
  .limit(1)
  .maybeSingle();
const sequenceNumber = (maxData?.sequence_number ?? 0) + 1;
```

### Correção pontual dos dados de hoje (migração SQL)

Renumerar os carregamentos de hoje na ordem correta de criação, excluindo cancelados.

## Resultado Esperado

| Cenário | Antes (COUNT) | Depois (MAX) |
|---|---|---|
| Existem #4, #5 (antigos) | Próximo = #3 | Próximo = #6 |
| Dia novo, sem corridas | Próximo = #1 | Próximo = #1 |
| #1, #2, #3(cancelado) | Próximo = #3 | Próximo = #3 |

## Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/create-ride-with-login/index.ts` | Trocar COUNT por MAX(sequence_number) |
| Migração SQL (one-time) | Renumerar corridas de hoje na ordem correta |

