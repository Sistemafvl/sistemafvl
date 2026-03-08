

## Plano: Unificar contagem de TBRs (contar cada TBR apenas 1 vez)

### Problema

Os números divergem entre as telas porque usam lógicas diferentes:

| Tela | Valor | Como calcula |
|------|-------|-------------|
| Dashboard | 3867 | RPC (ride_tbrs ativos) + retornos por **data** (created_at) |
| Operação | 3843 | ride_tbrs ativos + retornos por **ride_id** |
| Ciclos | 3843 | ride_tbrs + retornos por ride_id |

A diferença (3867 vs 3843) ocorre porque o Dashboard conta retornos por data, podendo pegar retornos de corridas de outros dias. A Operação conta por ride_id, que é o correto.

### Regra correta

Um TBR escaneado = 1 contagem. Se virou insucesso (removido da ride_tbrs pelo trigger), o total original bipado = ride_tbrs atuais + retornos únicos daquelas mesmas corridas.

### Alterações

**1. Atualizar RPC `get_unit_tbr_count`** para já incluir os retornos vinculados às mesmas corridas do período. Assim a contagem fica precisa e centralizada no banco:
- Conta `ride_tbrs` das corridas do período
- Soma códigos únicos de `piso_entries` + `ps_entries` + `rto_entries` das mesmas corridas (que não estejam mais na ride_tbrs)

**2. `src/components/dashboard/DashboardMetrics.tsx`** — remover as 3 queries extras de retornos (linhas 65-71) que foram adicionadas incorretamente. Voltar a usar apenas o resultado da RPC.

**3. Textos dos InfoButtons** — atualizar a descrição de "TBRs escaneados" para refletir a lógica correta: "Total de pacotes originalmente bipados na conferência. Cada TBR é contado apenas uma vez, mesmo que tenha retornado como insucesso."

### Arquivos afetados
- Nova migração SQL (atualizar RPC `get_unit_tbr_count`)
- `src/components/dashboard/DashboardMetrics.tsx` — remover soma manual de retornos
- Textos informativos atualizados

