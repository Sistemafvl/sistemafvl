

# Plano de Correcoes - 5 Pontos

## 1. Rastreamento TBR - Exibir apenas o TBR buscado

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

Atualmente a busca usa `ilike` com `%code%` (linha 72), o que pode retornar resultados parciais. Alem disso, a secao "Movimentos" lista todos os TBRs do carregamento.

Correcoes:
- Alterar a query de `ilike('%code%')` para `.eq("code", code)` para buscar o TBR exato
- Remover a secao "Movimentos (X TBRs neste carregamento)" que lista todos os TBRs do ride. O usuario quer ver apenas as informacoes do TBR pesquisado, nao de todo o carregamento
- Remover a query paralela de `all_scans` (linha 87) e o campo `all_scans` da interface

## 2. Operacao - Contagem deve considerar PS e RTO

**Arquivo:** `src/pages/dashboard/OperacaoPage.tsx`

Atualmente o calculo de "concluidos" subtrai apenas `piso_returns` (retornos ao piso). Quando um TBR vai para PS ou RTO, deveria tambem reduzir a contagem.

Correcoes:
- Alem de consultar `piso_entries`, tambem consultar `ps_entries` e `rto_entries` com status "open" para os mesmos `ride_id`s
- Somar todos os retornos (piso + PS + RTO) para cada ride
- Atualizar o calculo: `concluidos = total_tbrs - (piso + ps + rto)`
- Atualizar os indicadores gerais para refletir o total correto

## 3 e 4. PS - Finalizar deve manter na lista com status

**Arquivo:** `src/pages/dashboard/PSPage.tsx`

Atualmente `handleFinalize` remove o item da lista local (linha 197) e atualiza status para "closed" no banco. O usuario quer que o item permaneca na lista com indicacao visual de "Finalizado".

Correcoes:
- Alterar `loadEntries` para buscar TODOS os PS da unidade (remover filtro `.eq("status", "open")`)
- Em `handleFinalize`, ao inves de filtrar/remover, atualizar o status localmente para "closed"
- Na tabela, adicionar coluna "Status" com Badge colorido:
  - "open" = Badge amarelo/destrutivo "Aberto"
  - "closed" = Badge verde "Finalizado"
- O botao "Finalizar" so aparece para itens com status "open"

## 5. Renomear "Pendencias" para "Problem Solv"

**Arquivo:** `src/pages/dashboard/PSPage.tsx`

Alterar o titulo de `PS - Pendencias` para `PS - Problem Solv` na linha 214.

---

## Resumo tecnico de arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `src/pages/dashboard/DashboardHome.tsx` |
| Editar | `src/pages/dashboard/OperacaoPage.tsx` |
| Editar | `src/pages/dashboard/PSPage.tsx` |

