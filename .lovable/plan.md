

# Plano: Abas Individuais por Motorista + Fórmulas Excel + Tabela de Pacotes Mínimos

## Resumo

Vou expandir o `generatePayrollExcel.ts` para:

1. **Abas individuais por motorista** — após a aba "Folha de Pagamento", cada motorista terá sua própria aba com resumo diário, valores e totais, tudo com **fórmulas Excel nativas** (SUM, PRODUCT, etc.) para que o gerente possa editar valores e os cálculos se atualizem automaticamente.

2. **Tabela de Pacotes Mínimos sempre presente** — mesmo sem dados configurados, a seção de "Mínimo de 60 Pacotes" será criada com linhas em branco prontas para preenchimento manual, com fórmulas embutidas.

3. **Fórmulas na aba principal** — substituir os valores hardcoded de TOTAL GERAL, TOTAL DE PACOTES, DESCONTOS e somas diárias por fórmulas `SUM` e `PRODUCT` do Excel.

## Estrutura de cada aba individual do motorista

```text
Aba: "Nome Do Motorista"
┌──────────────────────────────────────────┐
│ RESUMO DO MOTORISTA                       │
├──────────────┬───────────────────────────┤
│ Nome         │ João Silva                │
│ CPF          │ 123.456.789-00            │
│ Veículo      │ CARRO                     │
│ Chave PIX    │ email@email.com           │
│ Valor/Pacote │ R$ 3,35                   │
├──────────────┴───────────────────────────┤
│                                           │
│ DETALHAMENTO DIÁRIO                       │
├────────┬──────────┬──────────┬───────────┤
│  Data  │ Pacotes  │ Retornos │ Concluídos│
│ 01/03  │    45    │    3     │ =B-C (fml)│
│ 02/03  │    52    │    1     │ =B-C (fml)│
│ ...    │          │          │           │
│ TOTAL  │ =SUM()   │ =SUM()   │ =SUM()   │
├────────┴──────────┴──────────┴───────────┤
│                                           │
│ RESUMO FINANCEIRO                         │
├──────────────────┬───────────────────────┤
│ Total Pacotes    │ =ref célula TOTAL      │
│ Valor por Pacote │ R$ 3,35               │
│ Subtotal         │ =Pacotes*Valor (fml)   │
│ Descontos (DNR)  │ R$ xx                  │
│ Adicional        │ R$ xx                  │
│ TOTAL A PAGAR    │ =Subtotal-Desc+Adic    │
└──────────────────┴───────────────────────┘
```

## Fórmulas na aba principal

- Coluna "TOTAL" (última): `=SUM(J5:X5)` (soma das colunas de datas)
- Coluna "TOTAL GERAL": `=D5*C5-E5+F5` (pacotes × valor - descontos + adicional)
- Linha TOTAL: `=SUM(D5:D30)` para cada coluna numérica

## Tabela de Pacotes Mínimos (sempre criada)

- Se não houver motoristas configurados, cria 10 linhas em branco com fórmulas prontas
- Colunas: Nome, Veículo, Valor/Pacote, Total Pacotes, Descontos, Adicional, Total Geral, CPF, PIX, [datas...], Total
- Fórmulas de TOTAL GERAL e TOTAL por linha já embutidas

## Arquivos alterados

- `src/pages/dashboard/reports/generatePayrollExcel.ts` — toda a lógica descrita acima

