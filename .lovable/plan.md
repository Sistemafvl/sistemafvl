

## Plano - 4 Ajustes

### 1. Campo de busca nos motivos de insucesso (RetornoPisoPage.tsx)

O dropdown `<Select>` de "Motivo do insucesso" (linhas 477-484) sera substituido por um componente `Popover` + `Command` com campo de busca digitavel, permitindo filtrar rapidamente os motivos disponiveis.

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx`
- Importar `Popover`, `PopoverContent`, `PopoverTrigger` de `@/components/ui/popover`
- Importar `Command`, `CommandInput`, `CommandItem`, `CommandList`, `CommandEmpty`, `CommandGroup` de `@/components/ui/command`
- Importar `Check` e `ChevronsUpDown` de `lucide-react`
- Adicionar estado `reasonSearchOpen` (boolean)
- Substituir o `<Select>` (linhas 477-484) por Popover+Command com busca integrada
- Ao selecionar um motivo, fechar o popover automaticamente (conforme padrao UI do projeto)

### 2. Auto-correcao ao adicionar novo motivo - Retorno Piso (RetornoPisoPage.tsx)

Na funcao `handleAddReason` (linha 200), antes de inserir no banco, aplicar formatacao automatica: primeira letra maiuscula, restante preservado.

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx` (linha 200)
- Trocar `newReasonInput.trim()` por uma versao formatada:
  ```
  const text = newReasonInput.trim();
  const formatted = text.charAt(0).toUpperCase() + text.slice(1);
  ```
- Usar `formatted` no insert e no `setSelectedReason`

### 3. Auto-correcao ao adicionar novo motivo - PS (RetornoPisoPage.tsx e PSPage.tsx)

Mesma logica de capitalizacao aplicada em dois locais:

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx` - funcao `handleAddPsReason` (linha 298)
- Aplicar `text.charAt(0).toUpperCase() + text.slice(1)` no `psNewReasonInput.trim()`

**Arquivo:** `src/pages/dashboard/PSPage.tsx` - funcao `handleAddReason` (linha 321)
- Aplicar mesma formatacao no `newReasonInput.trim()`

### 4. Paginacao de 5 itens nos 3 cards de ranking (DashboardInsights.tsx)

**Arquivo:** `src/components/dashboard/DashboardInsights.tsx` (linha 34)
- Alterar `PAGE_SIZE` de `10` para `5`

---

### Resumo dos arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/RetornoPisoPage.tsx` | Busca nos motivos de insucesso + auto-correcao piso + auto-correcao PS |
| `src/pages/dashboard/PSPage.tsx` | Auto-correcao no campo de novo motivo |
| `src/components/dashboard/DashboardInsights.tsx` | PAGE_SIZE de 10 para 5 |

