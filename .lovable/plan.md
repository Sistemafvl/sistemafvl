

## Plano de Implementação (2 mudanças)

### 1. Fechar piso_entry ao Finalizar PS

**Arquivo:** `src/pages/dashboard/PSPage.tsx`

Na função `handleFinalize` (linha 475), após fechar o `ps_entries`, executar update no `piso_entries` para fechar registros abertos com o mesmo `tbr_code` e `unit_id`.

### 2. Ícone "olho" nos eventos PS da Timeline

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

- Expandir a interface `TimelineEvent` com campos opcionais: `photo_url`, `reason`, `observations`, `is_seller`
- No bloco de construção de timeline para PS (linha 219-228), incluir esses campos do `ps_entries`
- Adicionar estado `psDetailEvent` para controlar qual evento está sendo visualizado
- Na renderização da timeline (linha 477-502), para eventos do tipo `"ps"` que tenham `photo_url` ou dados extras, exibir um ícone `Eye` clicável
- Ao clicar, abrir um mini modal/popover inline mostrando: foto (se houver), motivo, observações, seller

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `PSPage.tsx` | Fechar `piso_entry` aberta ao finalizar PS |
| `DashboardHome.tsx` | Ícone Eye nos eventos PS + modal de detalhes |

