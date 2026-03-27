
Objetivo: corrigir de forma definitiva o erro no cadastro de motorista no site publicado, sem quebrar fluxo existente.

Diagnóstico confirmado
- O erro atual no publicado é de RLS no banco: `new row violates row-level security policy for table "drivers"`.
- O frontend já está com a correção de UUID local e sem `.select()` no insert.
- Portanto, o problema está na camada de políticas/permissões do ambiente publicado (diferença entre ambientes e/ou role efetiva diferente no momento do insert).

Plano de implementação (seguro e sem impacto de operação)

1) Normalizar políticas de INSERT da tabela `drivers` (idempotente)
- Criar uma migration cirúrgica para:
  - Remover policies de INSERT conflitantes/antigas em `public.drivers`.
  - Recriar policy explícita para `anon` com `WITH CHECK (true)`.
  - Criar também policy de INSERT para `authenticated` com `WITH CHECK (true)` (fallback seguro caso a sessão venha autenticada no runtime).
- Não abrir SELECT de `drivers` para `anon` (mantém blindagem de dados sensíveis).

2) Garantir privilégio de tabela para INSERT (hardening compatível)
- Na mesma migration, garantir `GRANT INSERT ON public.drivers TO anon, authenticated`.
- Isso evita efeito colateral de hardening anterior que tenha revogado escrita em produção.

3) Blindagem sem quebrar UX no frontend
- Manter o fluxo atual do `DriverRegistrationModal` (sem mudanças de comportamento).
- Apenas reforçar tratamento de erro para identificar RLS explicitamente no toast/log técnico interno (sem expor detalhes sensíveis para usuário final).

4) Publicação e sincronização
- Publicar para levar schema + código para o ambiente ao vivo.
- Fazer atualização forçada de cache/sincronização no publicado para evitar bundle antigo.

5) Validação E2E obrigatória (sem regressão)
- Testar no publicado com CPF novo:
  - Cadastro simples sem documentos.
  - Cadastro com 1 documento.
- Confirmar que:
  - toast de sucesso aparece,
  - motorista entra na listagem normal,
  - login do motorista funciona,
  - login gerente e exibição de nomes continuam intactos.

Detalhes técnicos
- Arquivos alvo:
  - `supabase/migrations/<nova_migration_fix_drivers_insert_live.sql>`
  - `src/components/DriverRegistrationModal.tsx` (somente melhoria de mapeamento de erro, opcional e não disruptiva)
- Sem alteração de fluxo operacional, layout ou regras de negócio.
- Foco em correção de permissão/RLS entre ambientes, preservando a blindagem de dados já implantada.

Critério de sucesso
- Zero erro de RLS no insert de `drivers` no ambiente publicado.
- Fluxos existentes mantidos (cadastro, login e visualização operacional).
