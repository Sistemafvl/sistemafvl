

## Plano Revisado — 3 Correções

### 1. Discrepância no relatório de pagamento (Anexos 1-4)

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`

**Problema:** Linha 411 usa `new Set(rTbrs.map(t => t.code))` para deduplicar TBRs por código. Quando um TBR é carregado, vai pro insucesso, e é re-carregado no mesmo dia, o Set conta como 1, mas a Operação conta como 2 (um por ride). Isso causa a diferença de 133 vs 134 e 72 vs 73.

**Correção:** Usar `rTbrs.length` em vez de `uniqueTbrCodes.size` para o `tbrCount`. Remover a variável `uniqueTbrCodes`. Ajustar a lógica de `netReturns` para contar por instância (não por código único).

---

### 2. Amarelo permanente no TBR bipado 3x (Anexos 5-6)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**Problema:** O amarelo já é salvo no banco (`highlight: "yellow"`) e lido no refetch (linha 452), mas o `setTimeout` de 1 segundo atrasa o `UPDATE` no banco. Se um realtime event dispara antes, o refetch ainda lê `highlight: null` e perde o amarelo.

**Correção:**
1. Executar o `await supabase.update({ highlight: "yellow" })` **imediatamente** (não dentro do setTimeout)
2. Manter o setTimeout apenas para a limpeza visual dos duplicatas temporários
3. Aumentar o realtime lock para 15 segundos para dar margem

Assim o amarelo é gravado no banco instantaneamente e qualquer refetch subsequente o restaura via `t.highlight === "yellow"` — ficando amarelo **para sempre**.

---

### 3. Timeline cronológica do TBR (Anexo 7)

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

**Problema:** Linha 197 marca TODOS os registros em `ride_tbrs` como "Origem: Conferência Carregamento". O rastro real deveria ser: Carregamento → Insucesso → Re-carregamento → Insucesso → Re-carregamento.

**Correção:** 
1. Ordenar `rideTbrs` por `scanned_at` crescente
2. O primeiro registro recebe "Origem: Conferência Carregamento"
3. Os registros seguintes recebem "Re-carregado: Conferência Carregamento"
4. Os eventos de piso/PS/RTO já aparecem corretamente entre eles pela ordenação cronológica final

---

### Arquivos afetados
1. `src/pages/dashboard/RelatoriosPage.tsx` — corrigir contagem de TBRs
2. `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` — amarelo permanente
3. `src/pages/dashboard/DashboardHome.tsx` — timeline cronológica

