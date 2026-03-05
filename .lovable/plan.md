
Plano objetivo para corrigir o alerta “É sua vez” e o som contínuo

1) Causa raiz confirmada (por que está disparando antes do sino)
- O backend de programação de carregamento (`supabase/functions/create-ride-with-login/index.ts`) está gravando `called_at` no momento de “Definir programação”.
- Como `DriverCallAlert` usa `called_at` como gatilho, o motorista recebe alerta sem o conferente clicar no sino.
- Além disso, o som atual é um beep curto em ciclos; em alguns celulares ele acaba soando como “1 beep”.

2) Ajuste principal (alertar só quando clicar no sino)
- Alterar `create-ride-with-login` para NÃO setar `called_at` ao criar/programar carga.
- Na atualização da `queue_entry` da programação, manter apenas status/completed_at e limpar campos de chamada:
  - `called_at: null`
  - `called_by_name: null`
- Resultado: programar carga não dispara mais “Sua Vez!”.

3) Blindagem no app do motorista (evitar falso positivo legado)
- Em `src/components/dashboard/DriverCallAlert.tsx`:
  - Considerar chamada válida somente quando houver `called_at` + `called_by_name` (chamada explícita via sino).
  - Ignorar registros antigos que tenham `called_at` sem `called_by_name` (resíduo de regra antiga).
  - Priorizar leitura da `queue_entry_id` da corrida ativa do motorista (pending/loading do dia), para não misturar com entradas antigas da fila.

4) Som e vibração contínuos até “CIENTE”
- Reescrever a engine de áudio do `DriverCallAlert` para modo realmente contínuo:
  - Web Audio contínuo (tom/sirene) enquanto `isAlerting=true`.
  - Fallback com `<audio loop>` (em vez de recriar áudio por beep).
- Manter vibração em loop contínuo.
- Parar som + vibração apenas no botão `CIENTE` (sem auto-stop por polling/realtime).

5) Escopo de arquivos
- `supabase/functions/create-ride-with-login/index.ts`
- `src/components/dashboard/DriverCallAlert.tsx`
- (sem migração de banco)

Detalhes técnicos (resumo)
- Gatilho correto de chamada passa a ser “evento de sino” (que já grava `called_at` e `called_by_name` em `ConferenciaCarregamentoPage`).
- Programação de carga não deve escrever `called_at`.
- Áudio em loop contínuo evita comportamento de beep único em mobile.

Validação pós-implementação
1. Programar motorista sem clicar no sino:
- Não pode aparecer “Sua Vez!”, nem som, nem vibração.
2. Clicar no sino no card do carregamento:
- Overlay “SUA VEZ!” aparece com nome do conferente.
- Som contínuo + vibração contínua iniciam.
3. Navegar para outras telas do motorista:
- Alerta continua ativo.
4. Clicar em `CIENTE`:
- Som e vibração param imediatamente.
