

## Plano: Pacotes Mínimos por Motorista

### O que será feito

Novo campo em Configurações que permite definir um mínimo de pacotes por motorista. Quando o motorista sair com menos TBRs que o mínimo em um dia, o sistema complementa automaticamente até o valor configurado no cálculo da folha de pagamento.

**Exemplo:** Vitoria Santana configurada com mínimo 60. Se sair com 59 TBRs no dia, o sistema calcula como 60 (adiciona +1 TBR virtual), usando o valor diferenciado dela se existir.

### 1. Criar tabela `driver_minimum_packages`

```sql
CREATE TABLE driver_minimum_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  min_packages integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, driver_id)
);
-- RLS: leitura, inserção, update e delete para todos (mesmo padrão das demais tabelas)
```

### 2. Adicionar seção na `ConfiguracoesPage.tsx`

- Nova seção após "Adicionais por Motorista" com ícone `Package` e título **"Pacotes Mínimos por Motorista"**
- Mesma mecânica de busca de motorista (reutiliza `searchDrivers`)
- Campo numérico para definir quantidade mínima
- Lista de motoristas configurados com botão de exclusão
- Texto explicativo: "Defina o mínimo de pacotes. Se o motorista sair com menos, o sistema complementa automaticamente no cálculo."

### 3. Integrar lógica no `RelatoriosPage.tsx`

Na geração da folha de pagamento (`buildPayroll`):
- Buscar `driver_minimum_packages` para a unidade
- Na construção dos `days` de cada motorista, após calcular `tbrCount` e `returns`:
  - Se `tbrCount < minPackages`, ajustar `tbrCount` para `minPackages`
  - Recalcular `value` com o tbrCount ajustado
- O valor diferenciado (`driver_custom_values`) já é respeitado pois `tbrVal` já é resolvido antes

### 4. Integrar nas telas da Matriz

Nas páginas `MatrizOverview`, `MatrizMotoristas` e `MatrizFinanceiro`, buscar também `driver_minimum_packages` e aplicar a mesma lógica de complemento ao calcular "Total Pago (TBRs)".

### Arquivos modificados
1. **Nova migração SQL** — tabela `driver_minimum_packages`
2. **`src/pages/dashboard/ConfiguracoesPage.tsx`** — nova seção de UI
3. **`src/pages/dashboard/RelatoriosPage.tsx`** — lógica de complemento no cálculo da folha
4. **`src/pages/matriz/MatrizOverview.tsx`** — aplicar mínimo no cálculo total pago
5. **`src/pages/matriz/MatrizMotoristas.tsx`** — aplicar mínimo no total ganho
6. **`src/pages/matriz/MatrizFinanceiro.tsx`** — aplicar mínimo no total pago por unidade

