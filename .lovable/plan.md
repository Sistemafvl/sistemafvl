
# Corrigir reversao de RTO ao excluir TBR incluso via sugestao

## Problema

Quando o usuario inclui um TBR via o balao de sugestao de RTO, o sistema:
1. Insere o TBR no `ride_tbrs`
2. Fecha o RTO (`status = 'closed'`)

Porem, ao clicar no X para remover esse TBR, o sistema apenas deleta o `ride_tbrs`, mas nao reabre o RTO. O balao de sugestao nao retorna porque o RTO continua com status "closed".

## Solucao

Modificar a funcao `handleDeleteTbr` em `ConferenciaCarregamentoPage.tsx` para:

1. Antes de deletar o TBR, verificar se existe um `rto_entries` com `status = 'closed'` cujo `tbr_code` corresponde ao codigo do TBR sendo excluido
2. Se existir, reabrir o RTO (`status = 'open'`, limpar `closed_at`)
3. Apos a exclusao, chamar `fetchOpenRtos()` para atualizar a lista de RTOs abertos e fazer o balao reaparecer

## Secao Tecnica

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**Funcao `handleDeleteTbr` (linha 374-381) - alteracao:**

```text
const handleDeleteTbr = async (tbrId: string, rideId: string) => {
  // Encontrar o codigo do TBR antes de remover
  const tbrToDelete = (tbrs[rideId] ?? []).find(t => t.id === tbrId);
  
  setTbrs((prev) => ({
    ...prev,
    [rideId]: (prev[rideId] ?? []).filter((t) => t.id !== tbrId),
  }));
  await supabase.from("ride_tbrs").delete().eq("id", tbrId);

  // Se o TBR excluido tinha um RTO fechado associado, reabrir
  if (tbrToDelete) {
    const { data: rtoMatch } = await supabase
      .from("rto_entries")
      .select("id")
      .eq("tbr_code", tbrToDelete.code)
      .eq("status", "closed")
      .eq("unit_id", unitId)
      .maybeSingle();
    if (rtoMatch) {
      await supabase
        .from("rto_entries")
        .update({ status: "open", closed_at: null })
        .eq("id", rtoMatch.id);
    }
  }

  fetchRides();
  fetchOpenRtos();
};
```

Isso garante que ao remover o TBR, o RTO volta a ficar pendente e o balao de sugestao reaparece automaticamente.
