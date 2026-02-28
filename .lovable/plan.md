

## Plano: Corrigir contagem de retornos — excluir TBRs removidos durante carregamento

### Problema
Quando um TBR é removido durante o carregamento (bipagem), o sistema cria uma `piso_entry` com o `ride_id` do carregamento. Na contagem de retornos, essas entradas são contadas como "retornos", inflando o número (ex: -98/13 com 111 retornos). O correto é: **só contar como retorno se o TBR ainda está no carregamento** (presente em `ride_tbrs`).

### Páginas já corretas (não precisam de alteração)
- **RelatoriosPage.tsx** e **DriverHome.tsx** — usam lógica de "retorno líquido" que cruza com `ride_tbrs`, portanto TBRs removidos não são contados.

### Páginas a corrigir

**1. `OperacaoPage.tsx` — contagem agregada (L97-140)**
- Alterar fetch de `ride_tbrs` para incluir `code` além de `ride_id`
- Construir um set de códigos por ride: `tbrCodesByRide[ride_id] = Set<code>`
- Na contagem de retornos, só contar se `tbrCodesByRide[ride_id].has(tbr_code)`

**2. `OperacaoPage.tsx` — modal de detalhes (L309-322)**
- Já busca `ride_tbrs` com `code` e cruza com retornos — porém os retornos vêm por `ride_id` e podem incluir TBRs removidos. Como o modal só mostra TBRs que estão em `ride_tbrs`, o vermelho está correto (se o código está em ride_tbrs E tem retorno). Este trecho **não precisa de correção**.

**3. `CiclosPage.tsx` — contagem agregada (L86-107)**
- Alterar fetch de `ride_tbrs` para incluir `code`
- Só contar retorno se o `tbr_code` existe em `ride_tbrs` para aquele `ride_id`

**4. `DriverRides.tsx` — contagem por corrida (L74-94)**
- Alterar fetch de `ride_tbrs` para incluir `code`
- Construir set de códigos por ride
- Só contar retorno se `tbr_code` está no set do ride correspondente

### Padrão da correção

Antes:
```typescript
const returnTbrSets: Record<string, Set<string>> = {};
[...pisoData, ...psData, ...rtoData].forEach((p) => {
  if (p.ride_id && p.tbr_code) {
    if (!returnTbrSets[p.ride_id]) returnTbrSets[p.ride_id] = new Set();
    returnTbrSets[p.ride_id].add(p.tbr_code);
  }
});
```

Depois:
```typescript
// Build set of TBR codes per ride
const tbrCodesByRide: Record<string, Set<string>> = {};
tbrsData.forEach((t) => {
  if (!tbrCodesByRide[t.ride_id]) tbrCodesByRide[t.ride_id] = new Set();
  tbrCodesByRide[t.ride_id].add(t.code);
});

// Only count as return if TBR is still in ride_tbrs
const returnTbrSets: Record<string, Set<string>> = {};
[...pisoData, ...psData, ...rtoData].forEach((p) => {
  if (p.ride_id && p.tbr_code && tbrCodesByRide[p.ride_id]?.has(p.tbr_code)) {
    if (!returnTbrSets[p.ride_id]) returnTbrSets[p.ride_id] = new Set();
    returnTbrSets[p.ride_id].add(p.tbr_code);
  }
});
```

