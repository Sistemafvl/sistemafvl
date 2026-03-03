

## Plano de Implementação — 7 Ajustes

### 1. Modal de confirmação no botão "Gerar" da Folha de Pagamento
**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`

Adicionar um estado `showGenerateConfirm` e um `Dialog` de confirmação que aparece ao clicar em "Gerar". O modal exibirá:
- Título: "Gerar Folha de Pagamento?"
- Mensagem informativa: "Ao confirmar, será gerado um relatório final. Os motoristas serão notificados e poderão realizar o envio da Nota Fiscal de serviço pelo aplicativo."
- Botões: "Cancelar" e "Confirmar e Gerar"

Ao confirmar, chama `fetchPayroll()` normalmente.

---

### 2. Coluna do dia na Folha de Pagamento deve mostrar TBRs concluídos (não total)
**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx` (fetchPayrollData) + `src/pages/dashboard/reports/PayrollReportContent.tsx`

**Problema:** Na tabela Login x Dias do PDF, a coluna do dia mostra `tbrCount` (total de TBRs). Deveria mostrar `tbrCount - returns` (concluídos). A Sarah tem 58 TBRs e 2 retornos, mas o dia mostra 58 — deveria mostrar 56.

**Correção:** Adicionar o campo `completed` na estrutura `days[]` do payroll (`tbrCount - returns`). Atualizar `PayrollReportContent` para usar `completed` na tabela de Login x Dias e na linha TOTAL.

---

### 3. TBR registrado no Insucesso deve ser removido do carregamento do motorista
**Arquivos:** `src/pages/dashboard/RetornoPisoPage.tsx`, `src/pages/dashboard/PSPage.tsx`

**Problema:** Quando um TBR é registrado no Insucesso/PS/RTO durante o carregamento ativo, ele não sai da lista `ride_tbrs`. Isso impede re-bipagem e mantém contadores inflados.

**Correção:** Após salvar uma entrada em `piso_entries` (handleSave), `ps_entries` (handleSave) ou similar, executar:
```typescript
// Remover TBR da ride_tbrs se está em carregamento ativo
if (trackInfo?.ride_id) {
  await supabase.from("ride_tbrs").delete()
    .eq("ride_id", trackInfo.ride_id)
    .ilike("code", tbrCode);
}
```

Isso garante que:
- O TBR sai da lista de carregamento do motorista
- Os contadores (badge e "TBRs Lidos") refletem a contagem correta
- O TBR pode ser bipado em outro carregamento se necessário

---

### 4. Cards "Top Motoristas (Entregas)" e "Média diária por motorista" devem contabilizar entregas concluídas
**Arquivo:** `src/components/dashboard/DashboardMetrics.tsx`

**Problema:** Os cards mostram total de TBRs escaneados, sem descontar retornos (piso, PS, RTO).

**Correção:** Na lógica de cálculo do `driverTotals` (linha ~198), buscar também `piso_entries`, `ps_entries` e `rto_entries` para os ride_ids do período. Descontar os retornos dos totais por motorista antes de calcular média e ranking. Usar contagem de TBRs concluídos (total - retornos) em vez de total bruto.

---

### 5. Unidade mais frequente do motorista no modal de busca da fila
**Arquivo:** `src/components/dashboard/QueuePanel.tsx`

No modal "Adicionar Motorista na Fila", após encontrar o motorista (no card `foundDriver`), buscar a unidade mais frequente:
```typescript
const { data: topUnit } = await supabase
  .from("driver_rides")
  .select("unit_id, units!inner(name)")
  .eq("driver_id", driver.id)
  .order("completed_at", { ascending: false })
  .limit(100);
```
Contar `unit_id` mais frequente e exibir o nome da unidade abaixo dos dados do veículo como: "📍 Unidade mais frequente: SSP9"

Também exibir no resultado da busca por nome (lista de resultados).

---

### 6. Remover paginação da tela PS
**Arquivo:** `src/pages/dashboard/PSPage.tsx`

Remover `ITEMS_PER_PAGE`, `page`, `totalPages`, `paginatedEntries`. Renderizar `entries` diretamente na tabela em vez de `paginatedEntries`. Remover o bloco de navegação de páginas (linhas 1035-1047).

---

### 7. Registro no system_updates
Inserir registro das alterações implementadas na tabela `system_updates`.

---

### Arquivos afetados
1. `src/pages/dashboard/RelatoriosPage.tsx` — modal de confirmação + coluna concluídos
2. `src/pages/dashboard/reports/PayrollReportContent.tsx` — coluna concluídos no PDF
3. `src/pages/dashboard/RetornoPisoPage.tsx` — remover TBR da ride_tbrs ao registrar insucesso
4. `src/pages/dashboard/PSPage.tsx` — remover paginação + remover TBR da ride_tbrs ao registrar PS
5. `src/components/dashboard/DashboardMetrics.tsx` — entregas concluídas nos cards
6. `src/components/dashboard/QueuePanel.tsx` — unidade frequente do motorista

