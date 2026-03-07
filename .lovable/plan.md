

## Plano: Corrigir Timeline TBR — Remover eventos de ride de onde o TBR saiu + garantir visibilidade do novo carregamento

### Problema

Quando um TBR sai de um ride (Micheal) via insucesso e é re-carregado em outro (Sarah), a timeline mostra:
- "Carregamento Iniciado" e "Carregamento Finalizado" do Micheal — **incorreto**, pois são eventos do ride, não do TBR. O TBR já tinha saído dali.
- Os eventos do novo carregamento (Sarah) podem estar abaixo mas não ficam visíveis, ou o cabeçalho fica mostrando dados do Micheal.

### Correção

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

**1. Não gerar "Carregamento Iniciado" e "Carregamento Finalizado" para rides sintéticos (onde o TBR foi removido)**
- Na iteração dos `loadEvents` (linhas 257-292), os eventos `started` e `finished` só devem ser gerados quando `evt.isReal === true` (ou seja, o TBR ainda está naquele ride).
- Para rides sintéticos (`!evt.isReal`), manter apenas o evento "Origem/Re-carregado" que mostra que o TBR passou por ali.

**2. Garantir que o cabeçalho do modal mostre o ride mais recente REAL**
- Na lógica de `lastLoadEvent` (linha 424), filtrar apenas `loadEvents` onde `isReal === true` para pegar o ride atual (Sarah). Se não houver nenhum real, usar o último sintético como fallback.

### Resultado esperado

A timeline do TBR316774261 ficará:
```
10:39 — Origem: Conferência Carregamento (Micheal, Rota 0814)
10:39 — Status: Retorno Piso (Troca de motorista)
10:44 — Status: Piso Fechado
10:44 — Re-carregado: Conferência Carregamento (Sarah, Rota XXXX)
10:XX — Carregamento Iniciado (Sarah)
10:XX — Carregamento Finalizado (Sarah)
```

Cabeçalho: Motorista Sarah, com status do ride atual.

