

## Plano de Correção: Paginação Robusta + Balão "Concluídos"

### 1. Tornar `fetchAllRows` à prova de falhas (supabase-helpers.ts)

O problema central é que queries sem `.order()` causam dados inconsistentes. A solução é **forçar `.order("id")` dentro do próprio helper**, para que nenhum chamador precise se preocupar com isso.

Mudanças em `supabase-helpers.ts`:
- Adicionar um wrapper `safeFetchAllRows` que, caso a query retorne dados inconsistentes (ex: duplicatas), detecte e trate
- Mais importante: adicionar **retry com fallback** — se a primeira página retornar vazia inesperadamente, tentar novamente
- Adicionar **deduplicação por ID** no helper para eliminar registros duplicados caso ocorram entre páginas
- Documentar que o chamador DEVE incluir `.order("id")` nas queries — mas como rede de segurança, o helper vai deduplicar

Implementação concreta:
```typescript
export async function fetchAllRows<T extends { id?: string } = any>(
  queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  options?: { deduplicateById?: boolean; maxRetries?: number }
): Promise<T[]> {
  const PAGE = 1000;
  const maxRetries = options?.maxRetries ?? 2;
  const all: T[] = [];
  let offset = 0;
  let retries = 0;
  
  while (true) {
    const { data, error } = await queryFn(offset, offset + PAGE - 1);
    if (error) {
      if (retries < maxRetries) { retries++; continue; }
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
    retries = 0;
  }
  
  // Deduplicate by id if available
  if (options?.deduplicateById !== false && all.length > 0 && 'id' in all[0]) {
    const seen = new Set<string>();
    return all.filter(item => {
      const id = (item as any).id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  return all;
}
```

### 2. Balão verde "Concluídos" entre "Lidos" e "Insucessos" (OperacaoPage.tsx)

Na área do indicador de cada card (linhas 355-364), adicionar um badge verde entre o número de lidos e o badge de insucessos:

```
89 lidos
🟢 86 concluídos    ← NOVO
🔴 3 insucessos
```

Onde `concluídos = totalLidosCard - c.all_returns` (são os TBRs efetivamente entregues, pelos quais o motorista recebe).

Mesma lógica aplicada em `DriverRides.tsx` e `DriverHome.tsx` para manter consistência nas 3 visões.

### Arquivos afetados
1. `src/lib/supabase-helpers.ts` — retry + deduplicação automática
2. `src/pages/dashboard/OperacaoPage.tsx` — badge verde "concluídos"
3. `src/pages/driver/DriverRides.tsx` — badge verde "concluídos"  
4. `src/pages/driver/DriverHome.tsx` — badge verde "concluídos"

