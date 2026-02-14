

# Botao de Excluir Conferente

## O que sera feito

Adicionar um botao de excluir (icone de lixeira) na coluna "Acoes" da tabela de Conferentes, entre o badge de status e o botao de visualizar (olho). Ao clicar, um dialogo de confirmacao aparecera para evitar exclusoes acidentais. Confirmando, o registro sera removido permanentemente do banco de dados.

## Alteracoes

### Arquivo: `src/pages/dashboard/ConferentesPage.tsx`

1. **Importar** o icone `Trash2` do lucide-react e os componentes `AlertDialog` (`AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`)

2. **Novo estado** para controlar o conferente selecionado para exclusao:
   - `deleteConferente` (tipo `Conferente | null`)
   - `deleteLoading` (boolean)

3. **Funcao `handleDelete`**: executa `supabase.from("user_profiles").delete().eq("id", conferente.id)`. Em caso de sucesso, remove o conferente da lista local e exibe toast de confirmacao. Em caso de erro, exibe toast de erro.

4. **Botao na tabela**: adicionar um botao com icone `Trash2` (lixeira) na coluna de acoes, posicionado onde a seta vermelha indica na imagem (antes do botao de visualizar). Ao clicar, abre o AlertDialog de confirmacao.

5. **AlertDialog de confirmacao**: exibe o nome do conferente e pede confirmacao antes de excluir. Botoes "Cancelar" e "Excluir" (com variante destructive).

## Detalhes tecnicos

- A exclusao e permanente (DELETE no banco), nao apenas desativacao
- O AlertDialog evita exclusoes acidentais
- Nenhuma alteracao de banco de dados necessaria -- a politica RLS "Authenticated can delete user_profiles" ja permite a operacao
- O botao tera estilo `variant="ghost"` e cor vermelha no icone para indicar acao destrutiva

