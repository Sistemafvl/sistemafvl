

## Diagnóstico

A exclusão falha silenciosamente porque o frontend usa o cliente Supabase com a chave `anon`, mas a tabela `drivers` só permite DELETE para o role `authenticated`. O motorista some da lista temporariamente (estado local) mas reaparece ao recarregar.

Além disso, excluir apenas da tabela `drivers` deixaria dados órfãos em tabelas relacionadas (`driver_documents`, `driver_rides`, `ride_tbrs`, `driver_invoices`, etc.).

## Plano

### 1. Adicionar ação `delete` na Edge Function `get-driver-details`
Usar o service role key (que já está disponível na função) para deletar permanentemente o motorista e todos os dados relacionados:
- `ride_tbrs` (via rides do motorista)
- `driver_rides`
- `driver_documents`
- `driver_invoices`
- `driver_bonus`
- `driver_fixed_values`
- `driver_custom_values`
- `driver_minimum_packages`
- `queue_entries`
- `rescue_entries`
- `unit_predefined_drivers`
- `unit_reviews`
- `ride_disputes`
- `dnr_entries` (por driver_id)
- `reativo_entries` (por driver_id)
- `drivers` (registro principal)

A função receberá `{ action: "delete", driver_id: "uuid" }` e executará todas as deleções em cascata.

### 2. Atualizar `AdminDriversPage.tsx`
Substituir o `supabase.from("drivers").delete()` por uma chamada `fetch` à Edge Function com `action: "delete"`, igual ao padrão já usado para listar motoristas.

**Arquivos alterados:**
- `supabase/functions/get-driver-details/index.ts` — adicionar handler de delete com cascata
- `src/pages/admin/AdminDriversPage.tsx` — chamar edge function para deletar

