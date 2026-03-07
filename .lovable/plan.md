

## Plano: Integrar Reativo como Adição nos Relatórios Financeiros

O Reativo é um **valor adicional** (R$ 20,00 por TBR ativado) que **soma** ao pagamento do motorista, similar ao Bônus.

### Alterações

**1. Interface `DriverPayrollData` (`PayrollReportContent.tsx`)**
- Adicionar campo `reativoTotal?: number`

**2. `fetchPayrollData` em `RelatoriosPage.tsx` (linhas 366-498)**
- Buscar `reativo_entries` do período para a unidade, agrupando por `driver_id`
- Criar `reativoByDriver` map (soma de `reativo_value` por motorista)
- Incluir `reativoTotal` no objeto de retorno
- Somar ao `totalValue` (linha 493): `+ reativoTotal`

**3. Modal de pré-visualização (`RelatoriosPage.tsx`, linha ~712)**
- Exibir linha "Reativo: +R$ X" (cor amber/amarelo) quando `reativoTotal > 0`

**4. PDF — `PayrollReportContent.tsx`**
- Adicionar metric box amber para Reativo na ficha individual (ao lado de Adicional)
- Adicionar coluna "Reat." no resumo geral (ao lado de Adic.)
- Incluir no grand total

**5. `MatrizFinanceiro.tsx`**
- Buscar `reativo_entries` agrupado por unidade, somar como coluna "Reativo" na tabela e no total

**6. `DriverRecebiveis.tsx`**
- Exibir reativo quando presente no `report_data` JSON

### Lógica
```
totalValue = (dias × valor TBR) - dnrDiscount + bonus + reativoTotal
```

