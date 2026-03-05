

## Diagnóstico e Plano de Correção: Divergência Operação vs Conferência + Remoção do X

### Causa raiz identificada

O botão **X** na lista de TBRs deleta o registro de `ride_tbrs` e cria um `piso_entry` com reason `"Removido do carregamento"`. Como esse motivo está em `OPERATIONAL_PISO_REASONS`, ele é **excluído de todas as contagens de retorno** em todo o sistema. Resultado: o TBR some do `ride_tbrs` (não conta como concluído) E some dos retornos (não conta como insucesso). O total original encolhe e os números ficam errados.

No caso do Willian Santos: se 102 TBRs foram removidos via X e 3 tiveram insucesso real, `ride_tbrs` mostra poucos registros e `all_returns` mostra só 3, resultando em 0/3 ao invés do total real.

### Correções

**1. Remover botão X de excluir TBR** (`ConferenciaCarregamentoPage.tsx`)
- Remover o `<button>` com ícone `<X>` nas duas views: lista normal (linhas ~2030-2036) e modo foco (linhas ~2208-2210)
- Remover `handleDeleteTbr`, `handleDeleteTbrWithPassword`, `confirmDeleteTbrWithPassword` e modais relacionados (modal de senha individual)
- Remover botão "Excluir selecionados" (batch delete) e `confirmBatchDelete`
- **Manter checkboxes** conforme solicitado
- Manter `handleDeleteTbr` internamente apenas para uso do sistema (reset/cancel), mas remover acesso do usuário

**2. Corrigir cálculo da Operação** (`OperacaoPage.tsx`)
- Incluir piso entries com reason `"Removido do carregamento"` no total original (para reconstruir o total escaneado historicamente)
- Fórmula: `total_original = ride_tbrs.count + retornos_reais + removidos_operacionais`
- `concluidos = ride_tbrs.count + removidos_operacionais` (itens removidos manualmente não são insucessos, foram retirados antes da rota)
- `retornos_exibidos` = apenas piso/ps/rto não-operacionais
- Performance = `(total_original - retornos_reais) / total_original * 100`

**3. Alinhar cálculo financeiro** (`RelatoriosPage.tsx`)
- Verificar que a folha de pagamento (payroll) usa a mesma lógica: `tbrCount` deve incluir TBRs removidos operacionalmente para não subcontar
- `completed = tbrCount - net_returns` (onde net_returns exclui operacionais)

**4. Alinhar demais páginas** 
- `CiclosPage.tsx`, `DashboardInsights.tsx`, `DriverRides.tsx` — mesma lógica de reconstrução do total original
- Garantir consistência: "Removido do carregamento" conta como TBR escaneado (total), mas não como insucesso (retorno)

### Arquivos afetados
1. `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` — remover X, batch delete, modais de senha
2. `src/pages/dashboard/OperacaoPage.tsx` — incluir "Removido" no total original
3. `src/pages/dashboard/RelatoriosPage.tsx` — incluir "Removido" no tbrCount da folha
4. `src/pages/dashboard/CiclosPage.tsx` — mesma correção
5. `src/components/dashboard/DashboardInsights.tsx` — mesma correção
6. `src/pages/driver/DriverRides.tsx` — mesma correção

