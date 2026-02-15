

# Resumo das alteracoes

**Arquivo:** `src/pages/dashboard/OperacaoPage.tsx`

**1. Mini-cards dentro de cada card de motorista**

Adicionar 4 mini-cards na parte inferior de cada quadrante do motorista (dentro do mesmo card):

- **Total Ganho** — valor em R$ que o motorista ganhou naquele carregamento (TBRs concluidos x valor do TBR configurado)
- **Media/TBR** — valor medio ganho por TBR
- **Performance** — percentual de conclusao (TBRs entregues vs total)
- **Tempo** — duracao do carregamento (horario inicio ate fim)

**2. Correcao do bug de contagem**

Quando um TBR retorna ao piso e sai com outro motorista, o retorno deixa de ser descontado do motorista original (ex: mostra 5/5 em vez de 4/5). A correcao remove o filtro de status das queries de retorno, garantindo que o desconto permaneca mesmo apos o piso ser fechado.

