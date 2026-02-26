

# Plano: Leitura e gravação ultra-rápida de TBRs

## Problema

Quando o scanner lê dois códigos em sequência rápida (< 2s), o segundo é descartado porque `processingRef` bloqueia o input enquanto o `saveTbr` executa múltiplas queries sequenciais no banco (verificar TBRs anteriores, fechar piso, fechar RTO, inserir). Todo esse processamento leva ~1-2s, bloqueando a próxima leitura.

## Solução: Fila de processamento assíncrona

Em vez de bloquear o input, implementar uma **fila (queue)** por ride que:
1. Captura o código imediatamente e limpa o input
2. Adiciona o código à fila
3. Processa a fila em background, um por vez
4. O input nunca fica bloqueado — aceita o próximo código enquanto o anterior está sendo processado

## Alterações em `ConferenciaCarregamentoPage.tsx`

**Remover:** `processingRef` como mecanismo de bloqueio de input

**Adicionar:**
- `queueRef = useRef<Record<string, string[]>>({})` — fila de códigos por ride
- `processingQueueRef = useRef<Record<string, boolean>>({})` — flag indicando se a fila está sendo processada
- Função `processQueue(rideId)` que consome a fila sequencialmente, chamando `saveTbr` para cada código
- Atualização otimista imediata: ao entrar na fila, o TBR já aparece na lista (com estado "pendente") antes mesmo de salvar no banco

**Fluxo do scanner (debounce 50ms):**
1. Código chega → limpa input imediatamente → adiciona à fila
2. Se `processQueue` não está rodando para esse ride, inicia
3. `processQueue` consome códigos um a um, chamando `saveTbr`
4. Enquanto processa, novos códigos continuam entrando na fila

**Otimização adicional no `saveTbr`:**
- Executar queries independentes em paralelo (`Promise.all`) onde possível: fechar `piso_entries` e `rto_entries` simultaneamente
- Reduzir o número de awaits sequenciais

## Resumo

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Substituir `processingRef` por sistema de fila; paralelizar queries no `saveTbr` |

