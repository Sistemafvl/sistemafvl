

## Plano: Detecção Instantânea de TBR Duplicado

### Problema Identificado
Ao bipar um TBR que já existe na lista, a detecção de duplicata só acontece **depois** que o item passa pela fila de processamento (`processQueue`). Como o primeiro scan pode estar ainda processando (com várias consultas ao banco: PS check, TBR anterior, piso entries, insert), o re-scan fica preso na fila esperando. O resultado: parece que "não faz nada" até o segundo re-scan.

### Solução
Mover a detecção de duplicata para **antes** da fila de processamento. Se o código já existe no `processedCodesRef` ou no estado local `tbrs`, a resposta (beep + flash vermelho) deve ser **imediata e síncrona**, sem entrar na fila.

---

### Alterações

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**1. Criar função `handleDuplicateInstant` (síncrona, sem await):**
- Verifica se o código já existe em `processedCodesRef[rideId]` ou em `tbrs[rideId]`
- Se sim: incrementa `scanCountsRef`, toca `playErrorBeep()`, adiciona TBR temporário com `_duplicate: true`, remove após 1s
- Se `scanCountsRef >= 3`: marca o original como amarelo (yellow highlight) no banco
- Retorna `true` se era duplicata (para não entrar na fila)
- Retorna `false` se é código novo (segue para a fila normal)

**2. Modificar `handleTbrInputChange` (scanner mode, ~linha 1186):**
- Antes de enfileirar no `queueRef`, chamar `handleDuplicateInstant(rideId, code)`
- Se retornar `true`: limpa input, foca, e **não** adiciona à fila
- Se retornar `false`: segue o fluxo normal (enfileira)

**3. Modificar `handleTbrKeyDown` (modo manual, ~linha 1200):**
- Mesma lógica: antes de chamar `saveTbr`, verifica `handleDuplicateInstant`

**4. Na função `saveTbr` existente:**
- Manter a lógica atual para novos TBRs (totalScans === 1)
- A lógica de totalScans === 2 e >= 3 pode ser simplificada pois agora é tratada antes

### Resultado Esperado
- Bipar um TBR que já existe → **resposta instantânea** (< 50ms): beep de erro + flash vermelho
- Não depende de consultas ao banco para duplicatas
- Novos TBRs continuam passando pela fila com todas as validações

