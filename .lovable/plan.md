

# Limitar gráficos da Visão Geral a 15 dias

## Problema
Os três cards/gráficos (Carregamentos, TBRs escaneados, Média diária por motorista) usam por padrão os últimos 30 dias (`effectiveEnd.getDate() - 29` na linha 93 de `DashboardMetrics.tsx`).

## Solução

### `src/components/dashboard/DashboardMetrics.tsx`
- Linha 93: alterar `- 29` para `- 14` no cálculo de `effectiveStart`, fazendo o range padrão ser de 15 dias em vez de 30.

Apenas uma linha muda. Quando o usuário selecionar datas manualmente, o filtro customizado continua funcionando normalmente.

