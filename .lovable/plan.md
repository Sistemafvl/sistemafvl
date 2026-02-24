

# Correcao: Exclusao de TBR nao funciona (RLS bloqueando)

## Problema

O botao de excluir retorna sucesso (status 204) mas nao deleta nada do banco de dados. O TBR permanece la porque as politicas de DELETE nas tabelas afetadas exigem o role `authenticated`, mas o app opera com o role `anon` (login por unidade, sem Supabase Auth).

Tabelas afetadas:
- `piso_entries` - politica DELETE exige "Authenticated"
- `ps_entries` - politica DELETE exige "Authenticated"
- `rto_entries` - politica DELETE exige "Authenticated"
- `dnr_entries` - politica DELETE exige "Authenticated"

## Solucao

Adicionar politicas de DELETE para o role `anon` (ou alterar as existentes para permitir `anon`) em todas as 4 tabelas.

## Detalhes Tecnicos

### Migracao SQL

Criar novas politicas permissivas de DELETE para cada tabela:

```sql
CREATE POLICY "Anon can delete piso_entries"
  ON piso_entries FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can delete ps_entries"
  ON ps_entries FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can delete rto_entries"
  ON rto_entries FOR DELETE TO anon USING (true);

CREATE POLICY "Anon can delete dnr_entries"
  ON dnr_entries FOR DELETE TO anon USING (true);
```

### Nenhuma alteracao de codigo necessaria

O codigo em `RetornoPisoPage.tsx` ja esta correto. O problema e exclusivamente nas permissoes do banco de dados.

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar politicas DELETE para role `anon` em 4 tabelas |

