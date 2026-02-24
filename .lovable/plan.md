
# Correcoes: Label do Grafico de Pizza e "Desconhecido" nos Rankings

## 1. Label cortado no grafico de pizza (Anexo 1)

**Problema**: No card "Status dos carregamentos", o label do Recharts PieChart (ex: "lo: 23") esta sendo cortado porque o texto transborda a area do container. O label renderiza fora da area visivel do grafico.

**Solucao**: Ajustar o label do `Pie` para usar um formato mais compacto e garantir que o container tenha espaco suficiente. Duas mudancas:
- Aumentar levemente a altura do container de `h-[220px]` para `h-[260px]`
- Usar `label` com posicao externa e texto abreviado, ou usar a `Legend` do Recharts em vez de labels inline, o que evita sobreposicao

**Arquivo**: `src/components/dashboard/DashboardMetrics.tsx` (linhas 253-264)
- Remover o `label` inline do `Pie` (que renderiza texto sobre o grafico e corta)
- Adicionar `<Legend />` do Recharts abaixo do grafico para mostrar os nomes e valores
- Aumentar `h-[220px]` para `h-[260px]` para acomodar a legenda

## 2. "Desconhecido" nos Rankings (Anexo 2)

**Problema**: No card "Maiores Ofensores de Retorno TBRs", aparece "Desconhecido" com 5 retornos. Isso ocorre porque `piso_entries`, `rto_entries` ou `ps_entries` tem registros com `driver_name` nulo. O codigo usa `e.driver_name ?? "Desconhecido"` (linha 184).

**Solucao**: Filtrar entradas sem `driver_name` em vez de exibi-las como "Desconhecido". Se o nome nao existe, o registro nao deveria aparecer no ranking.

**Arquivo**: `src/components/dashboard/DashboardInsights.tsx` (linha 184)
- Trocar `const name = e.driver_name ?? "Desconhecido"` por um filtro que ignora entradas sem nome
- Adicionar `if (!e.driver_name) return;` antes de processar a entrada

## Detalhes Tecnicos

### DashboardMetrics.tsx - Grafico de Pizza

```typescript
// Linha 253: aumentar altura
<CardContent className="h-[260px]">

// Linha 256: remover label inline, adicionar Legend
import { Legend } from "recharts"; // ja importado via recharts

<Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" nameKey="name">
  {pieData.map((_, i) => (
    <Cell key={i} fill={COLORS[i % COLORS.length]} />
  ))}
</Pie>
<Tooltip />
<Legend formatter={(value, entry: any) => `${value}: ${entry.payload.value}`} wrapperStyle={{ fontSize: 12 }} />
```

### DashboardInsights.tsx - Filtrar "Desconhecido"

```typescript
// Linha 183-186: filtrar entradas sem nome
[...(pisoData ?? []), ...(rtoData ?? []), ...(psData ?? [])].forEach(e => {
  if (!e.driver_name) return; // Ignorar entradas sem nome
  const name = e.driver_name;
  if (!driverTbrSets[name]) driverTbrSets[name] = new Set();
  if (e.tbr_code) driverTbrSets[name].add(e.tbr_code);
});
```

### Resumo de arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/dashboard/DashboardMetrics.tsx` | Trocar label inline por Legend no PieChart, aumentar altura |
| `src/components/dashboard/DashboardInsights.tsx` | Filtrar entradas sem driver_name nos rankings |
