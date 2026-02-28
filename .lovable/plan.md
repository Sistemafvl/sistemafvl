

## Plano: Filtrar piso_entries com motivo "Removido do carregamento" dos retornos

### Problema
Entradas na `piso_entries` com `reason = "Removido do carregamento"` ou `"Carregamento resetado"` ou `"Carregamento cancelado"` são operacionais — o TBR foi removido durante a bipagem, não é um retorno real de entrega. Quando esse TBR permanece no `ride_tbrs` do motorista (foi re-escaneado), o sistema o conta como retorno, inflando os números (ex: 14/94 com 80 retornos).

### Motivos operacionais a excluir
- `"Removido do carregamento"` (266 closed + 44 open = 310 registros)
- `"Carregamento resetado"` (17 registros)
- `"Carregamento cancelado"` (5 registros)

Esses motivos indicam que o TBR voltou ao piso por questão operacional da conferência, não por falha de entrega.

### Arquivos a alterar

**1. `OperacaoPage.tsx`** — 2 locais:
- **Contagem agregada (L101-103)**: Adicionar `reason` ao select de `piso_entries` e filtrar para excluir motivos operacionais antes de contar retornos
- **Modal de detalhes (L316-317)**: Adicionar `reason` ao select de `piso_entries` e excluir motivos operacionais do `returnSet`

**2. `CiclosPage.tsx` (L90-91)**: Adicionar `reason` ao select e filtrar motivos operacionais

**3. `DriverRides.tsx` (L60-61)**: Adicionar `reason` ao select e filtrar motivos operacionais

**4. `DriverHome.tsx` (L68-69)**: Adicionar `reason` ao select e filtrar motivos operacionais

**5. `RelatoriosPage.tsx` (L264)**: Adicionar `reason` ao select e filtrar motivos operacionais

**6. `DashboardInsights.tsx` (L137-139, L176-178)**: Adicionar `reason` ao select e filtrar motivos operacionais

### Constante compartilhada

Criar em `src/lib/status-labels.ts`:
```typescript
export const OPERATIONAL_PISO_REASONS = [
  "Removido do carregamento",
  "Carregamento resetado",
  "Carregamento cancelado",
];
```

### Padrão da filtragem

Para queries que buscam piso_entries para contagem de retornos, adicionar `reason` ao select e filtrar:

```typescript
// Antes
fetchAllRows<{ ride_id: string; tbr_code: string }>((from, to) =>
  supabase.from("piso_entries").select("ride_id, tbr_code").in("ride_id", rideIds).range(from, to)
);

// Depois  
const pisoRaw = await fetchAllRows<{ ride_id: string; tbr_code: string; reason: string | null }>((from, to) =>
  supabase.from("piso_entries").select("ride_id, tbr_code, reason").in("ride_id", rideIds).range(from, to)
);
const pisoData = pisoRaw.filter(p => !OPERATIONAL_PISO_REASONS.includes(p.reason ?? ""));
```

Para o modal (query direta):
```typescript
supabase.from("piso_entries").select("tbr_code, reason").eq("ride_id", c.ride_id)
// Depois filtrar: excluir entradas com reason operacional
```

### Nota
- PS e RTO entries NÃO possuem esses motivos operacionais, então não precisam de filtro
- `MatrizOcorrencias.tsx` já busca `reason` e exibe para visualização — não precisa de filtro pois mostra todas as ocorrências

