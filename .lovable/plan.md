

# Plano: Renomear "TBRs Lidos" para "Concluídos" e mostrar valor do pacote no card "Insucessos"

## Alterações em `src/pages/driver/DriverHome.tsx`

### 1. Card "TBRs Lidos" → "Concluídos"
- Mudar label de `"TBRs Lidos"` para `"Concluídos"`
- Mudar valor de `metrics.totalLidos` para `metrics.totalTbrs` (que já representa os concluídos, pois ride_tbrs já tem retornos removidos pelo trigger)
- Trocar ícone para `CheckCircle2` e cor para `text-green-600`

### 2. Card "Insucessos" → mostrar valor R$ configurado
- Calcular o valor do TBR configurado pelo gerente (custom ou padrão da unidade) e expor no return do useMemo
- Mudar o valor do card de `metrics.totalReturns` (quantidade) para `formatBRL(metrics.totalReturns * tbrVal)` — mostrando o impacto financeiro dos insucessos
- Manter subtítulo ou tooltip com a quantidade para referência

### Dados técnicos
- O `tbrVal` já é calculado dentro do `useMemo` por dia; basta acumular um `totalReturnValue` (retornos × valor do TBR do dia) e retorná-lo no objeto de métricas
- Adicionar `totalReturnValue` ao return do useMemo

### Cards finais:
1. Total Corridas (Car, primary)
2. **Concluídos** (CheckCircle2, green) — era "TBRs Lidos"
3. Total Ganho (DollarSign, emerald)
4. Reativos (Zap, amber)
5. **Insucessos** (RotateCcw, red) — agora mostra `R$ valor` em vez de quantidade
6. Quinzena (CalendarDays, purple)

