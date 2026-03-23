

# Correção da inconsistência nos dados de ciclos após chamada

## Problema

Após uma chamada de motorista (10s), os valores de TBRs nos cards de ciclo mudam de forma inconsistente (ex: 2050 → 1976). Causa: quando o call overlay termina (linha 353), apenas `fetchRightData()` é chamado — o `fetchSidebarData()` NÃO é re-executado. Os dados dos ciclos ficam congelados no valor do último poll (30s), e quando o próximo poll ocorre, pode retornar valores diferentes se houve mudança nos dados durante esse intervalo.

## Correção

### Arquivo: `src/pages/dashboard/CallingPanelPage.tsx`

1. **Chamar `fetchSidebarData()` ao fim da chamada**: No `setTimeout` da linha 353, adicionar `fetchSidebarData()` junto com `fetchRightData()` para que os ciclos sejam atualizados imediatamente após o overlay fechar.

2. **Evitar re-fetch durante o overlay**: Adicionar um guard `showCall` no `fetchSidebarData` para não rodar o poll enquanto o overlay está ativo, evitando que dados parciais de uma chamada em andamento contaminem os contadores.

Correção mínima e cirúrgica — apenas adicionar a chamada `fetchSidebarData()` no callback de fim do timer.

