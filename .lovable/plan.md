

## Plano: Restaurar páginas faltantes do Master Admin

Atualmente o painel Master Admin tem apenas 4 páginas (Visão Geral, Domínios & Unidades, Gerentes, Diretores). Faltam 3 que existiam antes:

### Páginas a criar

1. **`src/pages/admin/DatabasePage.tsx`** — Banco de Dados
   - Lista todas as tabelas do sistema com contagem de registros (via `select count`)
   - Barra de progresso estimando uso de armazenamento vs limite de 500MB
   - Ícone de banco de dados, cards por tabela

2. **`src/pages/admin/AdminDriversPage.tsx`** — Motoristas (Gerenciador)
   - Lista todos os motoristas cadastrados globalmente (tabela `drivers` direta, não a view pública)
   - Exibe nome, CPF, placa, modelo, **senha visível** (com toggle olho), status ativo/inativo
   - Busca por nome/CPF, paginação
   - Botões de ativar/desativar e excluir motorista

3. **`src/pages/admin/SecurityPage.tsx`** — Segurança
   - Painel de auditoria mostrando status de proteção: RLS habilitado por tabela, Edge Functions configuradas, Storage buckets
   - Score de segurança calculado (% de tabelas com RLS, funções com JWT, etc.)
   - Lista de vulnerabilidades/alertas (tabelas sem RLS, buckets públicos, etc.)

### Arquivos a editar

4. **`src/components/admin/AdminSidebar.tsx`** — Adicionar 3 novos itens ao menu:
   - `{ title: "Motoristas", url: "/admin/motoristas", icon: Truck }`
   - `{ title: "Banco de Dados", url: "/admin/banco", icon: Database }`
   - `{ title: "Segurança", url: "/admin/seguranca", icon: Shield }`

5. **`src/App.tsx`** — Adicionar 3 rotas dentro do `<Route path="/admin">`:
   - `/admin/motoristas` → AdminDriversPage
   - `/admin/banco` → DatabasePage
   - `/admin/seguranca` → SecurityPage

### Resultado
- Menu do Master Admin terá 7 opções (Visão Geral, Domínios, Gerentes, Diretores, Motoristas, Banco de Dados, Segurança)
- Todas as funcionalidades que existiam antes serão restauradas

