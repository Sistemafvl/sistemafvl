

## Problema

O `handleFinalize` no PSPage.tsx agora fecha a `piso_entry` ao finalizar um PS — mas isso só funciona **daqui para frente**. Os TBRs que **já tinham** PS finalizado antes dessa mudança continuam aparecendo na lista de Insucessos porque nunca foram fechados retroativamente.

## Solução

Adicionar auto-close na função `loadEntries` do `RetornoPisoPage.tsx`: após carregar os registros abertos, verificar se algum deles já possui um `ps_entries` (aberto ou fechado) na mesma unidade. Se sim, fechar automaticamente essas `piso_entries`.

### Implementação

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx` — função `loadEntries` (após o bloco de auto-close operacional, linha ~175)

1. Coletar os `tbr_code` dos registros abertos restantes
2. Consultar `ps_entries` na mesma `unit_id` com esses códigos (qualquer status)
3. Para cada match, fechar a `piso_entry` correspondente e removê-la da lista exibida

```typescript
// Auto-close piso_entries que já têm PS registrado
const remainingEntries = allEntries; // ou filtrado após operacionais
const openCodes = remainingEntries.map(e => e.tbr_code.toLowerCase());
if (openCodes.length > 0) {
  const { data: psMatches } = await supabase
    .from("ps_entries")
    .select("tbr_code")
    .eq("unit_id", unitSession.id)
    .in("tbr_code", openCodes);
  if (psMatches && psMatches.length > 0) {
    const psSet = new Set(psMatches.map(p => p.tbr_code.toLowerCase()));
    const toClosePs = remainingEntries.filter(e => psSet.has(e.tbr_code.toLowerCase()));
    if (toClosePs.length > 0) {
      await supabase.from("piso_entries")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .in("id", toClosePs.map(e => e.id));
      // remover da lista exibida
    }
  }
}
```

| Arquivo | Mudança |
|---------|---------|
| `RetornoPisoPage.tsx` | Auto-close de piso_entries com PS existente no `loadEntries` |

