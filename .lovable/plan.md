

# Cadastro de Conferentes - Pagina Completa

## Resumo

Transformar o "Cadastro de Conferente" de um modal simples para uma pagina completa com lista, cadastro e acoes de gerenciamento.

## Alteracoes

### 1. Nova rota e pagina

- Criar `/dashboard/conferentes` com a pagina `src/pages/dashboard/ConferentesPage.tsx`
- Adicionar rota no `App.tsx` dentro do layout do dashboard
- Alterar o sidebar: "Cadastro de Conferente" passa a ser um link de navegacao (como "Motoristas Parceiros") em vez de abrir um modal

### 2. Pagina ConferentesPage

Layout semelhante ao `MotoristasParceirosPage`:

- **Cabecalho**: Titulo "Conferentes" com icone e botao "+" para abrir modal de cadastro
- **Tabela**: Colunas Nome, CPF, Status (Ativo/Inativo), Acoes
- **Busca**: Campo de pesquisa por nome ou CPF
- **Dados**: Carrega `user_profiles` filtrados pelo `unit_id` da sessao atual

### 3. Acoes por conferente

- **Olho (Eye)**: Modal com dados completos do conferente (nome, CPF, unidade, data de cadastro)
- **Ativar/Inativar (Switch)**: Toggle do campo `active` na tabela `user_profiles`
- **Transferencia de unidade (ArrowRightLeft)**: Modal com select de unidades para transferir o conferente, atualizando o `unit_id`

### 4. Modal de cadastro (botao +)

Reaproveita a logica do `ConferenteRegistrationModal` existente:
- Campos: Nome completo e CPF
- Ao salvar, adiciona na lista e fecha o modal

### 5. Limpeza

- Remover o import e uso do `ConferenteRegistrationModal` no `DashboardSidebar` (o modal de cadastro sera usado internamente na nova pagina)
- O arquivo `ConferenteRegistrationModal.tsx` pode ser mantido e reutilizado dentro da pagina, ou o modal pode ser inline na pagina

## Detalhes tecnicos

- A tabela `user_profiles` ja possui os campos necessarios: `name`, `cpf`, `unit_id`, `active`
- Para a transferencia de unidade, sera feito um `UPDATE` no `unit_id` do conferente
- Para carregar as unidades no modal de transferencia, buscar todas as unidades ativas da tabela `units`
- A busca de conferentes filtra por `unit_id` igual ao `unitSession.id` do auth store
- Nenhuma alteracao de banco de dados e necessaria

