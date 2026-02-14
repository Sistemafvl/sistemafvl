
# Separar Senhas do Gerenciador: Acesso vs Painel

## Problema Atual

O gerenciador tem apenas uma senha (`password`) na tabela `managers`. Porem, existem dois momentos de autenticacao distintos:

1. **Tela de login principal** (Anexo 1): CNPJ + senha para entrar no dashboard - atualmente usa a senha da unidade
2. **Modal "Login Gerente"** (Anexo 2): CNPJ + senha pessoal para acessar funcoes de gerente - usa `managers.password`

## Solucao

Adicionar uma segunda coluna de senha na tabela `managers`, separando:
- `password` (existente) - senha de **acesso** ao sistema (usada na tela de login, Anexo 1)
- `manager_password` (nova) - senha **pessoal do gerente** (usada no modal "Login Gerente", Anexo 2)

## Alteracoes

### 1. Migracao de banco

Adicionar coluna `manager_password` (text) na tabela `managers`.

### 2. Edge Function `authenticate-unit`

Quando o login for por CNPJ, ao inves de verificar `unit.password`, verificar `manager.password` (a senha de acesso do gerenciador).

### 3. Dashboard Sidebar - Modal "Login Gerente"

Alterar a query do `handleManagerLogin` para usar `manager_password` ao inves de `password`.

### 4. Admin - Pagina de Gerenciadores (`ManagersPage.tsx`)

- **Formulario de adicao**: campo "Senha" permanece (senha de acesso), adicionar campo "Senha Gerente" (senha pessoal)
- **Pencil (editar)**: edita nome, CNPJ e `password` (senha de acesso, Anexo 1)
- **UserCog (credenciais)**: edita CNPJ e `manager_password` (senha pessoal do gerente, Anexo 2)
- **Modal Visualizar**: mostrar ambas as senhas com labels claros

### 5. Resumo das senhas

| Contexto | Campo no banco | Onde e usada |
|---|---|---|
| Login principal (CNPJ) | `managers.password` | Tela de login (Anexo 1) |
| Login Gerente (painel) | `managers.manager_password` | Modal no dashboard (Anexo 2) |

## Detalhes tecnicos

- A coluna `manager_password` sera nullable inicialmente para nao quebrar registros existentes
- Gerenciadores existentes precisarao ter a `manager_password` definida pelo admin
- O modal "Login Gerente" so validara se `manager_password` estiver preenchida
- A edge function passara a validar `manager.password` ao inves de `unit.password` para login CNPJ
