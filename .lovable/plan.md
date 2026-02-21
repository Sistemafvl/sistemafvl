
# Plano de Melhorias - 10 Itens

## 1. DNR - Mostrar "Com Desconto" ou "Sem Desconto" no card finalizado (Anexo 1)
**Arquivo:** `src/pages/dashboard/DNRPage.tsx`
- Na interface `DnrEntry`, adicionar campo `discounted: boolean`
- No `statusBadge()`, quando status === "closed", verificar o campo `discounted`:
  - Se `discounted === true`: Badge vermelho "Finalizado c/ Desconto"
  - Se `discounted === false`: Badge verde "Finalizado s/ Desconto"

## 2. Relatório Resumo Geral - Chave PIX abaixo do nome do motorista (Anexo 2)
**Arquivos:** `src/pages/dashboard/RelatoriosPage.tsx`, `src/pages/dashboard/reports/PayrollReportContent.tsx`
- No `fetchPayroll`, buscar dados bancarios (pix_key, pix_key_type) dos motoristas via edge function `get-driver-details` ou diretamente da tabela `drivers` (usando service role via edge function)
- Adicionar campo `pixKey` e `pixKeyType` na interface `DriverPayrollData.driver`
- No `PayrollReportContent`, na tabela resumo geral, a celula "Motorista" exibira o nome na primeira linha e a chave PIX formatada na segunda linha (fonte menor, cor cinza), ambos na mesma celula

## 3. Configuracoes - Valores diferenciados por motorista (Anexo 3)
**Arquivos:** Migration SQL, `src/pages/dashboard/ConfiguracoesPage.tsx`

### 3.1 Migration - Nova tabela `driver_custom_values`
```
CREATE TABLE public.driver_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  custom_tbr_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unit_id, driver_id)
);
ALTER TABLE public.driver_custom_values ENABLE ROW LEVEL SECURITY;
-- Policies: Anyone can read/insert/update/delete
```

### 3.2 UI em ConfiguracoesPage
- Abaixo de "Valor por TBR", novo card "Valores Diferenciados"
- Campo de busca para selecionar motorista (por nome/CPF) dentre os que ja passaram pela unidade
- Ao selecionar, campo para definir o valor customizado por TBR
- Lista dos motoristas com valor customizado, com opcao de remover
- Na geracao do relatorio, usar `custom_tbr_value` em vez de `tbrValue` padrao quando existir

## 4. Configuracoes - Adicionais por motorista (Anexo 3 continuacao)
**Arquivos:** Migration SQL, `src/pages/dashboard/ConfiguracoesPage.tsx`, `RelatoriosPage.tsx`, `PayrollReportContent.tsx`

### 4.1 Migration - Nova tabela `driver_bonus`
```
CREATE TABLE public.driver_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  driver_name text,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_bonus ENABLE ROW LEVEL SECURITY;
-- Policies: Anyone can read/insert/update/delete
```

### 4.2 UI em ConfiguracoesPage
- Novo card "Adicionais" abaixo do anterior
- Selecao de motorista, valor do adicional, descricao e periodo
- Lista de adicionais cadastrados com opcao de remover

### 4.3 Integracao com Relatorio
- No `fetchPayroll`, buscar bonus do periodo para cada motorista
- Somar ao `totalValue` do motorista
- Exibir metricBox "Adicional" no relatorio individual
- Coluna "Adicional" na tabela resumo geral

## 5. Alerta sonoro para o motorista (Anexo 4 - ainda nao toca)
**Arquivo:** `src/pages/driver/DriverQueue.tsx`
- O problema persiste porque o `AudioContext` requer interacao previa do usuario
- Solucao: criar um `AudioContext` global que e inicializado no primeiro toque/clique do usuario na pagina
- Adicionar um event listener `click` no `document` que faz `audioCtx.resume()` uma vez
- Usar `setInterval` com `oscillator` para o beep continuo
- Adicionar fallback com `Audio()` e um data URI WAV real (o atual e invalido/truncado)
- Gerar um WAV PCM valido em base64 programaticamente

