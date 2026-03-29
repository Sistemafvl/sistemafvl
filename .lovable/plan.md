

## Plano: Trocar card "Retornos" por "Média Pacote"

### O que muda

No modal de pré-visualização da folha de pagamento (espelho, gerar ou consultar), o card que exibe **"Retornos"** será substituído por **"Média Pacote"**.

O cálculo é: `Valor Total / Total TBRs` (se Total TBRs = 0, exibe R$ 0,00). Referência direta da fórmula do Excel: `=SE(B179=0;0;C179/B179)`.

### Implementação

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`

Substituir o bloco das linhas 980-983:
```tsx
// DE:
<p className="text-xs text-muted-foreground">Retornos</p>
<p className="font-bold">{payrollData.reduce((s, d) => s + (d.totalReturns || 0), 0)}</p>

// PARA:
<p className="text-xs text-muted-foreground">Média Pacote</p>
<p className="font-bold">{(() => {
  const totalTbrs = payrollData.reduce((s, d) => s + (d.totalTbrs || 0), 0);
  const totalValue = payrollData.reduce((s, d) => s + (d.totalValue || 0), 0);
  return totalTbrs === 0 ? "R$ 0,00" : formatCurrency(totalValue / totalTbrs);
})()}</p>
```

Uma única alteração de 2 linhas. Nenhum outro arquivo afetado.

