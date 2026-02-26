

# Plano: Corrigir "respaldo" na animação de reordenação da fila

## Diagnóstico

O problema está na sequência de eventos em `handleMoveEntry` (linhas 225-244):

1. Animação CSS desliza os cards (300ms) ✅
2. `setAnimating(null)` — reseta a animação, cards voltam à posição original ❌
3. `fetchQueue()` — busca a nova ordem no banco (leva ~200-500ms) ❌

Entre os passos 2 e 3, os cards aparecem brevemente na posição antiga (o "respaldo"), porque a lista `entries` ainda não foi atualizada.

## Solução

Após a animação terminar, **trocar os itens localmente na lista `entries`** (atualização otimista) antes de resetar `animating`. Assim a ordem visual já reflete a troca imediatamente, sem esperar o banco. O `fetchQueue()` roda em background apenas para sincronizar.

**Arquivo:** `src/components/dashboard/QueuePanel.tsx`

**Alteração em `handleMoveEntry`** (linhas 232-244):
```typescript
// Wait for animation
await new Promise(r => setTimeout(r, 300));

// Optimistic local swap BEFORE resetting animation
setEntries(prev => {
  const newArr = [...prev];
  [newArr[idx], newArr[targetIdx]] = [newArr[targetIdx], newArr[idx]];
  return newArr;
});

// Now reset animation — local state already has correct order
setAnimating(null);

// DB update + background sync
const current = entries[idx];
const neighbor = entries[targetIdx];
await Promise.all([
  supabase.from("queue_entries").update({ joined_at: neighbor.joined_at }).eq("id", current.id),
  supabase.from("queue_entries").update({ joined_at: current.joined_at }).eq("id", neighbor.id),
]);
fetchQueue();
```

Nenhuma outra alteração. Layout, fluxo e estrutura permanecem iguais.

