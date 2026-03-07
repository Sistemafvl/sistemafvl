

## Plano: Valor Fixo de Saída por Motorista

### O que faz
Permite que o gerente configure um valor fixo de pagamento para um motorista em uma data específica. Quando configurado, o motorista recebe aquele valor exato no dia, independente da quantidade de TBRs. Funciona para datas passadas e futuras.

---

### 1. Banco de Dados: Criar tabela `driver_fixed_values`

Nova tabela com as colunas:
- `unit_id`, `driver_id`, `target_date`, `fixed_value`, `driver_name`, `created_at`
- Restrição única em `(unit_id, driver_id, target_date)` — um valor fixo por motorista por dia por unidade
- RLS aberta (mesmo padrão das outras tabelas de configuração)

### 2. Tela de Configurações: Nova seção após "Pacotes Mínimos"

**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`

Adicionar card "Valor Fixo de Saída" com:
- Campo de busca de motorista (mesmo padrão já usado na página)
- Campo de data (`type="date"`)
- Campo de valor em R$ (mesmo padrão de máscara de moeda já existente)
- Botão salvar → faz upsert na tabela `driver_fixed_values`
- Lista dos valores fixos cadastrados com nome do motorista, data, valor e botão de excluir

### 3. Cálculo da Folha: Usar valor fixo quando existir

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`

- Buscar `driver_fixed_values` da unidade no período selecionado
- Montar um Map: `"driverId_yyyy-MM-dd"` → `fixed_value`
- No cálculo por dia de cada motorista, verificar se existe valor fixo:
  - Se sim: `valor = fixedValue` (ignora `pacotes * valorTBR`)
  - Se não: mantém lógica atual

### 4. Painel do Motorista: Respeitar valor fixo

**Arquivo:** `src/pages/driver/DriverHome.tsx`

- Buscar `driver_fixed_values` do motorista
- Nos cálculos de métricas e quinzena, usar o valor fixo quando existir para aquele dia

### 5. Financeiro Matriz: Incluir valores fixos nos totais

**Arquivo:** `src/pages/matriz/MatrizFinanceiro.tsx`

- Buscar `driver_fixed_values` de todas as unidades do domínio
- No cálculo financeiro por unidade, para dias com valor fixo configurado, usar esse valor ao invés de `tbrs * valorTBR`

---

### Ordem de Implementação
1. Criar tabela no banco de dados
2. Adicionar seção na tela de Configurações (UI + CRUD)
3. Integrar no cálculo da folha (RelatoriosPage)
4. Integrar no painel do motorista (DriverHome)
5. Integrar no financeiro da matriz (MatrizFinanceiro)

