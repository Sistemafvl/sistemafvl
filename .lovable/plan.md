

## Plano de Implementação (6 mudanças)

### 1. TBRs removidos do carregamento nao devem contar como "lidos" (Anexo 1)

**Problema**: Quando um TBR é excluído de um carregamento (vai para Insucessos) e carregado em outro motorista, ele continua contando no `rideTbrs.length` do carregamento original. O TBR deveria ser descontado de todos os contadores.

**Lógica**: O TBR já é removido da tabela `ride_tbrs` ao ser excluído (handleDeleteTbr faz `DELETE`), mas o código já trata isso corretamente pois `ride_tbrs` é a source of truth. O problema pode estar no fato de que o re-fetch demora ou o `piso_entries` com motivo "Removido do carregamento" referencia o `ride_id` original.

**Verificação necessária**: Na verdade, ao excluir o TBR, `handleDeleteTbr` já remove de `ride_tbrs`. O `rideTbrs.length` deveria ser correto após re-fetch. O counter no badge (linha 1685) e "TBRs Lidos (N)" (linhas 1904, 2081) já refletem `ride_tbrs` que existe. Se o TBR foi deletado do ride_tbrs, não aparece mais.

O problema real está nos **outros módulos** que contam TBRs por ride_id (Operação, Ciclos, DriverRides, Folha de Pagamento, Matriz). Nesses módulos, o `ride_tbrs` já é correto pois o TBR deletado sai da tabela. Nao deve haver inconsistencia.

**Verificação adicional**: Possivel que o `ride_tbrs` DELETE nao esteja funcionando ou o cache esteja stale. Precisarei verificar se o `DELETE` no `ride_tbrs` está de fato ocorrendo. Se o TBR aparece como "Removido do carregamento" no piso mas ainda está no `ride_tbrs`, isso é um bug.

**Correção real**: Garantir que em **todos os pontos** onde contamos TBRs (OperacaoPage, CiclosPage, DashboardMetrics, DriverRides, relatórios), excluímos TBRs que estão no `piso_entries` com motivo "Removido do carregamento" referenciando aquele `ride_id`. Nao basta contar `ride_tbrs.length` — precisa verificar se o TBR ainda está la. Mas o `handleDeleteTbr` JÁ faz `DELETE` do `ride_tbrs`. Então o TBR nao deveria estar mais na tabela.

**Vou verificar na DB** se há TBRs que ficam na ride_tbrs mesmo após exclusão, o que indicaria que a deleção falha silenciosamente. Se o DELETE funciona, o problema é que o UI não atualiza. Vou implementar:

- Verificar que handleDeleteTbr realmente apaga do ride_tbrs
- Em OperacaoPage, CiclosPage e demais, os contadores já usam ride_tbrs (correto)
- No card da Conferência, o counter já reflete ride_tbrs atual

**Arquivos**: `ConferenciaCarregamentoPage.tsx`, `OperacaoPage.tsx`, `CiclosPage.tsx`, `DriverRides.tsx`

### 2. Filtro de Rota na Conferência Carregamento (Anexo 2)

**Arquivo**: `ConferenciaCarregamentoPage.tsx`

- Alterar layout de 3 filtros (cada `sm:w-1/3`) para 4 filtros (cada `sm:w-1/4`)
- Adicionar novo filtro de rota como Popover/Command (dropdown com buscador), similar ao filtro de login
- Listar rotas extraídas dos `rides` carregados no dia (valores únicos do campo `route`)
- Filtrar `displayRides` pelo campo `route` quando selecionado

### 3. Modal de confirmação ao Iniciar carregamento (Anexo 3)

**Arquivo**: `ConferenciaCarregamentoPage.tsx`

- Adicionar estado `iniciarConfirmRideId: string | null`
- Ao clicar "Iniciar", setar `iniciarConfirmRideId` em vez de chamar `handleIniciar` diretamente
- Dialog perguntando se o conferente ativo (nome exibido) vai realmente conferir o carregamento daquele motorista
- Botão "Confirmar e Iniciar" que chama `handleIniciar(iniciarConfirmRideId)`

### 4. Contagem de TBRs por ciclo (Anexo 4 e 5)

**Arquivo**: `CiclosPage.tsx`

Na interface `DayMetrics`, adicionar:
- `cycle1Tbrs`, `cycle2Tbrs`, `cycle3Tbrs`: contagem de TBRs lidos nos carregamentos de cada ciclo
- Computar somando `ride_tbrs` dos rides que caem em cada corte temporal
- Exibir abaixo do número de carregamentos em cada card de ciclo
- No relatório (modal), exibir também abaixo da qtd de veículos

### 5. Linha do tempo de rastreamento TBR (Anexo 6)

**Arquivo**: `DashboardHome.tsx`

Substituir os badges de status (PS/RTO/DNR/Piso) por uma **linha do tempo cronológica**:

- Ao buscar um TBR, consultar **todas** as tabelas (ride_tbrs, piso_entries, ps_entries, rto_entries, dnr_entries) onde o código aparece
- Para cada registro, criar um evento com: hora, conferente (buscar via conferente_id), ação/status, motivo/motorista
- Ordenar cronologicamente e exibir como timeline vertical com linhas pontilhadas entre eventos
- Formato: `[HH:mm] [Conferente] — Status: Descrição`
- Exemplos de eventos:
  - "Origem: Conferência Carregamento (Motorista X)"
  - "Status: Insucesso — Removido do carregamento"
  - "Status: Carregado (Motorista Y)"
  - "Status: PS Aberto — Descrição"
  - "Status: RTO — Descrição"
  - "Status: DNR Aberto — R$50.00"

### Resumo de Arquivos

| Arquivo | Mudanças |
|---------|---------|
| `ConferenciaCarregamentoPage.tsx` | Filtro de rota + Modal Iniciar |
| `CiclosPage.tsx` | TBRs por ciclo nos cards e relatório |
| `DashboardHome.tsx` | Timeline de rastreamento TBR |
| `OperacaoPage.tsx` | Verificar contadores TBR |

