

## Plano: TBRs Lidos = apenas ride_tbrs

Sim, o trigger `auto_remove_tbr_from_ride` já remove o TBR da `ride_tbrs` quando vai para insucesso. Então basta mostrar `ride_tbrs.length` diretamente, sem somar piso/ps/rto.

### Alterações

**1. `ConferenciaCarregamentoPage.tsx`**
- Linha 2104: `TBRs Lidos ({rideTbrs.length + (removedTbrCounts[ride.id] || 0)})` → `TBRs Lidos ({rideTbrs.length})`
- Linha 2293: mesma correção no focus mode
- Remover state `removedTbrCounts` e toda a lógica de fetch de piso/ps/rto para contagem de removidos (linhas ~480-511)

**2. `OperacaoPage.tsx`**
- Remover `all_ever_removed` do `DriverCard` e lógica de `allEverRemovedSets`
- `totalLidos = totalTbrsAtual` (sem somar removidos)
- Cards individuais: `totalLidosCard = c.total_tbrs` (sem `+ c.all_ever_removed`)

**3. `DriverHome.tsx`**
- `totalLidos = totalTbrs` (remover a soma de `totalAllRemoved`)
- Remover o bloco que calcula `totalAllRemoved` via allPisoEntries

**4. `DriverRides.tsx`**
- Mesma correção: `lidos = ride_tbrs count` sem somar removidos

### Resultado
"TBRs Lidos" reflete exatamente o que está na tabela `ride_tbrs`. Ao lançar insucesso, o trigger remove da ride_tbrs e o contador diminui automaticamente.

### Arquivos afetados
1. `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
2. `src/pages/dashboard/OperacaoPage.tsx`
3. `src/pages/driver/DriverHome.tsx`
4. `src/pages/driver/DriverRides.tsx`

