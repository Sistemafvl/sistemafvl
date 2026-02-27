

# Plano: Forçar carregamento da última versão ao abrir o sistema

## Problema

O PWA e o cache do navegador servem versões antigas dos arquivos JS/CSS. Mesmo com `skipWaiting` e `clientsClaim`, o Service Worker antigo pode continuar servindo assets cacheados até que o ciclo de atualização complete. Resultado: o usuário abre o sistema e vê a versão anterior (sem horários nos TBRs, etc.), precisando recarregar manualmente.

## Causa raiz

1. O `PWAAutoUpdate` verifica atualizações a cada 60s, mas na **primeira abertura** o SW antigo já está ativo e serve o cache antigo imediatamente
2. O `index.html` não tem headers `no-cache`, então o navegador pode servir uma cópia cacheada do HTML sem nem consultar o servidor
3. O `hasReloaded.current` impede reload duplicado, mas se o SW não detecta atualização imediatamente, a página fica na versão antiga

## Correções

### 1. Meta tags no-cache no `index.html`
Adicionar headers de cache-control via meta tags para garantir que o `index.html` nunca seja servido do cache do navegador:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

### 2. Versão embarcada com verificação na inicialização
- Gerar um `BUILD_VERSION` baseado no timestamp do build (via `define` no Vite)
- No `PWAAutoUpdate`, ao montar, comparar o `BUILD_VERSION` com o valor salvo no `localStorage`
- Se diferente: salvar a nova versão e forçar `location.reload()` uma única vez
- Isso garante que mesmo sem SW, ao carregar um novo bundle, o sistema recarrega limpo

### 3. Forçar verificação do SW na inicialização (não só a cada 60s)
- No `onRegisteredSW`, chamar `registration.update()` imediatamente ao registrar, além do intervalo

| Arquivo | Alteração |
|---|---|
| `index.html` | Adicionar meta tags no-cache |
| `vite.config.ts` | Adicionar `define: { __BUILD_VERSION__: JSON.stringify(Date.now().toString()) }` |
| `src/components/PWAAutoUpdate.tsx` | Verificar BUILD_VERSION vs localStorage, reload se diferente; chamar `registration.update()` imediato |

