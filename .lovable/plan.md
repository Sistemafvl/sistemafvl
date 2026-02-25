

# Plano: Corrigir exclusão de conferente que não persiste

## Diagnóstico

O problema é uma **falha silenciosa de permissão (RLS)**. A tabela `user_profiles` só permite DELETE para o role `authenticated`, mas o gerente opera com sessão `anon` (não autenticada no backend). Quando o gerente clica em "Excluir":

1. O código remove o conferente da lista local (UI atualiza)
2. O DELETE no banco é **bloqueado pela RLS** silenciosamente (retorna 0 linhas afetadas, sem erro)
3. O conferente nunca é realmente excluído
4. Ao recarregar a página, o conferente reaparece

## Solução

Adicionar uma política RLS de DELETE para o role `anon` na tabela `user_profiles`, seguindo o mesmo padrão já usado em `piso_entries`, `ps_entries`, `rto_entries` e `dnr_entries`.

### Alteração 1: Migração SQL

Criar política:
```sql
CREATE POLICY "Anon can delete user_profiles"
  ON public.user_profiles
  FOR DELETE
  USING (true);
```

### Alteração 2: Melhoria no código (ConferentesPage.tsx)

Adicionar verificação do resultado do DELETE para garantir que a exclusão realmente ocorreu antes de atualizar a UI. Se o delete retornar 0 linhas, não remover da lista e mostrar erro.

## Resumo

| Item | Alteração |
|---|---|
| Migração SQL | Adicionar policy `Anon can delete user_profiles` |
| `ConferentesPage.tsx` | Verificar resultado do delete e tratar falhas |

