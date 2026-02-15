
# Corrigir Relatorios: Download PDF + Funcionamento

## Problema
1. O botao "Gerar PDF" da Folha de Pagamento abre o dialogo de impressao do navegador (`window.print()`) em vez de baixar um arquivo PDF diretamente.
2. Os outros 3 botoes mostram "Em breve" (comportamento esperado), mas o usuario esperava que funcionassem.

## Solucao

### 1. Gerar PDF como download direto
Substituir `window.print()` por geracao de PDF real usando as bibliotecas `jspdf` e `html2canvas`:
- Instalar `jspdf` e `html2canvas` como dependencias
- Apos montar o conteudo do relatorio em uma div oculta (ja existe), capturar com `html2canvas` e converter para PDF com `jspdf`
- O arquivo sera baixado automaticamente com nome tipo `folha_pagamento_01-02-2026_a_15-02-2026.pdf`

### 2. Tornar a div do relatorio visivel temporariamente
- A div com classe `hidden print:block` precisa ficar visivel momentaneamente para o `html2canvas` capturar
- Mostrar a div, capturar cada pagina (resumo + fichas individuais), e esconder novamente

## Alteracoes tecnicas

**Dependencias novas:** `jspdf`, `html2canvas`

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`
- Remover `window.print()` e a logica de `@media print`
- Criar funcao `generatePDF()` que:
  1. Torna a div do relatorio visivel temporariamente
  2. Usa `html2canvas` para capturar cada secao (resumo + cada ficha individual)
  3. Adiciona cada captura como pagina no `jspdf`
  4. Chama `pdf.save("folha_pagamento_PERIODO.pdf")` para download direto
  5. Esconde a div novamente
- Manter o layout do relatorio como esta (tabelas, metricas, insights) mas ajustar os estilos para renderizacao em tela (remover dependencia de `@media print`)
- A div do relatorio usara `position: absolute; left: -9999px` em vez de `hidden` para permitir captura pelo html2canvas
