

## Plano Consolidado: Seleção de Conferente na Sidebar + Correções

### Resumo das 3 mudanças

**1. Seletor de Conferente na Sidebar (sem senha)**
- Novo campo `conferenteSession` (id, name) no `auth-store.ts`, persistido em localStorage
- Botão/Select abaixo do botão Gerente no `DashboardSidebar.tsx` para escolher conferente ativo (lista da tabela `user_profiles` da unidade)
- Sem conferente e sem gerente selecionado: bloquear acesso ao conteúdo do dashboard (overlay em `DashboardLayout.tsx`)
- Gerente bypassa o bloqueio

**2. Auto-preenchimento do conferente ao clicar Iniciar**
- O campo de conferente nos cards fica **sempre bloqueado** (read-only)
- Quando o conferente da sidebar clica em "Iniciar", o sistema automaticamente preenche o `conferente_id` do ride com o `conferenteSession.id` antes de mudar o status para `loading`
- Não é mais necessário selecionar o conferente manualmente no card — o Select vira apenas exibição
- Gerente pode alterar o conferente (já existente)

**3. Isolamento por conferente**
- Cards filtrados: conferente da sessão vê apenas seus cards + cards sem conferente (pending)
- Gerente vê todos os cards
- Resolve o problema de um computador afetar o carregamento de outro

**4. Carrossel — corrigir setas travadas**
- Mudar `containScroll: "trimSnaps"` para `containScroll: false` no Embla
- Setas sempre habilitadas quando há conteúdo para navegar

**5. Botão de excluir motorista aprovado da fila**
- No `QueuePanel.tsx`, adicionar botão X (rejeitar) ao lado de "Programar" para motoristas com status `approved`

### Arquivos modificados

1. **`src/stores/auth-store.ts`** — adicionar `conferenteSession` + `setConferenteSession` (persistido)
2. **`src/components/dashboard/DashboardSidebar.tsx`** — seletor de conferente abaixo do botão Gerente
3. **`src/components/dashboard/DashboardLayout.tsx`** — bloqueio sem conferente/gerente
4. **`src/pages/dashboard/ConferenciaCarregamentoPage.tsx`** — campo conferente sempre bloqueado, auto-preenche ao Iniciar, filtro por conferente, fix carrossel
5. **`src/components/dashboard/QueuePanel.tsx`** — botão X para motoristas aprovados

