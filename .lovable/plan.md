

## Plano de Implementação — Cards, Indicadores e Insights em 5 Páginas

### 1. Insucessos (RetornoPisoPage.tsx)

**Filtros adicionais:**
- Filtro de data (início/fim) com Calendar popover para filtrar `piso_entries` por `created_at`
- Select de Conferente (carregado de `user_profiles` da unidade)
- Select de Motorista (extraído dos entries únicos)

**Cards indicadores (acima da tabela):**
- Total de Insucessos abertos
- Top Motivo (motivo mais frequente)
- Top Motorista ofensor (mais insucessos)
- Top Conferente (mais registros)

### 2. Motoristas Parceiros (MotoristasParceirosPage.tsx)

**Cards indicadores (acima dos filtros):**
- Total de Motoristas cadastrados
- Motoristas Ativos (com operação nos últimos 30 dias)
- Motoristas Inativos (sem operação nos últimos 30 dias)
- Estados distintos representados

### 3. PS - Problem Solve (PSPage.tsx)

**Cards indicadores (acima da tabela):**
- Total PS no período
- PS Abertos vs Finalizados
- Top Motivo PS
- % Seller (is_seller = true)

### 4. DNR (DNRPage.tsx)

**Cards indicadores (acima das tabs):**
- Total DNRs registrados
- Valor total DNR (R$)
- DNRs Abertos / Analisando / Finalizados
- Valor total com desconto aplicado

### 5. Ciclos (CiclosPage.tsx)

**Novo campo:** `qtd_pacotes_informado` (manual, entre Qtd Pacotes e Abertura Galpão)

**Relatório (modal):** Na seção "Informações Complementares", exibir:
- Qtd Pacotes (existente)
- Qtd Pacotes Informado (novo)
- Diferença (Informado - Pacotes), com cor verde se positivo, vermelho se negativo

**Migração SQL:** Adicionar coluna `qtd_pacotes_informado integer default 0` na tabela `cycle_records`.

---

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `RetornoPisoPage.tsx` | Filtros de data/conferente/motorista + 4 cards indicadores |
| `MotoristasParceirosPage.tsx` | 4 cards indicadores |
| `PSPage.tsx` | 4 cards indicadores |
| `DNRPage.tsx` | 4 cards indicadores |
| `CiclosPage.tsx` | Campo "Qtd Pacotes Informado" + exibição no relatório com diferença |
| **Migração SQL** | `ALTER TABLE cycle_records ADD COLUMN qtd_pacotes_informado integer DEFAULT 0` |

