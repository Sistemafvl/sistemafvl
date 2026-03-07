

## Plano: 2 Correções

### 1. Exclusão de login não funciona

**Problema:** O `handleDeleteLogin` (linha 186-188) faz `supabase.from("unit_logins").delete().eq("id", id)` sem tratar o resultado. A RLS policy de DELETE existe e permite `true`, então o problema provavelmente é que a chamada não está sendo disparada ou há um erro silencioso.

**Correção em `src/pages/dashboard/ConfiguracoesPage.tsx`:**
- Capturar o `error` retornado pelo delete e logar/exibir toast de erro se falhar
- Adicionar `toast({ title: "Login excluído" })` em caso de sucesso
- Verificar se o `id` está chegando corretamente (pode ser que o componente esteja renderizando dados da view `unit_logins_public` que não tem `password` — verificar `fetchLogins`)

Preciso checar como `fetchLogins` busca os dados (se usa `unit_logins` ou `unit_logins_public`).

### 2. Balão de insucessos mostra apenas 3 ao invés de 6

**Problema:** O balão filtra `.in("reason", OPERATIONAL_PISO_REASONS)` que inclui apenas 3 motivos operacionais: "Removido do carregamento", "Carregamento resetado", "Carregamento cancelado". Já a tela de Insucessos busca TODOS os `piso_entries` com `status=open` sem filtro de motivo. Por isso a tela mostra 6 e o balão mostra 3.

**Correção em `src/components/dashboard/InsucessoBalloon.tsx`:**
- Remover o filtro `.in("reason", OPERATIONAL_PISO_REASONS)` da query de `piso_entries`
- O balão deve contar TODOS os insucessos abertos de ontem pra trás, independente do motivo
- Manter o filtro de data (`lt created_at < hoje`) e status `open`

