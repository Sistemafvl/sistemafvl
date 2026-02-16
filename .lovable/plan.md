

# Corrigir Cards de Metricas Vazios — Solucao Definitiva

## Problema
Os cards de metricas (TBRs, Retornos, Concluidos, etc.) aparecem com fundo colorido mas sem texto/numeros. Isso acontece porque o `html2canvas` nao consegue capturar corretamente elementos que sao renderizados condicionalmente e depois movidos off-screen via JavaScript.

## Causa Raiz
O fluxo atual e:
1. Estado e setado (`setPayrollData`) — componente renderiza no DOM sem posicionamento off-screen
2. Apos 500ms, `generatePDFFromContainer` move o container para `left: -9999px` e espera mais 400ms
3. `html2canvas` captura — mas nesse ponto os textos dentro de `inline-block` podem nao estar corretamente calculados

O `html2canvas` tem um bug conhecido onde textos em elementos `inline-block` posicionados off-screen via JavaScript nao sao renderizados corretamente.

## Solucao

### 1. Wrapper off-screen permanente no RelatoriosPage
Envolver todos os report containers em um `div` com estilo fixo `position: fixed; left: -9999px; top: 0; width: 1122px` — assim os componentes ja nascem posicionados off-screen com largura definida, e o browser calcula o layout completo desde o inicio.

### 2. Simplificar generatePDFFromContainer
Remover a logica de posicionamento do `generatePDFFromContainer` ja que o wrapper pai cuida disso. Manter apenas o delay e a captura.

### 3. Garantir visibilidade dos textos
Trocar o `display: "inline-block"` dos metric boxes para usar `display: "flex"` com `flex-direction: column` — `html2canvas` lida melhor com flex do que com inline-block para textos.

## Arquivos a Alterar

**`src/pages/dashboard/RelatoriosPage.tsx`**
- Envolver os 4 report containers em um div com `style={{ position: "fixed", left: "-9999px", top: 0, width: "1122px", zIndex: -1 }}`

**`src/pages/dashboard/reports/pdf-utils.ts`**
- Remover as linhas que setam `position`, `left`, `top`, `width` no container (pois o wrapper pai ja faz isso)
- Manter apenas `display: "block"` e o delay antes da captura
- No final, nao setar `display: none` (container fica off-screen permanentemente)

**`src/pages/dashboard/reports/PayrollReportContent.tsx`**
- Trocar `display: "inline-block"` dos metric boxes para `display: "flex"`, `flexDirection: "column"`, `alignItems: "center"`, `justifyContent: "center"`

**`src/pages/dashboard/reports/ReturnsReportContent.tsx`**
- Mesma correcao nos metric boxes: `display: "flex"` ao inves de layout implicito por bloco
