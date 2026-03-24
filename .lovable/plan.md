

# Fix: Socorrendo deve funcionar independente do status do card

## Problema
A página `UnitRescuePage.tsx` (linha 172-180) faz um `UPDATE` direto na tabela `ride_tbrs`:
```typescript
await supabase.from("ride_tbrs").update({ ride_id: targetInfo.rideId, is_rescue: true }).in("id", tbrIds);
```

A policy RLS de UPDATE em `ride_tbrs` exige que o `loading_status` do ride seja `'pending'` ou `'loading'`. Quando o card está `'finished'`, o UPDATE é **silenciosamente rejeitado** pela RLS -- os TBRs somem do UI (otimismo) mas voltam ao recarregar.

## Solução

### 1. Migration SQL -- nova RPC `process_rescue_tbr_batch`
Função `SECURITY DEFINER` que recebe um array de IDs de TBRs e o ride de destino, fazendo o UPDATE internamente (bypassa RLS):

```sql
CREATE OR REPLACE FUNCTION public.process_rescue_tbr_batch(
  p_tbr_ids uuid[],
  p_target_ride_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_count int;
BEGIN
  UPDATE ride_tbrs
  SET ride_id = p_target_ride_id, is_rescue = true
  WHERE id = ANY(p_tbr_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'moved', v_count);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

### 2. `src/pages/dashboard/UnitRescuePage.tsx`
Substituir o `supabase.from("ride_tbrs").update(...)` (linhas 172-182) pela chamada à nova RPC:

```typescript
const { data: rpcResult, error: rpcError } = await supabase.rpc("process_rescue_tbr_batch", {
  p_tbr_ids: tbrIds,
  p_target_ride_id: targetInfo.rideId,
});
if (rpcError || !(rpcResult as any)?.success) throw new Error(rpcError?.message || (rpcResult as any)?.error);
```

## Arquivos alterados
- **Migration SQL** -- nova função `process_rescue_tbr_batch`
- **`src/pages/dashboard/UnitRescuePage.tsx`** -- usar RPC em vez de update direto

