

## Plano: Corrigir contagens na Operação

### Problema

| O que mostra | Valor | Esperado | Causa |
|---|---|---|---|
| Operação "TBRs Lidos" | 3683 | 3782 | Conta só `ride_tbrs` ativos, ignora retornos removidos |
| Operação "Insucessos" | 160 | 93 | Soma piso+PS+RTO, mas deveria ser só piso (insucesso real) |
| Dashboard "TBRs escaneados" | 3782 | 3782 | Correto (RPC) |

### Correções em `src/pages/dashboard/OperacaoPage.tsx`

**1. "TBRs Lidos" deve mostrar o total original bipado** (ride_tbrs + retornos removidos = mesmo que Dashboard):
```typescript
// Antes:
const totalLidos = totalTbrsAtual; // 3683

// Depois:
const totalLidos = totalTbrsAtual + totalReturnsRemoved; // 3782
```
Para calcular `totalReturnsRemoved`, usar a lógica já existente de `allReturnTbrSets` mas subtrair os que ainda estão em `ride_tbrs` (evitar dupla contagem). Basicamente: códigos retorno únicos que NÃO estão mais na `tbrCodesByRide`.

**2. "Insucessos" deve mostrar apenas piso entries (insucesso real)**, não PS+RTO:
```typescript
// Contar apenas pisoData retornos únicos (sem PS/RTO)
const totalInsucessos = pisoOnlyReturns; // 93
```
Criar contagem separada `pisoOnlyReturnSets` com apenas `pisoData`.

**3. Performance** recalcular como `totalTbrsAtual / totalLidos` (concluídos / total bipado).

**4. Atualizar tooltips:**
- TBRs Lidos: "Total de pacotes bipados na conferência do dia (cada TBR contado uma única vez)."
- Insucessos: "Total de insucessos (Retorno Piso) registrados nos carregamentos do dia. Não inclui PS e RTO."

### Arquivo afetado
- `src/pages/dashboard/OperacaoPage.tsx` — linhas 144-204 e 261-269

