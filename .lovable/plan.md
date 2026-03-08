

## Plano: Opção "Todas" no seletor de unidades do Diretor

### Contexto
O diretor ao logar deve ver os dados consolidados de todas as unidades por padrão, e filtrar escolhendo uma unidade específica. Hoje, auto-seleciona a primeira unidade.

### Mudanças

**1. `src/components/dashboard/DirectorUnitSwitcher.tsx`**
- Adicionar opção "Todas as Unidades" como primeiro item do Select
- No login, auto-selecionar "Todas" em vez da primeira unidade
- Quando "Todas" selecionada, chamar `setActiveUnit("all", "Todas as Unidades")`

**2. `src/stores/auth-store.ts`**
- Sem mudanças estruturais — `setActiveUnit("all", "Todas as Unidades")` já funciona com a interface atual

**3. Criar `src/lib/unit-filter.ts`** — Helper de filtro
- Função `applyUnitFilter(query, unitId, domainUnits[])` que:
  - Se `unitId === "all"`: aplica `.in("unit_id", domainUnits.map(u => u.id))`
  - Senão: aplica `.eq("unit_id", unitId)`
- Reutilizável em todos os pontos de query

**4. `src/pages/dashboard/DashboardHome.tsx`**
- Importar helper e `domainUnits` do store
- Substituir `.eq("unit_id", unitSession.id)` pelo helper nas queries de feedback, DNR, TBR search
- Passar `unitId` + `domainUnits` para DashboardMetrics e DashboardInsights

**5. `src/components/dashboard/DashboardMetrics.tsx`**
- Receber `allUnitIds?: string[]` como prop
- Substituir todos os `.eq("unit_id", unitId)` pelo helper (8+ queries)

**6. `src/components/dashboard/DashboardInsights.tsx`**
- Mesmo padrão: receber `allUnitIds` e usar helper nas queries

**7. Páginas operacionais (PS, RTO, Piso, Carregamento, etc.)**
- Quando `unitSession.id === "all"`, exibir aviso "Selecione uma unidade específica para operar"
- Bloquear ações de escrita sem unidade específica selecionada

### Resultado
- Diretor entra e vê números de TODAS as unidades consolidados
- Ao selecionar uma unidade, filtra para aquela específica
- Páginas de operação exigem unidade específica para funcionar

