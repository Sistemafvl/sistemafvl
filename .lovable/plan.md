

## Plano: Corrigir ID do motorista no aceite de contrato

### Problema raiz
Em `DriverContractPage.tsx`, linha 12:
```typescript
const driverId = unitSession?.id; // ← Isto é o ID da UNIDADE, não do motorista!
```

Quando o motorista aceita o contrato, o registro em `driver_contracts` é salvo com o `unit_id` no campo `driver_id`. Na visão do diretor, `fetchAcceptances` busca motoristas reais via `driver_rides.driver_id` — os IDs nunca batem.

### Correção
Uma única linha em `src/pages/driver/DriverContractPage.tsx`:
```typescript
const driverId = unitSession?.user_profile_id; // ← ID correto do motorista
```

### Arquivo alterado
- `src/pages/driver/DriverContractPage.tsx` — corrigir `driverId` para usar `user_profile_id`

### Observação
Registros de aceite existentes (salvos com unit_id no campo driver_id) estão incorretos. Após a correção, o motorista precisará aceitar novamente para gerar o registro correto.

