

# Plano Completo de Alteracoes

## 1. Correcao global de timezone (Brasil UTC-3)
Criar funcoes utilitarias em `src/lib/utils.ts` para calcular inicio/fim do dia no fuso de Brasilia. Aplicar em todos os arquivos que filtram por "hoje" ou formatam datas: `DashboardMetrics.tsx`, `DashboardInsights.tsx`, `DriverHome.tsx`, `OperacaoPage.tsx`, `ConferenciaCarregamentoPage.tsx`, `QueuePanel.tsx`.

## 2. Filtro padrao do motorista abre com data de hoje
Em `DriverHome.tsx`, inicializar `startDate` e `endDate` com a data de hoje (BRT) em vez dos ultimos 30 dias.

## 3. Status da fila atualiza imediatamente (Motorista)
Em `DriverQueue.tsx`, aplicar update otimista + `fetchQueue()` apos o motorista entrar na fila. *(Ja implementado)*

## 4. Check visual nos logins ja usados hoje
Em `QueuePanel.tsx`, consultar `driver_rides` do dia e exibir icone de check ao lado dos logins ja usados. *(Ja implementado)*

## 5. TBRs em tempo real na visao do motorista
Migracao SQL para habilitar Realtime na tabela `ride_tbrs`. *(Ja implementado)*

## 6. Remover filtro de datas dos Feedbacks + enriquecer cards
Em `FeedbacksPage.tsx`, remover filtros de data e exibir avatar, bio, carro e performance do motorista. *(Ja implementado)*

## 7. Card indicador de feedbacks no Dashboard
Em `DashboardHome.tsx`, card clicavel com media de avaliacao e total de feedbacks. *(Ja implementado)*

## 8. Etiqueta de PS/RTO finalizado no rastreamento TBR
Em `DashboardHome.tsx`, ao buscar um TBR, exibir badges "PS Finalizado" ou "RTO Finalizado" mesmo quando o status e closed, para rastreabilidade completa.

## 9. Rastreabilidade TBR + RTO reutiliza mesma linha
Em `RetornoPisoPage.tsx`, buscar ultimo `ride_tbrs` por `scanned_at desc` e reutilizar registro RTO existente via UPDATE. *(Ja implementado)*

## 10. Remover coluna Motorista da tabela RTO
Em `RTOPage.tsx`, remover a coluna "Motorista" que nao faz sentido no fluxo RTO.

## 11. Correcao de valor monetario (centavos)
Em `DriverRides.tsx`, alterar `.toFixed(0)` para `.toFixed(2)` com `toLocaleString("pt-BR")` para exibir R$3,20 corretamente.

## 12. Contagem de retornos: 1 TBR = 1 retorno
Em todos os arquivos que calculam performance (retornos), contar `tbr_code` unicos por `ride_id` usando `Set` em vez de somar linhas de piso + ps + rto. Afeta: `DriverRides.tsx`, `OperacaoPage.tsx`, `DashboardInsights.tsx`, relatorios.

## 13. Upload de documentos do motorista + dados bancarios
- **Migracao SQL**: adicionar campos bancarios na tabela `drivers` (`bank_name`, `bank_agency`, `bank_account`, `pix_key`, `pix_key_name`, `pix_key_type`), criar tabela `driver_documents` e bucket `driver-documents`.
- **Nova pagina** `DriverDocuments.tsx`: upload de CNH, CRLV, comprovante de endereco (PDF/PNG/JPG) + formulario de dados bancarios.
- **Menu do motorista** `DriverSidebar.tsx`: adicionar item "Documentos".
- **Rota** `App.tsx`: adicionar `/motorista/documentos`.
- **Modal do gerente** `MotoristasParceirosPage.tsx`: exibir dados bancarios + botao "Baixar Documentos" que gera ZIP com JSZip.

## Resumo de arquivos

| # | Arquivo | Alteracao |
|---|---|---|
| 1 | `src/lib/utils.ts` | Funcoes timezone Brasil |
| 1 | `DashboardMetrics.tsx`, `DashboardInsights.tsx` | Timezone fix |
| 1,2 | `DriverHome.tsx` | Timezone fix + filtro padrao hoje |
| 1 | `OperacaoPage.tsx`, `ConferenciaCarregamentoPage.tsx` | Timezone fix |
| 8 | `DashboardHome.tsx` | Badges PS/RTO finalizado |
| 10 | `RTOPage.tsx` | Remover coluna Motorista |
| 11 | `DriverRides.tsx` | Fix valor monetario |
| 12 | `DriverRides.tsx`, `OperacaoPage.tsx`, `DashboardInsights.tsx`, relatorios | Retorno = tbr_code unico |
| 13 | Migracao SQL | Tabela docs + campos bancarios + bucket |
| 13 | `DriverDocuments.tsx` (novo) | Upload docs + dados bancarios |
| 13 | `DriverSidebar.tsx` | Menu Documentos |
| 13 | `App.tsx` | Rota /motorista/documentos |
| 13 | `MotoristasParceirosPage.tsx` | Dados bancarios + download ZIP |

