

# Correção: Criar função `process_tbr_scan` no banco de dados

## O Problema
O código chama `supabase.rpc('process_tbr_scan', ...)` mas essa função **não existe** no banco. Foi referenciada no código mas nunca criada via migration.

## A Solução
Criar a função SQL `process_tbr_scan` que consolida toda a lógica de inserção de TBR em uma única chamada ao banco, substituindo as múltiplas queries paralelas anteriores.

## O que a função faz (baseado no código que a consome):
1. Recebe `p_code`, `p_ride_id`, `p_unit_id`
2. Verifica se o TBR já existe neste ride (duplicata) → retorna `{ success: true, is_duplicate: true }`
3. Calcula o `trip_number` (quantas vezes este TBR já foi bipado em rides anteriores desta unidade + 1)
4. Insere na `ride_tbrs` com tratamento de conflito
5. Retorna `{ success: true, is_duplicate: false, trip_number: N }`

## Implementação
Uma migration SQL criando a função `process_tbr_scan` como `SECURITY DEFINER` que:
- Usa `SELECT ... FOR UPDATE` ou advisory lock para evitar race conditions
- Reutiliza o trigger `prevent_duplicate_tbr_across_rides` já existente
- Retorna JSON com `success`, `is_duplicate`, `trip_number`, e `error`

## Detalhes técnicos
```sql
CREATE OR REPLACE FUNCTION public.process_tbr_scan(
  p_code text, p_ride_id uuid, p_unit_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_code text := UPPER(TRIM(p_code));
  v_exists boolean;
  v_trip int;
  v_new_id uuid;
BEGIN
  -- Check duplicate in same ride
  SELECT EXISTS(
    SELECT 1 FROM ride_tbrs WHERE ride_id = p_ride_id AND UPPER(code) = v_code
  ) INTO v_exists;
  
  IF v_exists THEN
    RETURN jsonb_build_object('success', true, 'is_duplicate', true, 'trip_number', 1);
  END IF;

  -- Calculate trip_number from historical entries
  SELECT COUNT(*) + 1 INTO v_trip
  FROM (
    SELECT 1 FROM piso_entries WHERE UPPER(tbr_code) = v_code AND unit_id = p_unit_id
    UNION ALL
    SELECT 1 FROM ps_entries WHERE UPPER(tbr_code) = v_code AND unit_id = p_unit_id
    UNION ALL
    SELECT 1 FROM rto_entries WHERE UPPER(tbr_code) = v_code AND unit_id = p_unit_id
  ) hist;

  -- Insert (trigger prevent_duplicate_tbr_across_rides handles cross-ride check)
  INSERT INTO ride_tbrs (ride_id, code, trip_number)
  VALUES (p_ride_id, v_code, v_trip)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'is_duplicate', false, 'trip_number', v_trip);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

Nenhum arquivo de código precisa ser alterado -- apenas a migration para criar a função.

