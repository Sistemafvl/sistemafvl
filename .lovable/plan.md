

# Plano: Corrigir cálculo de ganho e substituir card "Entregues"

## Problema identificado

No arquivo `DriverRides.tsx` (página Corridas), os mini-cards por corrida estão com bug:

```typescript
const totalLidos = ride.tbrCount ?? 0;
const entregues = ride.tbrCount ?? 0;  // BUG: igual ao lidos!
const totalGanho = entregues * (ride.tbrValue ?? 0) + (ride.reativoValue ?? 0);
```

`entregues` usa `tbrCount` (todos os TBRs bipados) em vez de `tbrCount - returnCount` (concluidos). Isso infla o valor do "Total" e faz "Concl." mostrar o mesmo valor que "Lidos".

Na DriverHome, o cálculo do `totalGanho` ja esta correto (usa `dayTbrCount - dayReturnCount`), mas nao inclui reativos.

## Alteracoes

### 1. `src/pages/driver/DriverRides.tsx`
- Corrigir: `const entregues = Math.max(0, (ride.tbrCount ?? 0) - (ride.returnCount ?? 0))`
- O `totalGanho` passa a usar o valor correto automaticamente

### 2. `src/pages/driver/DriverHome.tsx`
- **Substituir card "Entregues"** por **"Reativos"** (valor R$ total de reativos no periodo)
- Adicionar fetch de `reativo_entries` no useEffect principal (soma de `reativo_value` para o periodo filtrado)
- Adicionar reativos ao calculo de `totalGanho` (atualmente nao esta incluido)
- Importar `Zap` do lucide-react

### Cards finais da Home:
1. Total Corridas | 2. TBRs Lidos | 3. Total Ganho (agora inclui reativos) | 4. **Reativos** (novo, amber) | 5. Insucessos | 6. Quinzena

