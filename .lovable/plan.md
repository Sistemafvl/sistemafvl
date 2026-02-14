

# Adicionar acoes nos gerenciadores (Admin) e botao de login gerente (Dashboard)

## Parte 1 — Icones de acao na lista de gerenciadores (ManagersPage)

**Arquivo:** `src/pages/admin/ManagersPage.tsx`

Adicionar 3 icones em cada linha de gerenciador, ao lado do Switch e do botao de excluir:

1. **Olho (`Eye`)** — Abre um modal (Dialog) exibindo todas as informacoes do gerenciador:
   - Nome
   - CNPJ (formatado)
   - Senha (visivel)
   - Status (ativo/inativo)
   - Data de criacao
   - ID da unidade

2. **Lapis (`Pencil`)** — Abre um modal de edicao com campos editaveis:
   - Nome
   - CNPJ
   - Senha
   - Botao "Salvar" que faz update no banco

3. **Icone de gerente (`UserCog`)** — Abre um modal para configurar login e senha exclusivos do gerente. Esses campos sao o proprio CNPJ + senha que o gerente ja possui na tabela `managers`. O modal permite visualizar e alterar essas credenciais de acesso que o gerente usara no botao do Dashboard.

### Modais a criar (dentro do mesmo arquivo ou como componentes separados):

- **Modal Visualizar**: Dialog read-only com todos os campos
- **Modal Editar**: Dialog com formulario para editar nome, CNPJ, senha
- **Modal Credenciais Gerente**: Dialog focado em mostrar/editar login (CNPJ) e senha de acesso

## Parte 2 — Botao de login do gerente no Dashboard

**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx`

Adicionar um botao logo abaixo do logo (onde o usuario sinalizou com o retangulo vermelho no Anexo 2). O botao tera um icone de gerente (`UserCog`) e texto "Gerente".

Ao clicar, abre um modal de login com:
- Campo CNPJ (com mascara)
- Campo Senha
- Botao "Entrar"

A autenticacao verifica na tabela `managers` se existe um gerenciador ativo com aquele CNPJ na unidade atual (obtida do `unitSession`) e se a senha confere. Em caso de sucesso, pode-se armazenar no `auth-store` que o gerente esta autenticado (adicionando um campo `managerSession` ao store).

**Arquivo:** `src/stores/auth-store.ts`

Adicionar ao store:
- `managerSession: { id, name, cnpj } | null`
- `setManagerSession`
- Limpar no `logout`

## Detalhes tecnicos

- Nenhuma migracao de banco necessaria (tabela `managers` ja tem todos os campos)
- Componentes Dialog do shadcn ja existem no projeto
- Icones `Eye`, `Pencil`, `UserCog` do lucide-react
- Validacao de CNPJ e senha no login do gerente
- A verificacao de senha do gerente sera feita consultando diretamente a tabela `managers` (senha em texto plano, como ja funciona no sistema)

## Arquivos afetados

1. `src/pages/admin/ManagersPage.tsx` — adicionar 3 icones + 3 modais
2. `src/components/dashboard/DashboardSidebar.tsx` — adicionar botao gerente + modal login
3. `src/stores/auth-store.ts` — adicionar `managerSession`

