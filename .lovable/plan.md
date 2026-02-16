

# Seguranca 100% - Resolver os 2 Alertas Restantes

## Alerta 1: QueuePanel trafega senhas de unit_logins

### Problema
`QueuePanel.tsx` (linha 146) e `ConfiguracoesPage.tsx` (linha 26) fazem `select("id, login, password")` na tabela `unit_logins`, trafegando senhas no frontend.

### Solucao
Criar uma Edge Function `create-ride-with-login` que:
- Recebe `driver_ride_id` + `unit_login_id` + `route`
- Busca o login/senha no servidor (nunca envia ao frontend)
- Insere/atualiza o `driver_rides` com login e senha preenchidos server-side
- Retorna apenas confirmacao (sem senha)

Alterar o frontend:
- `QueuePanel.tsx`: consultar `unit_logins` apenas com `select("id, login")` (sem password). Ao programar, chamar a Edge Function em vez de fazer UPDATE direto
- `ConfiguracoesPage.tsx`: manter `select("id, login, password")` apenas para o gerente que gerencia os logins (precisa ver a senha que cadastrou). Alternativa: tambem ocultar e usar Edge Function para revelar

---

## Alerta 2: Senhas armazenadas em texto plano

### Problema
Campos `password` em `drivers`, `managers`, `units` e `unit_logins` estao sem hashing. Se o banco for comprometido, todas as senhas ficam expostas.

### Solucao
Criar uma Edge Function `hash-password` (utilitaria interna) e refatorar os fluxos:

1. **unit_logins**: Criar Edge Function `manage-unit-login` que faz INSERT/UPDATE com bcrypt no servidor. A `create-ride-with-login` compara hash ao autenticar
2. **drivers**: A Edge Function `authenticate-unit` ja existe para login de unidades. Criar `authenticate-driver` que valida senha com bcrypt
3. **managers**: Criar `authenticate-manager` com bcrypt
4. **units**: Refatorar `authenticate-unit` para usar bcrypt

Criar migration para hashear todas as senhas existentes usando uma funcao SQL com `pgcrypto`.

### ATENCAO - Impacto Grande
Essa mudanca requer:
- Habilitar extensao `pgcrypto` no banco
- Migrar TODAS as senhas existentes para hash
- Refatorar TODOS os fluxos de login (motorista, gerente, unidade)
- Atualizar TODOS os formularios de cadastro/edicao para enviar senha via Edge Function
- Testar extensivamente antes de publicar

---

## Arquivos novos
1. `supabase/functions/create-ride-with-login/index.ts` - Insere ride com login/senha server-side

## Arquivos modificados
1. `src/components/dashboard/QueuePanel.tsx` - Remover `password` do select, usar Edge Function
2. `src/pages/admin/SecurityPage.tsx` - Atualizar status do alerta do QueuePanel para "Ativo"

## O que NAO sera feito agora (Alerta 2)
O hashing de senhas (bcrypt) e uma refatoracao complexa que afeta todos os fluxos de autenticacao do sistema. Recomendo resolver em uma etapa separada e dedicada para evitar quebrar logins existentes. O alerta sera mantido na pagina de seguranca como "risco documentado".

## Resultado esperado
- Score sobe de 86% para ~93% (1 alerta resolvido)
- Para chegar a 100%, o hashing de senhas precisara ser implementado em etapa futura dedicada
