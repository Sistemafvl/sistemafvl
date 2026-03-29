

## Plano: 3 correções

### 1. Corrigir erro de build em `GeneralAnalysisPage.tsx`
O arquivo ainda usa `RadixTooltip` no JSX (linhas 140-167) mas esse nome não está importado. Solução: substituir todas as ocorrências de `<RadixTooltip>` e `</RadixTooltip>` por `<Tooltip>` e `</Tooltip>` (do import UI na linha 7). O `RechartsTooltip` na linha 208 está correto.

### 2. Aceitar qualquer tipo de arquivo no upload de NF (`DriverRecebiveis.tsx`)
O input atual tem `accept=".pdf,.jpg,.jpeg,.png"`. Remover o atributo `accept` para permitir qualquer formato de arquivo.

### 3. Adicionar tabela resumo no Excel + remover abas extras (`generatePayrollExcel.ts`)
- **Tabela resumo a partir da coluna Z, linha 7**: 3 colunas — Nome do Motorista, Total Tabela 1 (TOTAL GERAL da seção fixa), Total Tabela 2 (TOTAL GERAL da seção mínimo 60), e Total. Com totais ao final das colunas.
- **Remover**: chamada de `createIndicadoresSheet` e todo o loop de criação de abas individuais por motorista. Manter apenas a aba "Fechamento".

### Arquivos alterados
- `src/pages/matriz/GeneralAnalysisPage.tsx` — corrigir `RadixTooltip` → `Tooltip`
- `src/pages/driver/DriverRecebiveis.tsx` — remover atributo `accept` dos inputs de arquivo
- `src/pages/dashboard/reports/generatePayrollExcel.ts` — adicionar resumo na coluna Z e remover abas Indicadores e individuais

