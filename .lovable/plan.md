

## Plano: Nova Página "Reativo" no Menu Principal

### Conceito
Página onde conferente/gerente busca um TBR, visualiza o histórico completo de rastreio e, com um botão "Ativar Reativo", registra o TBR como reativo (custo fixo R$ 20,00). Todos os reativos ficam listados em uma tabela profissional com detalhes.

### 1. Banco de Dados

**Nova tabela `reativo_entries`:**
- `id` (uuid PK, default gen_random_uuid())
- `unit_id` (uuid NOT NULL)
- `tbr_code` (text NOT NULL)
- `driver_id` (uuid)
- `driver_name` (text)
- `ride_id` (uuid)
- `route` (text)
- `login` (text)
- `conferente_name` (text) — quem ativou
- `manager_name` (text) — gerente logado, se houver
- `reativo_value` (numeric NOT NULL DEFAULT 20.00)
- `activated_at` (timestamptz NOT NULL DEFAULT now())
- `created_at` (timestamptz NOT NULL DEFAULT now())
- `observations` (text)
- `status` (text NOT NULL DEFAULT 'active')

RLS aberta (mesmo padrão do projeto). Constraint UNIQUE em `(unit_id, tbr_code)` para evitar duplicidade.

### 2. Nova Página `ReativoPage.tsx`

**Funcionalidades:**
- **Buscador de TBR**: campo de input para digitar/escanear o código TBR
- **Resultado da busca**: mostra o histórico completo do TBR (em qual corrida está, motorista, conferente, rota, login, status do carregamento, data/hora de escaneamento, ocorrências em piso/PS/RTO)
- **Botão "Ativar Reativo"**: registra o TBR na tabela `reativo_entries` com valor fixo de R$ 20,00, preenchendo automaticamente os dados do motorista, conferente ativo e gerente logado
- **Lista de Reativos do dia**: tabela com todos os reativos registrados, exibindo: TBR, motorista, rota, conferente, gerente, data/hora de ativação, valor (R$ 20,00), status
- **Filtro por data**: seletor de data igual às outras páginas
- **Indicadores no topo**: total de reativos do dia, valor total (qtd × R$ 20)

### 3. Menu e Rotas

- Adicionar "Reativo" ao array `menuItems` no `DashboardSidebar.tsx` (acesso geral, não restrito a gerente)
- Ícone: `Zap` do lucide-react
- Rota: `/dashboard/reativo`
- Adicionar rota no `App.tsx`

### 4. Integração Financeira
O valor de R$ 20,00 por TBR reativo será registrado na tabela para futura integração com relatórios financeiros.

### Ordem de Implementação
1. Migração SQL (tabela + RLS)
2. Criar `ReativoPage.tsx`
3. Adicionar menu + rota

