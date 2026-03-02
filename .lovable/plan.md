

## Problema Identificado

A página Master Admin (`AdminOverviewPage.tsx`) tem **todas as queries limitadas a 1000 registros** pelo limite padrão do Supabase. Isso afeta diretamente os cards:

| Query | Impacto |
|-------|---------|
| `driver_rides` (linha 55) | Card "Carregamentos" mostra no máximo 1000 |
| `ride_tbrs` (linha 82) | Card "TBRs Escaneados" mostra no máximo 1000, **sem filtro de data/unidade** |
| `ps_entries` (linha 56) | Card "PS" limitado a 1000 |
| `rto_entries` (linha 57) | Card "RTO" limitado a 1000 |
| `piso_entries` (linha 58) | Card "Retorno Piso" limitado a 1000 |
| `unit_reviews` (linha 59) | Card "Média Avaliações" limitado |
| `drivers_public` (linha 80) | Card "Motoristas Ativos" limitado |
| `user_profiles` (linha 81) | Card "Conferentes Ativos" limitado |

Além disso, a query de `ride_tbrs` (linha 82) **não filtra por data nem unidade** — busca TODOS os TBRs do banco e depois filtra no client. Isso é ineficiente e incorreto.

## Solução

Usar `fetchAllRows` e `fetchAllRowsWithIn` do `supabase-helpers.ts` para todas as queries, e corrigir a busca de TBRs para filtrar corretamente:

1. **Rides, PS, RTO, Piso, Reviews**: Usar `fetchAllRows` com paginação `.range()` para ultrapassar o limite de 1000
2. **TBRs**: Após obter os ride IDs, usar `fetchAllRowsWithIn` para buscar TBRs apenas das rides filtradas (com chunking e paginação)
3. **Drivers e Conferentes**: Usar `fetchAllRows` para garantir lista completa
4. Manter a mesma estrutura de KPIs e gráficos — apenas corrigir a fonte de dados

### Arquivo afetado
- `src/pages/admin/AdminOverviewPage.tsx`

