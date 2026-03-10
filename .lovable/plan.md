

# Plano: 3 Alterações (sem AdSense)

## 1. Remover card "Sua Posição no Ranking" (DriverHome)

**Arquivo:** `src/pages/driver/DriverHome.tsx`
- Remover linhas 540-554 (bloco do card ranking)
- Remover linhas 433-459 (state `rankPosition` + useEffect que chama RPC `get_top_drivers_by_tbrs`)
- Remover `Trophy` do import (linha 8)
- Economia de 1 query RPC por pageview

## 2. Trocar mini-card "Insuc." por "Méd/Dia" (DriverRides)

**Arquivo:** `src/pages/driver/DriverRides.tsx`
- Pré-calcular a média de TBRs concluídos/dia: `totalConcluídos / diasÚnicosComCorrida` usando todas as corridas carregadas no período
- Computar um `avgPerDay` usando `useMemo` baseado em `rides`
- Substituir o mini-card "Insuc." (linhas 305-309, vermelho com AlertTriangle) por um card teal/cyan com ícone `TrendingUp`, label "Méd/Dia", valor = `avgPerDay`
- O grid passa de 5 colunas para 5 (mesmo layout), trocando apenas o conteúdo do card

## 3. Círculo indicador de média no Carregamento

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Após carregar as rides e TBRs do dia, coletar os `driver_id`s únicos
- Fazer uma query adicional: buscar `driver_rides` dos últimos 30 dias para esses motoristas na mesma unidade, contar TBRs por ride via `ride_tbrs`, agrupar por driver e calcular média diária
- Armazenar em `Map<string, number>` (driver_id → média/dia)
- Renderizar um círculo de ~28px entre o Avatar e o nome do motorista (nas duas views: focus mode linha ~2002 e lista normal linha ~2413)
- Cor do círculo:
  - Verde: TBRs atuais >= 90% da média
  - Amarelo: 70-90%
  - Vermelho: < 70%
- Dentro do círculo: número da média arredondado
- Tooltip com detalhes: "Média: X TBRs/dia · Atual: Y TBRs"

---

Nenhuma mudança no AdSense. Sem alteração de fluxo ou estrutura.

