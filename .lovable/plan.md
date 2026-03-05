

## Plano — 5 Correções e Melhorias

### 1. Amarelo permanente para TBRs bipados 3x+

**Problema**: Apenas 2 TBRs ficaram amarelos. O highlight só é aplicado no momento exato do 3º bipe, mas se o TBR já estava no banco com `highlight: "yellow"` de uma sessão anterior, ou se foi bipado 3x em sequência rápida com race condition, o amarelo não persiste para todos os casos.

**Causa**: Na renderização, `_yellowHighlight` é derivado de `t.highlight === "yellow"` no fetch. Porém, no fluxo de 3x bipe, o `count >= 2` depende de `occurrences` no estado local, que pode não refletir a realidade se o 2º bipe temporário já foi removido pelo timeout de 1s antes do 3º bipe chegar.

**Correção** em `ConferenciaCarregamentoPage.tsx`:
- No branch `count === 1` (2º bipe), além de marcar `_duplicate`, salvar no banco `highlight: "yellow"` imediatamente — pois o 2º bipe já confirma duplicata.
- Remover a dependência de um 3º bipe para o amarelo. Qualquer TBR bipado 2x ou mais fica amarelo permanente.
- No branch `count >= 2` (3x+), manter a lógica de limpar duplicatas mas garantir que o realEntry já tem highlight.

### 2. Inconsistência no Espelho na primeira geração

**Problema**: Na primeira vez que gera o Espelho com range de vários dias, os dados vêm errados. Na segunda vez, corrige.

**Causa**: O `fetchPayrollData` faz muitas queries paralelas com `fetchAllRows` e `.in("ride_id", rideIds)`. Quando `rideIds` é muito grande (100+), o `.in()` pode atingir limites de URL/query. Na segunda chamada, cache do browser/conexão reaproveita e funciona.

**Correção** em `RelatoriosPage.tsx`:
- Particionar `rideIds` em chunks de 50 ao usar `.in()` em `fetchAllRows`, concatenando os resultados.
- Criar helper `fetchInChunks` que divide arrays grandes para evitar truncamento silencioso.
- Aplicar em todas as queries que usam `.in("ride_id", rideIds)` no `fetchPayrollData`.

### 3. Campo de busca/filtro na Fila de Motoristas

**Correção** em `QueuePanel.tsx`:
- Adicionar `Input` de busca abaixo do header da Sheet, antes da lista.
- Filtrar `entries` por nome do motorista (case-insensitive, parcial).
- Manter contagem total no badge, filtrar apenas visualmente.

### 4. Toast animado quando motorista entra na fila

**Correção** em `QueuePanel.tsx`:
- No `fetchQueue`, ao detectar novos motoristas (comparar IDs anteriores vs atuais), disparar toast customizado.
- Renderizar toasts como mini-cards acima do botão "Fila" (position: fixed, bottom + offset).
- Animação: slide-up + fade-in, empilhamento vertical, auto-dismiss em 5s.
- Componente interno `QueueToast` com estado de pilha.

### 5. Timeline do Rastreamento TBR incompleta

**Problema**: Quando o `ride_tbr` é deletado pelo trigger de insucesso, a timeline perde o evento de carregamento.

**Correção** em `DashboardHome.tsx`:
- Além de buscar `ride_tbrs`, reconstruir eventos de carregamento a partir de `piso_entries` e `ps_entries` que possuem `ride_id`.
- Para cada `piso/ps/rto_entry` com `ride_id`, buscar a `driver_ride` correspondente e verificar se já existe um evento de `ride_tbrs` para aquele ride+code.
- Se não existir (foi deletado pelo trigger), criar um evento sintético "Conferência Carregamento" com timestamp anterior ao do insucesso.
- Buscar driver_rides por IDs coletados de piso/ps/rto entries para obter motorista, rota, etc.

### Arquivos afetados
1. `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` — amarelo no 2º bipe
2. `src/pages/dashboard/RelatoriosPage.tsx` — chunked queries
3. `src/components/dashboard/QueuePanel.tsx` — busca + toast animado
4. `src/pages/dashboard/DashboardHome.tsx` — timeline reconstituída

