

# Editar e Período em Pacotes Mínimos

## Problema
1. Não há botão de edição nos registros existentes de pacotes mínimos
2. O campo de data é único (`target_date`) — o usuário quer definir um **período** (início e fim), e se ambos em branco, fica fixo

## Solução

### 1. Migration SQL — alterar tabela `driver_minimum_packages`
- Adicionar colunas `period_start date` e `period_end date` (ambas nullable)
- Migrar dados: copiar `target_date` para `period_start` (registros com data passam a ter período de 1 dia)
- Remover coluna `target_date`
- Atualizar constraint unique para `(unit_id, driver_id, period_start, period_end)`

### 2. `src/pages/dashboard/ConfiguracoesPage.tsx`
- **Estado**: trocar `mpDate` por `mpPeriodStart` e `mpPeriodEnd`; adicionar `editingMpId`, `editMpValue`, `editMpStart`, `editMpEnd` para edição inline
- **Formulário de criação**: substituir o campo de data único por dois inputs lado a lado ("Início do período" e "Fim do período") com label "Opcional — Em branco fica fixo"
- **Lista de registros**: adicionar botão de lápis (Pencil) ao lado da lixeira; ao clicar, a linha vira editável com inputs para período e quantidade, com botão Check para salvar
- **Interface MinPackage**: trocar `target_date` por `period_start` e `period_end`
- **handleAddMinPackage**: enviar `period_start` e `period_end` em vez de `target_date`
- **handleEditMinPackage** (novo): faz `update` no registro com novos valores
- **Exibição**: mostrar "Fixo" quando sem período, ou "DD/MM — DD/MM" quando com período

### Arquivos alterados
- **Migration SQL** — reestruturar colunas de data
- **`src/pages/dashboard/ConfiguracoesPage.tsx`** — formulário com período + botão editar

