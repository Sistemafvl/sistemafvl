

## Plano: Contador de 5s para refresh da fila

### Problema
O Realtime nem sempre entrega o evento instantaneamente, causando casos onde um motorista entra na fila e não aparece até atualizar a página.

### Solução
Adicionar um `setInterval` de 5 segundos no `QueuePanel.tsx` que chama `fetchQueue()` automaticamente, como fallback ao Realtime.

### Mudança

**Arquivo:** `src/components/dashboard/QueuePanel.tsx`

Adicionar um `useEffect` com intervalo de 5s:

```typescript
// Polling fallback — refresh queue every 5 seconds
useEffect(() => {
  const interval = setInterval(() => {
    fetchQueue();
  }, 5000);
  return () => clearInterval(interval);
}, [fetchQueue]);
```

Inserido logo após o `useEffect` do Realtime (linha ~154). Sem mudanças visuais — apenas um refresh silencioso dos dados da fila a cada 5 segundos.

