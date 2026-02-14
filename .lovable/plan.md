
# Cadastro de Motorista Parceiro

## Resumo

Adicionar um botao "Cadastro Motorista" abaixo do botao "ENTRAR" na tela inicial. Ao clicar, abre um modal de cadastro. Apos o cadastro, o motorista faz login pela tela normal (dominio, unidade, CPF, senha) e acessa um "Painel do Motorista Parceiro". O motorista nao fica vinculado a nenhuma unidade especifica (acesso livre).

## Alteracoes

### 1. Criar tabela `drivers` no banco

Nova tabela com os campos:
- `id` (uuid, PK)
- `name` (text) — Nome completo
- `cpf` (text, unique) — CPF do motorista
- `cep` (text)
- `address` (text) — Endereco (preenchido via CEP)
- `neighborhood` (text) — Bairro
- `city` (text) — Cidade
- `state` (text) — Estado
- `car_plate` (text) — Placa do carro
- `car_model` (text) — Modelo do carro
- `email` (text)
- `whatsapp` (text)
- `password` (text)
- `active` (boolean, default true)
- `created_at` (timestamptz, default now())

RLS: permitir INSERT para anon (cadastro publico) e SELECT para anon com filtro por CPF (para login).

### 2. Criar componente `DriverRegistrationModal`

**Arquivo:** `src/components/DriverRegistrationModal.tsx`

Modal (Dialog) com formulario contendo todos os campos:
- Nome completo, CPF (com mascara), CEP (com mascara e busca automatica)
- Endereco, Bairro, Cidade, Estado (preenchidos automaticamente via API ViaCEP)
- Placa do carro, Modelo do carro
- Email, WhatsApp (com mascara)
- Senha (com icone de olho para mostrar/ocultar)
- Botao "Cadastrar"

Ao preencher o CEP (8 digitos), faz fetch em `https://viacep.com.br/ws/{cep}/json/` e preenche endereco, bairro, cidade e estado automaticamente.

Apos cadastro com sucesso, fecha o modal e exibe toast de confirmacao.

### 3. Adicionar botao na tela inicial

**Arquivo:** `src/pages/Index.tsx`

Adicionar abaixo do componente `UnitLoginForm` um botao "Cadastro Motorista" com icone `Truck`. Ao clicar, abre o `DriverRegistrationModal`.

### 4. Atualizar Edge Function `authenticate-unit`

**Arquivo:** `supabase/functions/authenticate-unit/index.ts`

Alem de verificar `user_profiles` e `managers`, adicionar verificacao na tabela `drivers`:
- Se o CPF informado nao for encontrado em `user_profiles`, buscar em `drivers`
- Se encontrado em `drivers`, verificar a senha do motorista (nao a da unidade)
- Retornar `sessionType: "driver"` no payload

Isso permite que o motorista faca login em qualquer unidade usando seu CPF e sua propria senha.

### 5. Atualizar auth-store

**Arquivo:** `src/stores/auth-store.ts`

Adicionar `"driver"` ao tipo `SessionType`.

### 6. Criar pagina "Painel do Motorista Parceiro"

**Arquivo:** `src/pages/dashboard/DriverPanel.tsx`

Pagina simples com titulo "Painel do Motorista Parceiro" e mensagem de boas-vindas. Funcionalidades serao adicionadas posteriormente.

### 7. Adicionar rota e condicional no dashboard

**Arquivo:** `src/App.tsx`

Adicionar rota `/dashboard/motorista` dentro do layout do dashboard.

**Arquivo:** `src/components/dashboard/DashboardLayout.tsx` ou redirecionamento

Quando `unitSession.sessionType === "driver"`, redirecionar automaticamente para o painel do motorista e ocultar o sidebar padrao (ou mostrar um sidebar simplificado).

## Detalhes tecnicos

- API ViaCEP e publica e gratuita, sem necessidade de chave
- Mascaras: CPF (000.000.000-00), CEP (00000-000), WhatsApp ((00) 00000-0000)
- Campo de senha com icone de olho (padrao do projeto)
- A senha do motorista e independente da senha da unidade — na edge function, quando for driver, valida a senha do driver e nao da unidade
- RLS da tabela drivers permite INSERT sem autenticacao (cadastro publico) e SELECT filtrado por CPF
- Layout existente nao sera alterado, apenas adicionado o botao abaixo do formulario
