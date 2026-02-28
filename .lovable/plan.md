

## Plano: Corrigir fechamento de piso_entries — bug de case sensitivity

### Causa raiz
Quando um TBR é removido do carregamento, a `piso_entry` é criada com o código em **maiúsculo** (ex: `TBR314647445`). Quando o mesmo TBR é escaneado em outro motorista, o `code` é gravado em **minúsculo** (ex: `tbr314647445`). A lógica de fechamento usa `.eq("tbr_code", code)` que faz comparação **case-sensitive** no Postgres — resultado: a piso_entry nunca é fechada.

### Correção

**1. `ConferenciaCarregamentoPage.tsx` — fechar piso/rto ao escanear (L804-814)**
- Converter `code` para uppercase antes de fechar: `.eq("tbr_code", code.toUpperCase())`
- Alternativamente, usar `.ilike("tbr_code", code)` para match case-insensitive
- Aplicar o mesmo fix na query de RTO

**2. `ConferenciaCarregamentoPage.tsx` — exclusão de TBR / reabrir piso (L660-696)**
- Garantir que o código usado para buscar piso_entries fechadas também use case-insensitive

**3. `RetornoPisoPage.tsx` — auto-limpeza ao carregar (L125-135)**
- Após carregar os entries open, verificar quais têm reason "Removido do carregamento" e cujo `tbr_code` existe em `ride_tbrs` (case-insensitive)
- Auto-fechar essas entries e removê-las da lista exibida
- Isso limpa os dados históricos já afetados pelo bug

### Padrão da correção no scan

```typescript
// Antes (L804-809)
supabase.from("piso_entries")
  .update({ status: "closed", closed_at: ... })
  .eq("tbr_code", code)
  .eq("status", "open"),

// Depois — normalizar para uppercase
const upperCode = code.toUpperCase();
supabase.from("piso_entries")
  .update({ status: "closed", closed_at: ... })
  .ilike("tbr_code", upperCode)
  .eq("status", "open"),
```

### Auto-limpeza no RetornoPisoPage

Após o `loadEntries`, filtrar entries com reason operacional que já estão em `ride_tbrs` e fechá-las automaticamente em background.

