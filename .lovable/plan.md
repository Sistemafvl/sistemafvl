

# Plano: Leitura ultra-rápida de TBRs - corrigir stale state e reduzir latência

## Problema identificado

Analisando os network requests do teste:
- TBR4567819 e TBR4567849 foram escaneados anteriormente com ~600ms de diferença (ok)
- TBR4567834 e TBR4567896 foram processados no mesmo segundo (19:49:13) -- a fila funcionou e ambos foram gravados

Porém, o problema principal é que `saveTbr` lê `tbrs[rideId]` do **state React** (linha 615-616) para verificar duplicatas. Quando a fila processa 2 códigos seguidos, o segundo item lê o state **antes** do `setTbrs` do primeiro ter sido aplicado, causando:
1. O segundo TBR não vê o primeiro na lista de duplicatas
2. Possíveis gravações duplicadas ou erros de "mesmo TBR"

Além disso, cada `saveTbr` faz até 4 queries sequenciais ao banco antes de inserir, adicionando ~500ms-1s de latência por item.

## Solução

### 1. Usar ref para tracking de códigos processados (evitar stale state)

Criar `processedCodesRef = useRef<Record<string, Set<string>>>({})` que é atualizado **sincronamente** dentro da fila, antes mesmo do `setTbrs` assíncrono do React. Assim, o segundo TBR na fila consegue ver imediatamente que o primeiro já foi processado.

### 2. Reduzir debounce de 50ms para 20ms

Scanners enviam o código completo de uma vez. 20ms é suficiente para capturar o input completo.

### 3. Paralelizar queries iniciais no saveTbr

As queries de verificação (check previous TBRs) e fechamento (piso/rto) podem ser otimizadas usando `Promise.all` onde possível.

## Alterações em `ConferenciaCarregamentoPage.tsx`

1. Adicionar `processedCodesRef` que mantém um Set de códigos já enfileirados/processados por ride
2. No `handleTbrInputChange`, verificar duplicata via ref **antes** de enfileirar
3. Na `processQueue`, após processar cada código, atualizar o ref
4. No `saveTbr`, usar o ref em vez de `tbrs[rideId]` para contagem de ocorrências
5. Reduzir debounce para 20ms

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Adicionar `processedCodesRef` para tracking síncrono; reduzir debounce; verificar duplicatas via ref |

