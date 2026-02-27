

## Plan: Ajustes nas telas da Matriz (Overview, Motoristas, Financeiro)

### Resumo das mudanças solicitadas

**Anexo 1 — MatrizOverview.tsx (KPI "Média Avaliação")**
- Substituir o card "Média Avaliação" por "Total Pago (TBRs)" que calcula o valor total pago aos motoristas pelos TBRs concluídos (carregamentos finalizados), considerando `driver_custom_values` para taxas diferenciadas e `unit_settings.tbr_value` como fallback padrão.
- Buscar `driver_custom_values` e `unit_settings` no fetch de dados da Overview.

**Anexo 2 — MatrizOverview.tsx (Gráficos)**
- **Status dos Carregamentos (pizza):** Traduzir os status para PT-BR usando mapeamento (`finished` → "Finalizado", `cancelled` → "Cancelado", `pending` → "Pendente", `loading` → "Carregando").
- **Top 10 Motoristas:** Os IDs truncados (`driver_id.slice(0,8)`) estão aparecendo no lugar dos nomes. Buscar `drivers_public` para mapear `driver_id` → `name` e exibir o nome real.

**Anexo 3 — MatrizMotoristas.tsx**
- Substituir coluna "Média" (média TBRs/carregamento) por "Total Ganho" — valor total recebido pelos TBRs finalizados, usando `driver_custom_values` + `unit_settings.tbr_value`.
- Adicionar filtro de Unidade (Select com "Todas" + lista de unidades do domínio).

**Anexo 4 — MatrizFinanceiro.tsx**
- Excluir o gráfico de barras "Receita vs DNR por Unidade".
- Substituir card "Receita Estimada" por "Total Pago (TBRs)" — soma real paga aos motoristas considerando valores diferenciados.
- Na tabela "Detalhamento por Unidade": substituir coluna "Receita Est." por "Total Pago TBRs" e excluir coluna "Líquido Est.".

### Detalhes técnicos

**Dados adicionais a buscar:**
- `drivers_public` (id, name) — já buscado em Motoristas, adicionar em Overview
- `unit_settings` (unit_id, tbr_value) — adicionar em Overview e Motoristas
- `driver_custom_values` (unit_id, driver_id, custom_tbr_value) — adicionar em Overview, Motoristas e Financeiro

**Lógica de cálculo "Total Pago":**
Para cada TBR finalizado (em ride com `loading_status = finished` ou qualquer ride concluída):
1. Verificar se existe `driver_custom_values` para o `driver_id` + `unit_id` → usar `custom_tbr_value`
2. Senão, usar `unit_settings.tbr_value` da unidade
3. Somar todos os valores

**Mapeamento de status PT-BR (pizza chart):**
```
pending → Pendente
loading → Carregando  
finished → Finalizado
cancelled → Cancelado
```

### Arquivos a modificar
1. `src/pages/matriz/MatrizOverview.tsx` — KPI, pizza chart tradução, top 10 com nomes reais
2. `src/pages/matriz/MatrizMotoristas.tsx` — coluna Média → Total Ganho, filtro unidade
3. `src/pages/matriz/MatrizFinanceiro.tsx` — remover gráfico, ajustar card e tabela

