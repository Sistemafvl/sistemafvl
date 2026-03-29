

## Diagnóstico

### Problema 1: Página de Contrato do Diretor fica carregando infinitamente
A função `fetchLatestContract` é definida na linha 17, mas **nunca é chamada** — não existe um `useEffect` para executá-la. O estado `fetching` começa como `true` e nunca muda, travando na tela de loading.

### Problema 2: Motorista excluída ainda consegue logar
A Edge Function `authenticate-unit` (linha 160-165) busca o motorista na tabela `drivers` com `eq("active", true)`. A exclusão via `get-driver-details` deleta o registro da tabela `drivers`. Porém, se a motorista Vitória ainda consegue logar, é possível que:
- O registro não foi de fato deletado (a Edge Function pode ter falhado silenciosamente em alguma tabela dependente com FK)
- Ou o `drivers_public` view ainda retorna dados antigos

A solução mais robusta é adicionar uma verificação explícita na `authenticate-unit`: se o driver não existir na tabela `drivers`, negar login.

## Plano

### 1. Corrigir `ContractEditorPage.tsx` — adicionar `useEffect`
Adicionar o `useEffect` que chama `fetchLatestContract()` ao montar o componente. Sem isso, a página nunca sai do estado de loading.

```typescript
useEffect(() => {
  fetchLatestContract();
}, []);
```

### 2. Reforçar bloqueio de login para motoristas excluídos
Na Edge Function `authenticate-unit`, o trecho que busca o motorista (linha 160-165) já filtra por `active: true`. Mas para garantir que motoristas deletados não consigam logar mesmo por cache ou race condition, vamos verificar os logs e, se necessário, redeployar a função para garantir que a versão mais recente está ativa.

**Arquivos alterados:**
- `src/pages/matriz/ContractEditorPage.tsx` — adicionar `useEffect` para chamar `fetchLatestContract`
- `supabase/functions/authenticate-unit/index.ts` — redeploy para garantir versão atualizada (o código já bloqueia drivers deletados, pois o `SELECT` não encontrará o registro)

