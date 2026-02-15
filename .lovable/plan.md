
# Quatro Melhorias no Sistema FVL

## 1. Toast melhorado para TBR bloqueado na Conferencia

Quando um TBR ja saiu para rota e nao passou pelo Retorno Piso, a mensagem de bloqueio sera mais clara e informativa.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

- Alterar o texto do toast para: **"Este TBR encontra-se em viagem. Registre-o no Retorno Piso antes de escaneá-lo novamente no carregamento."**
- Titulo: **"TBR em viagem"**

---

## 2. Dashboard Visao Geral com metricas e graficos

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

Abaixo do campo de busca TBR, adicionar uma secao completa de metricas operacionais:

**Cards de resumo (grid 2x2 em mobile, 4 colunas em desktop):**
- Total de carregamentos do dia (contagem de `driver_rides` com `completed_at` de hoje)
- TBRs escaneados hoje (contagem de `ride_tbrs` com `scanned_at` de hoje)
- PS abertos (contagem de `ps_entries` com `status = 'open'` da unidade)
- RTO abertos (contagem de `rto_entries` com `status = 'open'` da unidade)
- Retornos Piso abertos (contagem de `piso_entries` com `status = 'open'`)
- Carregamentos em andamento (contagem de `driver_rides` com `loading_status = 'loading'`)

**Graficos (usando Recharts, ja instalado):**
- Grafico de barras: carregamentos por dia (ultimos 7 dias)
- Grafico de linha: TBRs escaneados por dia (ultimos 7 dias)
- Grafico de pizza/donut: distribuicao de status dos carregamentos (pending/loading/finished)

Todas as queries filtradas por `unit_id` da sessao atual.

---

## 3. Configuracao de valor por TBR

**Banco de dados:** Criar tabela `unit_settings` com colunas:
- `id` (uuid, PK)
- `unit_id` (uuid, NOT NULL)
- `tbr_value` (numeric, default 0)
- `created_at` / `updated_at` (timestamps)

Politicas RLS abertas (mesmo padrao do projeto).

**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`

Adicionar nova secao (Card) abaixo de "Logins e Senhas":
- Titulo: "Valor por TBR"
- Campo numerico com mascara de moeda (R$) para definir o valor que cada TBR entregue vale para o motorista
- Botao "Salvar" que faz upsert na tabela `unit_settings`
- Texto explicativo: "Valor pago por TBR entregue (exceto retornos piso)"

---

## 4. Modal de CEP no botao RTO do Retorno Piso

**Banco de dados:** Adicionar coluna `cep` (text, nullable) na tabela `rto_entries`.

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx`

Quando o usuario clicar no botao "RTO" na lista do Retorno Piso:
1. Abrir um modal pedindo o CEP do RTO
2. Campo de CEP com mascara (00000-000)
3. Botao "Incluir RTO" que:
   - Cria a entrada na tabela `rto_entries` com o CEP informado
   - Fecha o `piso_entries` correspondente (status = 'closed')
   - Remove da lista do Retorno Piso

A funcionalidade futura de comparar rota com CEP para sugerir envio de RTO durante carregamentos sera preparada com o campo `cep` armazenado, mas a logica de matching sera implementada em uma proxima etapa.

---

## Secao Tecnica

**Migracoes SQL necessarias:**

```text
-- Tabela unit_settings
CREATE TABLE public.unit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  tbr_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unit_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read unit_settings" ON public.unit_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unit_settings" ON public.unit_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update unit_settings" ON public.unit_settings FOR UPDATE USING (true);
-- Unique constraint para upsert
CREATE UNIQUE INDEX unit_settings_unit_id_idx ON public.unit_settings (unit_id);

-- Coluna CEP em rto_entries
ALTER TABLE public.rto_entries ADD COLUMN cep text;
```

**Arquivos modificados:**
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (texto do toast)
- `src/pages/dashboard/DashboardHome.tsx` (metricas, graficos, cards BI)
- `src/pages/dashboard/ConfiguracoesPage.tsx` (secao valor TBR)
- `src/pages/dashboard/RetornoPisoPage.tsx` (modal CEP no botao RTO)
- Migracoes SQL (nova tabela + nova coluna)
