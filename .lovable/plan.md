

## Plano: Corrigir contagens de TBRs Lidos e Insucessos na Operacao

### Diagnostico (dados reais do banco)

| Metrica | Valor atual | Valor correto | Causa do erro |
|---------|------------|---------------|---------------|
| TBRs Lidos | 3843 | 3782 | Soma ride_tbrs (3683) + TODOS os retornos (160), incluindo os que ainda estao na ride_tbrs. Deveria somar apenas os 99 retornos cujos codigos foram removidos da ride_tbrs |
| Insucessos | 158 | 93 | Conta piso+PS+RTO (open+closed). Deveria contar apenas piso_entries com status=open |

### Alteracoes em `src/pages/dashboard/OperacaoPage.tsx`

**1. Buscar status dos piso_entries** (linha ~107): adicionar `status` ao select de piso_entries para poder filtrar por status=open.

**2. Calcular retornos removidos corretamente** (linhas ~158-168): `allReturnTbrSets` atualmente conta TODOS os retornos. Precisa mudar para contar apenas codigos que NAO estao mais na `tbrCodesByRide` (mesma logica da RPC). Assim `totalAllReturns` = 99 e `totalLidos` = 3683 + 99 = 3782.

**3. Calcular insucessos apenas com piso open** (linhas ~170-180): `pisoOnlyTbrSets` atualmente conta todos os piso (open+closed). Filtrar para incluir apenas os com `status='open'`.

**4. Buscar campo status** nos dados do piso: alterar a query de `piso_entries` para incluir o campo `status`.

### Logica corrigida (pseudo-codigo)

```typescript
// Fetch piso with status
fetchAllRowsWithIn<{ ride_id: string; tbr_code: string; reason: string | null; status: string }>(...)

// allReturnTbrSets: only codes NOT in ride_tbrs (removed)
[...pisoData, ...psData, ...rtoData].forEach(p => {
  const upperCode = p.tbr_code?.toUpperCase();
  if (p.ride_id && upperCode && !tbrCodesByRide[p.ride_id]?.has(upperCode)) {
    allReturnTbrSets[p.ride_id].add(upperCode);
  }
});

// pisoOnlyTbrSets: only open piso
pisoData.filter(p => p.status === 'open').forEach(p => {
  pisoOnlyTbrSets[p.ride_id].add(upperCode);
});
```

### Arquivo afetado
- `src/pages/dashboard/OperacaoPage.tsx`