## 6. Exclusao de TBR - Corrigir definitivamente (Anexo 5 e 6)
**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- O problema e que o Realtime listener na linha 393 escuta TODOS os eventos de `ride_tbrs` sem filtro de `ride_id`
- Quando o DELETE propaga, o Realtime dispara `fetchRides()` que re-busca tudo incluindo cache stale
- Solucao:
  1. Manter uma lista de IDs deletados em `deletingRef` e nao remove-los do set ate o fetchRides pos-delay
  2. No `fetchRides`, filtrar os TBRs que estao no `deletingRef` antes de setar o estado
  3. Aumentar o delay para 3000ms
  4. Adicionar filtro no listener Realtime para ignorar eventos DELETE (somente reagir a INSERT/UPDATE)
- Tambem: ao excluir TBR, reabrir a entrada no retorno piso (ja implementado, manter)

## 7. Retorno Piso - Somente gerente pode excluir TBRs
**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx`
- Adicionar botao "Excluir" (icone lixeira) na coluna Acoes, visivel somente quando `managerSession` existe
- Ao clicar, excluir o registro de `piso_entries` (DELETE)
- Confirmar com dialog simples antes de excluir

## 8. PS - 30 registros por pagina (Anexo 7)
**Arquivo:** `src/pages/dashboard/PSPage.tsx`
- Implementar paginacao com 30 itens por pagina
- Adicionar estado `page` e botoes "Anterior" / "Proxima"
- Usar `.range()` na query ou fatiar o array localmente
- Exibir contagem "Pagina X de Y"

## 9. RTO - 30 registros por pagina (Anexo 8)
**Arquivo:** `src/pages/dashboard/RTOPage.tsx`
- Mesma implementacao de paginacao do PS
- 30 itens por pagina com navegacao

## 10. Motoristas Parceiros - Visao global com filtros (Anexo 9)
**Arquivo:** `src/pages/dashboard/MotoristasParceirosPage.tsx`
- Mudar de "motoristas que passaram pela unidade" para TODOS os motoristas cadastrados globalmente
- Buscar de `drivers_public` sem filtro por unit_id
- 50 registros por pagina com paginacao
- Adicionar filtros acima da busca: Estado, Cidade, Bairro, CEP
- Para cada motorista, buscar a data do ultimo carregamento (`driver_rides` ordenado por `completed_at DESC LIMIT 1`)
- Adicionar coluna "Ultima Operacao" com a data do ultimo carregamento

## 11. Corridas do motorista - Trocar "Tempo" por "Qtd TBRs" (Anexo 10)
**Arquivo:** `src/pages/driver/DriverRides.tsx`
- No mini-card roxo (4o card), trocar:
  - Icone: de `Timer` para `ScanBarcode` (ou `Package`)
  - Label: de "Tempo" para "TBRs"
  - Valor: de `tempo` (duracao) para `ride.tbrCount` (quantidade de TBRs)

---

## Resumo de Arquivos e Migrations

| Arquivo | Alteracao |
|---|---|
| Migration SQL | Criar tabelas `driver_custom_values` e `driver_bonus` |
| `DNRPage.tsx` | Badge com/sem desconto nos finalizados |
| `RelatoriosPage.tsx` | Buscar PIX, custom values e bonus |
| `PayrollReportContent.tsx` | PIX na celula do nome, colunas DNR/Adicional |
| `ConfiguracoesPage.tsx` | Cards de valores diferenciados e adicionais |
| `DriverQueue.tsx` | Fix audio com AudioContext global e WAV valido |
| `ConferenciaCarregamentoPage.tsx` | Fix definitivo exclusao TBR |
| `RetornoPisoPage.tsx` | Botao excluir so para gerente |
| `PSPage.tsx` | Paginacao 30/pagina |
| `RTOPage.tsx` | Paginacao 30/pagina |
| `MotoristasParceirosPage.tsx` | Visao global + filtros + ultima operacao + paginacao 50 |
| `DriverRides.tsx` | Trocar Tempo por Qtd TBRs |
