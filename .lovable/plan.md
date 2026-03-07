

## Plano: Módulo "Socorrendo" no Painel do Motorista

### O que faz
Permite que um motorista "socorra" outro cujo veículo quebrou. O motorista socorrista escaneia os TBRs do motorista com problemas. Esses TBRs são transferidos do carregamento original para o carregamento do socorrista, aparecendo com fundo preto/texto branco no card de conferência e contabilizando nas métricas do socorrista.

---

### 1. Banco de Dados

**Nova tabela `rescue_entries`:**
- `id` (uuid PK)
- `unit_id` (uuid NOT NULL)
- `rescuer_driver_id` (uuid NOT NULL) — motorista que está socorrendo
- `original_driver_id` (uuid NOT NULL) — motorista socorrido (inferido do TBR)
- `original_ride_id` (uuid) — ride de onde o TBR veio
- `rescuer_ride_id` (uuid) — ride para onde o TBR foi (carregamento ativo do socorrista)
- `tbr_code` (text NOT NULL)
- `scanned_at` (timestamptz DEFAULT now())
- `created_at` (timestamptz DEFAULT now())
- RLS aberta (mesmo padrão)

**Coluna `is_rescue` na `ride_tbrs`:**
- `ALTER TABLE ride_tbrs ADD COLUMN IF NOT EXISTS is_rescue boolean DEFAULT false;`
- Permite identificar TBRs de socorro no card de conferência (fundo preto)

### 2. Menu do Motorista

**`DriverSidebar.tsx`:** Adicionar item "Socorrendo" após "DNR" com ícone `LifeBuoy`, URL `/motorista/socorrendo`

**`App.tsx`:** Adicionar rota `/motorista/socorrendo` → `DriverRescue`

### 3. Nova Página: `src/pages/driver/DriverRescue.tsx`

**Interface:**
- Header com título "Socorrendo" e ícone
- Campo de input para digitar TBR + botão de scanner por câmera (mesmo padrão do sistema)
- Ao bipar/digitar um TBR:
  1. Busca no banco qual `ride_tbrs` contém esse código (join com `driver_rides` da mesma unidade, do dia, status pending/loading/finished)
  2. Se encontrado: identifica o motorista original e o ride original
  3. Busca o carregamento ativo do socorrista (ride com `loading_status = 'loading'` ou o mais recente `finished` do dia)
  4. Se o socorrista não tem ride ativo, exibe erro
  5. Deleta o TBR do `ride_tbrs` do motorista original
  6. Insere no `ride_tbrs` do socorrista com `is_rescue = true`
  7. Insere registro em `rescue_entries` para histórico
  8. Feedback sonoro (beep sucesso) + visual (TBR aparece na lista)
  9. Se TBR não encontrado em nenhum ride → beep erro + toast

- Lista de TBRs já socorridos nesta sessão, com:
  - Código TBR
  - Nome do motorista original
  - Horário da leitura

### 4. Visual no Card de Conferência

**`ConferenciaCarregamentoPage.tsx`:**
- Ao renderizar TBRs de um ride, verificar `is_rescue === true`
- Se sim: aplicar classe `bg-black text-white` no item do TBR
- Tooltip ou badge indicando "Socorro" para contexto visual

### 5. Contabilização

Como os TBRs são fisicamente movidos para o `ride_tbrs` do socorrista, toda a contabilização existente (métricas, folha, financeiro) já contempla automaticamente — não precisa de alteração adicional.

---

### Ordem de Implementação
1. Migração SQL (tabela `rescue_entries` + coluna `is_rescue` em `ride_tbrs`)
2. Criar `DriverRescue.tsx` com scanner, lógica de transferência e lista
3. Adicionar rota e menu
4. Ajustar visual do card de conferência para TBRs de socorro

