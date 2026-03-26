
Objetivo: eliminar a divergência entre ambiente de criação e publicado sem quebrar fluxo operacional.

1) Diagnóstico e causa provável
- O comportamento do print indica bundle antigo em cache (Service Worker/Cache Storage), não falta real de código.
- Hoje o app tenta registrar `/sw.js` em `PWAAutoUpdate`, mas a PWA do Vite está comentada. Isso cria cenário de SW “fantasma” (stale) e tela desatualizada.

2) Correção estrutural (sem impacto de negócio)
- Refatorar `src/components/PWAAutoUpdate.tsx` para ficar “ambiente-aware”:
  - Em criação/preview (`id-preview--...`): não registrar SW; limpar registrations + caches automaticamente (1 vez por sessão) e dar 1 reload controlado.
  - Em publicado: só registrar SW se `/sw.js` existir; se não existir, limpar SW antigo automaticamente.
  - Manter proteção contra loop de reload.

3) Tornar sincronização manual sempre acessível
- Extrair botão “Limpar cache e sincronizar” para componente único reutilizável.
- Usar em `DashboardLayout`, `MatrizLayout`, `AdminLayout` e `DriverLayout`.
- Ajustar responsividade para nunca “sumir” (ícone em telas pequenas, texto em telas maiores; sem `hidden sm:flex` rígido).

4) Transparência de versão para evitar confusão
- Exibir selo discreto no header (ambiente + build version) para você ver na hora se está em criação ou publicado e se carregou versão nova.

5) Limpeza de configuração para evitar recaída
- Em `vite.config.ts`, remover import/config morto de PWA comentada para não reintroduzir SW parcial no futuro.

6) Validação final (E2E)
- Abrir criação “do zero” (novo dia), logar e validar se o botão aparece no topo.
- Comparar a mesma rota em criação vs publicado com mesmo build.
- Testar fluxo gerente/conferente/motorista para garantir zero regressão funcional.

Arquivos-alvo:
- `src/components/PWAAutoUpdate.tsx`
- `src/components/dashboard/DashboardLayout.tsx`
- `src/components/matriz/MatrizLayout.tsx`
- `src/components/admin/AdminLayout.tsx`
- `src/components/dashboard/DriverLayout.tsx`
- novo componente compartilhado de sync/version (ex.: `src/components/VersionSyncControl.tsx`)
- `vite.config.ts`
