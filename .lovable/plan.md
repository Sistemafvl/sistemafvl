

## Plano: Adicionar Filtros de Nome e Login na Conferência Carregamento

### O que falta do pedido original (Anexo 1)

Os filtros de **nome do motorista** e **login (dropdown com buscador)** não foram implementados. Apenas o campo "Buscar TBR" e os filtros de data existem atualmente.

### Mudanças

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

1. **Reduzir campo "Buscar TBR"** — de `flex-1` para largura fixa menor (~33%)
2. **Adicionar campo "Nome do motorista"** — Input de texto que filtra `displayRides` localmente por `driver_name` (case-insensitive)
3. **Adicionar dropdown "Login"** — Combobox com buscador (usando `cmdk`/Command) que:
   - Carrega logins da tabela `unit_logins` da unidade ao montar
   - Permite digitar para filtrar na lista
   - Ao selecionar um login, filtra `displayRides` para mostrar apenas rides com aquele login
   - Botão de limpar para remover o filtro

4. **Lógica de filtro** — Encadear os 3 filtros:
   ```
   displayRides = (isSearchActive ? searchRides : rides)
     .filter(r => !driverNameFilter || r.driver_name?.toLowerCase().includes(driverNameFilter))
     .filter(r => !loginFilter || r.login === loginFilter)
   ```

### Layout dos filtros (linha única responsiva)
```text
[ 🔍 Buscar TBR (33%) ] [ 👤 Nome motorista (33%) ] [ 🔑 Login ▼ (33%) ]
[  📅 Data início  ] [  📅 Data fim  ]
```

### Estados novos
- `driverNameFilter: string` — texto digitado no campo nome
- `loginFilter: string` — login selecionado no dropdown
- `unitLogins: string[]` — lista de logins carregados do banco

