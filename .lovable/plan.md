

# Visao Geral - Menu e Layout do Dashboard

## Resumo

Duas alteracoes: (1) adicionar item "Visao Geral" no menu do sidebar como primeira opcao, apontando para `/dashboard`; (2) reorganizar o layout da pagina inicial para colocar data/hora ao lado do "Bem-vindo" na mesma linha, liberando espaco para futuros cards de indicadores.

## Alteracoes

### 1. Sidebar - Novo item "Visao Geral"

No arquivo `src/components/dashboard/DashboardSidebar.tsx`, adicionar "Visao Geral" como primeiro item do `menuItems`, com icone `LayoutDashboard` e url `/dashboard`.

```text
menuItems:
  - Visao Geral        -> /dashboard          (LayoutDashboard)
  - Conferencia Carregamento -> /dashboard/conferencia (Truck)
```

### 2. DashboardHome - Reorganizar layout

No arquivo `src/pages/dashboard/DashboardHome.tsx`:

- Colocar o bloco "Bem-vindo" e o card de data/hora lado a lado usando `flex` ou `grid`
- O "Bem-vindo" fica a esquerda, o card de data/hora fica a direita, na mesma linha
- Abaixo, manter espaco livre para futuros cards de indicadores e insights

Layout proposto:

```text
+----------------------------------+-----------------------------+
| Bem-vindo                        |  [relogio] sabado, 14 de    |
| ABC-AMZL -- UNIDADE 1            |  fevereiro de 2026  18:05   |
+----------------------------------+-----------------------------+
|                                                                |
|  (espaco para futuros cards de indicadores)                    |
|                                                                |
+----------------------------------------------------------------+
```

## Arquivos afetados

- `src/components/dashboard/DashboardSidebar.tsx` - adicionar item no menu
- `src/pages/dashboard/DashboardHome.tsx` - reorganizar layout

## Detalhes tecnicos

- Importar `LayoutDashboard` do lucide-react no sidebar
- No DashboardHome, usar `flex justify-between items-start` para alinhar bem-vindo e relogio na mesma linha
- Nenhuma alteracao de banco de dados necessaria

