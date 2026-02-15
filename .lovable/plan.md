
# Melhorias: Insights Avancados + Balao RTO na Conferencia + RTO sem botao Finalizar

## 1. Insights e Rankings abaixo dos graficos (DashboardMetrics.tsx)

Apos os 3 graficos existentes, adicionar uma nova secao com cards de ranking e insights:

**Rankings (cards lado a lado):**
- **Top 5 Motoristas com mais entregas** (ultimos 30 dias): consulta `driver_rides` agrupando por `driver_id`, contando total, juntando nome do `drivers`
- **Top 5 Motoristas com mais retornos** (piso + RTO): consulta `piso_entries` + `rto_entries` agrupando por `driver_name`
- **Conferentes mais ativos**: consulta `driver_rides` agrupando por `conferente_id`

**Cards de insight adicionais (grid):**
- Media de TBRs por carregamento (total TBRs / total rides)
- Taxa de retorno (% de TBRs que foram para piso/RTO vs total)
- Tempo medio de carregamento (media de `finished_at - started_at` dos rides finalizados)
- Melhor dia da semana (dia com mais carregamentos nos ultimos 30 dias)

Todos filtrados por `unit_id`.

## 2. Balao de dica de RTO na Conferencia de Carregamento

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Logica: quando o gerente preenche/edita o campo **Rota** de um carregamento, o sistema consulta a tabela `rto_entries` com `status = 'open'` e compara o campo `cep` do RTO com o texto da rota. Se houver caracteres em comum (ex: rota "0814 com 15" contem "0814" que e parte do CEP "08141180"), exibe um balao de dica abaixo do botao Finalizar.

**Implementacao:**
- Ao carregar os rides ou ao editar a rota, buscar `rto_entries` abertas da unidade
- Para cada ride com rota preenchida, verificar se algum RTO tem CEP cujos 4-5 primeiros digitos aparecem no texto da rota
- Se houver match, renderizar um pequeno balao (tooltip/card) logo abaixo do botao Finalizar com texto profissional:
  > "Sugestao: O TBR [CODIGO] possui um RTO pendente com CEP compativel com esta rota. Considere inclui-lo neste carregamento."
- O balao tera um botao "Incluir TBR" que ao clicar:
  1. Insere o TBR do RTO no `ride_tbrs` do carregamento atual
  2. Atualiza o `rto_entries` para `status = 'closed'`
  3. O balao desaparece

## 3. Remover botao Finalizar da pagina RTO

**Arquivo:** `src/pages/dashboard/RTOPage.tsx`

- Remover a coluna "Acoes" e o botao "Finalizar" da tabela
- Substituir por uma coluna "Status" que mostra:
  - **Pendente** (badge amarela) quando `status = 'open'`
  - **Finalizado** (badge verde) quando `status = 'closed'`
- O RTO sera finalizado automaticamente quando o TBR for escaneado no carregamento (via a logica do balao acima) ou quando retornar ao piso e passar pelo fluxo novamente
- Remover tambem o botao "Finalizar RTO" do modal de historico do TBR

---

## Secao Tecnica

**Arquivos modificados:**
- `src/components/dashboard/DashboardMetrics.tsx` — adicionar secao de rankings e insights apos os graficos
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` — adicionar logica de match CEP/rota e balao de dica com acao de incluir TBR
- `src/pages/dashboard/RTOPage.tsx` — remover botao Finalizar, substituir por coluna Status

**Consultas adicionais no DashboardMetrics:**
- `driver_rides` agrupado por `driver_id` (top motoristas)
- `piso_entries` + `rto_entries` agrupado por `driver_name` (top retornos)
- `driver_rides` com `started_at` e `finished_at` para media de tempo

**Logica de match CEP/Rota na Conferencia:**
- Buscar RTOs abertos da unidade com CEP preenchido
- Extrair os primeiros 4 digitos do CEP
- Verificar se esses digitos aparecem no campo rota do ride
- Exibir balao apenas quando houver match
