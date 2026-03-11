

# Plano: Otimizações B, C e D (baixo risco)

## B. Consolidar queries do DashboardMetrics

**Arquivo:** `src/components/dashboard/DashboardMetrics.tsx`

Atualmente `fetchChartData` faz 4 queries separadas ao `driver_rides`:
1. Linha 99: `rides7` (completed_at) para bar chart
2. Linha 109-116: `unitRidesInRange` (id, completed_at) para line chart
3. Linha 140-147: `finishedRides` (driver_id, completed_at) para driver avg
4. Linha 151-158: `rideIdsList` (id, driver_id) para driver avg TBRs

**Solução:** Fazer 1 unica query `fetchAllRows` com `select("id, driver_id, completed_at, loading_status")` e derivar tudo no JS:
- `rides7` = todas as rides (para bar chart)
- `unitRidesInRange` = rides sem cancelled (para line chart TBRs)
- `finishedRides` + `rideIdsList` = rides com loading_status=finished (para driver avg)

**Economia:** ~3 queries por pageview do dashboard (~15 queries/dia)

## C. Debounce no InsucessoBalloon

**Arquivo:** `src/components/dashboard/InsucessoBalloon.tsx`

Atualmente cada INSERT em `ride_tbrs` e cada mudanca em `piso_entries` chama `fetchInsucessos()` imediatamente. Durante carregamento ativo, isso pode ser 50+ chamadas/hora.

**Solucao:** Adicionar um `useRef` com `setTimeout` de 15 segundos. Cada evento Realtime reseta o timer. Assim, durante bipagem continua, so faz 1 fetch a cada 15s em vez de 1 por bipe.

**Economia:** ~90% das queries Realtime do balloon

## D. Cachear query de media no Carregamento

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Atualmente o `useEffect` da linha 508 depende de `[unitId, rides]`. Como `rides` muda a cada evento Realtime (cada bipe), a query de 30 dias re-executa constantemente.

**Solucao:** Extrair os `driverIds` em um `useMemo` com stringify, e usar esse valor estavel como dependencia. Assim a query so re-executa quando a lista de motoristas muda (novo motorista entra), nao quando um TBR e bipado.

**Economia:** ~50+ queries/hora a menos durante operacao ativa

---

Nenhuma dessas mudancas altera fluxo operacional, dados exibidos ou comportamento de UI. Apenas reduzem frequencia de queries redundantes.

