
Objetivo: corrigir a inversão “TBR Lido” antes de “Carregamento Iniciado” na timeline do rastreamento.

Diagnóstico (por que isso acontece)
- No `DashboardHome.tsx`, para o primeiro evento (`index === 0`), o código adiciona:
  1) `TBR Lido`
  2) depois `Carregamento Iniciado`
- Em muitos casos, ambos ficam com o mesmo timestamp (principalmente quando o evento é reconstruído/sintético).
- A ordenação final usa só `timestamp`; quando empata, a UI mantém a ordem de inserção e mostra “TBR Lido” antes de “Carregamento Iniciado”.

Plano de ajuste
1) Ajustar a construção dos eventos do primeiro carregamento
- No bloco `loadEvents.forEach`, para `index === 0`, criar primeiro o evento `Carregamento Iniciado` e depois `TBR Lido`.
- Manter o timestamp atual do início (sem mudar regra de negócio), apenas garantindo precedência visual/lógica.

2) Adicionar desempate de ordenação na timeline
- No `timeline.sort(...)`, além de comparar `timestamp`, aplicar prioridade quando horários forem iguais:
  - `Carregamento Iniciado` antes de `TBR Lido`
  - `TBR Lido` antes de `TBR Re-carregado`
  - manter demais eventos como estão (sem alterar comportamento atual).
- Isso evita regressão futura mesmo se a ordem de `push` mudar.

3) (Opcional recomendado) Melhorar legibilidade de horário
- Exibir segundos no horário (`dd/MM HH:mm:ss`) só no modal de rastreamento para reduzir sensação de “evento impossível” quando os minutos são iguais.

Arquivo afetado
- `src/pages/dashboard/DashboardHome.tsx`

Resultado esperado
- Para o mesmo TBR, a linha do tempo passa a aparecer como:
  - `Carregamento Iniciado` (Micheal)
  - `TBR Lido` (Micheal)
  - `Status: Retorno Piso`
  - `TBR Re-carregado` (Sarah)
  - `Carregamento Finalizado` (Sarah)
- Sem inversão lógica no topo da cronologia.
