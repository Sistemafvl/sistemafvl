

## Plano: Unificar lógica de TBRs + Info buttons nos Ciclos

### Problema identificado

Os números diferem porque usam lógicas diferentes:

| Tela | Valor | Lógica |
|------|-------|--------|
| Dashboard "TBRs escaneados" | 3683 | Conta apenas `ride_tbrs` (ativos na carga) |
| Operação "TBRs Lidos" | 3843 | `ride_tbrs` + retornos (piso+ps+rto) = total bipado |
| Ciclos "Total TBRs Lidos" | 3683 | Mesmo que Dashboard (só `ride_tbrs`) |

A diferença (3843 - 3683 = 160) são os 160 insucessos que foram removidos da `ride_tbrs` pelo trigger automático.

### Correção: unificar para "total bipado" (incluindo retornos)

A lógica correta de "TBRs Lidos/Escaneados" deve ser a da Operação: **tudo que foi bipado**, incluindo os que depois viraram insucesso.

### Alterações

**1. `src/components/dashboard/DashboardMetrics.tsx`** — RPC `get_unit_tbr_count` conta só ride_tbrs. Criar nova RPC ou adicionar contagem de retornos ao valor existente. Somar retornos (piso+ps+rto únicos) ao `todayTbrCount` para refletir o total real bipado.

**2. `src/pages/dashboard/CiclosPage.tsx`** — `metrics.totalTbrs` usa só `tbrsData.length`. Alterar para `totalTbrs = tbrsData.length + totalReturns` (o total original bipado). Aplicar a mesma lógica nos TBRs por ciclo.

**3. Adicionar InfoButtons nos cards do Ciclos (modal Relatório):**
- Tempo Médio Carreg.: "Média de tempo entre início e finalização de todos os carregamentos do dia."
- Total TBRs Lidos: "Total de pacotes bipados na conferência, incluindo os que retornaram como insucesso."
- Total Carregamentos: "Número de carregamentos realizados no dia."
- Liberação Motorista: "Carregamentos finalizados (motorista liberado)."
- Taxa de Conclusão: "Percentual de TBRs entregues com sucesso em relação ao total bipado."
- Insucessos (Dia Anterior): "Quantidade de insucessos operacionais registrados no dia anterior."
- Frota: "Quantidade e tipo de veículos utilizados no dia."
- Carreg. Dia Anterior: "Variação percentual de carregamentos em relação ao dia anterior."

**4. Adicionar InfoButtons nos campos complementares da página Ciclos (fora do modal):**
- Qtd Pacotes (TBRs): "Total de pacotes bipados no dia (preenchido automaticamente)."
- VRID: "Quantidade informada pelo VRID (preenchimento manual)."

### Arquivos afetados
- `src/components/dashboard/DashboardMetrics.tsx` — somar retornos ao contador de TBRs
- `src/pages/dashboard/CiclosPage.tsx` — corrigir `totalTbrs` + adicionar InfoButtons
- Possivelmente nova migração SQL para atualizar a RPC (ou calcular no frontend)

