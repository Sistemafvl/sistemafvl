

# Corrigir Cards de Metricas Vazios nos Relatorios PDF

## Problema
Os cards de metricas (TBRs, Retornos, Concluidos, Taxa, Media, Valor) aparecem com fundo colorido mas sem nenhum texto/numero visivel. Isso afeta o relatorio de Folha de Pagamento e tambem o de Retornos.

## Causa Raiz
Os componentes de relatorio usam `display: "none"` no container principal. Quando o `generatePDFFromContainer` muda para `display: "block"`, o `html2canvas` pode nao renderizar corretamente textos que nunca foram "laid out" pelo browser. Alem disso, no ReturnsReportContent os cards tem fontes muito pequenas (7px label).

## Solucao

### 1. Remover `display: "none"` dos componentes de relatorio
Em todos os 4 componentes de conteudo (PayrollReportContent, DailySummaryReportContent, ReturnsReportContent, RankingReportContent), trocar:
- `style={{ display: "none", ... }}` 

Por nenhum estilo de ocultacao — o `generatePDFFromContainer` ja posiciona o container off-screen com `position: absolute; left: -9999px` antes de capturar e depois esconde com `display: none`. O container comeca visivel (mas fora da tela por estar dentro de um elemento posicionado).

### 2. Corrigir tamanhos de fonte no ReturnsReportContent
Os cards de totais de Retornos (Piso, PS, RTO, Total) usam:
- Valor: `fontSize: "18px"` — aumentar para `22px` e cor `COLORS.tealDark`
- Label: `fontSize: "7px"` — aumentar para `10px` e cor `COLORS.dark`
- Adicionar `border` e `minWidth: "100px"` para consistencia

### 3. Verificar todos os relatorios
Garantir que nenhum componente de relatorio tenha `display: "none"` no estilo inline do container principal.

## Arquivos Alterados

**`src/pages/dashboard/reports/PayrollReportContent.tsx`**
- Remover `display: "none"` do container raiz

**`src/pages/dashboard/reports/DailySummaryReportContent.tsx`**
- Remover `display: "none"` do container raiz

**`src/pages/dashboard/reports/ReturnsReportContent.tsx`**
- Remover `display: "none"` do container raiz
- Corrigir tamanhos de fonte nos cards de metricas (valor 22px, label 10px)

**`src/pages/dashboard/reports/RankingReportContent.tsx`**
- Remover `display: "none"` do container raiz

**`src/pages/dashboard/reports/pdf-utils.ts`**
- Ajustar `generatePDFFromContainer` para garantir que o container comece visivel antes da captura e seja escondido ao final

