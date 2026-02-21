

# Plano de Implementacao - 4 Itens

## 1. Alerta animado no menu "Recebiveis" do motorista (Anexo 1)

**Arquivos:** `src/components/dashboard/DriverSidebar.tsx`, `src/pages/driver/DriverRecebiveis.tsx`

No sidebar do motorista, ao lado do item "Recebiveis", exibir um ponto de exclamacao animado (icone `AlertCircle` com `animate-pulse` em vermelho) quando existir pelo menos 1 relatorio de pagamento (`payroll_reports`) que inclui o motorista e que ainda NAO tem NF enviada (`driver_invoices`).

**Logica:**
- No `DriverSidebar`, ao carregar, buscar `payroll_reports` e `driver_invoices` para o `driverId`
- Contar quantos relatorios incluem o motorista (via `report_data` JSON) mas nao tem invoice correspondente
- Se `pendingCount > 0`, renderizar um indicador vermelho animado ao lado do titulo "Recebiveis" no menu
- Quando o motorista faz upload da NF em `DriverRecebiveis`, ao chamar `loadEntries()` apos sucesso, o sidebar deve atualizar (via re-render ou estado global)
- Para simplificar, o sidebar fara a consulta no mount e o estado sera local; ao navegar de volta ao sidebar, ele re-consulta

**Visual:** Bolinha vermelha com `animate-bounce` ou icone `!` com `animate-pulse` posicionado ao lado direito do texto "Recebiveis".

## 2. Fix DEFINITIVO da exclusao de TBR (Anexo 2) - URGENTE

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

O problema persiste mesmo apos o delay de 1500ms. A causa raiz e que o canal Realtime escuta `event: "*"` na tabela `driver_rides` (linha 395), e QUALQUER atualizacao nessa tabela (incluindo as operacoes em piso_entries que podem triggerar side-effects) causa `fetchRides()`. O `fetchRides()` re-busca ride_tbrs do banco, e como o DELETE ja propagou, o TBR nao deveria voltar - MAS o problema real e que existem MULTIPLOS listeners Realtime (INSERT, UPDATE, DELETE em ride_tbrs + wildcard em driver_rides), e cada um pode chamar `fetchRides()` em momentos diferentes, causando race conditions.

**Solucao definitiva - Abordagem de lock temporal robusto:**
1. Substituir `skipRealtimeRef` (boolean) por um **timestamp de lock**: `realtimeLockUntil = useRef<number>(0)`
2. No handler de cada evento Realtime, verificar `Date.now() < realtimeLockUntil.current` - se sim, ignorar
3. No `handleDeleteTbr`:
   - Setar `realtimeLockUntil.current = Date.now() + 5000` (lock por 5 segundos)
   - Remocao otimista da UI
   - Aguardar TODAS as operacoes sequenciais (delete, piso, rto)
   - `await fetchRides()` (filtra via `deletingRef`)
   - `deletingRef.current.delete(tbrId)` imediatamente apos fetchRides
   - NAO resetar o lock - ele expira sozinho apos 5s
4. Manter o filtro `deletingRef` no `fetchRides` como seguranca extra (linha 275)

Essa abordagem elimina qualquer race condition porque:
- O lock temporal NAO depende de ordem de execucao
- Eventos Realtime que cheguem ate 5s apos a exclusao sao ignorados automaticamente
- Apos 5s, o TBR ja foi removido do banco e qualquer fetchRides trara os dados corretos

## 3. Filtros de data em Corridas do Motorista (Anexo 3)

**Arquivo:** `src/pages/driver/DriverRides.tsx`

Adicionar filtros de data (De / Ate) na pagina de Corridas do motorista, similar ao que ja existe na Visao Geral:

- Adicionar estados `startDate` e `endDate` (default: 30 dias atras ate hoje)
- Adicionar dois `Popover` + `Calendar` para selecao de datas
- Filtrar a query do Supabase com `.gte("completed_at", startDate)` e `.lte("completed_at", endDate)`
- Re-buscar ao alterar datas
- Atualizar o contador "Total de corridas" para refletir o periodo filtrado

## 4. Busca nos logins + Conferente travado definitivamente (Anexo 4)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

### 4a. Travar conferente apos selecao
A logica atual (linha 1178) ja tenta travar: `disabled={(!!ride.conferente_id || lockedConferentes.current.has(ride.id)) && !managerSession}`

O problema e que o `lockedConferentes` usa um `useRef<Set>` que nao causa re-render. Quando `handleSelectConferente` faz o update otimista no state `rides`, o `ride.conferente_id` deveria estar preenchido - mas pode haver um timing issue.

**Correcao:** Apos `handleSelectConferente`:
- Usar um estado `lockedConferenteIds` (useState<Set>) em vez de useRef, para forcar re-render
- Adicionar o rideId ao set ANTES do update otimista
- Manter a condicao: se `ride.conferente_id` ou `lockedConferenteIds.has(ride.id)` e NAO e gerente -> disabled

### 4b. Campo de busca na selecao de conferente
Substituir o `Select` por um `Popover` + `Command` (cmdk) com campo de busca integrado, permitindo digitar para filtrar os conferentes por nome. Isso segue o padrao de "combobox" ja disponivel via shadcn/ui.

### 4c. Campo de busca na selecao de logins
Se houver um seletor de logins em algum lugar, adicionar busca. Pela imagem, o campo "Login" e editavel inline (campo de texto). Se o usuario se refere a busca dentro da lista de conferentes (ja coberto em 4b), nao ha acao adicional.

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `DriverSidebar.tsx` | Indicador animado de NF pendente no menu Recebiveis |
| `DriverRecebiveis.tsx` | Nenhuma alteracao (fluxo de upload ja funciona) |
| `DriverRides.tsx` | Filtros de data (De/Ate) com Calendar |
| `ConferenciaCarregamentoPage.tsx` | Lock temporal 5s para Realtime + conferente com useState + busca combobox |

