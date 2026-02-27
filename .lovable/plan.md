

# Análise de Escalabilidade e Performance do Sistema FVL

## Diagnóstico Atual

O sistema já funciona para múltiplas unidades e domínios por design (isolamento via `unit_id`). Porém, há pontos de atenção para operação com muitos acessos simultâneos:

---

## Pontos Positivos (já funciona bem)
- Isolamento correto por `unit_id` em todas as queries — cada unidade vê apenas seus dados
- Realtime com filtro por `unit_id` — cada canal é isolado
- PWA com service worker para cache de assets estáticos
- Offline store com IndexedDB para operações pendentes
- Edge functions sem JWT (acesso rápido, sem overhead de auth)

---

## Problemas Identificados e Correções Propostas

### 1. Realtime do `ride_tbrs` sem filtro de `unit_id` (CRÍTICO)

Na `ConferenciaCarregamentoPage.tsx` (linhas 543-545), os listeners de `ride_tbrs` **não possuem filtro**. Isso significa que **qualquer TBR inserido/atualizado/deletado em QUALQUER unidade** dispara `fetchRides()` para TODAS as unidades conectadas. Com 10+ unidades operando simultaneamente, isso gera dezenas de fetches desnecessários por segundo.

**Correção**: Não é possível filtrar `ride_tbrs` por `unit_id` diretamente (a tabela não tem esse campo). A solução é fazer o listener reagir ao payload e verificar se o `ride_id` pertence aos rides carregados antes de chamar `fetchRides()`, ou debounce o fetch.

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` (linhas 538-548) | Adicionar **debounce de 2s** no realtime de `ride_tbrs` para evitar rajadas de refetch. Manter um `Set` de `rideIds` atuais e só refetch se o payload pertencer a um ride da unidade |

### 2. `fetchRides()` faz 3 queries sequenciais a cada trigger realtime

Cada chamada a `fetchRides()` executa: rides → drivers → tbrs (3 requests). Com realtime sem debounce, isso multiplica.

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Adicionar debounce de ~1.5s no `fetchRides` dentro do listener realtime para agrupar múltiplos eventos em um único refetch |

### 3. QueryClient sem configuração de cache

O `QueryClient` na linha 43 do `App.tsx` é instanciado sem nenhuma configuração. Isso significa `staleTime: 0` — toda vez que um componente monta, refaz a query.

| Arquivo | Alteração |
|---|---|
| `App.tsx` (linha 43) | Configurar `defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } }` para reduzir refetches desnecessários |

### 4. Página de Conferência com ~2000 linhas (peso do bundle)

`ConferenciaCarregamentoPage.tsx` tem 1966 linhas. Isso impacta tempo de parse e memória.

| Arquivo | Alteração |
|---|---|
| (futuro, não prioritário) | Extrair componentes (cards, modais, scanner) em arquivos separados. Não é bloqueante, mas melhora manutenabilidade |

### 5. Canal `system-updates-realtime` sem filtro global

`SystemUpdates.tsx` escuta TODOS os eventos de `system_updates` sem filtro — impacto baixo pois é tabela pequena, mas vale notar.

---

## Resumo de Prioridades

| Prioridade | Ação | Impacto |
|---|---|---|
| **Alta** | Debounce no realtime de `ride_tbrs` e `driver_rides` | Evita dezenas de fetches simultâneos |
| **Alta** | Configurar `staleTime` no QueryClient | Reduz queries redundantes em navegação |
| **Média** | Verificar `ride_id` no payload realtime antes de refetch | Isola completamente o realtime por unidade |
| **Baixa** | Code-split da página de Conferência | Melhora tempo de carregamento inicial |

### Sobre a infraestrutura
O backend (Lovable Cloud) escala automaticamente. Conexões realtime e queries são gerenciadas pelo serviço. O gargalo potencial está no **lado do cliente** fazendo requests excessivos, não no servidor. As correções acima resolvem isso.

Deseja que eu implemente as correções de alta prioridade (debounce no realtime + configuração do QueryClient)?

