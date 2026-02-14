

# Aumentar o logotipo no sidebar

Alterar o tamanho do logo no componente `AdminSidebar.tsx`. Atualmente ele usa `size="sm"` (`h-10 sm:h-12`), que fica muito pequeno na sidebar.

## Alteracao

**Arquivo:** `src/components/admin/AdminSidebar.tsx`

- Trocar `<LogoHeader size="sm" />` para `<LogoHeader size="md" />`, que usa `h-16 sm:h-20` — um tamanho mais visivel e proporcional ao sidebar.
- Ajustar o padding do container de `p-4` para `p-4 py-5` para dar mais respiro vertical ao logo.

