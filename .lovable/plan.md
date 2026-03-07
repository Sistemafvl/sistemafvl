

## Plano: Alimentar Atualizações + Remover Limitações

### 1. Inserir ~40 atualizações no `system_updates` via migração SQL

Vou compilar todas as implementações e correções recentes do sistema e inserir via migration SQL. Incluindo (entre outras):

- Prevenção de tradução automática do navegador
- Remoção obrigatoriedade de documentos no cadastro de motorista
- Fix de confiabilidade no cadastro (spinner travando)
- Ícone de teclado na página PS
- Card "Quinzena" no painel do motorista
- Renomeação "Reincidências" → "Pend. Coleta"
- Filtro de unidade em Motoristas Parceiros
- Ciclos: auto-contagem TBRs, VRID, veículos, insucessos dia anterior
- Substituição ícone lixeira por sino no carregamento
- Seletor de unidade com delay de 3 caracteres
- Formatação global BRL (formatBRL)
- Timeline TBR corrigida (ordem cronológica + segundos)
- Balão de insucessos flutuante
- Validação de login obrigatório ao finalizar carregamento
- Edição inline de logins (ícone lápis)
- Remoção dos cards Ciclo 1/2/3
- Renomeação "Conferência Carregamento" → "Carregamento"
- E demais melhorias implementadas ao longo do projeto

### 2. Remover/aumentar limites restritivos

**`src/components/dashboard/SystemUpdates.tsx`** (linha 37):
- Alterar `.limit(20)` para `.limit(50)` — permitir exibir mais atualizações no feed

**`src/pages/dashboard/ReversaPage.tsx`** (linha 128):
- Alterar `.limit(50)` para remover ou aumentar para `.limit(500)` — não limitar lotes de reversa

**`src/components/dashboard/QueuePanel.tsx`** (linha 326):
- `.limit(100)` — este é para histórico de corridas de um motorista, razoável manter

**Nota:** Os demais `.limit(1)` e `.limit(10)` são para buscas pontuais (lookup de TBR, autocomplete) e são corretos — não devem ser alterados. O sistema já usa `fetchAllRows` para consultas em massa, então não há limitação de 1000 rows nas operações críticas.

### Arquivos afetados
- Nova migração SQL (INSERT em `system_updates`)
- `src/components/dashboard/SystemUpdates.tsx` — limit 20 → 50
- `src/pages/dashboard/ReversaPage.tsx` — limit 50 → 500

