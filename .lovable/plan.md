

# Correção dos Erros de Build

## Problemas identificados

1. **`vite-plugin-pwa` v1.2.0 incompatível com Vite 5** — A v1.x do plugin requer Vite 6+. O projeto usa Vite 5.4.19, então precisa usar v0.21.x (última compatível com Vite 5). Além disso, está em `dependencies` quando deveria estar em `devDependencies`.

2. **`framer-motion` não instalado** — `CallingPanelPage.tsx` importa `framer-motion` mas o pacote não está no `package.json`.

3. **TS2589 em `QueuePanel.tsx` linha 361** — Type instantiation excessivamente profunda na chain de query do Supabase (`.select().eq().eq().maybeSingle()`). Resolvido com cast `as any`.

## Plano de implementação

### 1. Corrigir versão do `vite-plugin-pwa`
- Mover de `dependencies` para `devDependencies`
- Alterar versão de `^1.2.0` para `^0.21.1` (última compatível com Vite 5)

### 2. Adicionar `framer-motion` ao `package.json`
- Adicionar `"framer-motion": "^11.18.0"` em `dependencies`

### 3. Corrigir TS2589 em `QueuePanel.tsx`
- Adicionar cast `as any` na query da linha 361 para evitar inferência de tipo excessivamente profunda

### Detalhes técnicos
- Arquivo alterado: `package.json` (mover vite-plugin-pwa, adicionar framer-motion)
- Arquivo alterado: `src/components/dashboard/QueuePanel.tsx` (cast na linha 361)
- Nenhum fluxo operacional será afetado — são apenas correções de build

