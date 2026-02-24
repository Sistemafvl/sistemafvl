
# Correcao: Contagem Duplicada de TBRs na Folha de Pagamento

## Problema Identificado

Na geracao da folha de pagamento, o sistema conta TBRs por dia usando `rTbrs.length` (total de entradas em `ride_tbrs`). Quando um pacote retorna e sai novamente no mesmo dia, ele e escaneado duas vezes (uma por corrida), inflando a contagem.

**Exemplo do dia 23/02 - Vitoria Santana:**
- Corrida 1: 9 TBRs escaneados, 1 retornou (8 concluidos)
- Corrida 2: 1 TBR escaneado (o que retornou), 0 retornos (1 concluido)
- `rTbrs.length` = 9 + 1 = **10** (ERRADO)
- Correto: 9 TBRs unicos, 9 concluidos (o retorno foi resolvido)

## Causa Raiz

Duas falhas no calculo por dia (linhas 371-378 de `RelatoriosPage.tsx`):

1. **tbrCount usa contagem bruta** em vez de codigos unicos
2. **Retornos nao consideram re-tentativas**: um TBR que retornou mas saiu novamente com sucesso ainda e contado como retorno

## Solucao

Alterar a logica de calculo por dia para:

1. Contar TBRs unicos por dia usando `Set` de codigos
2. Para retornos, verificar se o TBR foi re-entregue em uma corrida posterior no mesmo dia. Se sim, nao contar como retorno (retorno liquido)

**Arquivo**: `src/pages/dashboard/RelatoriosPage.tsx` (linhas 371-378)

## Detalhes Tecnicos

### Logica atual (com bug)

```typescript
const rTbrs = allTbrs.filter(t => info.rideIds.includes(t.ride_id));
const returnTbrSet = new Set<string>();
[...allPiso, ...allPs, ...allRto].forEach((p: any) => {
  if (p.ride_id && info.rideIds.includes(p.ride_id) && p.tbr_code) returnTbrSet.add(p.tbr_code);
});
return { tbrCount: rTbrs.length, returns: returnTbrSet.size, ... };
```

### Logica corrigida

```typescript
const rTbrs = allTbrs.filter(t => info.rideIds.includes(t.ride_id));
// 1. Contar TBRs unicos por codigo
const uniqueTbrCodes = new Set(rTbrs.map((t: any) => t.code));

// 2. Coletar codigos que retornaram
const returnCodesForDay = new Set<string>();
[...allPiso, ...allPs, ...allRto].forEach((p: any) => {
  if (p.ride_id && info.rideIds.includes(p.ride_id) && p.tbr_code) {
    returnCodesForDay.add(p.tbr_code);
  }
});

// 3. Calcular retornos liquidos (excluir re-tentativas bem-sucedidas)
// Ordenar corridas do dia por horario
const sortedDayRides = driverRides
  .filter(r => info.rideIds.includes(r.id))
  .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime());

const netReturns = new Set<string>();
returnCodesForDay.forEach(code => {
  // Encontrar a ultima corrida onde esse codigo aparece
  let lastRideId: string | null = null;
  for (const ride of sortedDayRides) {
    if (rTbrs.some((t: any) => t.ride_id === ride.id && t.code === code)) {
      lastRideId = ride.id;
    }
  }
  // Se o codigo tem retorno na sua ultima corrida do dia, e retorno liquido
  if (lastRideId) {
    const hasReturnInLast = [...allPiso, ...allPs, ...allRto].some(
      (p: any) => p.ride_id === lastRideId && p.tbr_code === code
    );
    if (hasReturnInLast) netReturns.add(code);
  }
});

return {
  date,
  login: info.login,
  tbrCount: uniqueTbrCodes.size,     // 9 (nao 10)
  returns: netReturns.size,           // 0 (o retorno foi resolvido)
  value: (uniqueTbrCodes.size - netReturns.size) * tbrVal  // 9 * 2.20 = 19.80
};
```

### Resultado esperado para Vitoria no dia 23/02

| Antes (errado) | Depois (correto) |
|---|---|
| tbrCount = 10 | tbrCount = 9 |
| returns = 1 | returns = 0 (re-tentativa bem-sucedida) |
| concluidos = 9 | concluidos = 9 |
| valor = 9 x R$2,20 = R$19,80 | valor = 9 x R$2,20 = R$19,80 |

O valor final coincide neste caso, mas a contagem de TBRs (70 total) e retornos (9 total) no cabecalho tambem serao corrigidos, pois sao somados a partir dos dados diarios.

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/RelatoriosPage.tsx` | Deduplicar TBRs por codigo e calcular retornos liquidos por dia |
