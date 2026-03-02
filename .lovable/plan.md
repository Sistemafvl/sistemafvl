

## Problema

O auto-close não está funcionando por causa da **comparação case-sensitive**. O `.in("tbr_code", openCodes)` no Supabase/PostgreSQL é case-sensitive. Os códigos TBR no `piso_entries` estão em minúsculas (`tbr314129965`) mas no `ps_entries` estão em maiúsculas (`TBR314129965`), então o match falha.

Além disso, a linha 178 tem um bug lógico: `|| true` anula o filtro completamente.

## Correção

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx` — linhas 177-201

Trocar a busca `.in("tbr_code", openCodes)` por uma abordagem que normalize a comparação. Como o `.in()` do Supabase não suporta case-insensitive, a solução é buscar **todos** os `ps_entries` da unidade e comparar no client-side com `.toLowerCase()`, ou usar `.or()` com múltiplos `ilike`. A abordagem mais simples e eficiente:

1. Buscar `ps_entries` da unidade sem filtro de `tbr_code` (apenas `unit_id`)
2. Fazer o match case-insensitive no JavaScript
3. Corrigir o filtro `|| true` na linha 178

```typescript
// Linha 178: corrigir o filtro — remover || true
const remainingEntries = allEntries;

// Buscar TODOS os ps_entries da unidade para comparação case-insensitive
const { data: psMatches } = await supabase
  .from("ps_entries")
  .select("tbr_code")
  .eq("unit_id", unitSession.id);

if (psMatches && psMatches.length > 0) {
  const psSet = new Set(psMatches.map(p => p.tbr_code.toLowerCase()));
  const toClosePs = remainingEntries.filter(e => psSet.has(e.tbr_code.toLowerCase()));
  // ... fechar e remover da lista
}
```

| Arquivo | Mudança |
|---------|---------|
| `RetornoPisoPage.tsx` | Corrigir comparação case-insensitive no auto-close de PS |

