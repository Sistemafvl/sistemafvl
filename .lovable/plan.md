

## Plano - Ajustar modal de relatorio e restaurar toasts

### 1. Modal de Relatorio mais compacto (CiclosPage.tsx)

Reduzir tamanhos para que todo o conteudo caiba visualmente no modal sem necessidade de scroll:

- `DialogContent`: aumentar largura para `max-w-5xl` e manter `max-h-[90vh]`
- Cards de indicadores BI: reduzir padding de `p-3` para `p-2`, icones de `h-4 w-4` para `h-3 w-3`, valores de `text-xl` para `text-base`, labels de `text-[10px]` para `text-[9px]`
- Secao "Dados Manuais": reduzir padding
- Secao "Ciclos": reduzir padding dos cards internos
- Container `reportRef`: reduzir spacing de `space-y-4` para `space-y-2` e padding de `p-4` para `p-3`
- Header do PDF: reduzir titulo de `text-lg` para `text-base`

### 2. Restaurar Toasts do sistema (App.tsx)

O componente `<Toaster />` do Sonner nao esta sendo renderizado em nenhum lugar. Todas as chamadas `toast.success()` e `toast.error()` usam Sonner, mas o provider nao esta montado.

**Arquivo:** `src/App.tsx`
- Importar `{ Toaster }` de `@/components/ui/sonner`
- Adicionar `<Toaster />` dentro do JSX, logo apos `<OfflineIndicator />`

### Resumo

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/CiclosPage.tsx` | Reduzir tamanhos de texto, padding e gaps no modal para caber tudo visivel |
| `src/App.tsx` | Adicionar `<Toaster />` do Sonner para restaurar notificacoes toast em todo o sistema |

