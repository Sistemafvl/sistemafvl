

## Correcoes na Conferencia Carregamento

### Problema 1: Acoes nao sao instantaneas

Atualmente, ao clicar em Iniciar, Finalizar, Retornar ou escanear um TBR, o codigo salva no banco mas **nao atualiza a tela imediatamente** -- depende do realtime que tem atraso. A solucao e chamar `fetchRides()` logo apos cada mutacao, garantindo atualizacao instantanea.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Funcoes afetadas:
- `handleIniciar` -- adicionar `await fetchRides()` apos o update
- `handleFinalizar` -- adicionar `await fetchRides()` apos o update
- `handleRetornar` -- adicionar `await fetchRides()` apos o update
- `handleSelectConferente` -- adicionar `await fetchRides()` apos o update
- `handleTbrSubmit` -- adicionar `await fetchRides()` apos o insert (alem de limpar o input)

---

### Problema 2: Gravar e exibir data/hora de inicio e termino

Adicionar duas colunas na tabela `driver_rides`:
- `started_at` (TIMESTAMPTZ, nullable) -- gravado ao clicar Iniciar
- `finished_at` (TIMESTAMPTZ, nullable) -- gravado ao clicar Finalizar

**Migracao SQL:**
```sql
ALTER TABLE public.driver_rides
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
```

**Logica atualizada:**
- `handleIniciar`: salva `loading_status: 'loading'` **e** `started_at: new Date().toISOString()`
- `handleFinalizar`: salva `loading_status: 'finished'` **e** `finished_at: new Date().toISOString()`
- `handleRetornar`: salva `loading_status: 'loading'` **e** `finished_at: null` (limpa o termino)

**Exibicao no card:**
- Logo apos a placa, exibir "Inicio: DD/MM/YYYY HH:MM" quando `started_at` existir
- Logo apos o inicio, exibir "Termino: DD/MM/YYYY HH:MM" quando `finished_at` existir
- Usar icones de relogio para diferenciar visualmente

---

### Resumo dos arquivos

**Migracao de banco:** nova migracao para `started_at` e `finished_at`

**Arquivo modificado:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Adicionar `await fetchRides()` em todas as funcoes de mutacao
- Adicionar campos `started_at` e `finished_at` na interface e nas acoes
- Exibir as datas formatadas no card, logo apos a placa
