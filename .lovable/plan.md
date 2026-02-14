

# Transformar Dashboard em layout com sidebar e aumentar logotipo

## Resumo

Substituir o layout atual do Dashboard (header + cards centrais) por um layout com menu lateral (sidebar), movendo as opcoes relevantes para o sidebar. Tambem aumentar o tamanho do logotipo no sidebar.

## Alteracoes

### 1. Criar componente `DashboardSidebar.tsx`

**Arquivo novo:** `src/components/dashboard/DashboardSidebar.tsx`

Sidebar usando os componentes `Sidebar` do shadcn, contendo:
- Logo no topo com `size="lg"` (maior e mais visivel)
- Informacoes da unidade/dominio e relogio
- Itens de menu (apenas os que ficam):
  - **Conferencia Carregamento** (antigo "Saida de Mercadoria") — icone `Truck`
  - **Relatorios** — icone `BarChart3`
  - **Configuracoes** — icone `Settings`
- Botao "Sair" no rodape do sidebar
- Itens removidos dos cards: "Entrada de Mercadoria" e "Scanner QR / Codigo de Barras"

### 2. Criar componente `DashboardLayout.tsx`

**Arquivo novo:** `src/components/dashboard/DashboardLayout.tsx`

Layout wrapper com `SidebarProvider`, similar ao `AdminLayout`:
- Verifica autenticacao (`unitSession`)
- Renderiza `DashboardSidebar` + area principal com `Outlet`
- Header com `SidebarTrigger`

### 3. Criar pagina inicial do dashboard

**Arquivo novo:** `src/pages/dashboard/DashboardHome.tsx`

Pagina de boas-vindas simples com informacoes da unidade (dominio, unidade, relogio) que aparece como conteudo principal.

### 4. Atualizar rotas

**Arquivo:** `src/App.tsx`

Mudar de rota unica `/dashboard` para layout com sub-rotas:

```text
/dashboard          -> DashboardLayout
  /dashboard        -> DashboardHome (index)
  /dashboard/conferencia  -> (placeholder futuro)
  /dashboard/relatorios   -> (placeholder futuro)
  /dashboard/configuracoes -> (placeholder futuro)
```

### 5. Remover `DashboardPage.tsx` antigo

O arquivo `src/pages/DashboardPage.tsx` sera substituido pelo novo layout.

## Detalhes tecnicos

- Reutiliza os mesmos componentes de Sidebar do shadcn ja usados no admin
- Reutiliza `LogoHeader`, `NavLink`, `useAuthStore`
- Nenhuma dependencia nova necessaria
- Os itens de menu ficam desabilitados (com visual "Em breve") ate serem implementados, exceto como links de navegacao no sidebar
- O logotipo usara `size="lg"` (`h-24 sm:h-32`) no sidebar para ficar bem visivel

