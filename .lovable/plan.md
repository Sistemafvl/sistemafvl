
# Plano: Menu Lateral + Gerenciadores + Campo CPF/CNPJ Inteligente

## Resumo

Adicionar um menu lateral (sidebar) ao painel Admin com navegacao entre secoes, criar a secao "Gerenciadores" para cadastro de gerentes por unidade (que acessam via CNPJ), e transformar o campo CPF da tela de login em um campo inteligente CPF/CNPJ que detecta automaticamente o tipo de acesso.

---

## 1. Menu Lateral no Admin

Usar o componente Sidebar (shadcn) ja disponivel no projeto para criar uma navegacao lateral na area admin com as seguintes opcoes:

- **Dominios e Unidades** (tela atual do admin)
- **Gerenciadores** (nova tela)

O sidebar sera responsivo: em mobile aparece como drawer (Sheet), em desktop como painel fixo lateral. Um botao SidebarTrigger ficara sempre visivel no header.

### Arquivos envolvidos:
- **Novo**: `src/components/admin/AdminSidebar.tsx` - componente do sidebar
- **Novo**: `src/components/admin/AdminLayout.tsx` - layout wrapper com sidebar
- **Novo**: `src/pages/admin/DomainsUnitsPage.tsx` - conteudo atual extraido do AdminPage
- **Novo**: `src/pages/admin/ManagersPage.tsx` - tela de Gerenciadores
- **Editar**: `src/pages/AdminPage.tsx` - refatorar para usar AdminLayout com sub-rotas
- **Editar**: `src/App.tsx` - adicionar rotas `/admin/domains`, `/admin/managers`

---

## 2. Tabela de Gerenciadores (managers)

Criar tabela `managers` no banco para armazenar os gerentes de cada unidade:

```text
managers
- id (uuid, PK)
- name (text, NOT NULL)
- cnpj (text, NOT NULL)
- password (text, NOT NULL)
- unit_id (uuid, FK -> units.id)
- active (boolean, default true)
- created_at (timestamptz, default now())
- UNIQUE(cnpj, unit_id)
```

RLS: leitura publica de ativos (para login), CRUD completo para autenticados (admin).

---

## 3. Tela de Gerenciadores

Na pagina `/admin/managers`:
- Select de Dominio para filtrar unidades
- Select de Unidade
- Formulario para adicionar gerenciador: Nome, CNPJ, Senha
- Lista de gerenciadores da unidade selecionada com toggle ativo/inativo e botao excluir
- Layout responsivo mobile-first (inputs empilhados em mobile, lado a lado em desktop)

---

## 4. Campo CPF/CNPJ Inteligente na Tela de Login

Transformar o campo "CPF" em "CPF / CNPJ":
- Detectar automaticamente pelo numero de digitos: ate 11 digitos = CPF, de 12 a 14 digitos = CNPJ
- Mascara automatica: CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00)
- Quando for CPF: manter o fluxo atual (busca em `user_profiles`)
- Quando for CNPJ: buscar em `managers` e validar senha como acesso de gerenciador

### Arquivos envolvidos:
- **Editar**: `src/components/UnitLoginForm.tsx` - campo inteligente com deteccao
- **Editar**: `supabase/functions/authenticate-unit/index.ts` - adicionar logica para CNPJ (buscar na tabela managers)
- **Editar**: `src/stores/auth-store.ts` - adicionar tipo de sessao (user vs manager) para diferenciar acesso

---

## 5. Atualizacao do Auth Store

Adicionar campo `sessionType: "user" | "manager"` ao estado para que o sistema saiba qual tipo de acesso foi feito e possa direcionar para telas/permissoes diferentes no futuro.

---

## Detalhes Tecnicos

### Migracao SQL (managers)

```sql
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  password TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cnpj, unit_id)
);

ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- Leitura de ativos (para login)
CREATE POLICY "Anyone can read active managers"
  ON public.managers FOR SELECT
  USING (active = true);

-- CRUD para autenticados
CREATE POLICY "Authenticated can read all managers"
  ON public.managers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert managers"
  ON public.managers FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update managers"
  ON public.managers FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete managers"
  ON public.managers FOR DELETE TO authenticated
  USING (true);
```

### Logica de deteccao CPF/CNPJ no login

```text
digitos = input.replace(/\D/g, '')
if (digitos.length <= 11) -> CPF -> buscar em user_profiles
if (digitos.length > 11)  -> CNPJ -> buscar em managers
```

### Rotas do Admin

```text
/admin          -> redireciona para /admin/domains
/admin/domains  -> Dominios e Unidades (tela atual)
/admin/managers -> Gerenciadores
```

### Responsividade

Todos os novos componentes seguem a diretriz mobile-first:
- Sidebar com Sheet em mobile, painel fixo em desktop
- Inputs h-11, botoes h-12, touch-friendly
- Grid responsivo (1 coluna mobile, 2 colunas desktop)
