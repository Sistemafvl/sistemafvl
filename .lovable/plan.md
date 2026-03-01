

## Plano: Adicionar polling de 5 segundos para os cards de carregamento

### Problema
Novos carregamentos criados (ex: pelo fluxo da fila) nem sempre aparecem instantaneamente via Realtime, exigindo refresh manual da pagina.

### Solucao
Adicionar um `useEffect` com `setInterval` de 5 segundos que chama `fetchRides()` como fallback, similar ao que ja existe no `QueuePanel`. O intervalo respeita o `realtimeLockUntil` para nao conflitar com operacoes otimistas.

### Alteracao

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Apos a linha 567 (`useEffect(() => { fetchRides(); }, [fetchRides]);`), adicionar:

```typescript
// Polling fallback: refresh rides every 5 seconds as safety net
useEffect(() => {
  const interval = setInterval(() => {
    if (Date.now() < realtimeLockUntil.current) return;
    fetchRides();
  }, 5000);
  return () => clearInterval(interval);
}, [fetchRides]);
```

Isso garante que mesmo se o Realtime falhar ou atrasar, os cards aparecerao em no maximo 5 segundos.

