

# Plano: Adicionar Lixeira para Excluir PS

## O que será feito
Adicionar um botão de lixeira (ícone `Trash2`) em cada linha da tabela de PS, visível para entradas abertas e finalizadas. Ao clicar:

- **Se o TBR veio de um insucesso** (existe um `piso_entries` com mesmo `tbr_code` e `status = "closed"`): reabre o insucesso (volta `status` para `"open"` e limpa `closed_at`), depois deleta o PS.
- **Se foi cadastrado direto** (sem piso correspondente): apenas deleta o PS do sistema.

Um diálogo de confirmação será exibido antes de qualquer exclusão.

## Arquivo modificado
**`src/pages/dashboard/PSPage.tsx`**

1. Importar `Trash2` do lucide-react e componentes do `AlertDialog`
2. Adicionar estado `deletingEntry: PsEntry | null`
3. Criar função `handleDeletePs(entry)` com a lógica descrita acima
4. Adicionar botão `Trash2` na coluna de ações (linha ~1046), visível para **todos** os status
5. Adicionar `AlertDialog` de confirmação com mensagem explicativa em PT-BR

## Detalhes técnicos
- A query no `piso_entries` usa `.ilike("tbr_code", entry.tbr_code)` + `.eq("unit_id", unitSession.id)` + `.eq("status", "closed")` para encontrar o insucesso correspondente
- Nenhuma migração de banco necessária — as tabelas e permissões já suportam delete

