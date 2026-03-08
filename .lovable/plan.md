

## Plano: Corrigir lógica dos cards por tela

### Resumo das regras por tela

| Tela | Card | Deve mostrar |
|------|------|-------------|
| Dashboard (Visão Geral) | TBRs escaneados | Todos TBRs únicos do dia (ride_tbrs + retornos). **Já está correto** via RPC. |
| Dashboard | Insucessos abertos | Todos os abertos independente de data. **Já está correto** (`eq("status","open")`). |
| Operação | TBRs Lidos | Apenas TBRs concluídos (ride_tbrs ativos). **ERRADO** — hoje soma retornos. |
| Operação | Insucessos | Retornos. **Já está correto.** |
| Ciclos | Total TBRs Lidos | Todos TBRs únicos do dia (ride_tbrs + retornos). **Já está correto.** |

### Única alteração necessária

**`src/pages/dashboard/OperacaoPage.tsx`** — linhas 200-203:

Atualmente:
```typescript
const totalLidos = totalTbrsAtual + totalAllReturns;
const performanceRate = totalLidos > 0 ? ((totalTbrsAtual / totalLidos) * 100).toFixed(1) : "100";
```

Deve mudar para:
```typescript
const totalLidos = totalTbrsAtual; // Apenas concluídos (ride_tbrs)
const totalOriginal = totalTbrsAtual + totalAllReturns; // Para cálculo de performance
const performanceRate = totalOriginal > 0 ? ((totalTbrsAtual / totalOriginal) * 100).toFixed(1) : "100";
```

E atualizar o texto do InfoButton de "TBRs Lidos" para: "Total de pacotes atualmente na carga (concluídos). Não inclui retornos (insucesso, PS, RTO)."

### Arquivos afetados
- `src/pages/dashboard/OperacaoPage.tsx` — corrigir `totalLidos` e tooltip

