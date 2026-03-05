

## Diagnóstico: Causa Raiz da Divergência

### O Problema Real

Identifiquei a causa raiz: **todas as queries paginadas com `fetchAllRows`/`fetchAllRowsWithIn` estao usando `.range(from, to)` SEM `.order()`**. Sem um ORDER BY estavel, o PostgREST retorna linhas em ordem indefinida. Quando a paginacao cruza multiplas paginas (>1000 linhas), linhas podem ser **duplicadas ou omitidas** entre paginas.

Hoje, com 50 carregamentos e ~2980 TBRs, a paginacao gera 3 paginas. Sem ORDER BY, o banco pode pular todos os TBRs do Willian (105) ou do Emerson (66), resultando em `total_tbrs=0` para esses motoristas. Dai aparece "0/3" ao inves de "105/108".

A visao do motorista funciona porque busca apenas as rides de UM motorista (menos dados, cabe em 1 pagina na maioria dos casos).

### Correcoes

**1. Adicionar `.order("id")` a TODAS as queries paginadas** (~25 queries em 10 arquivos)

Isso garante paginacao deterministica. Cada pagina retorna um bloco unico de linhas, sem saltos.

Arquivos afetados:
- `OperacaoPage.tsx` (4 queries: ride_tbrs, piso, ps, rto)
- `CiclosPage.tsx` (4 queries)
- `DriverHome.tsx` (4 queries)
- `DriverRides.tsx` (4 queries)
- `ConferenciaCarregamentoPage.tsx` (2 queries - piso removidos + TBRs na busca)
- `RelatoriosPage.tsx` (8+ queries)
- `DashboardInsights.tsx` (6 queries)
- `DashboardHome.tsx`, `ConfiguracoesPage.tsx`, `FeedbacksPage.tsx`, `FinanceiroPage.tsx`, `RetornoPisoPage.tsx`
- `MatrizOverview.tsx`, `MatrizUnidades.tsx`, `MatrizMotoristas.tsx`, `MatrizFinanceiro.tsx`

**2. Mudar formato de exibicao para "Lidos + Insucessos"**

Nas 3 visoes (Gerente/Operacao, Motorista Home, Motorista Corridas):

- **Antes:** `105/108 concluidos`
- **Depois:** `108 lidos` + badge `3 insucessos`

Formula:
- `lidos = ride_tbrs.count + unique_return_codes.count` (trigger remove TBR do ride_tbrs ao inserir piso/ps/rto)
- `insucessos = unique_return_codes.count`
- `pagamento = (lidos - insucessos) * valor_tbr`

**3. Indicadores globais (topo da pagina Operacao)**
- "TBRs Lidos" = soma de todos os lidos
- "Insucessos" = soma de todos os retornos
- Remover "Conclusao %" (redundante com o novo formato)

### Impacto Tecnico

A correcao do `.order("id")` e a mais critica: sem ela, qualquer dia com >1000 TBRs pode mostrar dados errados. A mudanca de formato e cosmetica mas alinha com o que o usuario pediu.

