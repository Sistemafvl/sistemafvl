

# Plano: Otimizações de Consumo (Rodada 2)

Otimizações seguras que não alteram fluxos, telas ou estrutura.

---

## 1. DashboardHome: Consolidar 7 queries DNR/Feedback em 2

**Problema:** Ao abrir a Visão Geral da unidade, são feitas **7 queries paralelas** só para DNR + Feedback (linhas 86-103). Três delas são `count: exact, head: true` separadas das queries de dados.

**Correção em `DashboardHome.tsx`:**
- Substituir as 7 queries por **2 queries**:
  - `dnr_entries` → buscar `status, dnr_value` com filtro `unit_id` (1 query, agrupar no JS)
  - `unit_reviews` → buscar `rating` com filtro `unit_id` (1 query, calcular média e total no JS)
- Economia: **5 requests por pageview**

---

## 2. DashboardHome: Relógio de 1s → 60s

**Problema:** `setInterval(() => setDateTime(new Date()), 1000)` causa re-render a cada segundo em toda a página, mesmo que o relógio só precise de resolução de minuto.

**Correção:** Mudar intervalo de `1000` para `60000` (1 minuto).
- Economia: **~59 re-renders por minuto** eliminados

---

## 3. Matriz: `drivers_public` carrega TODOS os motoristas do sistema

**Problema:** Em `MatrizOverview.tsx` (linha 69), `MatrizMotoristas.tsx` e `MatrizFinanceiro.tsx`, a query `drivers_public` faz `fetchAllRows` **sem filtro de unidade**, baixando TODOS os motoristas do sistema inteiro, mesmo que a Matriz só precise dos motoristas que têm corridas no período.

**Correção:**
- Remover a query separada de `drivers_public`
- Usar os `driver_id` já presentes nas `driver_rides` carregadas e buscar apenas esses IDs específicos via `.in("id", driverIdsFromRides)`
- Se necessário filtrar por nome, usar os dados já carregados
- Economia: **1 query massiva eliminada por pageview** (potencialmente centenas/milhares de registros)

---

## 4. DriverHome: DNR effect roda sem filtro de data

**Problema:** O `useEffect` de DNR (linha 123-139) busca **TODOS os DNR do motorista na unidade**, sem filtro de data. Se o motorista tem histórico longo, isso pode retornar centenas de registros desnecessários.

**Correção:** Adicionar filtro de data (quinzena atual) na query de DNR, igual ao resto da página.

---

## 5. Lazy import do Recharts nos componentes do Motorista

**Problema:** `DriverHome.tsx` importa `LineChart, BarChart, PieChart` do Recharts no topo, mesmo que os gráficos só apareçam rolando pra baixo. Isso pesa no bundle inicial do motorista.

**Correção:** Usar `React.lazy` para importar os componentes de gráfico só quando necessário (dentro de um `Suspense`), reduzindo o tempo de carregamento inicial da página do motorista.

---

## Resumo

| Otimização | Impacto | Risco |
|---|---|---|
| DNR/Feedback 7→2 queries | -5 requests/pageview | Zero |
| Relógio 1s→60s | -59 re-renders/min | Relógio atualiza a cada minuto |
| drivers_public filtrado | -1 query massiva | Zero |
| DNR filtrado por data | Menos dados transferidos | Zero |
| Lazy Recharts | Bundle menor, carrega mais rápido | Zero |

Nenhuma mudança visual ou funcional.

