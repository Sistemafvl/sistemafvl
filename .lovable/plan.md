

# Correção do Módulo "Socorrendo" — TBRs não são inseridos no carregamento do socorrista

## Problema Raiz

A tabela `ride_tbrs` tem uma política RLS de INSERT que **só permite inserir TBRs em rides com `loading_status` = 'pending' ou 'loading'**:

```sql
WITH CHECK: EXISTS (
  SELECT 1 FROM driver_rides 
  WHERE driver_rides.id = ride_tbrs.ride_id 
  AND driver_rides.loading_status = ANY (ARRAY['pending', 'loading'])
)
```

No código de resgate (`DriverRescue.tsx`, linha 126-129), o sistema tenta inserir no ride do socorrista com fallback para `finished`:

```typescript
const activeRide =
  rescuerRides.find((r) => r.loading_status === "loading") ??
  rescuerRides.find((r) => r.loading_status === "finished") ?? // ← BLOQUEADO PELA RLS
  rescuerRides[0];
```

Quando o socorrista já finalizou seu carregamento (status `finished`), a inserção no `ride_tbrs` é **silenciosamente rejeitada** pela RLS. O `rescue_entries` é criado normalmente, mas o TBR nunca aparece no carregamento do motorista.

## Solução

### 1. Criar RPC `process_rescue_tbr` (migration SQL)
Função `SECURITY DEFINER` que bypassa a RLS para inserções de resgate:
- Recebe: `p_code`, `p_original_tbr_id`, `p_rescuer_ride_id`, `p_trip_number`
- Deleta o TBR original
- Insere no ride do socorrista com `is_rescue = true` (sem restrição de `loading_status`)
- Retorna sucesso/erro

### 2. Atualizar `DriverRescue.tsx`
- Substituir as chamadas manuais de `delete` + `insert` na `ride_tbrs` pela RPC `process_rescue_tbr`
- Manter o restante da lógica (inserção em `rescue_entries`, feedback visual)

### Arquivos alterados
- **Migration SQL** — nova RPC `process_rescue_tbr`
- **`src/pages/driver/DriverRescue.tsx`** — usar a RPC em vez de operações diretas

