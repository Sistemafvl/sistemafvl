

# Plano de Correcoes e Novas Funcionalidades - 4 Itens Principais

## 1. Fix definitivo da exclusao de TBR (Anexo 1 e 6) - URGENTE

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**Problema raiz:** Apos clicar no X para excluir um TBR, o mesmo reaparece na lista. Isso acontece porque:
1. O listener Realtime de `driver_rides` usa `event: "*"` (incluindo UPDATE) - quando o sistema cria/atualiza a `piso_entry` apos exclusao, isso pode disparar uma cascata que chama `fetchRides()` 
2. O `skipRealtimeRef` e resetado no timeout de 3s, mas as operacoes de piso/rto podem demorar e disparar eventos antes
3. O `fetchRides()` re-busca tudo do banco, e o DELETE pode ainda nao ter propagado

**Solucao:**
- Na funcao `handleDeleteTbr`: aguardar TODAS as operacoes (delete do TBR, criar piso, reopen RTO) ANTES de reativar o Realtime
- Usar `await` sequencial para garantir que tudo esta gravado
- Remover o `setTimeout` de 3000ms - em vez disso, fazer `fetchRides()` diretamente apos todas as operacoes assincronas completarem
- So entao limpar `deletingRef` e reativar `skipRealtimeRef`
- No `fetchRides`, manter o filtro de `deletingRef` como seguranca extra

**Logica revisada:**
```
handleDeleteTbr:
  1. Add to deletingRef, skip realtime
  2. Optimistic UI removal
  3. await DELETE from ride_tbrs
  4. await create/reopen piso_entry
  5. await reopen RTO if exists
  6. await fetchOpenRtos()
  7. await fetchRides()  // re-fetch com filtro deletingRef
  8. deletingRef.delete(tbrId)
  9. skipRealtimeRef = false
```

## 2. Remover botao RTO do Retorno Piso (Anexo 2)

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx`

- Remover o botao "RTO" da coluna Acoes na tabela de entries (linhas 330-332)
- Remover o modal de CEP para RTO (linhas 439-473) e todos os estados relacionados (`rtoModalOpen`, `rtoEntry`, `rtoCep`, `rtoSaving`)
- Remover a funcao `handleOpenRtoModal`, `handleCepChange`, `handleConfirmRto`
- Manter apenas o botao "PS" e o botao "Excluir" (gerente)

## 3. RTO como novo TBR de carregamento (Anexo 3)

**Arquivo:** `src/pages/dashboard/RTOPage.tsx`

A logica atual do RTO busca um TBR existente em `ride_tbrs` e vincula a um carregamento anterior. O usuario quer que ao escanear/digitar um TBR na pagina RTO, ele seja tratado como um NOVO TBR para devolucao a vendedores.

**Mudancas:**
- Ao escanear/digitar um TBR na pagina RTO, nao precisa buscar historico obrigatoriamente
- Abrir o formulario de inclusao diretamente (campo conferente, CEP, descricao)
- Gravar na `rto_entries` normalmente (sem exigir `ride_id` - pode ser null)
- Esse TBR deve ser rastreavel na Visao Geral como qualquer outro TBR com status RTO
- Remover o step intermediario de "Historico" que obriga existir um ride vinculado
- O campo de input deve funcionar com Enter (como o Retorno Piso)

**Fluxo novo:**
```
1. Digita/escaneia TBR -> Enter
2. Abre modal com campos: Conferente, CEP, Descricao
3. Opcionalmente busca historico se existir em ride_tbrs (informativo)
4. Ao gravar, insere em rto_entries (ride_id pode ser null)
5. Na Visao Geral, busca continua funcionando normalmente
```

## 4. Relatorios: Consulta + Gerar PDF + Financeiro + Recebiveis (Anexo 4)

Essa e uma funcionalidade grande que envolve multiplos arquivos e uma nova tabela. Sera dividida em sub-itens:

### 4.1 Botoes Consulta e Gerar PDF no card Folha de Pagamento

**Arquivo:** `src/pages/dashboard/RelatoriosPage.tsx`

- No card "Folha de Pagamento", substituir o botao unico por dois botoes lado a lado:
  - **Consultar**: busca os dados e renderiza o relatorio na tela (em um modal ou pagina inline) para visualizacao sem gerar PDF
  - **Gerar PDF**: mantém o comportamento atual (busca dados + gera PDF + salva registro no banco)

### 4.2 Nova tabela `payroll_reports` (Migration)

```sql
CREATE TABLE public.payroll_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  generated_by text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  report_data jsonb NOT NULL, -- dados completos dos motoristas
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payroll_reports ENABLE ROW LEVEL SECURITY;
-- RLS: Anyone can CRUD
```

### 4.3 Nova tabela `driver_invoices` (Migration)

```sql
CREATE TABLE public.driver_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_report_id uuid NOT NULL REFERENCES payroll_reports(id),
  driver_id uuid NOT NULL,
  unit_id uuid NOT NULL,
  file_url text, -- URL do upload da NF
  file_name text,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_invoices ENABLE ROW LEVEL SECURITY;
