

## Plano: Eliminar Limite de 1000 Registros em Todo o Sistema

### Resumo

Sim, vou corrigir **todas** as queries vulneráveis. Identifiquei **7 arquivos** com queries que ainda podem truncar dados acima de 1000 registros. As queries já protegidas (OperacaoPage, CiclosPage, DNRPage, PSPage, RTOPage, RelatoriosPage, DashboardMetrics gráficos, DriverRides, FeedbacksPage TBRs) continuam intactas.

### Queries a Corrigir

**1. MatrizOverview.tsx** (ALTA prioridade — agrega múltiplas unidades)
- Linhas 62-71: 8 queries diretas sem paginação (rides, PS, RTO, DNR, piso, reviews, drivers, settings)
- Converter todas para `fetchAllRows`

**2. MatrizUnidades.tsx** (ALTA prioridade)
- Linhas 40-45: 6 queries diretas (rides, PS, RTO, DNR, piso, reviews)
- Converter para `fetchAllRows`

**3. MatrizMotoristas.tsx** (MÉDIA)
- Linhas 49-54: queries de `drivers_public`, `dnr_entries`, `ps_entries`, `unit_settings`, `custom_values`, `min_packages` sem paginação
- Converter para `fetchAllRows`

**4. MatrizFinanceiro.tsx** (MÉDIA)
- Linha 43: `dnr_entries` sem paginação
- Converter para `fetchAllRows`

**5. DashboardHome.tsx** (MÉDIA)
- Linhas 87-90: `unit_reviews` sem paginação (média de avaliações)
- Linhas 102-105: `dnr_entries` sem paginação (contadores DNR)
- Converter para `fetchAllRows`

**6. ConferenciaCarregamentoPage.tsx** (MÉDIA)
- Linhas 472-476: `piso_entries` removidos sem paginação
- Linhas 499-503: busca global de TBRs (`ride_tbrs.ilike`) sem paginação
- Linhas 553-557: TBRs de rides encontrados na busca sem paginação
- Converter para `fetchAllRows`

**7. ConfiguracoesPage.tsx** (BAIXA)
- Linha 99: `driver_custom_values` sem paginação
- Linha 109: `driver_bonus` sem paginação
- Linha 115: `driver_minimum_packages` sem paginação
- Linha 129: `driver_rides` para buscar motoristas sem paginação
- Converter para `fetchAllRows`

**8. FeedbacksPage.tsx** (BAIXA)
- Linha 57-61: `driver_rides` sem paginação (rides por driver)
- Converter para `fetchAllRows`

**9. FinanceiroPage.tsx** (BAIXA)
- Linhas 55-59: `payroll_reports` sem paginação
- Linhas 63-66: `driver_invoices` sem paginação
- Converter para `fetchAllRows`

**10. RetornoPisoPage.tsx** (BAIXA)
- Linhas 154-159: `piso_entries` abertos sem paginação
- Converter para `fetchAllRows`

### Outras Limitações Verificadas

- **`.in()` com arrays muito grandes**: já tratado pelo `chunkArray` no helper. Sem risco.
- **`count: exact, head: true`**: usado no DashboardMetrics para contagens — isso é server-side, sem limite de 1000. OK.
- **RPCs**: `get_unit_tbr_count`, `get_top_drivers_by_tbrs`, `get_ride_tbr_counts` — executam server-side, sem limite. OK.
- **Nova unidade**: não cria limitação nova; o risco é proporcional ao volume de dados, não ao número de unidades.

### Abordagem Técnica
- Importar `fetchAllRows` (e `fetchAllRowsWithIn` quando necessário para `.in()`)
- Adicionar `.range(from, to)` em cada query convertida
- Manter a mesma lógica de negócio, apenas garantindo paginação automática

### Total: ~25 queries em 10 arquivos

