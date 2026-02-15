
# Plano de Implementacao

Este plano cobre 4 itens solicitados:

---

## 1. Melhorar o modal de Rastreamento TBR (Visao Geral)

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

Adicionar ao modal de rastreamento informacoes extras do motorista e do veiculo:
- Buscar tambem `car_model`, `car_plate`, `car_color` da tabela `drivers`
- Exibir no grid: Carro (modelo + cor), Placa
- Verificar se o TBR possui entrada ativa em `ps_entries` ou `rto_entries` e exibir badges indicando "PS Aberto" ou "RTO Aberto" com a descricao do problema

Atualizar a interface `TbrResult` para incluir `car_model`, `car_plate`, `car_color`, `ps_status`, `rto_status`.

---

## 2. Nova pagina: Retorno Piso (menu principal)

### 2.1 Banco de dados
Criar tabela `piso_entries` com colunas:
- `id` (uuid, PK)
- `tbr_code` (text, NOT NULL)
- `ride_id` (uuid)
- `unit_id` (uuid, NOT NULL)
- `driver_name` (text)
- `route` (text)
- `reason` (text, NOT NULL) -- motivo do insucesso
- `conferente_id` (uuid)
- `status` (text, default 'open')
- `created_at` (timestamptz, default now())
- `closed_at` (timestamptz)

Criar tabela `piso_reasons` para motivos personalizados:
- `id` (uuid, PK)
- `unit_id` (uuid, NOT NULL)
- `label` (text, NOT NULL)
- `created_at` (timestamptz, default now())

Ambas com RLS permissiva (mesmo padrao das outras tabelas).

### 2.2 Menu
**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx`

Adicionar "Retorno Piso" ao array `menuItems` com icone `PackageX` (ou similar do Lucide).

### 2.3 Rota
**Arquivo:** `src/App.tsx`

Adicionar rota `/dashboard/retorno-piso` com componente `RetornoPisoPage`.

### 2.4 Pagina
**Novo arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx`

Funcionalidade:
- Campo de leitura de TBR (acionado por Enter, max 15 chars)
- Ao ler, abre modal com:
  - Informacoes de rastreio (motorista, rota, carro, conferente, status, etc.)
  - Select com motivos pre-definidos: "1a tentativa de entrega", "2a tentativa de entrega", "3a tentativa de entrega", "Endereco nao localizado"
  - Motivos customizados cadastrados pela unidade (tabela `piso_reasons`)
  - Botao "+ Ocorrencia" para cadastrar novo motivo na hora (adiciona na `piso_reasons` e ja seleciona)
  - Botao "Gravar" para salvar na `piso_entries`
- Lista de TBRs no piso (status open), cada linha com:
  - Codigo TBR, Motorista, Rota, Motivo, Data
  - Botoes de acao: "PS" (migra para ps_entries) e "RTO" (migra para rto_entries)
  - Ao clicar PS/RTO, cria entrada na tabela correspondente e finaliza a entrada do piso

---

## 3. Nova pagina: Operacao (menu gerente)

### 3.1 Menu
**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx`

Adicionar "Operacao" ao array `managerMenuItems` com icone `Activity`.

### 3.2 Rota
**Arquivo:** `src/App.tsx`

Adicionar rota `/dashboard/operacao` com componente `OperacaoPage`.

### 3.3 Pagina
**Novo arquivo:** `src/pages/dashboard/OperacaoPage.tsx`

Funcionalidade:
- Filtro de data (seletor de dia)
- Campo de busca TBR (Enter, max 15 chars)
- Lista de cards de motoristas do dia filtrado:
  - Avatar, nome, carro (modelo/placa/cor)
  - Rota, login, conferente
  - Total de TBRs carregados
  - TBRs que retornaram ao piso (consulta `piso_entries` por ride_id)
  - Indicador: "49/50 concluidos" (total - retornos)
  - Status do carregamento e tempo
- Indicadores gerais no topo:
  - Total de carregamentos do dia
  - Total de TBRs lidos
  - Total de retornos ao piso
  - Taxa de conclusao (%)

---

## 4. Corrigir erro no Perimetro/Geofencing

**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`

O erro ocorre ao chamar a edge function `geocode-address`. A funcao em si parece correta, mas o tratamento de resposta no frontend pode falhar silenciosamente. Melhorias:
- Adicionar `try/catch` mais robusto com mensagem de erro visivel (toast ou alert inline)
- Tratar caso de resposta nula ou erro de rede com feedback ao usuario
- Verificar se `res.data` contem `error` e exibir mensagem adequada

---

## Resumo de Arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `src/pages/dashboard/DashboardHome.tsx` |
| Editar | `src/components/dashboard/DashboardSidebar.tsx` |
| Editar | `src/App.tsx` |
| Editar | `src/pages/dashboard/ConfiguracoesPage.tsx` |
| Criar | `src/pages/dashboard/RetornoPisoPage.tsx` |
| Criar | `src/pages/dashboard/OperacaoPage.tsx` |
| Migracao | Tabelas `piso_entries` e `piso_reasons` |
