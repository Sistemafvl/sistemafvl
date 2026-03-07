

## Diagnóstico: Diferença entre "TBRs escaneados" na Visão Geral vs Operação

### Causa Raiz
No `DashboardMetrics.tsx` (Visão Geral), o cálculo de "TBRs escaneados" soma **duas coisas**:

1. Contagem via RPC `get_unit_tbr_count` — conta TBRs presentes em `ride_tbrs` (correto)
2. **Extra**: busca códigos TBR de `ps_entries` e `rto_entries` que **não estão** em `ride_tbrs`, e soma ao total (linhas 64-78)

O problema: quando um TBR é bipado na conferência e depois retorna como insucesso, o trigger `auto_remove_tbr_from_ride` deleta-o de `ride_tbrs`. Então o sistema conta esse TBR novamente via PS/RTO como "extra", inflando o número. Resultado: 3723 na Visão Geral vs 3698 na Operação (diferença = 25 TBRs contados em duplicidade).

A página de **Operação** está correta — conta apenas `ride_tbrs` (o que está na carga).

### Correção

**`DashboardMetrics.tsx`:**
- Remover o bloco de contagem extra de PS/RTO (linhas 64-78) do card indicador
- Remover o bloco equivalente no cálculo do gráfico de linha (linhas 142-153)
- O valor do RPC `get_unit_tbr_count` já representa a contagem correta: TBRs que foram lidos e estão na carga

Isso alinha ambas as telas para contar cada TBR apenas uma vez.

