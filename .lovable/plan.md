

# Plano: Auto-atualização do sistema (PWA)

## Diagnóstico

O sistema usa PWA com `registerType: "autoUpdate"`, mas **não existe nenhum código que registre o Service Worker** nem que force a atualização. O Vite PWA gera o SW, mas ninguém o importa/ativa. Resultado: o browser serve arquivos antigos do cache e o usuário vê a versão desatualizada até que o cache expire naturalmente.

## Solução

Duas alterações:

### 1. Workbox: forçar ativação imediata do novo SW

**Arquivo:** `vite.config.ts`

Adicionar `skipWaiting: true` e `clientsClaim: true` ao bloco `workbox`. Isso faz o novo Service Worker tomar controle imediatamente, sem esperar o usuário fechar todas as abas.

### 2. Registrar o SW e recarregar ao detectar atualização

**Novo arquivo:** `src/components/PWAAutoUpdate.tsx`

Componente que usa `useRegisterSW` do `virtual:pwa-register/react` para:
- Registrar o SW automaticamente
- Verificar atualizações a cada 60 segundos
- Quando detectar uma nova versão, chamar `updateServiceWorker(true)` que força `skipWaiting` + recarrega a página automaticamente
- Mostrar um toast informando "Sistema atualizado" após o reload

**Arquivo:** `src/App.tsx`

Incluir `<PWAAutoUpdate />` dentro do App.

### 3. Tipagem para o módulo virtual

**Novo arquivo:** `src/vite-pwa.d.ts`

Declaração de tipo para `virtual:pwa-register/react` evitar erros de TypeScript.

## Resumo

| Arquivo | Alteração |
|---|---|
| `vite.config.ts` | Adicionar `skipWaiting` + `clientsClaim` ao workbox |
| `src/components/PWAAutoUpdate.tsx` | Novo — registra SW, detecta updates, recarrega automaticamente |
| `src/vite-pwa.d.ts` | Novo — tipos do módulo virtual |
| `src/App.tsx` | Incluir `<PWAAutoUpdate />` |

