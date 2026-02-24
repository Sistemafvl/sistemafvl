
# Correcao: Corridas do Motorista usando valor TBR errado

## Problema

A pagina de Corridas (DriverRides) nao consulta a tabela `driver_custom_values` e usa apenas o valor padrao da unidade (`unit_settings.tbr_value`). Motoristas com valor diferenciado (como Vitoria com R$2,20) veem calculos baseados no valor padrao (R$3,35).

**Exemplo - Vitoria, corrida #19 (23/02):**
- Exibido: Total R$26,80 (8 x R$3,35)
- Correto: Total R$17,60 (8 x R$2,20)

## Causa Raiz

No arquivo `src/pages/driver/DriverRides.tsx`:
- Linha 61: Busca apenas `unit_settings` para valor do TBR
- Linha 86: Atribui `tbrValue` direto do `settingsMap` sem verificar valor customizado
- Nao existe fetch de `driver_custom_values`

## Solucao

Adicionar a consulta de `driver_custom_values` e priorizar o valor customizado sobre o valor padrao da unidade, mantendo consistencia com a folha de pagamento e o dashboard.

## Detalhes Tecnicos

### Arquivo: `src/pages/driver/DriverRides.tsx`

**Mudanca 1 -- Adicionar fetch de `driver_custom_values` (linha 55-62)**

Incluir no `Promise.all`:
```typescript
supabase.from("driver_custom_values")
  .select("unit_id, custom_tbr_value")
  .eq("driver_id", driverId),
```

**Mudanca 2 -- Criar mapa de valores customizados e priorizar (linhas 64-86)**

```typescript
const customMap = new Map(
  (customRes.data ?? []).map((cv) => [cv.unit_id, Number(cv.custom_tbr_value)])
);

// Na atribuicao de tbrValue:
tbrValue: customMap.get(r.unit_id) ?? settingsMap.get(r.unit_id) ?? 0,
```

### Resultado esperado

| Corrida | Antes (errado) | Depois (correto) |
|---|---|---|
| #20 (1 TBR) | R$3,35 | R$2,20 |
| #19 (8 concluidos) | R$26,80 | R$17,60 |

### Arquivo modificado

| Arquivo | Alteracao |
|---|---|
| `src/pages/driver/DriverRides.tsx` | Buscar `driver_custom_values` e priorizar valor customizado sobre valor padrao da unidade |
