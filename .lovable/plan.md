

# Plano de Correções - 3 Problemas

## 1. Botao "Adicionar Motorista na Fila" (QueuePanel)

Adicionar um botao "+" no topo do painel lateral da fila que abre um modal de busca por CPF. O fluxo:

- Gerente clica no botao "+" no header do painel da fila
- Abre um Dialog com campo de busca por CPF
- Ao digitar/buscar, consulta a tabela `drivers` pelo CPF
- Se encontrar, exibe nome, foto e dados do motorista
- Botao "Adicionar na Fila" insere um registro em `queue_entries` com status "waiting"
- Depois disso, o fluxo segue normalmente (Programar, etc.)

**Arquivo:** `src/components/dashboard/QueuePanel.tsx`
- Adicionar estados para o modal de busca (cpfSearch, foundDriver, searchLoading)
- Novo Dialog com Input de CPF e resultado
- Funcao `handleSearchDriver` que busca na tabela `drivers` por CPF
- Funcao `handleAddToQueue` que insere em `queue_entries`

## 2. TBRs Amarelos Nao Aparecem em Outros Dispositivos

O problema: o destaque amarelo (`_yellowHighlight`) e apenas um flag local no React state. Quando outro dispositivo carrega os dados, ele nao sabe quais TBRs devem ser amarelos.

**Solucao:** Persistir o status de destaque no banco de dados.

- Adicionar coluna `highlight` (text, nullable) na tabela `ride_tbrs` para armazenar o tipo de destaque ("yellow", null)
- Quando ocorre leitura tripla, atualizar o primeiro TBR com `highlight = 'yellow'` no banco
- No `fetchRides`, mapear `highlight === 'yellow'` para `_yellowHighlight: true`
- Assim todos os dispositivos verao o mesmo destaque

**Migration SQL:**
```sql
ALTER TABLE public.ride_tbrs ADD COLUMN highlight text DEFAULT null;
```

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Na logica de triplicata (count >= 2): alem de setar `_yellowHighlight` localmente, fazer `UPDATE ride_tbrs SET highlight = 'yellow' WHERE id = first.id`
- No `fetchRides`, ao mapear TBRs: se `t.highlight === 'yellow'`, setar `_yellowHighlight: true`

## 3. Mapa Nao Carrega (Tiles Cinza)

O mapa mostra controles do Leaflet mas os tiles do OpenStreetMap ficam cinza. O problema e o atributo `sandbox` no iframe que bloqueia requisicoes cross-origin dos tiles.

**Solucao:** Remover completamente o atributo `sandbox` do iframe. O conteudo ja e gerado via `srcdoc` (HTML inline), entao nao ha risco de seguranca significativo.

**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`
- Remover `sandbox="allow-scripts allow-same-origin allow-popups"` do iframe

## Resumo de Alteracoes

| Acao | Arquivo / Recurso |
|------|-------------------|
| Migration SQL | Adicionar coluna `highlight` em `ride_tbrs` |
| Editar | `src/components/dashboard/QueuePanel.tsx` - modal de adicionar motorista por CPF |
| Editar | `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` - persistir yellow highlight |
| Editar | `src/pages/dashboard/ConfiguracoesPage.tsx` - remover sandbox do iframe |

