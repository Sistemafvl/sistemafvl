

## Plano: Corrigir trigger de remoção de TBR ao criar insucesso/PS/RTO

### Problema
O trigger `auto_remove_tbr_from_ride` só remove o TBR do `ride_id` informado no insert de piso/ps/rto. Se o `ride_id` no insert não corresponder ao ride onde o TBR realmente está em `ride_tbrs`, a remoção falha silenciosamente.

Caso concreto: TBR319054171 foi bipado no ride `6eed97ea` (rota 0824, Wendel), mas o piso foi criado apontando para ride `21dfaa34` (rota 0814, Wendel). Trigger tentou deletar de `21dfaa34` — não encontrou nada. TBR ficou "fantasma" em `ride_tbrs`.

### Correção

**Alterar a função `auto_remove_tbr_from_ride`** para remover o TBR de QUALQUER ride, não apenas do `NEW.ride_id`:

```sql
CREATE OR REPLACE FUNCTION public.auto_remove_tbr_from_ride()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM ride_tbrs
  WHERE UPPER(code) = UPPER(NEW.tbr_code);
  RETURN NEW;
END;
$$;
```

Justificativa: o constraint `prevent_duplicate_tbr_across_rides` já garante que um TBR só existe em um ride por vez. Portanto, deletar sem filtrar por `ride_id` é seguro e mais robusto.

**Limpar o registro fantasma atual:**
```sql
DELETE FROM ride_tbrs
WHERE UPPER(code) = 'TBR319054171'
  AND ride_id = '6eed97ea-5ac5-4173-8176-3febf8c5d598';
```

### Arquivo afetado
- Migration SQL (trigger update + data cleanup)
- Nenhum arquivo de frontend precisa mudar