-- RLS: Anyone can CRUD
```

### 4.4 Menu Financeiro (Gerente)

**Arquivos:** 
- `src/components/dashboard/DashboardSidebar.tsx` - Adicionar "Financeiro" ao `managerMenuItems` com icone `DollarSign`
- `src/App.tsx` - Adicionar rota `/dashboard/financeiro`
- `src/pages/dashboard/FinanceiroPage.tsx` (NOVO)

**Funcionalidade:**
- Ao clicar em "Gerar PDF" na Folha de Pagamento, alem de gerar o PDF, salva um registro em `payroll_reports` com os dados completos em JSON
- Na pagina Financeiro, lista todos os relatorios gerados como cards com periodo e data de geracao
- Ao clicar em um card, abre uma visao detalhada com cards individuais por motorista contendo:
  - Nome, valores, corridas, TBRs, retornos, DNR, bonus
  - Indicador de NF: tick verde se o motorista ja fez upload, ou pendente
  - Botao para baixar a NF anexada

### 4.5 Menu Recebiveis (Motorista)

**Arquivos:**
- `src/components/dashboard/DriverSidebar.tsx` - Adicionar "Recebiveis" com icone `DollarSign`
- `src/App.tsx` - Adicionar rota `/motorista/recebiveis`
- `src/pages/driver/DriverRecebiveis.tsx` (NOVO)

**Funcionalidade:**
- Lista cards com resumo de cada relatorio de pagamento gerado que inclui o motorista
- Cada card mostra: periodo, valores, corridas, TBRs, retornos, DNR, bonus
- Botao de upload para anexar NF de Servico
- Ao fazer upload, salva em storage `driver-documents` e atualiza `driver_invoices`
- O upload fica visivel para o gerente na pagina Financeiro

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Fix definitivo exclusao TBR - await all ops before re-fetch |
| `RetornoPisoPage.tsx` | Remover botao RTO e modal CEP |
| `RTOPage.tsx` | Novo fluxo: TBR como entrada direta sem exigir ride vinculado |
| `RelatoriosPage.tsx` | Split em Consultar + Gerar PDF, salvar em payroll_reports |
| `DashboardSidebar.tsx` | Adicionar menu Financeiro |
| `DriverSidebar.tsx` | Adicionar menu Recebiveis |
| `App.tsx` | Novas rotas /dashboard/financeiro e /motorista/recebiveis |
| `FinanceiroPage.tsx` (NOVO) | Pagina com cards de relatorios e detalhe por motorista |
| `DriverRecebiveis.tsx` (NOVO) | Pagina com recebiveis e upload de NF |
| Migration SQL | Tabelas payroll_reports e driver_invoices |

