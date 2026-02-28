

## Plano: Loading na busca TBR, filtro de TBRs e correção de exclusão

### Problema 1 — "Nenhum resultado" aparece antes do carregamento
Ao buscar um TBR, o estado `isSearchActive` fica `true` imediatamente (via `setTbrSearchCommitted`), mas `searchRides` ainda está vazio enquanto `fetchSearchResults` roda. O usuário vê "Nenhum resultado encontrado" por 1-2 segundos até os dados chegarem.

### Problema 2 — Busca mostra todos os TBRs do motorista
Ao buscar um TBR específico, o card do motorista aparece com TODOS os TBRs listados. O usuário quer ver apenas o TBR buscado.

### Problema 3 — Exclusão de TBR falha silenciosamente
A exclusão otimista funciona na UI, mas o realtime (com debounce de 1.5s) pode re-inserir o TBR deletado antes que o `realtimeLockUntil` expire, ou o `fetchRides` após delete pode trazer dados antigos.

---

### Mudanças

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

1. **Adicionar estado `isSearchLoading`** — novo `useState(false)` que fica `true` durante `fetchSearchResults` e `false` ao final.

2. **Spinner na busca** — No bloco condicional de renderização (linha ~1427), adicionar checagem de `isSearchLoading` antes de "Nenhum resultado". Quando `isSearchLoading` for `true`, mostrar `<Loader2 className="h-8 w-8 animate-spin" />` centralizado.

3. **Filtrar TBRs na lista quando busca ativa (Anexo 3)** — Na renderização dos `rideTbrs` dentro de cada card (linha ~1703), quando `isSearchActive`, filtrar para mostrar apenas TBRs cujo `code` contém o termo buscado:
   ```typescript
   const visibleTbrs = isSearchActive 
     ? rideTbrs.filter(t => t.code.toLowerCase().includes(tbrSearchCommitted.toLowerCase()))
     : rideTbrs;
   ```
   O contador de TBRs no badge também refletirá o total real (`rideTbrs.length`), mas a lista exibida será `visibleTbrs`.

4. **Corrigir exclusão de TBR** — O problema é que o `realtimeLockUntil` de 5 segundos pode não ser suficiente, e o `fetchRides` final pode buscar dados antes do DELETE propagar. Ajustes:
   - Aumentar `realtimeLockUntil` para 8 segundos
   - Adicionar `await` de 500ms antes do `fetchRides` final no `handleDeleteTbr` para dar tempo ao DB
   - Garantir que `deletingRef` é verificado ao processar dados do realtime também (já existe no `fetchRides`, mas confirmar)

5. **Aplicar loading spinner em outras telas** — Verificar e adicionar loading state nas páginas:
   - `OperacaoPage.tsx` — já tem `isLoading`/Skeleton, OK
   - `RetornoPisoPage.tsx`, `DNRPage.tsx` — verificar se já possuem loading adequado

### Fluxo corrigido da busca
```text
Enter → setTbrSearchCommitted(val) + setIsSearchLoading(true)
       → fetchSearchResults(val)
       → [Spinner girando na tela]
       → setSearchRides(mapped) + setIsSearchLoading(false)
       → [Cards aparecem com apenas o TBR buscado visível na lista]
```

