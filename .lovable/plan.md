

# Fix: Bloquear bipagem de TBRs com PS fechado

## Problema
A RPC `process_tbr_scan` verifica duplicatas e calcula `trip_number`, mas **não consulta `ps_entries`** para checar se o TBR tem PS com `status = 'closed'`. Resultado: TBRs já resolvidos via PS podem ser bipados e carregados novamente.

## Solução

### Migration SQL — atualizar `process_tbr_scan`
Adicionar verificação logo após o check de duplicata:

```sql
-- Check if TBR has a closed PS (globally for this unit)
IF EXISTS (
  SELECT 1 FROM ps_entries
  WHERE UPPER(tbr_code) = v_code
    AND unit_id = p_unit_id
    AND status = 'closed'
) THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'TBR possui PS fechado e não pode ser carregado'
  );
END IF;
```

A função completa será recriada com `CREATE OR REPLACE` mantendo toda a lógica existente + esta nova verificação inserida entre o check de duplicata e o cálculo do `trip_number`.

## Arquivos alterados
- **Migration SQL** — `CREATE OR REPLACE FUNCTION process_tbr_scan` com bloqueio de PS fechado

