

# Plano: Observação no PS + Lápis para editar

## 1. Migração SQL

Adicionar coluna `observations` (text, nullable) na tabela `ps_entries`.

## 2. Alterações em `src/pages/dashboard/PSPage.tsx`

**Interface e estado:**
- Adicionar `observations` ao `PsEntry`
- Novo estado `observations` (string)
- Novo estado `editingEntry` (PsEntry | null) para modo edição

**Modal — campo Observação:**
- Adicionar `<Textarea>` com label "Observação" abaixo do bloco de foto, antes do botão "Gravar PS"
- No `handleSave`, incluir `observations` no insert

**Tabela — coluna Observação:**
- Nova coluna "Observação" entre "Data" e "Status"
- Exibir texto truncado (max ~30 chars)

**Lápis para editar:**
- Na coluna Ações, adicionar botão com ícone `Pencil` (apenas para status "open")
- Ao clicar, preenche o modal com os dados do registro existente (motivo, conferente, seller, observação, foto)
- O botão do modal muda para "Atualizar PS" e faz `update` em vez de `insert`
- Resetar `editingEntry` ao fechar o modal

**PDF:**
- Incluir observação na linha do registro, abaixo do motivo

## Resumo

| Arquivo | Alteração |
|---|---|
| Migração SQL | `ADD COLUMN observations text` em `ps_entries` |
| `PSPage.tsx` | Campo observação no modal, coluna na tabela, lápis para edição, update no save, PDF |

