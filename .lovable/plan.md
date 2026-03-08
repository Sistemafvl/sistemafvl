

# Plano: Modal de escolha PDF/Excel + Geração de Excel na Folha de Pagamento

## Resumo

Adicionar um modal intermediário nos botões "Espelho" e "Gerar" perguntando se o usuário quer baixar em **PDF** ou **Excel**. O Excel seguirá o modelo fornecido com seção única, dados concluídos, descontos/adicionais preenchidos e resumo completo.

## Estrutura do Excel (baseada no modelo)

```text
┌─────────────────────────────────────────────────────────────────────┐
│ MOTORISTAS POR PACOTES                                              │
│                                                                     │
│ DADOS FINANCEIROS                                                   │
│ NOME COMPLETO | Veículo | VALOR POR PACOTE | TOTAL PACOTES |       │
│ DESCONTOS | ADICIONAL | TOTAL GERAL | CPF | CHAVE PIX |            │
│ [dia1] | [dia2] | ... | TOTAL                                       │
│─────────────────────────────────────────────────────────────────────│
│ Driver 1      | CARRO   | R$ 3,35          | 834   | -R$50 | +R$30 │
│ Driver 2      | MOTO    | R$ 2,20          | 150   |       |       │
│ ...                                                                 │
│─────────────────────────────────────────────────────────────────────│
│ Total         |         |                  | 15274 | -R$50 | +R$30 │
│                                                                     │
│ RESUMO        | Qtd Pacotes | Valor Total | Média Pacote            │
│ TOTAL         | 15274       | R$ 50.522   | R$ 3,31                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Colunas do Excel

| Coluna | Origem no sistema |
|--------|------------------|
| NOME COMPLETO | `driver.name` |
| Veículo | Inferido: se `tbrValueUsed` <= 2.50 = "MOTO", senão "CARRO" |
| VALOR POR PACOTE | `tbrValueUsed` (custom ou unit default) |
| TOTAL DE PACOTES ENTREGUES | `totalCompleted` |
| DESCONTOS | `dnrDiscount` (do sistema) |
| ADICIONAL | `bonus + reativoTotal` (do sistema) |
| TOTAL GERAL | `(pacotes × valor) - descontos + adicional` |
| CPF | `driver.cpf` formatado |
| CHAVE PIX | `driver.pixKey` |
| Dias (dinâmicos) | Concluídos por dia (vazio se não trabalhou) |
| TOTAL (última col) | Soma dos dias |

## Mudanças

### 1. Instalar `xlsx` (SheetJS)
- Adicionar dependência `xlsx` para gerar `.xlsx` no browser.

### 2. Criar `src/pages/dashboard/reports/generatePayrollExcel.ts`
- Função que recebe `DriverPayrollData[]` + metadados e gera/baixa o arquivo `.xlsx`.
- Cabeçalhos formatados, linha de totais, bloco de resumo no rodapé.
- Valores monetários formatados em pt-BR.

### 3. Criar componente `FormatChoiceModal`
- Modal simples com 2 botões: PDF e Excel.
- Recebe callback `onChoose(format: "pdf" | "excel")`.

### 4. Modificar `RelatoriosPage.tsx`
- Nos botões "Espelho" e "Gerar": após preview, trocar "Baixar PDF" / "Confirmar e Gerar" por botões que abrem o `FormatChoiceModal`.
- Se escolher PDF: fluxo atual (html2canvas + jsPDF).
- Se escolher Excel: chamar `generatePayrollExcel()` com os mesmos dados.
- O fluxo de "Gerar" continua salvando no banco antes de baixar, independente do formato.

## Detalhes Técnicos

- A inferência CARRO/MOTO usa o valor do TBR: `<= 2.50` = MOTO, caso contrário CARRO.
- O `TOTAL GERAL` no Excel será calculado como: `(totalCompleted × tbrValue) - dnrDiscount + bonus + reativoTotal`.
- Células vazias nos dias = motorista não trabalhou (não colocar 0).
- Nome do arquivo: `folha_pagamento_[unidade]_[periodo].xlsx`.

