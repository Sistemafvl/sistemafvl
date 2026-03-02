

## Plano de Implementação (6 mudanças)

### 1. Renomear "Retorno Piso" para "Insucessos" no menu

**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx` (linha 51)

Alterar `{ title: "Retorno Piso", ... }` para `{ title: "Insucessos", ... }`. Manter a URL e o ícone iguais.

Tambem atualizar quaisquer referências visuais ao nome "Retorno Piso" em labels de métricas no `DashboardMetrics.tsx` (linha 243, label "Retornos Piso abertos" -> "Insucessos abertos") e no `DashboardHome.tsx` (caso exista referência ao texto).

---

### 2. Spinner no botão PDF do PS

**Arquivo:** `src/pages/dashboard/PSPage.tsx`

- Adicionar estado `generatingPdf` (boolean)
- No `generatePDF`, setar `true` no início e `false` no final
- No botão PDF (linha ~895), mostrar `Loader2 animate-spin` em vez de `FileText` enquanto `generatingPdf === true`, e desabilitar o botão

---

### 3. Modal de confirmação ao Finalizar carregamento

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

- Adicionar estado `finalizarConfirmRideId: string | null`
- Ao clicar "Finalizar" (linhas 1743 e 2039), em vez de chamar `handleFinalizar` diretamente, setar `finalizarConfirmRideId = ride.id`
- Criar um `Dialog` de confirmação com:
  - Icone de alerta amarelo
  - Texto: "Confirme com o motorista antes de finalizar:"
  - Exibir: **Quantidade de TBRs bipados** e **Login utilizado no coletor**
  - Botão "Confirmar e Finalizar" que chama `handleFinalizar(finalizarConfirmRideId)` e fecha o modal
  - Botão "Cancelar" que fecha o modal

---

### 4. Remover filtros de calendário dos cards de gráficos na Visão Geral + Substituir "Status dos carregamentos" por "Média diária por motorista"

**Arquivo:** `src/components/dashboard/DashboardMetrics.tsx`

- Remover o componente `DateRangeFilter` e os estados `barDates`, `lineDates`, `pieDates`
- Os 3 cards de gráficos passam a usar apenas os filtros globais `startDate`/`endDate`
- Substituir o card "Status dos carregamentos" (PieChart) por uma **lista de motoristas com média diária de TBRs finalizados**:
  - Buscar `driver_rides` finalizados no período, com contagem de TBRs por motorista
  - Calcular a média diária (total TBRs / dias no período)
  - Exibir lista paginada (5 por página) com nome do motorista e média

**Arquivo:** `src/components/dashboard/DashboardInsights.tsx`

- Remover os `DateRangeFilter` dos 3 `PaginatedRankingCard`
- Remover os estados `driverDates`, `returnDates`, `confDates`
- Os cards usam apenas os filtros globais `startDate`/`endDate` passados via props

---

### 5. Exclusão de TBR com senha do gerente + exclusão em lote

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Mudanças no card inline (linhas ~1848-1856) e no Focus Mode (linhas ~2003-2006):

- **Exclusão individual**: Ao clicar no X, abrir um modal pedindo a senha do gerente (`manager_password`). Validar contra a tabela `managers`. Só excluir se a senha for correta.

- **Exclusão em lote**:
  - Adicionar checkbox ao lado de cada TBR na lista (visível apenas para `isMyRide`)
  - Adicionar estado `selectedTbrsForDelete: Record<string, Set<string>>` (por ride_id)
  - Quando há TBRs selecionados, mostrar botão "Excluir selecionados (N)" que abre o mesmo modal de senha do gerente
  - Após validar senha, chamar `handleDeleteTbr` para cada TBR selecionado (em sequência ou paralelo)
  - Cada TBR excluído segue o fluxo existente: vai para Insucessos (piso_entries) com motivo "Removido do carregamento"

---

### 6. Verificação do mecanismo de amarelo (3 bipagens)

O mecanismo já está implementado e funcionando:
- Quando um TBR é bipado 3 vezes, o sistema detecta como triplicata
- Remove as 2 cópias extras e marca a original com `_yellowHighlight: true`
- O `getTbrItemClass` aplica `bg-yellow-100 text-yellow-700 border-yellow-300`
- O campo `highlight: "yellow"` é salvo no banco (`ride_tbrs.highlight`)

Nenhuma alteração necessaria neste mecanismo.

---

### Resumo de Arquivos Afetados

| Arquivo | Mudanças |
|---------|---------|
| `DashboardSidebar.tsx` | Renomear menu |
| `PSPage.tsx` | Spinner no PDF |
| `ConferenciaCarregamentoPage.tsx` | Modal finalizar + senha gerente para excluir + exclusão em lote |
| `DashboardMetrics.tsx` | Remover filtros cards + substituir pie chart por média diária |
| `DashboardInsights.tsx` | Remover filtros cards |

