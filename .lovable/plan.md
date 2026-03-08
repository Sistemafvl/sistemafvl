

## Plano: Remover mecanismo Master Admin

### Escopo de remoção

**Arquivos a deletar:**
- `src/components/AdminLoginModal.tsx`
- `src/components/admin/AdminLayout.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/pages/admin/AdminOverviewPage.tsx`
- `src/pages/admin/AdminDriversPage.tsx`
- `src/pages/admin/DomainsUnitsPage.tsx`
- `src/pages/admin/ManagersPage.tsx`
- `src/pages/admin/DatabasePage.tsx`
- `src/pages/admin/SecurityPage.tsx`
- `src/pages/admin/AdminUpdatesPage.tsx`
- `src/components/admin/AdminSystemUpdates.tsx`
- `supabase/functions/admin-validate/index.ts`
- `supabase/functions/get-manager-details/index.ts`
- `src/hooks/use-triple-click.ts`

**Arquivos a editar:**
1. **`src/App.tsx`** — remover todas as rotas `/admin/*`, imports de AdminLayout e páginas admin
2. **`src/stores/auth-store.ts`** — remover `isMasterAdmin`, `setMasterAdmin` do state e do persist
3. **`src/pages/Index.tsx`** — remover `AdminLoginModal`, `showAdminModal`, redirect de `isMasterAdmin`, e `onTripleClick` do LogoHeader
4. **`src/components/LogoHeader.tsx`** — remover prop `onTripleClick` e uso do hook `useTripleClick`

**Backend:**
- Deletar edge functions `admin-validate` e `get-manager-details`
- Tabela `user_roles` e função `has_role` permanecem (podem ser úteis futuramente)

### Resultado
- Nenhum acesso Master Admin no sistema
- Triple-click no logo não faz nada
- Rotas `/admin/*` deixam de existir
- Login continua funcionando normalmente para unidades, motoristas e matriz

