

## Plano - Nova pagina "Ciclos"

### 1. Rota e Menu

**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx`
- Adicionar item `{ title: "Ciclos", url: "/dashboard/ciclos", icon: RefreshCw }` no array `managerMenuItems`, logo apos "Operacao" (posicao index 1)

**Arquivo:** `src/App.tsx`
- Importar `CiclosPage` de `src/pages/dashboard/CiclosPage.tsx`
- Adicionar rota `<Route path="ciclos" element={<CiclosPage />} />`

### 2. Tabela no banco de dados

Criar tabela `cycle_records` para armazenar os campos manuais preenchidos pelo gerente:

```sql
CREATE TABLE public.cycle_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  qtd_pacotes integer DEFAULT 0,
  abertura_galpao time DEFAULT NULL,
  hora_inicio_descarregamento time DEFAULT NULL,
  hora_termino_descarregamento time DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, record_date)
);

ALTER TABLE public.cycle_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cycle_records" ON public.cycle_records FOR SELECT USING (true);
CREATE POLICY "Anyone can insert cycle_records" ON public.cycle_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update cycle_records" ON public.cycle_records FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete cycle_records" ON public.cycle_records FOR DELETE USING (true);
```

### 3. Nova pagina CiclosPage

**Arquivo:** `src/pages/dashboard/CiclosPage.tsx`

**Layout principal:**
- Titulo "Ciclos" com icone RefreshCw
- Botao "Relatorio" no topo direito que abre o modal de resumo
- Filtro de data (igual ao padrao do projeto com Popover + Calendar)

**Campos manuais (formulario editavel):**
- Qtd de pacotes (Input numerico)
- Abertura Galpao (Input tipo time - HH:mm)
- Hora Inicio Descarregamento (Input tipo time)
- Hora Termino Descarregamento (Input tipo time)
- Botao "Salvar" que faz upsert na tabela `cycle_records` com base em `unit_id + record_date`

**Ciclos automaticos:**
- Ciclo 1: conta carregamentos da tabela `driver_rides` com `completed_at` ate as 08:30 (11:30 UTC) do dia selecionado
- Ciclo 2: conta carregamentos ate as 09:30 (12:30 UTC), somando com ciclo 1 (acumulado)
- Ciclo 3: conta todos os carregamentos do dia (sem hora limite), acumulado total

A contagem usa a mesma logica da OperacaoPage: filtra `driver_rides` por `unit_id` e range do dia em horario de Brasilia (UTC-3).

**Exibicao dos ciclos:**
- 3 cards lado a lado: Ciclo 1, Ciclo 2, Ciclo 3
- Cada card mostra: quantidade de carregamentos do ciclo, horario limite, e o acumulado

### 4. Modal de Relatorio

Ao clicar em "Relatorio", abre-se um Dialog com:

**Cabecalho:** "Resumo Operacao [dd/MM/yyyy]"

**Indicadores BI (cards em grid):**
- Tempo medio de carregamento (media de `finished_at - started_at` das rides do dia)
- Total TBRs lidos (soma de ride_tbrs do dia)
- Total carregamentos
- Liberacao motorista (quantidade de rides com status "finished")
- Taxa de conclusao (TBRs - retornos / TBRs)
- Total retornos (piso + ps + rto por TBR unico)
- Comparacao com dia anterior: diferenca percentual em carregamentos e TBRs (seta verde/vermelha)
- Tempo medio por TBR (tempo total / total TBRs)

**Dados manuais do dia:**
- Qtd pacotes, abertura galpao, inicio/termino descarregamento

**Ciclos:**
- Resumo dos 3 ciclos com valores

**Botao "Gerar PDF":**
- Usa jsPDF + html2canvas (mesmo padrao do projeto)
- Layout horizontal A4 (landscape)
- Renderiza o conteudo do modal em um container off-screen e captura com html2canvas
- Usa os mesmos estilos de `pdf-styles.ts` (COLORS, headerCellStyle, etc.)
- Nome do arquivo: `Resumo_Operacao_[data].pdf`

### Resumo dos arquivos

| Arquivo | Acao |
|---|---|
| `src/components/dashboard/DashboardSidebar.tsx` | Adicionar item "Ciclos" no menu gerente |
| `src/App.tsx` | Adicionar rota /dashboard/ciclos |
| `src/pages/dashboard/CiclosPage.tsx` | **Novo** - pagina completa com campos manuais, ciclos automaticos, modal relatorio e PDF |
| Migration SQL | Criar tabela `cycle_records` |

### Detalhes tecnicos dos ciclos

```text
Dia selecionado: 2026-02-21
Horario Brasilia (UTC-3):

Ciclo 1: completed_at <= "2026-02-21T11:30:00.000Z" (08:30 BRT)
  -> Conta: 10 carregamentos

Ciclo 2: completed_at <= "2026-02-21T12:30:00.000Z" (09:30 BRT)
  -> Conta: 19 (acumulado, inclui ciclo 1)

Ciclo 3: completed_at <= fim do dia
  -> Conta: 25 (acumulado total)
```

### Comparacao com dia anterior

Para os indicadores do modal, buscar dados do dia anterior (D-1) e calcular:
- Delta carregamentos: `((hoje - ontem) / ontem * 100)` com seta verde (positivo) ou vermelha (negativo)
- Delta TBRs: mesma logica
- Exibir como badge ao lado do valor principal

