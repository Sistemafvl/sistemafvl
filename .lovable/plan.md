

## Análise do Problema

O TBR318154303 foi carregado no Eduardo e depois no Renato sem passar pelo insucesso. A causa é uma **condição de corrida (race condition)** no fluxo de validação:

1. O frontend verifica se o TBR já existe em `ride_tbrs` de outro carregamento ativo (linhas 973-1017)
2. Porém, essa verificação é feita via consulta ao banco — se dois conferentes bipam o mesmo TBR quase simultaneamente em rides diferentes, a segunda consulta pode não encontrar o registro da primeira (que ainda está sendo inserido)
3. A constraint única no banco é `(ride_id, trip_number, UPPER(code))` — protege apenas duplicatas **dentro do mesmo ride**, não **entre rides diferentes**

## Solução

Duas camadas de proteção complementares:

### 1. Constraint no banco de dados (proteção definitiva)
Criar um índice único parcial que impede o mesmo TBR de existir em mais de um carregamento ativo ao mesmo tempo. Usar uma abordagem via trigger `BEFORE INSERT` em `ride_tbrs` que verifica se o código já existe em outro ride cujo `loading_status` seja `pending` ou `loading`.

```sql
CREATE OR REPLACE FUNCTION public.prevent_duplicate_tbr_across_rides()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ride_tbrs rt
    JOIN driver_rides dr ON dr.id = rt.ride_id
    WHERE UPPER(rt.code) = UPPER(NEW.code)
      AND rt.ride_id != NEW.ride_id
      AND dr.loading_status IN ('pending', 'loading')
  ) THEN
    RAISE EXCEPTION 'TBR already exists in another active loading';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_tbr_unique_across_active_rides
  BEFORE INSERT ON ride_tbrs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_tbr_across_rides();
```

### 2. Tratamento do erro no frontend
Na função `saveTbr`, capturar o erro do `INSERT` em `ride_tbrs`. Se o banco rejeitar por duplicata cross-ride, remover o item otimista do state local e exibir toast de erro.

### Alterações por arquivo

- **Nova migração SQL**: Criar trigger `prevent_duplicate_tbr_across_rides` conforme acima
- **`ConferenciaCarregamentoPage.tsx`**: No trecho do `insert` (linha ~1095), capturar o `error` retornado. Se houver erro contendo "TBR already exists in another active loading", remover o TBR otimista do state, tocar beep de erro e exibir toast informando que o TBR já está em outro carregamento ativo

