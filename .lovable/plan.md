

# Plano: Histórico de Rotas no Modal de Programação

## Objetivo
Adicionar um campo antes do campo "Rota" no modal de programação que exibe as rotas únicas que o motorista já utilizou naquela unidade, como botões clicáveis que preenchem automaticamente o campo de rota.

## Implementação

### Arquivo: `src/components/dashboard/QueuePanel.tsx`

**1. Novo state para histórico de rotas:**
- Adicionar `const [routeHistory, setRouteHistory] = useState<string[]>([])` junto aos outros states do modal.

**2. Buscar rotas no `openProgramModal`:**
- Ao abrir o modal, consultar `driver_rides` filtrando por `driver_id` e `unit_id`, selecionando apenas `route`, onde `route` não é null.
- Extrair valores únicos (deduplicated) e ordenar alfabeticamente.
- Setar em `setRouteHistory`.

```typescript
const { data: routesData } = await supabase
  .from("driver_rides")
  .select("route")
  .eq("driver_id", entry.driver_id)
  .eq("unit_id", unitId)
  .not("route", "is", null);
const uniqueRoutes = [...new Set((routesData ?? []).map(r => r.route).filter(Boolean))].sort();
setRouteHistory(uniqueRoutes as string[]);
```

**3. Renderizar campo de histórico antes do campo Rota:**
- Label "Rotas anteriores" com container `max-h-24 overflow-y-auto` (barra de rolagem se muitas rotas).
- Cada rota como `<Badge>` ou `<Button variant="outline" size="sm">` clicável.
- Ao clicar, preenche `setRoute(rota)`.
- Se não houver rotas, exibir texto "Nenhuma rota anterior encontrada."

```tsx
<div className="space-y-2">
  <Label className="font-semibold">Rotas anteriores</Label>
  <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 p-2 border rounded-md bg-muted/30">
    {routeHistory.length === 0 ? (
      <p className="text-xs text-muted-foreground italic">Nenhuma rota anterior.</p>
    ) : (
      routeHistory.map(r => (
        <Button key={r} variant="outline" size="sm" className="h-7 text-xs"
          onClick={() => setRoute(r)}>{r}</Button>
      ))
    )}
  </div>
</div>
```

Essa seção ficará logo acima do campo "Rota" existente, dentro do `<div className="space-y-4">` do modal.

