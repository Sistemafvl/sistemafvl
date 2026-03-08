

# Plano: Adicionar estilos ao Excel com `xlsx-js-style`

## Problema

A lib `xlsx` (SheetJS community) realmente **não suporta** estilos de célula. Mas o fork `xlsx-js-style` é um drop-in replacement que adiciona suporte completo a:

- **Cores de fundo** (fill) — amarelo nos títulos, verde nos totais
- **Negrito** (bold)
- **Bordas** em todas as células
- **Alinhamento** (centralizado, esquerda)
- **Merge de células** para títulos de seção

## Mudanças

### 1. Trocar dependência `xlsx` por `xlsx-js-style`

- Remover `xlsx` do `package.json`
- Adicionar `xlsx-js-style` (API idêntica, mesmo import pattern)
- Atualizar o import em `generatePayrollExcel.ts`

### 2. Aplicar estilos no `generatePayrollExcel.ts`

Após gerar o worksheet com `aoa_to_sheet`, percorrer as células e aplicar estilos:

| Elemento | Estilo |
|----------|--------|
| Título "MOTORISTAS FIXOS..." | Fundo amarelo (#FFD700), negrito, merge across |
| "DADOS FINANCEIROS" | Negrito |
| Headers (NOME, Veículo...) | Fundo amarelo (#FFD700), negrito, centralizado, bordas |
| Linhas de dados | Bordas finas, alinhamento centralizado nas colunas numéricas |
| Linha TOTAL | Fundo verde (#92D050), negrito, bordas |
| Título "MÍNIMO 60 PACOTES" | Fundo verde (#92D050), negrito, merge |
| Bloco CONSOLIDADO | Fundo cinza claro, negrito, bordas |
| Bloco RESUMO | Negrito nos headers, bordas |

### 3. Merge de células

- Títulos de seção: merge da coluna A até a última coluna
- Linha "DADOS FINANCEIROS": merge similar
- Linha de metadados (Unidade/Período/Gerado): merge em grupos

### Detalhes técnicos

- `xlsx-js-style` usa a propriedade `s` em cada célula: `ws["A1"].s = { font: { bold: true }, fill: { fgColor: { rgb: "FFD700" } }, border: {...}, alignment: { horizontal: "center" } }`
- Sem impacto em outros arquivos — mesmo API do `xlsx`
- A logo continuará como texto (limitação de complexidade), mas o visual ficará profissional com as cores e formatação

