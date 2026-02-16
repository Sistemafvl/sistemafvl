
# Tema por Tipo de Sessao (Motorista vs Unidade/Gerente)

## Problema
O tema escuro/claro e salvo globalmente pelo `next-themes` (chave `theme` no localStorage). Quando o motorista ativa o tema escuro, ao sair e logar como unidade/gerente, o tema escuro persiste -- porque e a mesma chave compartilhada.

## Solucao
Salvar a preferencia de tema separadamente por tipo de sessao, e ao logar/deslogar, aplicar o tema correto automaticamente.

### Detalhes tecnicos

**1. localStorage com chave por sessao**
- Ao mudar o tema em `DriverSettings`, salvar tambem em `localStorage` com chave `theme_driver`
- O dashboard da unidade/gerente usara a chave `theme_unit` (caso futuramente tenha config de tema la tambem)
- Padrao para ambos: `light`

**2. Restaurar tema ao logar (`DashboardLayout` e `DriverLayout`)**
- No `DriverLayout`, ao montar, ler `localStorage.getItem("theme_driver")` e chamar `setTheme()` com o valor (ou "light" se nulo)
- No `DashboardLayout`, ao montar, ler `localStorage.getItem("theme_unit")` e chamar `setTheme()` (ou "light" se nulo)

**3. Ao fazer logout, resetar para light**
- No `auth-store.ts`, a funcao `logout` nao precisa mudar -- mas nos layouts, ao detectar que nao ha sessao (redirect), o tema ja sera resetado pelo layout de destino (Index usa light)

**4. Atualizar `DriverSettings.tsx`**
- Ao trocar o tema, alem de `setTheme()`, salvar em `localStorage.setItem("theme_driver", novoTema)`

### Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `src/pages/driver/DriverSettings.tsx` | Salvar tema em `theme_driver` no localStorage ao trocar |
| `src/components/dashboard/DriverLayout.tsx` | useEffect ao montar: ler `theme_driver` e aplicar com `setTheme` |
| `src/components/dashboard/DashboardLayout.tsx` | useEffect ao montar: ler `theme_unit` e aplicar com `setTheme` (padrao light) |
| `src/pages/Index.tsx` | useEffect ao montar: forcar `setTheme("light")` para tela de login sempre clara |
