

## Problema

Quando um TBR é bipado, o fluxo atual é:
1. Item é adicionado ao estado local (aparece na lista)
2. `INSERT` é feito no banco
3. O canal Realtime detecta o INSERT e dispara `fetchRides()` após 1.5s de debounce
4. `fetchRides()` substitui TODO o estado local com dados do banco — o item **some** brevemente enquanto os dados são carregados, depois **volta**

O `realtimeLockUntil` só é usado ao **deletar** TBRs (lock de 8s), mas **não é usado ao inserir**. Por isso o Realtime interfere na inserção.

## Solução

Adicionar `realtimeLockUntil.current = Date.now() + 3000;` no `saveTbr`, logo antes do `setTbrs` otimista (linha ~810). Isso bloqueia o Realtime por 3 segundos após cada bipagem, impedindo que o `fetchRides()` sobrescreva o estado local enquanto a gravação ainda está sendo processada.

### Alteração única

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Na linha ~810, antes do `setTbrs`, adicionar:
```typescript
realtimeLockUntil.current = Date.now() + 3000;
```

Isso garante que a inserção otimista apareça instantaneamente e fique estável, sem piscar/sumir/voltar.

