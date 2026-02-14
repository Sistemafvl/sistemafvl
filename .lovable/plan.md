

# Reorganizar menu do Dashboard e sessao do gerente

## Resumo

Mover "Relatorios" e "Configuracoes" para dentro do menu exclusivo do gerente, adicionar "Cadastro de Motorista" e "Cadastro de Conferente", e fazer a sessao do gerente nao persistir ao atualizar a pagina.

## Alteracoes

### 1. Reorganizar itens do menu no sidebar

**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx`

- O menu principal (visivel para todos) tera apenas: **Conferencia Carregamento**
- Quando o gerente estiver logado, aparece uma segunda secao de menu "Gerente" com:
  - **Relatorios** (icone `BarChart3`)
  - **Configuracoes** (icone `Settings`)
  - **Cadastro de Motorista** (icone `Truck` ou similar)
  - **Cadastro de Conferente** (icone `ClipboardCheck` ou similar)

### 2. Sessao do gerente nao persiste ao recarregar

**Arquivo:** `src/stores/auth-store.ts`

Atualmente o `managerSession` e salvo no localStorage junto com o resto do estado. Vamos excluir o `managerSession` da persistencia usando a opcao `partialize` do zustand, para que ao atualizar a pagina o gerente precise logar novamente. Isso garante que:
- A sessao do dashboard (unidade) continua ativa em multiplos dispositivos
- A sessao do gerente fica apenas na memoria (some ao atualizar/fechar a pagina)
- Nao ha propagacao automatica entre dispositivos

### Detalhes tecnicos

- Usar `partialize` no middleware `persist` do zustand para excluir `managerSession` do armazenamento
- Separar `menuItems` em dois arrays: itens gerais e itens exclusivos do gerente
- Condicionar renderizacao dos itens do gerente com `managerSession !== null`
- Nenhuma migracao de banco necessaria
- Layout existente sera mantido integralmente

