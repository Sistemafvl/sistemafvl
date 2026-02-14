

# 4 Melhorias no Sistema FVL

## 1. Corrigir exclusao de Conferente (Bug)

**Problema:** A politica RLS de DELETE na tabela `user_profiles` so permite o role `authenticated`, mas o sistema usa conexao anonima (autenticacao customizada). O `supabase.delete()` retorna sem erro aparente, o estado local remove o conferente, mas o banco nao executa a exclusao. Ao recarregar, o registro reaparece.

**Solucao:** Adicionar politica RLS permitindo DELETE para o role `anon` na tabela `user_profiles`.

**Alteracao:** Migracao SQL para criar a politica.

---

## 2. Gerenciamento de Motoristas no Master Admin

**Nova pagina** acessivel pelo sidebar do Master Admin com:
- Lista paginada (20 por pagina) de todos os motoristas cadastrados
- Campo de busca por nome, CPF ou placa
- Acoes por motorista:
  - **Ver info**: modal com dados completos
  - **Editar**: modal com formulario editavel (nome, CPF, placa, modelo, cor, email, whatsapp, endereco, senha)
  - **Inativar/Ativar**: toggle de status
  - **Excluir**: exclusao permanente com dialogo de confirmacao

**Arquivos:**
- `src/pages/admin/AdminDriversPage.tsx` (novo)
- `src/components/admin/AdminSidebar.tsx` (adicionar item de menu "Gerenciamento de Motoristas")
- `src/App.tsx` (adicionar rota `/admin/drivers`)
- Migracao SQL: politica RLS de DELETE para `drivers` no role `anon` (ja existe para `authenticated`, precisa de `anon` tambem)

---

## 3. Campo de busca nos selects de Dominio e Unidade (tela inicial)

**Problema:** Quando existem muitos dominios/unidades, e dificil encontrar o desejado na lista.

**Solucao:** Substituir os componentes `Select` por `Popover` + `Command` (cmdk, ja instalado) para criar comboboxes com campo de busca integrado. O usuario digita e a lista filtra em tempo real.

**Arquivo:** `src/components/UnitLoginForm.tsx`
- Dominio: Popover com Command que filtra dominios por nome
- Unidade: Popover com Command que filtra unidades por nome
- Manter o mesmo visual e comportamento (selecionar dominio carrega unidades, etc.)

---

## 4. Painel lateral de Fila para o Gerente da Unidade

**Slide-out Panel** no dashboard do gerente que mostra a fila de motoristas da unidade em tempo real.

**Comportamento:**
- Quando fechado: apenas um icone/balao flutuante no canto inferior direito da tela com contador de motoristas na fila
- Ao clicar: painel desliza da direita para dentro da tela
- Conteudo do painel: lista de motoristas na fila com foto (placeholder), nome, hora de entrada, e botao "Programar"
- Atualizacao em tempo real via Supabase Realtime (tabela `queue_entries`)

**Arquivos:**
- `src/components/dashboard/QueuePanel.tsx` (novo) - componente do slide-out panel
- `src/components/dashboard/DashboardLayout.tsx` (adicionar o QueuePanel como overlay)
- O painel so aparece quando ha `managerSession` ativa

---

## Detalhes tecnicos

### Migracao SQL
```sql
-- Permitir DELETE anonimo em user_profiles
CREATE POLICY "Anyone can delete user_profiles"
  ON public.user_profiles FOR DELETE USING (true);

-- Permitir DELETE anonimo em drivers (para admin)
CREATE POLICY "Anyone can delete drivers"
  ON public.drivers FOR DELETE USING (true);
```

### Novos arquivos
1. `src/pages/admin/AdminDriversPage.tsx` - pagina completa com tabela paginada, busca, modais de ver/editar/excluir
2. `src/components/dashboard/QueuePanel.tsx` - painel lateral com Sheet do Radix ou div animada

### Arquivos modificados
1. `src/components/admin/AdminSidebar.tsx` - novo item "Gerenciamento de Motoristas" com icone Truck
2. `src/App.tsx` - nova rota `/admin/drivers` -> AdminDriversPage
3. `src/components/UnitLoginForm.tsx` - substituir Select por Combobox (Popover+Command)
4. `src/components/dashboard/DashboardLayout.tsx` - incluir QueuePanel
5. `src/pages/dashboard/ConferentesPage.tsx` - corrigir handleDelete para verificar erro real (a exclusao ja esta correta no codigo, o problema e apenas RLS)

