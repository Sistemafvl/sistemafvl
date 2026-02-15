

## Melhorias no Dashboard: Sidebar, Motoristas e novas opcoes PS/RTO

### 1. Card do Sidebar com Unidade e Dominio

No card do gerente logado no sidebar (`DashboardSidebar.tsx`), adicionar informacoes da unidade e dominio abaixo do nome do gerente.

**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx`

- Usar `unitSession.name` (unidade) e `unitSession.domain_name` (dominio) do auth store
- Exibir abaixo do nome do gerente em texto menor, ex: "Unidade: X | Dominio: Y"

---

### 2. Motoristas que Passaram pela Unidade

Alterar `MotoristasParceirosPage.tsx` para mostrar apenas motoristas que possuem registros na tabela `driver_rides` vinculados a unidade logada.

**Arquivo:** `src/pages/dashboard/MotoristasParceirosPage.tsx`

- Mudar o titulo para "Motoristas Parceiros que passaram por sua unidade"
- Alterar a query: buscar `driver_rides` onde `unit_id = unitSession.id`, extrair `driver_id` distintos, depois buscar os dados dos motoristas correspondentes
- Preencher as colunas Corridas, Entregues e Devolvidos com dados reais da tabela `driver_rides` (contagem total, contagem com `loading_status = 'finished'`, e contagem com `loading_status = 'returned'`)

---

### 3. Novas opcoes de menu: PS e RTO

Criar duas novas paginas acessiveis pelo menu do gerente, com logica muito similar entre elas.

#### 3.1 Tabelas no banco de dados

Criar duas tabelas novas:

**Tabela `ps_entries`:**
- `id` uuid PK default gen_random_uuid()
- `tbr_code` text NOT NULL
- `ride_id` uuid FK -> driver_rides.id (nullable, para vincular ao historico)
- `unit_id` uuid FK -> units.id NOT NULL
- `conferente_id` uuid FK -> user_profiles.id (nullable)
- `description` text NOT NULL (descricao do problema)
- `driver_name` text (cache do nome do motorista)
- `route` text (cache da rota)
- `status` text default 'open' (open / closed)
- `created_at` timestamptz default now()
- `closed_at` timestamptz nullable

**Tabela `rto_entries`:**
- Mesma estrutura identica a `ps_entries`

RLS: policies publicas (mesmo padrao do projeto).

#### 3.2 Menu lateral

**Arquivo:** `src/components/dashboard/DashboardSidebar.tsx`

- Adicionar ao array `managerMenuItems` duas novas opcoes:
  - `{ title: "PS", url: "/dashboard/ps", icon: AlertTriangle }`
  - `{ title: "RTO", url: "/dashboard/rto", icon: RotateCcw }`

#### 3.3 Rotas

**Arquivo:** `src/App.tsx`

- Adicionar rotas:
  - `/dashboard/ps` -> `PSPage`
  - `/dashboard/rto` -> `RTOPage`

#### 3.4 Pagina PS (`src/pages/dashboard/PSPage.tsx`)

**Fluxo:**
1. Campo de leitura de TBR no topo (mesmo padrao de scanner automatico com debounce 300ms)
2. Ao ler um TBR valido (prefixo "TBR"):
   - Busca na tabela `ride_tbrs` pelo codigo para encontrar o `ride_id`
   - Com o `ride_id`, busca em `driver_rides` o historico completo (motorista, rota, login, conferente, datas)
   - Exibe um modal com todas as informacoes historicas do TBR
   - Botao "Incluir PS" no modal
3. Ao clicar "Incluir PS":
   - Abre campos para: descricao do problema (textarea) e selecao do conferente (dropdown com conferentes da unidade)
   - Dados do historico sao preenchidos automaticamente (driver_name, route, ride_id)
   - Botao "Gravar"
4. Ao gravar, insere na tabela `ps_entries` e o TBR aparece na lista abaixo
5. Lista de PS com colunas: Codigo TBR, Motorista, Rota, Conferente, Problema, Data, Status, Acoes
6. Botao "Finalizar PS" na coluna de acoes: atualiza `status = 'closed'` e `closed_at = now()`
7. Ao finalizar, o registro some da lista ativa (ou mostra como finalizado)

Se o TBR nao for encontrado no historico, exibir mensagem informando que nao ha registros.

#### 3.5 Pagina RTO (`src/pages/dashboard/RTOPage.tsx`)

Mesma logica e layout da pagina PS, porem gravando na tabela `rto_entries`. Titulo "RTO" e icone diferente.

---

### Detalhes Tecnicos

**Novas dependencias:** Nenhuma (usa componentes e libs ja existentes)

**Arquivos criados:**
- `src/pages/dashboard/PSPage.tsx`
- `src/pages/dashboard/RTOPage.tsx`

**Arquivos modificados:**
- `src/components/dashboard/DashboardSidebar.tsx` (card + menu items)
- `src/pages/dashboard/MotoristasParceirosPage.tsx` (titulo + query filtrada por unidade)
- `src/App.tsx` (rotas PS e RTO)

**Migracao SQL:**
- Criar tabelas `ps_entries` e `rto_entries` com RLS
- Habilitar realtime para ambas (opcional)

**Query para motoristas da unidade:**
```text
1. SELECT DISTINCT driver_id FROM driver_rides WHERE unit_id = ?
2. SELECT * FROM drivers WHERE id IN (...)
3. Para cada motorista: COUNT de rides, COUNT de finished, COUNT de returned
```

**Busca de historico do TBR (PS/RTO):**
```text
1. SELECT ride_id FROM ride_tbrs WHERE code = ?
2. SELECT dr.*, d.name as driver_name FROM driver_rides dr JOIN drivers d ON d.id = dr.driver_id WHERE dr.id = ride_id
```

