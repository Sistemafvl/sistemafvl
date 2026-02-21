

# Sistema de Atualizacoes (Changelog Interno)

## Resumo

Criar uma secao "Atualizacoes do Sistema" visivel para todos os perfis (funcionario, gerente, motorista e master admin) na pagina de Visao Geral, apos todo o conteudo existente. O master admin tera tambem um painel de gerenciamento para criar e deletar registros.

---

## 1. Banco de Dados

Criar a tabela `system_updates`:

- `id` (uuid, PK, default gen_random_uuid())
- `type` (text, not null, default 'update') -- valores: 'create', 'update', 'config'
- `module` (text, not null) -- nome do modulo afetado
- `description` (text, not null) -- descricao da implementacao
- `published_at` (timestamptz, not null, default now())
- `created_at` (timestamptz, not null, default now())

RLS:
- SELECT: todos (anon + authenticated) podem ler
- INSERT/UPDATE/DELETE: apenas authenticated (master admin controla via interface)

Habilitar Realtime na tabela.

---

## 2. Componente de visualizacao: `src/components/dashboard/SystemUpdates.tsx`

Componente reutilizavel que:
- Busca os ultimos 20 registros ordenados por `published_at DESC`
- Usa Realtime (`postgres_changes`) para atualizar automaticamente
- Exibe cada registro como um card com:
  - Badge colorido por tipo (verde = "Novo", azul = "Atualizacao", roxo = "Config")
  - Nome do modulo em negrito
  - Descricao do que foi feito
  - Data formatada em pt-BR (dd/MM/yyyy 'as' HH:mm)
- Scroll interno (`max-h-[400px]`) com visual em `bg-muted/30` e hover
- Loader enquanto carrega e mensagem vazia se nao houver registros

---

## 3. Integracao nas paginas de Visao Geral

Adicionar `<SystemUpdates />` no final de cada pagina:

1. **Dashboard (funcionario/gerente):** `src/pages/dashboard/DashboardHome.tsx` -- apos `<DashboardInsights />` e antes do modal TBR
2. **Motorista:** `src/pages/driver/DriverHome.tsx` -- apos os graficos, no final do JSX
3. **Master Admin:** `src/pages/admin/AdminOverviewPage.tsx` -- apos os graficos, no final do JSX

---

## 4. Componente de administracao: `src/components/admin/AdminSystemUpdates.tsx`

Componente exclusivo do painel admin que:
- Formulario para criar novos registros: Select de tipo (create/update/config), Input de modulo, Textarea de descricao
- Lista todos os registros (sem limite) com botao de deletar cada um
- Busca e exibe todo o historico

---

## 5. Rota e menu admin

- Adicionar item "Atualizacoes" no `AdminSidebar.tsx` com icone `Megaphone` apontando para `/admin/updates`
- Criar pagina `src/pages/admin/AdminUpdatesPage.tsx` que renderiza `<AdminSystemUpdates />`
- Registrar rota `/admin/updates` em `App.tsx`

---

## Arquivos criados/modificados

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar tabela `system_updates` + RLS + Realtime |
| `src/components/dashboard/SystemUpdates.tsx` | Novo -- componente de visualizacao |
| `src/components/admin/AdminSystemUpdates.tsx` | Novo -- componente de gerenciamento |
| `src/pages/admin/AdminUpdatesPage.tsx` | Novo -- pagina admin |
| `src/pages/dashboard/DashboardHome.tsx` | Adicionar `<SystemUpdates />` |
| `src/pages/driver/DriverHome.tsx` | Adicionar `<SystemUpdates />` |
| `src/pages/admin/AdminOverviewPage.tsx` | Adicionar `<SystemUpdates />` |
| `src/components/admin/AdminSidebar.tsx` | Adicionar item de menu |
| `src/App.tsx` | Adicionar rota `/admin/updates` |

