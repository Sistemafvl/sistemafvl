
Objetivo: corrigir a tela de Ciclos para parar de mostrar 3843 e passar a usar a mesma lógica oficial da Visão Geral (3782 no seu exemplo), além de manter “Insucesso” separado.

Diagnóstico rápido
- Hoje `src/pages/dashboard/CiclosPage.tsx` calcula:
  - `totalTbrs = ride_tbrs` (ativos)
  - `totalReturns = retornos únicos por ride` (piso/ps/rto), sem a deduplicação global da RPC
  - Exibe `totalTbrs + totalReturns` em vários pontos.
- Por isso aparece 3843 (3683 + 160).
- A Visão Geral usa `get_unit_tbr_count`, que retorna 3782 no mesmo período/unidade.
- Então Ciclos está com fórmula local diferente da fórmula canônica.

Plano de implementação
1) Alinhar Ciclos com a contagem canônica
- Em `computeMetrics`, chamar `supabase.rpc("get_unit_tbr_count", { p_unit_id, p_start, p_end })`.
- Criar no `DayMetrics` um campo explícito (ex.: `totalScanned`) com esse valor.
- Manter `totalTbrs` (ativos) para cálculos operacionais internos.

2) Substituir todos os pontos que ainda usam soma local
- Trocar `metrics.totalTbrs + metrics.totalReturns` por `metrics.totalScanned` em:
  - “Qtd Pacotes (TBRs do dia)” (formulário)
  - “Total TBRs Lidos” (modal relatório)
  - “Qtd Pacotes (TBRs)” (bloco de informações complementares no modal)
  - DeltaBadge desse card (comparação com dia anterior)

3) Ajustar fórmula de performance no Ciclos
- Atualizar `taxaConclusao` para:
  - `metrics.totalScanned > 0 ? (metrics.totalTbrs / metrics.totalScanned) * 100 : 0`
- Isso evita usar uma base inflada por retorno duplicado entre rides.

4) Corrigir persistência do campo automático “Qtd Pacotes”
- Garantir que `qtd_pacotes` salvo em `cycle_records` seja o valor automático canônico (`metrics.totalScanned`) e não valor legado.
- Assim o campo “Diferença (VRID - Qtd Pacotes)” no relatório passa a refletir o número correto.

5) Ajustar textos para evitar ambiguidade
- Tooltip de “Qtd Pacotes / Total TBRs Lidos” deixando claro:
  - é total único processado do dia (mesma regra da Visão Geral),
  - não é soma manual com “insucessos abertos”.

Arquivo afetado
- `src/pages/dashboard/CiclosPage.tsx`

Critérios de aceite
- No mesmo dia/unidade, “Qtd Pacotes” em Ciclos = “TBRs escaneados” da Visão Geral.
- Exemplo esperado no seu cenário: Ciclos mostra 3782 (não 3843).
- Insucessos continuam separados pela regra “somente abertos” (93), sem inflar o total de pacotes.
- Modal e bloco de informações complementares exibem o mesmo número canônico.
