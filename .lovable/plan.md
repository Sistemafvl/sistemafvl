

## Diagnóstico: Por que os números divergem

**Causa raiz identificada:** A fórmula de "lidos" é diferente entre as duas páginas.

**Conferência:** `TBRs Lidos = rideTbrs.length + piso_entries com "Removido do carregamento"`

**Operação:** `Lidos = ride_tbrs.count + retornos NÃO-operacionais (piso filtrado + ps + rto)`

O problema: quando um TBR é removido do carregamento (razão "Removido do carregamento"), o trigger remove ele da `ride_tbrs`. Na Operação, esse TBR é filtrado pelo `OPERATIONAL_PISO_REASONS` e desaparece completamente — não conta em `ride_tbrs` nem em `all_returns`. Resultado: Thiago tem 96 TBRs na Conferência mas apenas 15 na Operação (os ~81 removidos operacionalmente sumiram).

Além disso, a Conferência também está incompleta: só adiciona de volta "Removido do carregamento", mas ignora TBRs removidos via PS/RTO/outros piso.

---

## Plano de Correção

### 1. Operação (`OperacaoPage.tsx`)

Mudar a contagem para incluir TODOS os TBRs removidos (qualquer razão):

- Buscar `pisoRaw` SEM filtrar por `OPERATIONAL_PISO_REASONS` para o cálculo de "lidos"
- Nova variável `allEverRemoved` = códigos únicos de ALL piso + ps + rto que NÃO estão mais em `ride_tbrs`
- `totalLidosCard = ride_tbrs.count + allEverRemoved.size`
- `insucessos = non-operational return codes` (manter filtro atual)
- `concluídos = ride_tbrs.count` (items que o motorista tem = entregues)
- Performance = `concluídos / totalLidosCard * 100`

### 2. Conferência (`ConferenciaCarregamentoPage.tsx`)

Corrigir `removedTbrCounts` para contar TODOS os TBRs removidos (não só "Removido do carregamento"):

- Buscar unique codes de `piso_entries` (qualquer razão) + `ps_entries` + `rto_entries` por ride
- Contar apenas os que NÃO estão em `ride_tbrs` atual
- `TBRs Lidos = rideTbrs.length + removedCount`

### 3. Driver views (`DriverHome.tsx`, `DriverRides.tsx`)

Mesma lógica: incluir todos os removidos no cálculo de "lidos" e manter "insucessos" como apenas não-operacionais.

### Arquivos afetados
1. `src/pages/dashboard/OperacaoPage.tsx`
2. `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
3. `src/pages/driver/DriverHome.tsx`
4. `src/pages/driver/DriverRides.tsx`

