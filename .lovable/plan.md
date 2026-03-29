

## Plano: Corrigir contagem de Retornos no fechamento

### Problema

A lógica de "retornos líquidos" (linhas 683-699 de `RelatoriosPage.tsx`) tenta verificar se um TBR de retorno existia na última corrida verificando `rTbrs` (dados de `ride_tbrs`). Porém, o trigger `auto_remove_tbr_from_ride` já deletou esse registro quando o insucesso foi cadastrado. Resultado: `lastRideId` nunca é atribuído → retorno nunca é contado → sempre 0.

### Solução

Simplificar a lógica: se um código aparece em piso/ps/rto vinculado às corridas do dia **e** NÃO está mais em `ride_tbrs` (activeTbrCodes), ele É um retorno efetivo. Remover a verificação desnecessária do `lastRideId`.

### Implementação

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx` (linhas ~683-699)

Substituir:
```typescript
const netReturns = new Set<string>();
returnCodesForDay.forEach(codeUpper => {
  if (activeTbrCodes.has(codeUpper)) return;
  let lastRideId: string | null = null;
  for (const ride of sortedDayRides) {
    if (rTbrs.some((t: any) => t.ride_id === ride.id && t.code && t.code.toString().toUpperCase() === codeUpper)) {
      lastRideId = ride.id;
    }
  }
  if (lastRideId) {
    const hasReturnInLast = [...allPiso, ...allPs, ...allRto].some(
      (p: any) => p.ride_id === lastRideId && p.tbr_code && p.tbr_code.toString().toUpperCase() === codeUpper
    );
    if (hasReturnInLast) netReturns.add(codeUpper);
  }
});
```

Por:
```typescript
const netReturns = new Set<string>();
returnCodesForDay.forEach(codeUpper => {
  // Se o TBR ainda está na carga ativa, não é retorno efetivo
  if (activeTbrCodes.has(codeUpper)) return;
  // Se saiu da carga (trigger deletou) e tem registro de insucesso, é retorno
  netReturns.add(codeUpper);
});
```

A mesma lógica já garante a validação: `returnCodesForDay` só contém códigos com `ride_id` vinculado às corridas do dia, e `activeTbrCodes` exclui os que ainda estão no carregamento. Não precisa de verificação adicional.

### Arquivo alterado
- `src/pages/dashboard/RelatoriosPage.tsx`

