

## Diagnóstico do Problema

Identifiquei **duas causas raiz** para o sistema não atualizar automaticamente:

### Problema 1: Preview do Lovable (área de criação)
O preview roda em modo `DEV` (`import.meta.env.DEV === true`), o que desabilita TODO o sistema de verificação de versão (`if (IS_DEV) return;` na linha 42 do PWAAutoUpdate). Isso é uma limitação do ambiente de preview — **não existe `version.json` em dev**. Este problema é do próprio Lovable e não tem solução via código. A versão que aparece no preview é a do código atual do editor, não a publicada.

### Problema 2: Dispositivos em produção não atualizam
A lógica atual tem uma falha crítica: ela busca `version.json` e guarda o valor remoto como "baseline" na primeira verificação, depois só dispara atualização se o valor **mudar novamente**. Ou seja:
- Usuário abre o app com JS antigo (ex: versão 100)
- `version.json` retorna versão 200 (nova)
- O sistema guarda 200 como baseline e **não faz nada**
- Só atualizaria se version.json mudasse para 300

Além disso, quando detecta mudança, mostra um modal esperando clique — o usuário nunca clica.

---

## Plano de Correção

### 1. Corrigir a lógica de detecção em `PWAAutoUpdate.tsx`
- Comparar `version.json` diretamente com `__BUILD_VERSION__` (a versão embutida no JS que o navegador carregou)
- Se forem diferentes → o JS está desatualizado → atualizar imediatamente
- Remover o conceito de "baseline ref" que causa o bug
- Remover o modal — fazer reload automático direto com limpeza completa (SW + Cache API + localStorage de versão)
- Manter polling a cada 2 minutos + verificação ao voltar à aba

### 2. Simplificar `main.tsx`
- Manter a limpeza diária mas garantir que não conflita com o PWAAutoUpdate
- Limpar também IndexedDB do app na limpeza diária

### 3. Melhorar `handleUpdate` (limpeza total)
- Limpar Service Workers, Cache API, localStorage de versão e IndexedDB
- Forçar reload com `location.href` para evitar cache do navegador

### 4. Manter o `VersionUpdateModal` disponível mas não usado
- O modal continua existindo caso queira usar futuramente, mas o fluxo padrão será auto-reload

### Arquivos a editar
- `src/components/PWAAutoUpdate.tsx` — reescrever lógica de detecção + auto-reload
- `src/main.tsx` — ajustar limpeza diária para incluir IndexedDB

### Resultado esperado
Ao publicar uma nova versão, qualquer dispositivo com o app aberto detectará automaticamente em até 2 minutos (ou ao voltar à aba) e recarregará sozinho, limpando todo o cache, sem necessidade de clique.

