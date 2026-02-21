

# Plano - 3 Itens

## 1. Atualizacoes do Sistema automaticas

O feed de atualizacoes ja funciona corretamente (os dados estao na tabela `system_updates` e o componente `SystemUpdates` os exibe). O problema e que as atualizacoes so aparecem quando cadastradas manualmente pelo painel Admin.

A partir de agora, toda vez que eu (Lovable) fizer uma implementacao, melhoria ou correcao, vou inserir automaticamente um registro na tabela `system_updates` com o tipo (`create`, `update` ou `config`), o modulo afetado e a descricao da mudanca. Isso sera feito via ferramenta de insercao de dados ao final de cada implementacao.

Nenhuma alteracao de codigo e necessaria - o componente `SystemUpdates.tsx` ja busca e exibe os dados com Realtime. A mudanca e apenas no fluxo de trabalho: registrar as atualizacoes automaticamente a cada deploy.

## 2. Busca global de TBR (todas as unidades)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Atualmente o `fetchSearchResults` filtra TBRs apenas pela unidade atual (`unit_id`). A busca sera expandida para pesquisar em TODAS as unidades do sistema.

### O que sera feito:
- Remover o filtro `.eq("unit_id", unitId)` da busca de rides no `fetchSearchResults`
- Buscar diretamente na tabela `ride_tbrs` com `.ilike("code", searchTerm)` sem filtro de unidade
- Para os resultados de outras unidades, exibir o nome da unidade ao lado do carregamento (buscar da tabela `units_public`)
- Destacar visualmente os resultados da unidade atual vs outras unidades (ex: badge "Outra Unidade" em laranja)
- Manter o highlight verde no TBR que corresponde a busca

### Fluxo:
1. Usuario digita TBR e pressiona Enter
2. Sistema busca em `ride_tbrs` globalmente (sem filtro de unidade)
3. Resultados mostram carregamentos de todas as unidades
4. Cards de outras unidades exibem badge com nome da unidade de origem

## 3. Modo Offline (Leitura + Escrita com sincronizacao)

**Arquivos novos:** `src/lib/offline-store.ts`, `src/hooks/use-offline-sync.ts`, `src/components/OfflineIndicator.tsx`
**Arquivos modificados:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`, `src/App.tsx`

### Arquitetura:

O sistema ja e um PWA com Service Worker. Para suportar escrita offline, sera implementado:

**a) Armazenamento local com IndexedDB (via wrapper simples):**
- Criar um store `offline-store.ts` usando a API nativa `IndexedDB` para armazenar:
  - Dados carregados (rides, tbrs, conferentes) como cache local
  - Fila de operacoes pendentes (inserts, updates, deletes) que falharam por falta de conexao

**b) Hook `use-offline-sync.ts`:**
- Detectar estado de conexao via `navigator.onLine` + eventos `online`/`offline`
- Quando offline: interceptar operacoes de escrita (saveTbr, deleteTbr, etc.), salvar na fila do IndexedDB
- Quando online: processar a fila de pendentes em ordem cronologica, sincronizando com o banco
- Emitir eventos para atualizar a UI apos sincronizacao

**c) Componente `OfflineIndicator.tsx`:**
- Banner fixo no topo da tela quando offline (icone de wifi cortado + "Modo Offline - dados serao sincronizados ao reconectar")
- Badge com contador de operacoes pendentes
- Animacao de sincronizacao quando reconectar

**d) Integracao com ConferenciaCarregamentoPage:**
- Ao carregar a pagina, salvar dados no cache local (IndexedDB)
- Funcoes de escrita (saveTbr, deleteTbr, handleSelectConferente) verificam `navigator.onLine`
  - Se online: comportamento normal (banco de dados)
  - Se offline: salva no IndexedDB + atualiza UI otimisticamente
- Ao reconectar: sincroniza fila e faz fetchRides para garantir consistencia

### Limitacoes conhecidas:
- Realtime nao funciona offline (desconecta automaticamente)
- Conflitos de dados (ex: mesmo TBR inserido por duas pessoas offline) serao resolvidos por ordem cronologica (first-come-first-served)
- O cache local tera limite de 24h para evitar dados desatualizados

---

## Detalhes Tecnicos

### IndexedDB Schema:
```text
Database: fvl-offline
  Store: cached-rides     (key: id)
  Store: cached-tbrs      (key: id)
  Store: pending-ops      (key: autoIncrement)
    { type: "insert"|"update"|"delete", table: string, data: object, timestamp: number }
```

### Fluxo de sincronizacao:
```text
[Offline]                          [Online]
  |                                   |
  |--> Salva operacao no IndexedDB    |
  |--> Atualiza UI otimisticamente    |
  |                                   |
  |--- Reconexao detectada ---------->|
  |                                   |--> Le fila de pendentes
  |                                   |--> Executa cada operacao no Supabase
  |                                   |--> Remove da fila se sucesso
  |                                   |--> fetchRides() para sincronizar
  |                                   |--> Toast "X operacoes sincronizadas"
```

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Busca global de TBR + integracao offline |
| `src/lib/offline-store.ts` | Novo - wrapper IndexedDB para cache e fila |
| `src/hooks/use-offline-sync.ts` | Novo - hook de deteccao e sincronizacao |
| `src/components/OfflineIndicator.tsx` | Novo - indicador visual de modo offline |
| `src/App.tsx` | Adicionar OfflineIndicator global |
| Insercao de dados | Registrar atualizacoes na tabela system_updates |

