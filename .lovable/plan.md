

## Melhorias na Conferencia Carregamento

### 1. Estado de Carregamento (Loading/Skeleton)

Atualmente, ao abrir a pagina, aparece "Nenhum carregamento programado hoje" por alguns segundos ate os dados carregarem. Isso da a impressao de que nao ha dados.

**Solucao:** Adicionar um estado `isLoading` que inicia como `true` e muda para `false` apos o primeiro fetch. Enquanto `isLoading` for true, exibir skeleton cards (placeholders animados) no lugar da mensagem vazia.

- Usar o componente `Skeleton` ja existente no projeto
- Exibir 3 skeleton cards em grid enquanto carrega
- Aplicar o mesmo padrao em outras telas que tenham o mesmo problema

### 2. TBR Mais Rapido (Atualizacao Otimista)

O TBR demora para aparecer na lista porque o sistema espera a gravacao no banco e depois faz um `fetchRides()` completo (que busca rides + drivers + tbrs).

**Solucao:** Implementar atualizacao otimista -- adicionar o TBR na lista local imediatamente antes de gravar no banco. Assim o usuario ve o TBR na lista instantaneamente.

- Ao detectar um TBR valido no debounce, inserir otimisticamente no estado `tbrs` com um ID temporario
- Em seguida gravar no banco e fazer `fetchRides()` para sincronizar
- O mesmo para exclusao: remover do estado local imediatamente, depois deletar no banco

### 3. Edicao Inline para Gerente (Rota, Login, Senha)

Apenas quando o `managerSession` existir no auth store, exibir um icone de lapis ao lado dos campos Rota, Login e Senha. Ao clicar, o campo vira um input editavel. Ao salvar (blur ou Enter), grava no banco instantaneamente.

- Verificar `managerSession` do `useAuthStore` para condicionar a exibicao
- Campos editaveis: `route`, `login`, `password`
- Ao salvar: update na tabela `driver_rides` e atualizar o estado local otimisticamente

---

### Detalhes Tecnicos

**Arquivo modificado:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**1. Loading State:**
- Novo estado: `const [isLoading, setIsLoading] = useState(true)`
- No `fetchRides`: setar `setIsLoading(false)` no final
- No render: se `isLoading`, mostrar grid com 3 `Skeleton` cards (altura ~300px)
- Import: `import { Skeleton } from "@/components/ui/skeleton"`

**2. TBR Otimista:**
No `handleTbrInputChange`, apos validar que comeca com "TBR":
```text
1. Gerar ID temporario (crypto.randomUUID())
2. Adicionar ao estado tbrs[rideId] imediatamente
3. Limpar input
4. Insert no banco em background
5. fetchRides() para sincronizar IDs reais
```

Para exclusao (`handleDeleteTbr`):
```text
1. Remover do estado tbrs imediatamente
2. Delete no banco em background
3. fetchRides() para sincronizar
```

**3. Edicao Inline (Gerente):**
- Novo estado: `const [editingField, setEditingField] = useState<{rideId: string, field: string} | null>(null)`
- Novo estado: `const [editValue, setEditValue] = useState("")`
- Verificar `managerSession` do auth store
- Import adicional: `Pencil` do lucide-react
- Para cada campo (route, login, password): se `managerSession` existe, mostrar icone de lapis
- Ao clicar no lapis: ativar modo edicao (input inline)
- Ao blur ou Enter: salvar com `supabase.from("driver_rides").update(...)` e atualizar estado local otimisticamente
- Campos editaveis: `route`, `login`, `password`

