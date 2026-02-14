

## Fluxo "Programar" com Modal e Card de Confirmacao

### Resumo
Quando o gerente clicar em "Programar", em vez de finalizar diretamente, abrira um modal para preencher **Rota** e **Login**. Ao clicar em "Definir", o sistema registra a corrida com essas informacoes e exibe um card de confirmacao com foto do motorista, nome, carro, placa, rota, login e sequencia de carregamento.

---

### 1. Migracao de Banco de Dados

Adicionar duas colunas na tabela `driver_rides`:
- `route` (TEXT, nullable) -- informacao de rota
- `login` (TEXT, nullable) -- login informado pelo gerente

Tambem adicionar `sequence_number` (INTEGER, nullable) para registrar a sequencia de carregamento.

---

### 2. Alteracoes no QueuePanel

**Dados adicionais do motorista na fila:**
- Ao buscar motoristas na fila, tambem carregar `avatar_url`, `car_model`, `car_plate` da tabela `drivers`.

**Modal de Programacao (Dialog):**
- Ao clicar "Programar", armazena a entrada selecionada e abre um Dialog.
- Campos do modal:
  - **Rota** -- Input de texto livre
  - **Login** -- Input de texto livre
  - Botao **Definir**

**Acao "Definir":**
1. Calcula o `sequence_number` (conta quantas rides ja existem para a unidade no dia + 1).
2. Atualiza `queue_entries` com status `completed`.
3. Insere em `driver_rides` com `route`, `login` e `sequence_number`.
4. Fecha o modal e abre um card/dialog de confirmacao.

**Card de Confirmacao (Dialog):**
- Foto do motorista (avatar)
- Nome do motorista
- Carro (modelo + cor)
- Placa
- Rota e Login preenchidos pelo gerente
- Sequencia de carregamento (ex: "#3")
- Botao para fechar

---

### Detalhes Tecnicos

**SQL Migration:**
```sql
ALTER TABLE public.driver_rides
  ADD COLUMN IF NOT EXISTS route TEXT,
  ADD COLUMN IF NOT EXISTS login TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER;
```

**Arquivos modificados:**
- `src/components/dashboard/QueuePanel.tsx` -- adicionar modal de programacao, card de confirmacao, buscar dados completos do motorista
- Nova migracao SQL

**Interface QueueEntry atualizada:**
```typescript
interface QueueEntry {
  id: string;
  driver_id: string;
  unit_id: string;
  status: string;
  joined_at: string;
  driver_name?: string;
  driver_avatar?: string;
  car_model?: string;
  car_plate?: string;
  car_color?: string;
}
```

**Fluxo de estados no componente:**
1. `selectedEntry` -- a entrada selecionada para programar
2. `showProgramModal` -- controla o modal com campos Rota/Login
3. `showConfirmCard` -- controla o card de confirmacao pos-definicao
4. `lastRideInfo` -- armazena dados da corrida recem-criada para exibir no card

