
## Plano - Busca de TBR mais abrangente (DashboardHome.tsx)

### Problema

Atualmente, a busca de TBR comeca pela tabela `ride_tbrs`. Se o codigo nao for encontrado la, retorna "TBR nao encontrado" imediatamente. Porem, um PS (ou RTO, DNR, Piso) pode ser registrado diretamente pelo codigo TBR sem que esse codigo esteja na tabela `ride_tbrs`. O resultado e que registros existentes ficam invisiveis na busca.

### Solucao

Reestruturar a logica de busca para usar uma abordagem em cascata:

1. **Primeiro**, buscar em `ride_tbrs` (caminho atual - fluxo completo com dados do carregamento)
2. **Se nao encontrar**, buscar em paralelo nas tabelas `ps_entries`, `rto_entries`, `dnr_entries` e `piso_entries` pelo `tbr_code`
3. **Se encontrar em qualquer uma dessas tabelas**, montar o resultado com os dados disponiveis (sem dados de carregamento/motorista, mas com os status PS/RTO/DNR/Piso)
4. **Somente se nao encontrar em nenhuma tabela**, mostrar "TBR nao encontrado"

### Detalhes tecnicos

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

**Alteracao na funcao `handleTbrKeyDown`** (linhas 125-207):

Apos o bloco que verifica `ride_tbrs` (linhas 131-134), em vez de retornar "nao encontrado", adicionar fallback:

```
// Se nao achou em ride_tbrs, buscar nas tabelas de ocorrencias
const [psCheck, rtoCheck, dnrCheck, pisoCheck] = await Promise.all([
  supabase.from("ps_entries").select("*").eq("tbr_code", code)
    .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  supabase.from("rto_entries").select("*").eq("tbr_code", code)
    .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  supabase.from("dnr_entries").select("*").eq("tbr_code", code)
    .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  supabase.from("piso_entries").select("*").eq("tbr_code", code)
    .order("created_at", { ascending: false }).limit(1).maybeSingle(),
]);
```

Se qualquer uma retornar dados, montar o `tbrResult` com:
- `driver_name`: extraido de `ps_entries.driver_name`, `rto_entries.driver_name`, `dnr_entries.driver_name` ou `piso_entries.driver_name` (o primeiro disponivel)
- `route`: de qualquer entrada que tenha
- `unit_name`: buscar da `units` usando o `unit_id` da entrada encontrada
- `conferente_name`: buscar do `conferente_id` se disponivel
- Campos de carregamento (`login`, `started_at`, `finished_at`, `sequence_number`, `loading_status`): ficam como null/vazio
- Campos de veiculo (`car_model`, `car_plate`, `car_color`): extraidos de `dnr_entries` se disponivel
- Status compostos (PS/RTO/DNR/Piso): preenchidos normalmente a partir dos dados encontrados
- `composite_status`: calculado pela mesma hierarquia (DNR > PS > RTO > Piso), com fallback "Sem carregamento"

### Resumo

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/DashboardHome.tsx` | Busca em cascata: ride_tbrs -> ps/rto/dnr/piso_entries -> nao encontrado |
