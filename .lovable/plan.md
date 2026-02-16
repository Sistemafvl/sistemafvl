

# Resumo Completo das Alteracoes

## 1. Status da fila atualiza imediatamente (Motorista)
**Arquivo:** `src/pages/driver/DriverQueue.tsx`
- Apos o insert na fila, chamar `fetchQueue()` imediatamente e aplicar update otimista no estado local para feedback instantaneo.

## 2. Check visual nos logins ja usados hoje
**Arquivo:** `src/components/dashboard/QueuePanel.tsx`
- No modal "Programar Carregamento", consultar `driver_rides` do dia para identificar logins ja utilizados.
- Exibir um icone de check ao lado do login na caixa de selecao. Todos continuam selecionaveis -- o check e apenas informativo.

## 3. TBRs em tempo real na visao do motorista
**Migracao SQL**
- Habilitar Realtime para a tabela `ride_tbrs` (`ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_tbrs`).

## 4. Remover filtro de datas dos Feedbacks
**Arquivo:** `src/pages/dashboard/FeedbacksPage.tsx`
- Remover os inputs de data e os estados `startDate`/`endDate`. A query buscara todas as avaliacoes da unidade sem restricao de periodo.

## 5. Rastreabilidade completa do TBR (RTO reutiliza mesma linha)
**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx`
- Buscar o ultimo `ride_tbrs` do TBR (ordenado por `scanned_at desc`) em vez de `.maybeSingle()`, para encontrar historico completo.
- Ao migrar para RTO, verificar se ja existe um `rto_entries` com o mesmo `tbr_code`. Se sim, fazer UPDATE (reabrir com status "open") em vez de INSERT.

## 6. Feedbacks enriquecidos com dados do motorista
**Arquivo:** `src/pages/dashboard/FeedbacksPage.tsx`
- Buscar `avatar_url`, `bio`, `car_model`, `car_color` dos motoristas.
- Calcular performance (total de corridas/TBRs) por motorista.
- Exibir avatar, bio, info do carro e performance em cada card de avaliacao.

## 7. Card indicador de motoristas no Dashboard
**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`
- Adicionar um card com media de avaliacao da unidade e total de feedbacks.
- Ao clicar no card, navegar para `/dashboard/feedbacks`.

## Resumo de arquivos

| # | Arquivo / Recurso | Alteracao |
|---|---|---|
| 1 | `src/pages/driver/DriverQueue.tsx` | Update otimista + fetchQueue apos join |
| 2 | `src/components/dashboard/QueuePanel.tsx` | Check visual nos logins usados hoje |
| 3 | Migracao SQL | Realtime para `ride_tbrs` |
| 4 | `src/pages/dashboard/FeedbacksPage.tsx` | Remover filtro de datas |
| 5 | `src/pages/dashboard/RetornoPisoPage.tsx` | Buscar ultimo ride_tbr + reutilizar RTO existente |
| 6 | `src/pages/dashboard/FeedbacksPage.tsx` | Avatar, bio, carro, performance nos cards |
| 7 | `src/pages/dashboard/DashboardHome.tsx` | Card indicador clicavel -> Feedbacks |

