

## Plano Expandido: Eliminar Limite de 1000 Rows em Todo o Sistema

### Problema
O banco retorna no máximo 1000 rows por query. O sistema inteiro usa `.data.length` ou `.data.filter()` em vez de contagens server-side ou paginação. Qualquer unidade com >1000 TBRs/dia terá dados errados.

### Solução: 2 abordagens combinadas

**A) RPC Functions no banco** — para contagens e agregações (evita trazer dados para o frontend)

**B) Helper de paginação** — para quando precisamos dos dados reais (lista de TBRs, etc.)

### Arquivos e mudanças

**1. Nova migration SQL** — criar 3 RPC functions:
- `get_unit_tbr_count(p_unit_id, p_start, p_end)` — conta TBRs escaneados da unidade no período (JOIN ride_tbrs + driver_rides)
- `get_top_drivers_by_tbrs(p_unit_id, p_since, p_until)` — ranking de motoristas por TBRs finalizados
- `get_ride_tbr_counts(p_ride_ids uuid[])` — retorna `ride_id, count` para um array de ride IDs (substitui buscar todos os TBRs só para contar)

**2. Helper de paginação** — `src/lib/supabase-helpers.ts`
- Função `fetchAllRows()` que faz loop com `.range()` até buscar todos os registros
- Usada em qualquer lugar que precise dos dados reais (não apenas contagem)

**3. Arquivos a corrigir:**

| Arquivo | Problema | Solução |
|---------|----------|---------|
| `DashboardMetrics.tsx` | `.data.filter()` limitado a 1000 | Usar RPC `get_unit_tbr_count` |
| `DashboardInsights.tsx` | `fetchTopDrivers` conta rides, não TBRs; queries sem limite | Usar RPC `get_top_drivers_by_tbrs` + paginação |
| `ConferenciaCarregamentoPage.tsx` | TBRs de rides truncados | Helper `fetchAllRows` |
| `RelatoriosPage.tsx` | 3 queries de TBRs truncadas (ranking, pagamento, resumo) | Helper `fetchAllRows` |
| `OperacaoPage.tsx` | TBRs por ride truncados | RPC `get_ride_tbr_counts` ou `fetchAllRows` |
| `CiclosPage.tsx` | Contagem de TBRs por ciclo truncada | RPC ou `fetchAllRows` |
| `DriverHome.tsx` | TBRs do motorista truncados | `fetchAllRows` |
| `DriverRides.tsx` | TBRs do motorista truncados | `fetchAllRows` |
| `MatrizOverview.tsx` | TBRs da matriz truncados | `fetchAllRows` |
| `MatrizMotoristas.tsx` | TBRs truncados | `fetchAllRows` |
| `MatrizFinanceiro.tsx` | TBRs truncados | `fetchAllRows` |
| `MatrizUnidades.tsx` | TBRs truncados | `fetchAllRows` |
| `FeedbacksPage.tsx` | TBRs truncados | `fetchAllRows` |

### Detalhes técnicos

**Helper `fetchAllRows`:**
```typescript
async function fetchAllRows<T>(query: SupabaseQuery): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await query.range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}
```

**RPC `get_unit_tbr_count`:**
```sql
CREATE FUNCTION get_unit_tbr_count(p_unit_id uuid, p_start timestamptz, p_end timestamptz)
RETURNS bigint AS $$
  SELECT COUNT(*) FROM ride_tbrs rt
  JOIN driver_rides dr ON dr.id = rt.ride_id
  WHERE dr.unit_id = p_unit_id
    AND rt.scanned_at >= p_start AND rt.scanned_at <= p_end
$$ LANGUAGE sql STABLE;
```

### Ordem de implementação
1. Migration SQL com as 3 RPC functions
2. Helper `fetchAllRows` em `src/lib/supabase-helpers.ts`
3. Corrigir os 13 arquivos listados, substituindo queries limitadas por RPC ou `fetchAllRows`

Isso elimina o limite de 1000 em **todo o sistema**, sem exceção.

