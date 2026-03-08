

## Resposta: O acesso do Diretor já existe

O login do diretor **já está implementado** no fluxo atual de login. Funciona assim:

1. Na tela de login, o diretor seleciona seu **Domínio**
2. Na lista de unidades, seleciona **"MATRIZ ADMIN"** (que aparece no topo)
3. Digita seu **CPF** e **senha pessoal**
4. A edge function `authenticate-unit` identifica que é uma unidade `is_matriz`, busca na tabela `directors` e retorna `sessionType: "matriz"`

O cadastro de novos diretores é feito pela página de **Gerenciadores** (quando o domínio é selecionado sem unidade específica).

### O que precisa mudar no plano aprovado

O login já funciona. A implementação pendente é apenas o **redirecionamento e experiência pós-login**:

- Hoje o diretor vai para `/matriz` (painel separado e limitado)
- O plano aprovado redireciona para `/dashboard` com:
  - Seletor de troca de unidade na sidebar
  - Todos os menus desbloqueados
  - Seção BI Consolidado

Nenhum arquivo novo de login precisa ser criado. Quer que eu prossiga com a implementação do plano aprovado?

