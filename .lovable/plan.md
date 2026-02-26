

# Plano: Fixar timestamp do TBR no momento exato da bipagem

## Problema

Linha 636 cria o TBR local com `scanned_at: new Date().toISOString()` para exibição imediata. Mas linha 717 faz o insert sem passar `scanned_at`, então o banco gera seu próprio timestamp default (alguns milissegundos/segundos depois). Quando o `fetchRides` recarrega os dados, o horário muda.

## Correção

Passar o mesmo `scanned_at` do TBR local no insert do banco. Uma linha:

**Linha 717** de `ConferenciaCarregamentoPage.tsx`:
```typescript
// Antes:
await supabase.from("ride_tbrs").insert({ ride_id: rideId, code, trip_number: tripNumber } as any);

// Depois:
await supabase.from("ride_tbrs").insert({ ride_id: rideId, code, trip_number: tripNumber, scanned_at: newTbr.scanned_at } as any);
```

Isso garante que o horário exibido inicialmente e o gravado no banco são idênticos.

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Adicionar `scanned_at: newTbr.scanned_at` no insert da linha 717 |

