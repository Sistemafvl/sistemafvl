

## Plano: 2 Ajustes no Painel do Motorista

### 1. Card Quinzena independente do filtro de data (`DriverHome.tsx`)

**Problema:** O card Quinzena usa os dados filtrados (`rides`, `tbrs`, etc.), então se o filtro mostra apenas "hoje", a quinzena mostra só o valor de hoje.

**Solução:** Criar um `useEffect` separado que busca as corridas da quinzena vigente diretamente do banco, independente do filtro de data:
- Calcular `qStart` e `qEnd` com base na data atual de Brasília (1-15 ou 16-último dia do mês, usando `new Date(year, month+1, 0)` para pegar o último dia correto)
- Buscar `driver_rides` no período da quinzena
- Buscar TBRs, retornos, settings, custom values, bonuses e fixed values associados
- Calcular o total da quinzena com a mesma lógica atual, mas usando dados independentes
- Armazenar em um state separado `quinzenaValue` que não depende dos filtros

### 2. Último mini-card em Corridas: "Perf." → "Reativos" (`DriverRides.tsx`)

**Problema:** O último card mostra Performance (100%), mas deve mostrar o valor de reativos da corrida/dia.

**Solução:**
- Na busca de dados do `DriverRides`, adicionar consulta à tabela `reativo_entries` filtrando por `driver_id` e período
- Criar um mapa `reativoByRide` (por `ride_id`) ou `reativoByDay` (por data da corrida)
- Substituir o mini-card "Perf." (ícone Target, cor purple) por "Reat." (ícone Zap, cor amber)
- Exibir `R$ X` quando houver reativo, ou `R$ 0` quando não houver

### Arquivos alterados
1. `src/pages/driver/DriverHome.tsx` — fetch independente para quinzena
2. `src/pages/driver/DriverRides.tsx` — buscar reativos + trocar último mini-card

