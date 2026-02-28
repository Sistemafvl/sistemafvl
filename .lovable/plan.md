

## Plano: Eliminar limite de 1000 registros em todo o sistema

### Diagnóstico completo

Após analisar todos os arquivos, identifiquei **16 queries vulneráveis** ao limite de 1000 registros. Todas as queries de `ride_tbrs` já estão corrigidas com `fetchAllRows`. Porém, outras tabelas que acumulam dados ao longo do tempo (`piso_entries`, `ps_entries`, `rto_entries`, `dnr_entries`, `driver_rides`) ainda estão limitadas.

### Queries vulneráveis por arquivo

| Arquivo | Tabela(s) limitada(s) | Risco |
|---------|----------------------|-------|
| `OperacaoPage.tsx` L101-103 | piso_entries, ps_entries, rto_entries `.in("ride_id")` | Alto |
| `CiclosPage.tsx` L90-92 | piso_entries, ps_entries, rto_entries `.in("ride_id")` | Alto |
| `DriverHome.tsx` L68-70 | piso_entries, ps_entries, rto_entries `.in("ride_id")` | Médio |
| `DriverRides.tsx` L60-62 | piso_entries, ps_entries, rto_entries `.in("ride_id")` | Médio |
| `RelatoriosPage.tsx` L252-254 | piso_entries, ps_entries, rto_entries `.in("ride_id")` | Alto |
| `DashboardInsights.tsx` L136-139, 170-172 | piso/rto/ps_entries `.eq("unit_id")` + data | Médio |
| `DashboardInsights.tsx` L194 | driver_rides `.eq("unit_id")` | Médio |
| `MotoristasParceirosPage.tsx` L127-131 | driver_rides `.in("driver_id")` | Alto |
| `MatrizOcorrencias.tsx` L49-52 | ps/rto/piso/dnr_entries `.in("unit_id")` | Alto |
| `MatrizMotoristas.tsx` L45 | driver_rides `.in("unit_id")` | Alto |
| `MatrizFinanceiro.tsx` L39 | driver_rides `.in("unit_id")` | Alto |
| `DNRPage.tsx` L68-72 | dnr_entries `.eq("unit_id")` | Médio |
| `PSPage.tsx` L160-166 | ps_entries `.eq("unit_id")` + data | Médio |
| `RTOPage.tsx` L90-94 | rto_entries `.eq("unit_id")` | Médio |

### Estratégia

Usar `fetchAllRows` para todas as queries que buscam listas completas sem `.limit()`, `.maybeSingle()` ou `{ count: "exact", head: true }`. Queries que já usam `.limit(1)` ou `.maybeSingle()` estão seguras.

### Mudanças por arquivo

1. **`OperacaoPage.tsx`** — Envolver `piso_entries`, `ps_entries`, `rto_entries` com `fetchAllRows`

2. **`CiclosPage.tsx`** — Envolver `piso_entries`, `ps_entries`, `rto_entries` com `fetchAllRows`

3. **`DriverHome.tsx`** — Envolver `piso_entries`, `ps_entries`, `rto_entries` com `fetchAllRows`

4. **`DriverRides.tsx`** — Envolver `piso_entries`, `ps_entries`, `rto_entries` com `fetchAllRows`

5. **`RelatoriosPage.tsx`** — Envolver `piso_entries`, `ps_entries`, `rto_entries` com `fetchAllRows` (em todas as funções de relatório)

6. **`DashboardInsights.tsx`** — Envolver queries de retornos (`piso/ps/rto`) e `driver_rides` (fetchTopConferentes) com `fetchAllRows`

7. **`MotoristasParceirosPage.tsx`** — Envolver `driver_rides` com `fetchAllRows`

8. **`MatrizOcorrencias.tsx`** — Envolver todas as 4 queries (`ps/rto/piso/dnr_entries`) com `fetchAllRows`

9. **`MatrizMotoristas.tsx`** — Envolver `driver_rides` com `fetchAllRows`

10. **`MatrizFinanceiro.tsx`** — Envolver `driver_rides` com `fetchAllRows`

11. **`DNRPage.tsx`** — Envolver `dnr_entries` com `fetchAllRows`

12. **`PSPage.tsx`** — Envolver `ps_entries` com `fetchAllRows`

13. **`RTOPage.tsx`** — Envolver `rto_entries` com `fetchAllRows`

### Padrão de conversão

Antes:
```typescript
const { data } = await supabase.from("piso_entries").select("ride_id, tbr_code").in("ride_id", rideIds);
const pisoData = data ?? [];
```

Depois:
```typescript
const pisoData = await fetchAllRows<{ ride_id: string; tbr_code: string }>((from, to) =>
  supabase.from("piso_entries").select("ride_id, tbr_code").in("ride_id", rideIds).range(from, to)
);
```

### Nota técnica
- Queries com `.maybeSingle()`, `.single()`, `.limit(1)` ou `{ count: "exact", head: true }` NÃO precisam de paginação
- Queries de lookup (conferentes, drivers_public, unit_settings) têm baixo volume e não precisam de paginação
- O `fetchAllRows` já existe em `src/lib/supabase-helpers.ts` e será reutilizado

