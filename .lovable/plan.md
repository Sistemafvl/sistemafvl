

# Painel Exclusivo do Motorista Parceiro

## Problema atual

Quando um motorista faz login por CPF, ele e redirecionado para o mesmo layout do dashboard da unidade (apenas sem sidebar). O motorista precisa de uma experiencia completamente diferente, com seu proprio menu e funcionalidades.

## Nova estrutura

O motorista tera um layout dedicado com sidebar proprio e paginas exclusivas:

```text
+-------------------------------+------------------------------------------+
| LOGO                          |  MOTORISTA PARCEIRO                      |
|-------------------------------|------------------------------------------|
| [foto perfil]                 |                                          |
| Bem-vindo, [Nome]             |  (conteudo da pagina ativa)              |
|-------------------------------|                                          |
| MENU                          |                                          |
|  > Visao Geral                |                                          |
|  > Entrar na Fila             |                                          |
|  > Indicadores                |                                          |
|  > Perfil                     |                                          |
|  > Avaliar Unidades           |                                          |
|  > Configuracoes              |                                          |
|-------------------------------|                                          |
| [Sair]                        |                                          |
+-------------------------------+------------------------------------------+
```

## Paginas do motorista

1. **Visao Geral** (`/dashboard/motorista`) - Pagina inicial com saudacao e resumo
2. **Entrar na Fila** (`/dashboard/motorista/fila`) - Seleciona dominio/unidade e entra na fila com contador de posicao
3. **Indicadores** (`/dashboard/motorista/indicadores`) - Estatisticas de corridas, entregas, devolucoes
4. **Perfil** (`/dashboard/motorista/perfil`) - Upload de foto, edicao de dados cadastrais
5. **Avaliar Unidades** (`/dashboard/motorista/avaliacoes`) - Avaliar unidades onde trabalhou
6. **Configuracoes** (`/dashboard/motorista/configuracoes`) - Preferencias do motorista

## Alteracoes por arquivo

### 1. `src/components/dashboard/DriverSidebar.tsx` (novo)
- Sidebar dedicado para motoristas
- Exibe foto de perfil (placeholder inicial) e nome do motorista
- Menu com as 6 opcoes listadas acima
- Botao "Sair" no rodape
- Icones: LayoutDashboard, Users, BarChart3, User, Star, Settings

### 2. `src/components/dashboard/DriverLayout.tsx` (novo)
- Layout exclusivo para motoristas (similar ao DashboardLayout mas usando DriverSidebar)
- Verifica se `unitSession.sessionType === "driver"`, caso contrario redireciona
- Header com label "MOTORISTA PARCEIRO"

### 3. Paginas do motorista (novos arquivos)
- `src/pages/driver/DriverHome.tsx` - Visao geral com "Bem-vindo, [nome]"
- `src/pages/driver/DriverQueue.tsx` - Selecionar dominio/unidade e entrar na fila (placeholder)
- `src/pages/driver/DriverStats.tsx` - Indicadores (placeholder)
- `src/pages/driver/DriverProfile.tsx` - Perfil com upload de foto e edicao de dados (placeholder)
- `src/pages/driver/DriverReviews.tsx` - Avaliacoes de unidades (placeholder)
- `src/pages/driver/DriverSettings.tsx` - Configuracoes (placeholder)

### 4. `src/components/dashboard/DashboardLayout.tsx` (editar)
- Redirecionar motoristas para `/motorista` em vez de `/dashboard/motorista`

### 5. `src/App.tsx` (editar)
- Adicionar novo grupo de rotas `/motorista` com DriverLayout
- Rotas: index, fila, indicadores, perfil, avaliacoes, configuracoes
- Remover rota antiga `/dashboard/motorista`

### 6. `src/pages/Index.tsx` (editar)
- Atualizar redirect: se `unitSession.sessionType === "driver"`, redirecionar para `/motorista`

## Detalhes tecnicos

- O login do motorista continua pelo formulario da pagina inicial (CPF + senha)
- A edge function `authenticate-unit` ja retorna `sessionType: "driver"` corretamente
- O `unitSession` armazena os dados do motorista (id, nome, cpf)
- As paginas serao criadas como placeholders com estrutura preparada para funcionalidade futura
- O DriverSidebar nao tera modal de gerente (exclusivo da visao da unidade)
- Nenhuma alteracao de banco de dados necessaria neste momento

