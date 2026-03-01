

## Problema

Existem TBRs duplicados na tabela `ride_tbrs` (mesmo `code`, mesmo `ride_id`, mesmo `trip_number`). A consulta no banco confirmou dezenas de duplicatas — alguns TBRs aparecem 3 ou 4 vezes no mesmo carregamento. A causa raiz é que o `processedCodesRef` (guarda em memória) é resetado ao navegar/recarregar a página, e não há verificação no banco antes do `insert`.

## Solução — 3 camadas de proteção

### 1. Verificação no banco antes do insert (código)
**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Na função `saveTbr`, logo antes da linha `await supabase.from("ride_tbrs").insert(...)` (linha ~817), adicionar uma consulta:
```typescript
const { data: existing } = await supabase
  .from("ride_tbrs")
  .select("id")
  .eq("ride_id", rideId)
  .ilike("code", code)
  .eq("trip_number", tripNumber)
  .limit(1);

if (existing && existing.length > 0) return; // já existe, pula
```

### 2. Inicializar `processedCodesRef` ao carregar dados
**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Na função `fetchRides`, após carregar os TBRs do banco para cada ride, popular o `processedCodesRef` com os códigos existentes. Isso garante que mesmo após navegar para outra página e voltar, a guarda em memória esteja sincronizada.

### 3. Índice único no banco de dados (migração SQL)
Criar uma migração que:
1. Remove duplicatas existentes (mantendo a entrada mais antiga por `scanned_at`)
2. Cria um índice único: `CREATE UNIQUE INDEX ride_tbrs_unique_code_per_ride ON ride_tbrs (ride_id, trip_number, UPPER(code))`

Isso torna impossível inserir duplicatas no nível do banco, mesmo se o código da aplicação falhar.

### 4. Limpeza dos duplicados existentes
A migração SQL vai deletar as linhas duplicadas antes de criar o índice, mantendo apenas o registro mais antigo de cada combinação `(ride_id, trip_number, code)`.

