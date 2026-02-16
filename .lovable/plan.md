

# Painel do Motorista -- Melhorias Completas

## 1. Metricas nos Cards de Corridas

Em cada card de corrida na pagina `/motorista/corridas`, adicionar 4 mini-cards de metricas abaixo das informacoes existentes, identicos aos da pagina Operacao:

- **Total Ganho** (R$) -- concluidos x valor TBR da unidade
- **Media/TBR** (R$) -- total ganho / total TBRs
- **Performance** (%) -- (concluidos / total TBRs) x 100
- **Tempo** -- diferenca entre started_at e finished_at

Para calcular, sera necessario buscar:
- `ride_tbrs` para contar TBRs por corrida
- `piso_entries` + `ps_entries` + `rto_entries` para contar retornos por corrida
- `unit_settings.tbr_value` para valor do TBR
- `started_at` e `finished_at` de `driver_rides`

**Arquivo:** `src/pages/driver/DriverRides.tsx`

---

## 2. Visao Geral com BI e Insights (DriverHome)

Transformar a pagina `/motorista` em um dashboard completo com filtro de datas e visualizacoes:

### Filtro de periodo
- Seletor de data inicial e final (padrao: ultimos 30 dias)

### Cards de resumo (grid 2x3)
- Total de Corridas
- Total de TBRs
- Total Ganho (R$)
- Taxa de Conclusao (%)
- Media TBRs/Dia
- Total de Retornos

### Graficos (Recharts)
- **Linha**: Corridas por dia no periodo
- **Barras**: TBRs por dia
- **Pizza**: Distribuicao de retornos (Piso vs PS vs RTO)
- **Barras horizontais**: Top 5 unidades por numero de corridas

### Insights inteligentes
- Melhor dia da semana (mais corridas)
- Media de ganho por dia trabalhado
- Taxa de retorno geral
- Unidade mais frequente

**Arquivo:** `src/pages/driver/DriverHome.tsx`

---

## 3. Remover "Indicadores" do menu

Remover o item "Indicadores" do sidebar do motorista e a rota correspondente.

**Arquivos:**
- `src/components/dashboard/DriverSidebar.tsx` -- remover item do array
- `src/App.tsx` -- remover rota `/motorista/indicadores` e import do DriverStats

---

## 4. Avaliar Unidades (com estrelas e comentarios)

### Nova tabela: `unit_reviews`
```sql
CREATE TABLE unit_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id),
  unit_id uuid NOT NULL REFERENCES units(id),
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);
```
- RLS: motoristas podem inserir/ler suas proprias avaliacoes; gerentes podem ler avaliacoes da sua unidade

### Pagina `/motorista/avaliacoes`
- Listar todas as unidades onde o motorista tem pelo menos 1 corrida (via `driver_rides`)
- Para cada unidade: nome, total de corridas, avaliacao atual (se existir) ou botao "Avaliar"
- Modal de avaliacao: 5 estrelas clicaveis + campo de comentario + botao Enviar
- Permitir editar avaliacao existente

**Arquivo:** `src/pages/driver/DriverReviews.tsx`

---

## 5. Feedbacks no menu do Gerente

### Nova pagina: `/dashboard/feedbacks`
- Listar todas as avaliacoes (`unit_reviews`) da unidade do gerente
- Exibir: nome do motorista, estrelas, comentario, data
- Card de resumo: media geral, total de avaliacoes, distribuicao por estrelas
- Filtro por periodo

### Menu do gerente
- Adicionar item "Feedbacks" com icone `MessageSquare` no array `managerMenuItems`

**Arquivos:**
- `src/pages/dashboard/FeedbacksPage.tsx` (novo)
- `src/components/dashboard/DashboardSidebar.tsx` -- adicionar item
- `src/App.tsx` -- adicionar rota

---

## 6. Configuracoes do Motorista

Pagina `/motorista/configuracoes` com opcoes basicas:

- **Tema**: Toggle claro/escuro (usando next-themes, ja instalado)
- **Notificacoes**: Toggle para receber notificacoes da fila (salvo em localStorage)
- **Idioma**: Selector PT-BR (fixo por enquanto, preparado para expansao)
- **Sobre o sistema**: Versao, contato, link de suporte

**Arquivo:** `src/pages/driver/DriverSettings.tsx`

---

## Resumo tecnico de alteracoes

| Arquivo | Acao |
|---|---|
| `src/pages/driver/DriverRides.tsx` | Adicionar mini-cards de metricas por corrida |
| `src/pages/driver/DriverHome.tsx` | Reescrever com BI completo, graficos e filtros |
| `src/pages/driver/DriverReviews.tsx` | Sistema de avaliacao com estrelas |
| `src/pages/driver/DriverSettings.tsx` | Configuracoes basicas do sistema |
| `src/pages/dashboard/FeedbacksPage.tsx` | Nova pagina de feedbacks para gerente |
| `src/components/dashboard/DriverSidebar.tsx` | Remover Indicadores |
| `src/components/dashboard/DashboardSidebar.tsx` | Adicionar Feedbacks ao menu gerente |
| `src/App.tsx` | Remover rota indicadores, adicionar rota feedbacks |
| **Migracao SQL** | Criar tabela `unit_reviews` com RLS |

