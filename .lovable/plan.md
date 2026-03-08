

## Plano: Corrigir loading dos cards de métricas na visão da unidade

### Problema
O `DashboardMetrics` e `DashboardInsights` substituem todo o conteúdo por um único spinner centralizado quando `loading=true`. Isso cria uma área cinza vazia que parece bugada -- especialmente na visão da unidade (não diretor).

### Solução
Em vez de retornar apenas um spinner, manter o layout dos cards visível e colocar spinners **dentro de cada card** individual.

### Mudanças

**1. `src/components/dashboard/DashboardMetrics.tsx`**
- Remover o early return com spinner (linhas 226-232)
- Nos 6 cards de KPI (Carregamentos, TBRs, PS, RTO, Insucessos, Carregando), renderizar `<Loader2 className="animate-spin" />` no lugar do valor quando `loading=true`
- Manter charts com spinner interno (já funciona assim com `chartLoading`)

**2. `src/components/dashboard/DashboardInsights.tsx`**
- Remover o early return com spinner
- Nos 4 cards de métricas (Média TBRs, Taxa Retorno, Tempo Médio, Dia Movimentado), renderizar spinner dentro do card quando `loading=true`
- Nos 3 cards de ranking (Top Motoristas, Ofensores, Conferentes), renderizar spinner dentro do card quando `loading=true`

### Resultado
Os cards mantêm seu layout e tamanho durante o carregamento, com spinners individuais girando em cada um até os dados reais aparecerem. Sem mais áreas cinzas vazias.

