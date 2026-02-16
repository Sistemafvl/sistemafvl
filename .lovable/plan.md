
# Plano de Melhorias - 7 Itens

## 1. Filtro de data na Visao Geral da unidade (Anexo 1)
Adicionar um seletor de datas (periodo) logo abaixo do card de "Avaliacao da Unidade" e acima dos cards de metricas. Esse filtro controlara o periodo dos dados exibidos nos componentes `DashboardMetrics` e `DashboardInsights`.

**Arquivos:**
- `src/pages/dashboard/DashboardHome.tsx` — adicionar estados `startDate`/`endDate` com Popover+Calendar, passar como props
- `src/components/dashboard/DashboardMetrics.tsx` — receber props opcionais de data e usar no lugar de "hoje" e "7 dias"
- `src/components/dashboard/DashboardInsights.tsx` — receber props opcionais de data e usar no lugar de "30 dias"

## 2. Enter no login do Gerente (Anexo 2)
O modal de Login Gerente no `DashboardSidebar.tsx` usa um `<div>` com botao em vez de `<form>`. Ao pressionar Enter no campo de senha, nada acontece.

**Solucao:** Envolver os campos em um `<form onSubmit={handleManagerLogin}>` e trocar o `<Button onClick>` por `<Button type="submit">`.

**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx`

## 3. Numeros de concluidos/retornos clicaveis com modal de TBRs (Anexo 3)
Na pagina de Operacao, os numeros "7/7", "4/5" etc serao clicaveis. Ao clicar, abre um modal com:
- Dados do motorista (nome, carro, rota, login, conferente, horarios)
- Lista de TBRs daquele carregamento
- TBRs sem retorno em **verde**, TBRs com retorno (piso/ps/rto) em **vermelho**

**Arquivo:** `src/pages/dashboard/OperacaoPage.tsx` — tornar o indicador clicavel, criar modal com query de `ride_tbrs` e cruzamento com `piso_entries`/`ps_entries`/`rto_entries` para colorir

## 4. Icone de placa quebrado (Anexo 4)
Na pagina de Operacao, a placa e exibida com emoji `&#x1F4CB;` em vez de um icone. No card de Conferencia, a placa nao tem icone nenhum (linha 862-865).

**Solucao:** Usar o icone `Car` do lucide-react como prefixo da placa nos dois locais.

**Arquivos:**
- `src/pages/dashboard/OperacaoPage.tsx` — substituir emoji por icone
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` — adicionar icone na placa

## 5. RTO fecha ao sair para entrega (Anexo 5)
Quando um TBR com RTO aberto e incluido em um novo carregamento (via scan normal ou via botao "Incluir TBR" da sugestao), o sistema ja fecha o RTO via sugestao (linha 958). Porem, quando o TBR e escaneado normalmente (sem sugestao), o `handleTbrInputChange` nao fecha o RTO associado.

**Solucao:** No fluxo de scan normal (quando `tripNumber > 1` e piso entry existe), apos fechar o `piso_entries`, tambem fechar qualquer `rto_entries` aberto para aquele `tbr_code`.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` — adicionar `UPDATE rto_entries SET status='closed'` apos fechar piso_entries no scan de reincidencia

## 6. Filtro de data individual por card de grafico/ranking (Anexo 6)
Cada card de grafico (Carregamentos 7 dias, TBRs escaneados 7 dias, Status dos carregamentos) e cada card de ranking (Top Motoristas, Top Retornos, Conferentes mais ativos) tera um pequeno seletor de datas proprio no canto superior direito do card, permitindo alterar o periodo somente daquele card especifico.

**Arquivos:**
- `src/components/dashboard/DashboardMetrics.tsx` — adicionar estado de data local para cada grafico com Popover+Calendar inline no CardHeader
- `src/components/dashboard/DashboardInsights.tsx` — adicionar estado de data local para cada ranking card

## 7. Paginacao nos cards de ranking (Anexo 7)
Os cards de ranking (Top Motoristas, Top Retornos, Conferentes mais ativos) terao paginacao interna: 10 registros por pagina com controles de navegacao (anterior/proximo) dentro do proprio card.

**Arquivo:** `src/components/dashboard/DashboardInsights.tsx` — adicionar estado de pagina por card, limitar exibicao a 10 por pagina, adicionar botoes prev/next

---

## Resumo de arquivos

| # | Arquivo | Alteracao |
|---|---|---|
| 1 | `DashboardHome.tsx` | Filtro de data global |
| 1 | `DashboardMetrics.tsx` | Receber props de data |
| 1 | `DashboardInsights.tsx` | Receber props de data |
| 2 | `DashboardSidebar.tsx` | Envolver login em form |
| 3 | `OperacaoPage.tsx` | Modal de TBRs ao clicar nos numeros |
| 4 | `OperacaoPage.tsx` | Fix icone placa |
| 4 | `ConferenciaCarregamentoPage.tsx` | Adicionar icone placa |
| 5 | `ConferenciaCarregamentoPage.tsx` | Fechar RTO ao escanear TBR reincidente |
| 6 | `DashboardMetrics.tsx` | Filtro de data por card |
| 6 | `DashboardInsights.tsx` | Filtro de data por card |
| 7 | `DashboardInsights.tsx` | Paginacao 10/pagina nos rankings |
