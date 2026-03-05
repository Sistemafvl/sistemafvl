

## Correção — Amarelo confiável no 3º bipe (não no 2º)

### Problema atual
O amarelo foi movido para o 2º bipe, mas isso marca TBRs bipados acidentalmente 2x, o que acontece com frequência. O correto é o 3º bipe.

### Problema original (por que o 3º bipe falhava)
O `count` é calculado contando ocorrências do código no estado local (`tbrs[rideId]`). Mas no 2º bipe, a duplicata temporária é removida após 1s de timeout. Se o 3º bipe chegar **depois** desse 1s, o estado local só tem 1 ocorrência, então `count === 1` (2º bipe) em vez de `count >= 2` (3º bipe). O amarelo nunca é aplicado.

### Solução
Usar um **ref persistente** (`scanCountsRef`) que conta quantas vezes cada código foi bipado na sessão, independente do estado local. Isso elimina a dependência do timing dos timeouts.

### Mudanças em `ConferenciaCarregamentoPage.tsx`

1. Criar `scanCountsRef = useRef<Record<string, Record<string, number>>>({})` — mapa `rideId → code → totalScans`
2. No início do `saveTbr`, incrementar `scanCountsRef.current[rideId][code]`
3. Usar `scanCountsRef` para determinar o branch:
   - `totalScans === 1` → 1º bipe: salvar normalmente
   - `totalScans === 2` → 2º bipe: marcar `_duplicate` temporário (vermelho 1s), bipe de erro, **sem amarelo**
   - `totalScans >= 3` → 3º bipe: marcar `highlight: "yellow"` no banco, limpar duplicatas, amarelo permanente
4. Reverter o branch `count === 1` para não salvar `highlight: "yellow"` — remover a linha `void supabase.from("ride_tbrs").update({ highlight: "yellow" }).eq("id", realEntry.id)` do bloco do 2º bipe
5. Resetar o contador do código quando o carregamento muda ou é finalizado

### Resultado
- 1º bipe: salva normal
- 2º bipe: aviso vermelho temporário (1s), sem persistência amarela
- 3º bipe: amarelo permanente garantido, independente do timing entre bipes
- Bipes acidentais (2x) não poluem a tela

