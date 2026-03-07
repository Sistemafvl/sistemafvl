
Objetivo: impedir de forma definitiva que um TBR entre em outro carregamento sem passar por insucesso/ocorrência, sem alterar dados antigos.

1) Diagnóstico confirmado
- O problema ainda ocorre por 2 brechas:
  1. Trigger no banco (`prevent_duplicate_tbr_across_rides`) só bloqueia quando o ride anterior está `pending/loading`; se estiver `finished`, libera.
  2. No frontend (`saveTbr`), existe lógica que libera novo carregamento quando encontra qualquer histórico em `piso_entries` (mesmo antigo/fechado), e ainda tenta apagar `ride_tbrs` antigos em background.
- Evidência já visível no banco: TBRs iguais em rides diferentes sem novo insucesso entre as leituras.

2) Correção no banco (camada definitiva)
- Criar nova migration para substituir a função/trigger atual:
  - `DROP TRIGGER IF EXISTS check_tbr_unique_across_active_rides ON public.ride_tbrs;`
  - `CREATE OR REPLACE FUNCTION public.prevent_duplicate_tbr_across_rides() ...`
- Nova regra:
  - Bloquear insert se já existir o mesmo `UPPER(code)` em qualquer outro `ride_id` (não depender de `loading_status`).
  - Adicionar `pg_advisory_xact_lock(hashtext(UPPER(NEW.code)))` dentro da função para eliminar condição de corrida (concorrência real de dois bipes simultâneos).
- Resultado: só entra novamente quando o registro anterior tiver sido removido pelo fluxo de insucesso/PS/RTO (trigger `auto_remove_tbr_from_ride`).

3) Correção no frontend (alinhar comportamento ao banco)
Arquivo: `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Em `saveTbr`:
  - Remover a liberação baseada em “existe qualquer piso histórico”.
  - Remover a exclusão automática de `ride_tbrs` antigos (`void delete ... prevIds`) para não abrir brecha.
  - Se `previousTbrs.length > 0`, bloquear imediatamente com mensagem clara: “TBR já vinculado a outro carregamento; precisa passar por insucesso”.
- Manter rollback otimista + beep de erro + toast quando o banco rejeitar insert.

4) Fechar pontos alternativos de inserção
- Em “Incluir TBR” (bolha de RTO), tratar erro de insert:
  - Se bloqueado por duplicidade, mostrar toast e NÃO fechar o RTO.
- Revisar `DriverRescue` para manter tratamento amigável de erro (já há try/catch, apenas padronizar mensagem).

5) Validação pós-implementação (sem mexer no histórico antigo)
- Cenário A: mesmo TBR em ride A e tentar em ride B sem insucesso → deve bloquear sempre.
- Cenário B: registrar insucesso com `ride_id` correto e depois bipes no novo ride → deve permitir.
- Cenário C: dois bipes simultâneos em rides diferentes → apenas um deve entrar (lock transacional).
- Cenário D: botão “Incluir TBR” respeitando mesma regra.

Detalhes técnicos (resumo)
- A proteção principal passa a ser de banco + lock transacional por código.
- Frontend deixa de “adivinhar liberação” por histórico antigo e passa a refletir a regra real.
- Sem correção retroativa de dados existentes, conforme solicitado.
