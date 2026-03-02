

## Plano de Implementação (2 mudanças)

### 1. Contador "TBRs Final" na Conferência Carregamento

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

O "TBRs Lidos" mostra o total de TBRs que foram escaneados (incluindo os que depois saíram para Insucessos). A ideia é adicionar um segundo contador **"TBRs Final"** que mostra quantos TBRs **ainda estão** no carregamento (excluindo os removidos).

**Implementação:**
- Buscar da tabela `piso_entries` os registros com `reason = "Removido do carregamento"` que referenciam TBRs do carregamento atual (por `ride_id` ou matching de códigos)
- Calcular `tbrsFinal = rideTbrs.length` (que já é correto pois o DELETE remove da `ride_tbrs`)
- Na verdade, como `handleDeleteTbr` já faz DELETE do `ride_tbrs`, o `rideTbrs.length` já **é** o número final. O "TBRs Lidos" deveria mostrar o total histórico (incluindo removidos).
- **Solução**: Manter um estado separado `totalScanned` por ride que rastreie o total original (ride_tbrs atuais + piso_entries com motivo "Removido do carregamento" para aquele ride). Exibir:
  - `TBRs Lidos (112)` = total que foi escaneado historicamente
  - `TBRs Final (97)` = `rideTbrs.length` (os que de fato estão no carregamento)
- Aplicar nos 4 locais: badge do card, "TBRs Lidos" inline, badge focus mode, "TBRs Lidos" focus mode

### 2. Loading spinner nos 3 cards de gráficos da Visão Geral

**Arquivo:** `src/components/dashboard/DashboardMetrics.tsx`

Atualmente o `loading` state controla apenas os cards de métricas no topo. Os 3 cards inferiores (Carregamentos, TBRs escaneados, Média diária) carregam dados via `fetchChartData` que não tem estado de loading próprio.

**Implementação:**
- Adicionar estado `chartLoading` (boolean), setar `true` no início de `fetchChartData` e `false` no final
- Nos 3 cards (linhas 270-346), exibir `<Loader2 className="h-6 w-6 animate-spin" />` centralizado no `CardContent` enquanto `chartLoading === true`
- Manter o conteúdo atual quando `chartLoading === false`

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `ConferenciaCarregamentoPage.tsx` | Contador "TBRs Final" ao lado de "TBRs Lidos" |
| `DashboardMetrics.tsx` | Estado `chartLoading` + spinner nos 3 cards |

