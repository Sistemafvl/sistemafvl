
# Correcao: Sincronizar Numeros do Dashboard do Motorista com a Folha de Pagamento

## Problema

O dashboard do motorista (DriverHome) e a folha de pagamento (RelatoriosPage) usam logicas diferentes para calcular TBRs e retornos, gerando numeros inconsistentes.

**Vitoria Santana (01/02 - 23/02):**

| Metrica | Folha de Pagamento | Dashboard Motorista |
|---|---|---|
| TBRs | 69 | 70 |
| Retornos | 8 | 9 |
| Valor | R$ 184,20 | R$ 184,20 |

**Ricardo Brito (01/02 - 23/02):**

| Metrica | Folha de Pagamento | Dashboard Motorista |
|---|---|---|
| TBRs | 87 | 91 |
| Retornos | 13 | 15 |
| Valor | R$ 247,90 | R$ 254,60 |

## Causa Raiz

Duas diferencas no codigo do dashboard do motorista (`DriverHome.tsx`):

1. **Query incompleta**: A query de `ride_tbrs` seleciona apenas `id, ride_id` (linha 65), sem o campo `code`. Sem o campo `code`, nao e possivel deduplicar TBRs que aparecem em multiplas corridas no mesmo dia.

2. **Contagem bruta**: Usa `tbrs.length` (linha 110) em vez de contar codigos unicos. Se um pacote sai em 2 corridas no mesmo dia, e contado 2 vezes.

3. **Sem logica de retornos liquidos**: Conta retornos unicos por dia, mas nao verifica se o TBR foi re-entregue com sucesso em uma corrida posterior (net returns).

## Solucao

Aplicar no `DriverHome.tsx` exatamente a mesma logica que ja funciona na folha de pagamento:

1. Adicionar `code` na query de `ride_tbrs`
2. Contar TBRs unicos por dia usando `Set` de codigos
3. Aplicar logica de retornos liquidos (net returns) — verificar a ultima corrida do dia

## Detalhes Tecnicos

### Arquivo: `src/pages/driver/DriverHome.tsx`

**Mudanca 1 — Query (linha 65)**:
Trocar `select("id, ride_id")` por `select("id, ride_id, code")` na query de `ride_tbrs`.

**Mudanca 2 — Calculo de metricas (linhas 108-168)**:
Reescrever o bloco `useMemo` para:

```typescript
const metrics = useMemo(() => {
  const totalRides = rides.length;

  // Group rides by day
  const ridesByDay = new Map<string, string[]>();
  rides.forEach((r: any) => {
    const day = format(parseISO(r.completed_at), "yyyy-MM-dd");
    if (!ridesByDay.has(day)) ridesByDay.set(day, []);
    ridesByDay.get(day)!.push(r.id);
  });

  // Calculate per-day with deduplication and net returns (same as payroll)
  let totalTbrs = 0;
  let totalReturns = 0;
  let totalGanho = 0;

  const settingsMap = new Map(unitSettings.map((s: any) => [s.unit_id, Number(s.tbr_value)]));
  const customMap = new Map(customValues.map((cv: any) => [cv.unit_id, Number(cv.custom_tbr_value)]));

  ridesByDay.forEach((rideIds, day) => {
    const dayTbrs = tbrs.filter((t: any) => rideIds.includes(t.ride_id));

    // 1. TBRs unicos por codigo
    const uniqueCodes = new Set(dayTbrs.map((t: any) => t.code));

    // 2. Codigos que retornaram
    const returnCodes = new Set<string>();
    [...pisoEntries, ...psEntries, ...rtoEntries].forEach((p: any) => {
      if (p.ride_id && rideIds.includes(p.ride_id) && p.tbr_code) {
        returnCodes.add(p.tbr_code);
      }
    });

    // 3. Retornos liquidos (verificar ultima corrida do dia)
    const sortedDayRides = rides
      .filter((r: any) => rideIds.includes(r.id))
      .sort((a: any, b: any) =>
        new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
      );

    const netReturns = new Set<string>();
    returnCodes.forEach(code => {
      let lastRideId: string | null = null;
      for (const ride of sortedDayRides) {
        if (dayTbrs.some((t: any) => t.ride_id === ride.id && t.code === code)) {
          lastRideId = ride.id;
        }
      }
      if (lastRideId) {
        const hasReturnInLast = [...pisoEntries, ...psEntries, ...rtoEntries].some(
          (p: any) => p.ride_id === lastRideId && p.tbr_code === code
        );
        if (hasReturnInLast) netReturns.add(code);
      }
    });

    const dayTbrCount = uniqueCodes.size;
    const dayReturnCount = netReturns.size;
    totalTbrs += dayTbrCount;
    totalReturns += dayReturnCount;

    // Valor do dia
    const firstRide = rides.find((r: any) => r.id === rideIds[0]);
    const unitId = firstRide?.unit_id;
    const tbrVal = (unitId && customMap.get(unitId)) ?? (unitId && settingsMap.get(unitId)) ?? 0;
    totalGanho += Math.max(0, dayTbrCount - dayReturnCount) * tbrVal;
  });

  // Add bonuses
  const totalBonus = bonuses.reduce((s: number, b: any) => s + Number(b.amount), 0);
  totalGanho += totalBonus;

  const concluidos = Math.max(0, totalTbrs - totalReturns);
  const taxaConclusao = totalTbrs > 0 ? (concluidos / totalTbrs) * 100 : 0;
  const workedDays = ridesByDay.size;
  const mediaTbrsDia = workedDays > 0 ? totalTbrs / workedDays : 0;
  const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });

  return { totalRides, totalTbrs, totalGanho, taxaConclusao, mediaTbrsDia, totalReturns, workedDays, days };
}, [rides, tbrs, pisoEntries, psEntries, rtoEntries, unitSettings, customValues, bonuses, startDate, endDate]);
```

### Resultado esperado apos correcao

**Vitoria**: TBRs=69, Retornos=8, Valor=R$184,20 (igual a folha)
**Ricardo**: TBRs=87, Retornos=13, Valor=R$247,90 (igual a folha)

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/pages/driver/DriverHome.tsx` | Adicionar `code` na query + aplicar logica de TBRs unicos e retornos liquidos identica a folha de pagamento |
