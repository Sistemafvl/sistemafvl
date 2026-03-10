

# Plano: Corrigir cálculo do card Quinzena

## Problema raiz

A query da quinzena (e também a query principal de métricas) busca **todas** as `driver_rides` do período filtrando apenas por `completed_at`, sem filtrar por `loading_status`. Como `completed_at` tem valor `DEFAULT now()` no banco, **toda corrida criada** (inclusive `cancelled`, `pending`, `loading`) aparece na query.

Corridas canceladas ainda têm TBRs em `ride_tbrs` (o trigger só remove TBRs de insucesso, não de cancelamento), inflando massivamente o total.

## Correção

### `src/pages/driver/DriverHome.tsx`

**1. Query principal de rides (linha ~50-56):**
- Adicionar `.neq("loading_status", "cancelled")` para excluir corridas canceladas

**2. Query da quinzena (linhas ~307-314):**
- Adicionar `.neq("loading_status", "cancelled")` para excluir corridas canceladas

Ambas as queries passam de:
```
.eq("driver_id", driverId).eq("unit_id", unitId).gte("completed_at", start).lte("completed_at", end)
```
Para:
```
.eq("driver_id", driverId).eq("unit_id", unitId).gte("completed_at", start).lte("completed_at", end).neq("loading_status", "cancelled")
```

Isso garante que apenas corridas ativas (pending, loading, finished) sejam contabilizadas nos ganhos do motorista.

