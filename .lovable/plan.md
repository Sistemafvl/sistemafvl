

## Plano de Correção e Melhorias

### 1. Bug dos Números na Operação + Spinners nos Cards Indicadores

**Problema**: Os 4 cards indicadores (Carregamentos, TBRs lidos, Retornos piso, Conclusão) mostram valores computados de `cards` que começa vazio. Os valores aparecem como `0` durante o carregamento e podem flashar dados incorretos antes da carga completa. Além disso, comparações case-sensitive entre TBR codes de `ride_tbrs` e `piso_entries`/`ps_entries`/`rto_entries` podem causar contagens erradas (ex: `tbr123` vs `TBR123`).

**Arquivo**: `src/pages/dashboard/OperacaoPage.tsx`

**Correções**:
- Adicionar spinner (Loader2) nos 4 cards indicadores enquanto `loading === true`
- Normalizar todos os códigos TBR para uppercase nas comparações (`tbrCodesByRide`, `returnTbrSets`, `returnSet` no modal)
- No modal de detalhes, normalizar `returnSet` para uppercase

### 2. Sugestão de Logins Anteriores no Modal de Programação

**Arquivo**: `src/components/dashboard/QueuePanel.tsx`

**Mudanças**:
- Ao abrir o modal, buscar os logins anteriores do motorista naquela unidade (`driver_rides` filtrado por `driver_id` + `unit_id`, campo `login`)
- Exibir seção "Logins anteriores" acima do campo Login, com botões clicáveis (igual a "Rotas anteriores")
- Se o login já foi usado hoje, mostrar um tick verde ao lado do nome (usar `usedLoginsToday` que já existe)
- Ao clicar num login anterior, selecionar o login correspondente no combobox

### 3. Coluna "Conferente" no Retorno Piso

**Arquivo**: `src/pages/dashboard/RetornoPisoPage.tsx`

**Mudanças**:
- Adicionar `conferente_id` ao select da query `loadEntries`
- Buscar nomes dos conferentes via `user_profiles` para os IDs encontrados
- Adicionar coluna "Conferente" na tabela entre "Rota" e "Motivo"
- Exibir o nome do conferente que registrou o TBR no piso

### 4. Case-Insensitive para TBR em Todo o Sistema

**Arquivos afetados**: `OperacaoPage.tsx`, `RetornoPisoPage.tsx` e qualquer comparação de TBR code

**Mudanças**:
- Em `OperacaoPage.tsx`: normalizar `t.code.toUpperCase()` ao construir `tbrCodesByRide` e ao comparar em `returnTbrSets`
- Em `RetornoPisoPage.tsx`: usar `.ilike()` nas buscas de `ride_tbrs` (já usa `.ilike()` nas verificações de duplicidade, mas a busca principal na linha 209 usa `.eq("code", code)` - mudar para `.ilike("code", code)`)
- No modal de detalhes da Operação: normalizar `returnSet` para uppercase

### Detalhes Técnicos

**Operação - Spinners nos cards**:
```
// Dentro do grid de indicadores, cada card mostra:
{loading ? <Loader2 className="animate-spin" /> : <p>{valor}</p>}
```

**Case-insensitive fix no OperacaoPage**:
```
tbrCodesByRide[t.ride_id].add(t.code.toUpperCase());
// ...
tbrCodesByRide[p.ride_id]?.has(p.tbr_code.toUpperCase())
```

**Logins anteriores no QueuePanel**:
```
// Buscar logins anteriores do motorista
const { data: loginsData } = await supabase
  .from("driver_rides")
  .select("login")
  .eq("driver_id", entry.driver_id)
  .eq("unit_id", unitId)
  .not("login", "is", null);
const uniqueLogins = [...new Set(loginsData.map(r => r.login))];
```

**Conferente no Retorno Piso**:
```
// Adicionar conferente_id ao select
.select("id, tbr_code, driver_name, route, reason, created_at, ride_id, conferente_id")
// Buscar nomes via user_profiles
```

