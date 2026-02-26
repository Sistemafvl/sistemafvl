

# Plano: Auto-scroll para o último TBR bipado

## Problema

O `scrollTbrList` é chamado na linha 716 com `setTimeout` de 50ms, e internamente tem outro `setTimeout` de 100ms (total ~150ms). Porém, o React pode ainda não ter renderizado o novo item no DOM nesse momento, fazendo com que `scrollHeight` ainda reflita o estado anterior.

## Correção

1. Aumentar o timeout interno de `scrollTbrList` de 100ms para 200ms para garantir que o React já renderizou o novo TBR
2. Adicionar `behavior: 'smooth'` para uma rolagem mais fluida
3. Usar `scrollIntoView` no último elemento filho para maior precisão

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Ajustar `scrollTbrList` para scroll confiável ao último item |

