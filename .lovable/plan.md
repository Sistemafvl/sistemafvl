

# Plano: Preservar conferente ao retornar carregamento

## Problema

A função `handleRetornar` (linha 523) faz update do `loading_status` para "loading" e `finished_at` para null, mas o `fetchRides()` subsequente recarrega todos os dados do banco. Se houver algum timing issue ou se o conferente não foi salvo corretamente, o dropdown pode voltar ao estado "não selecionado". Além disso, não há proteção explícita para garantir que o `conferente_id` não seja alterado durante o retorno.

## Correção

### 1. Garantir que `handleRetornar` nunca toque no `conferente_id`

Na linha 524, o update já não inclui `conferente_id`, mas vamos adicionar uma proteção explícita para manter o valor atual e adicionar `e.stopPropagation()` no botão para evitar propagação de eventos.

### 2. Adicionar o `rideId` ao `lockedConferenteIds` antes de retornar

Antes de executar o update, inserir o `rideId` no set de locks para que o dropdown permaneça travado durante todo o processo:

```typescript
const handleRetornar = async (rideId: string) => {
  // Preserve conferente lock during return
  setLockedConferenteIds((prev) => new Set(prev).add(rideId));
  await supabase.from("driver_rides")
    .update({ loading_status: "loading", finished_at: null } as any)
    .eq("id", rideId);
  await fetchRides();
};
```

### 3. Adicionar `stopPropagation` no botão Retornar

No JSX do botão (linha 1469), adicionar `e.stopPropagation()` para evitar que o clique propague e afete o conferente select.

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Lock conferente antes do retorno + stopPropagation no botão |

