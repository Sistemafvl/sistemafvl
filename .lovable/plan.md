

# Excluir TBR Definitivamente do Sistema (Retorno Piso)

## O que sera feito

Ao clicar no icone de lixeira em um registro do Retorno Piso (visao do gerente), o sistema ira excluir o codigo TBR de **todas** as tabelas do sistema, nao apenas do `piso_entries`.

## Tabelas afetadas na exclusao

Ao confirmar a exclusao, o sistema deleta registros com o mesmo `tbr_code` + `unit_id` de:

1. `piso_entries` - o proprio registro do Retorno Piso
2. `ride_tbrs` - remove o TBR de qualquer carregamento (pelo code)
3. `ps_entries` - remove de PS
4. `rto_entries` - remove de RTO
5. `dnr_entries` - remove de DNR

## Detalhes Tecnicos

### Arquivo: `src/pages/dashboard/RetornoPisoPage.tsx`

Modificar o handler de confirmacao de delete (linhas 418-423) para, alem de deletar o `piso_entries`, tambem deletar o TBR de todas as outras tabelas:

```typescript
// Ao confirmar exclusao:
const tbrCode = entries.find(p => p.id === e.id)?.tbr_code;

// 1. Deletar de piso_entries
await supabase.from("piso_entries").delete().eq("id", e.id);

// 2. Deletar de ride_tbrs (pelo code)
await supabase.from("ride_tbrs").delete().eq("code", tbrCode);

// 3. Deletar de ps_entries
await supabase.from("ps_entries").delete()
  .eq("tbr_code", tbrCode).eq("unit_id", unitId);

// 4. Deletar de rto_entries
await supabase.from("rto_entries").delete()
  .eq("tbr_code", tbrCode).eq("unit_id", unitId);

// 5. Deletar de dnr_entries
await supabase.from("dnr_entries").delete()
  .eq("tbr_code", tbrCode).eq("unit_id", unitId);
```

Nenhuma migracao SQL necessaria - todas as tabelas ja possuem politicas de DELETE habilitadas.

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/RetornoPisoPage.tsx` | Expandir handler de delete para limpar TBR de todas as tabelas |

