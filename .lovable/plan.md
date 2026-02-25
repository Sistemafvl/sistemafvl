

# Plano: 3 Correções — TBRs do PS/RTO, Loading no Definir, Atualizações do Sistema

## Problema 1 — TBRs adicionados direto no PS/RTO não contam como "escaneados"

**Causa raiz**: O card "TBRs escaneados (hoje)" no `DashboardMetrics.tsx` (linha 91-102) conta apenas registros da tabela `ride_tbrs`. Quando um TBR é registrado diretamente na tela PS ou RTO (sem passar pela Conferência de Carregamento), ele não existe em `ride_tbrs` — só em `ps_entries` ou `rto_entries`. Logo, não é contabilizado.

**Solução**: Na função `fetchAll`, além de contar TBRs da tabela `ride_tbrs`, também contar TBRs **únicos** das tabelas `ps_entries` e `rto_entries` criados no mesmo período, que NÃO existam já em `ride_tbrs`. Somar ao total.

O mesmo ajuste se aplica ao gráfico de linha "TBRs escaneados" na `fetchChartData` tipo `line`.

### Arquivo: `src/components/dashboard/DashboardMetrics.tsx`

Na `fetchAll` (após linha 102):
- Buscar `ps_entries` e `rto_entries` do período com `unit_id`
- Coletar códigos TBR únicos que **não** estejam no set de `ride_tbrs` já contados
- Somar ao `todayTbrCount`

Na `fetchChartData` tipo `line`:
- Mesma lógica: adicionar TBRs de PS/RTO por dia

---

## Problema 2 — Botão "Definir" sem indicador de carregamento

**Causa raiz**: A função `handleDefinir` no `QueuePanel.tsx` (linha 199-216) não possui estado de loading. O botão fica clicável e sem feedback visual durante a chamada à edge function.

**Solução**: Adicionar estado `definingRide` e usá-lo no botão.

### Arquivo: `src/components/dashboard/QueuePanel.tsx`

1. Adicionar estado: `const [definingRide, setDefiningRide] = useState(false);`
2. No `handleDefinir`: envolver com `setDefiningRide(true)` no início e `setDefiningRide(false)` no finally
3. No botão "Definir" (linha 420): adicionar `disabled={definingRide}` e mostrar `<Loader2 className="animate-spin" />` quando `definingRide` é true

---

## Problema 3 — Lista de Atualizações do Sistema não preenchida

**Causa raiz**: O sistema de "Atualizações do Sistema" é **manual** — o admin precisa ir na página admin e criar cada entrada. Não existe automação que detecte mudanças no código e registre automaticamente.

O usuário espera que o feed reflita as mudanças feitas durante o desenvolvimento, mas o componente `SystemUpdates.tsx` apenas lê da tabela `system_updates`, que só tem dados se alguém inseriu manualmente via `AdminSystemUpdates`.

**Solução**: Como a automação real de changelog requer integração com o pipeline de deploy (fora do escopo), a solução prática é **popular a tabela com as atualizações recentes** que foram feitas nesta sessão de desenvolvimento, garantindo que o feed funcione. Além disso, verificar se o componente está renderizando corretamente no dashboard.

Vou inserir via migração SQL as atualizações recentes mais relevantes para que o feed já apareça preenchido. E verificar se o `SystemUpdates` está de fato sendo renderizado no `DashboardHome`.

O componente `SystemUpdates` já está importado e usado no `DashboardHome.tsx` (linha 18). Preciso verificar se está renderizado na parte visível da página.

---

## Resumo de Arquivos

| Arquivo | Alteração |
|---|---|
| `src/components/dashboard/DashboardMetrics.tsx` | Incluir TBRs de `ps_entries` e `rto_entries` na contagem e gráfico |
| `src/components/dashboard/QueuePanel.tsx` | Adicionar loading state no botão "Definir" |
| Migração SQL | Popular `system_updates` com changelog recente |

