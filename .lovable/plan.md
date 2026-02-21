

# Plano de Correções e Melhorias - 8 Itens

## 1. Adicionais: Trocar periodo por data unica (Anexo 1)

**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`

- Substituir os dois campos de data (period_start e period_end) por um unico campo "Data" referente ao dia da corrida
- Ao salvar, gravar `period_start = period_end = data_selecionada` na tabela `driver_bonus`
- Atualizar o label de "Inicio/Fim do Periodo" para "Data da Corrida"
- Na listagem de bonus, exibir apenas a data unica em vez do intervalo

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`
- Ajustar a query de bonus para buscar por `period_start` dentro do range do relatorio (entre startDate e endDate)

## 2. Valores Diferenciados no Relatorio (Anexo 2)

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`

O problema: na linha 131, o calculo do valor usa `common.tVal` (valor padrao) para todos os motoristas, ignorando `driver_custom_values`.

Correções:
- No `fetchPayroll`, buscar `driver_custom_values` da tabela para o `unit_id` atual
- Criar um `Map<driver_id, custom_tbr_value>`
- No calculo de cada motorista (linha 131), usar `customValueMap.get(driverId) ?? common.tVal` em vez de `common.tVal`
- Tambem no calculo do `totalValue` (linha 145), usar o valor correto

**Arquivo:** `src/pages/dashboard/reports/PayrollReportContent.tsx`
- Adicionar campo `tbrValueUsed` em `DriverPayrollData` para exibir o valor por TBR correto na ficha individual (linha 126)

## 3. Contador de Fila para o Motorista (Anexo 3)

**Arquivo:** `src/pages/driver/DriverQueue.tsx`

- Na tela "Em Carregamento" (quando `activeRide` existe), adicionar um card mostrando a posicao na fila de finalizacao
- Buscar quantos carregamentos ativos (status "loading" ou "pending") na unidade tem `completed_at` anterior ao do motorista atual
- Exibir como "Posicao na Fila: Xo" com atualizacao via Realtime

## 4. Travar Seletor de Conferente (Anexo 4)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (linha 1114)

O seletor ja tem `disabled={!!ride.conferente_id && !managerSession}` mas o problema e que apos a atualizacao otimista, o `fetchRides()` pode resetar o estado antes do banco confirmar.

Correção:
- Adicionar um `lockedConferentes` ref/state que marca rides com conferente recem-selecionado
- Ao selecionar conferente, adicionar o `rideId` ao set de travados
- Na renderizacao, verificar tambem se o ride esta no set de travados (alem do `conferente_id`)
- O `fetchRides` mantem o lock pois o dado vem do banco com o conferente salvo

## 5. Bloquear TBR duplicado entre carregamentos ativos (Anexo 5)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

O problema: a validacao na linha 480-484 verifica `previousTbrs` em OUTROS rides, mas so bloqueia se nao houver piso_entry. Se o ride anterior ainda esta ativo (nao excluiu o TBR), o sistema permite a leitura.

Correção:
- Apos buscar `previousTbrs`, verificar se algum desses rides esta com status "pending" ou "loading" (carregamento ativo)
- Se o TBR pertence a um carregamento ativo, bloquear a leitura com mensagem "TBR ja esta em outro carregamento ativo"
- Apenas permitir re-leitura se todos os rides anteriores com esse TBR estiverem finalizados/cancelados E houver registro no Retorno Piso

## 6. Exclusao de TBR - Fix definitivo (Anexo 6)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

O problema persiste pois o `skipRealtimeRef` com delay de 2000ms nao e suficiente. O `deletingRef` limpa o ID antes do fetchRides ser chamado.

Correções:
- Aumentar delay para 3000ms
- Manter o `tbrId` no `deletingRef` ate APOS o fetchRides completar
- No `fetchRides`, filtrar TBRs que estao no `deletingRef` antes de setar o estado
- Ao excluir TBR, criar/reabrir entrada no `piso_entries` com motivo "Removido do carregamento"

## 7. Chave PIX no Resumo Geral do Relatorio (Anexo 7)

**Arquivos:** `src/pages/dashboard/RelatoriosPage.tsx`, `src/pages/dashboard/reports/PayrollReportContent.tsx`

Correções no `RelatoriosPage.tsx`:
- No `fetchPayroll`, buscar `pix_key` e `pix_key_type` de cada motorista via `get-driver-details` (self_access: true) ou query batch
- Adicionar campo `pixKey` na interface `DriverPayrollData.driver`

Correções no `PayrollReportContent.tsx`:
- Na celula "Motorista" da tabela resumo geral (linha 215), exibir o nome na primeira linha e a chave PIX na segunda linha (fonte menor, cor cinza) dentro da mesma celula `<td>`
- Tambem adicionar colunas "Adicional" e "Valor Liquido" integrando os bonus

## 8. Foto do Motorista no Modal de Motoristas Parceiros (Anexo 8)

**Arquivo:** `src/pages/dashboard/MotoristasParceirosPage.tsx`

O problema: a query na linha 118 nao inclui `avatar_url` no SELECT, e o modal usa um icone estatico em vez da foto.

Correções:
- Adicionar `avatar_url` ao SELECT da query `drivers_public` (linha 118)
- Adicionar `avatar_url: string | null` na interface `DriverGlobal`
- No modal, trocar o div estatico com icone `<Truck>` por um componente `<Avatar>` que usa `viewDriver.avatar_url`

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `ConfiguracoesPage.tsx` | Trocar periodo por data unica nos Adicionais |
| `RelatoriosPage.tsx` | Integrar custom values, bonus e PIX no payroll |
| `PayrollReportContent.tsx` | PIX abaixo do nome + colunas bonus/valor liquido |
| `DriverQueue.tsx` | Contador de posicao na fila de carregamento |
| `ConferenciaCarregamentoPage.tsx` | Lock conferente, bloquear TBR entre ativos, fix exclusao |
| `MotoristasParceirosPage.tsx` | Exibir avatar do motorista no modal |

