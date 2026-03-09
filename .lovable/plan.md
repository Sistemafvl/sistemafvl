

# Plano: Corrigir cálculo duplo de subtração no "Total Ganho" e "Concl."

## Problema raiz

O trigger `auto_remove_tbr_from_ride` **já remove** TBRs da tabela `ride_tbrs` quando um insucesso é registrado. Portanto, `ride_tbrs` já contém **apenas os concluídos**.

O código atual busca `ride_tbrs` (41 itens = já limpos) e depois subtrai os retornos (39) novamente, resultando em `41 - 39 = 2` concluídos e R$6,70. O correto seria 41 concluídos.

**Mesma lógica errada existe em 3 locais:**
1. `DriverHome.tsx` — metrics `useMemo` (linhas ~161-213)
2. `DriverHome.tsx` — quinzena `useEffect` (linhas ~364-382)
3. `DriverRides.tsx` — mini-cards por corrida (linha 228)

## Correção

### 1. `src/pages/driver/DriverHome.tsx` — metrics useMemo

**Antes:** `dayTbrCount - dayReturnCount` (subtração dupla)
**Depois:** `ride_tbrs` count = concluídos direto. Sem subtrair retornos.

- `totalTbrs` = soma de `uniqueCodes.size` por dia (ride_tbrs = concluídos)
- `totalLidos` = `totalTbrs + totalReturns` (volume original carregado)
- `totalGanho` por dia = `uniqueCodes.size * tbrVal` (sem subtrair retornos)
- `concluidos` = `totalTbrs` (já limpo pelo trigger)
- Remover toda a lógica de `returnCodes`, `netReturns`, `sortedDayRides` do cálculo financeiro — manter `totalReturns` apenas para o card "Insucessos"

### 2. `src/pages/driver/DriverHome.tsx` — quinzena useEffect

Mesma correção: `total += uniqueCodes.size * tbrVal` sem subtrair `dayReturnCount`.

### 3. `src/pages/driver/DriverRides.tsx` — mini-cards

**Antes:** `entregues = tbrCount - returnCount` (subtração dupla)
**Depois:** `entregues = tbrCount` (ride_tbrs já é o concluído)
- `totalLidos` = `tbrCount + returnCount` (volume original)

### Cards finais na Home:
| Card | Valor |
|------|-------|
| Total Corridas | rides.length |
| TBRs Lidos | totalTbrs + totalReturns (volume original) |
| Total Ganho | baseado em ride_tbrs (concluídos) + reativos + bônus |
| Reativos | soma reativo_value |
| Insucessos | totalReturns |
| Quinzena | recalculado sem subtração dupla |

