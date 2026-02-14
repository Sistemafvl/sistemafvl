

## Melhorias na Conferencia Carregamento

### 1. Campo de Busca de TBR no Topo

Adicionar um campo de busca no topo da pagina, logo abaixo do titulo. Ao digitar um codigo TBR, a lista de cards sera filtrada para mostrar apenas o card que contem aquele TBR.

- Campo com icone de lupa e placeholder "Buscar TBR..."
- Filtragem em tempo real conforme o usuario digita
- Se nenhum card contem o TBR buscado, exibir mensagem "Nenhum resultado encontrado"
- Ao limpar o campo, todos os cards voltam a aparecer

### 2. Botao de Excluir TBR

Adicionar um icone X (vermelho) ao lado de cada TBR listado no card.

- Ao clicar, exclui o registro da tabela `ride_tbrs`
- Atualiza a lista instantaneamente com `fetchRides()`
- Disponivel tanto no status "loading" quanto "finished"

### 3. Leitura Automatica do TBR (sem Enter)

O campo de leitura de TBR deve gravar **automaticamente** assim que o scanner preencher o campo, sem necessidade de pressionar Enter.

**Logica:**
- Usar um `useEffect` ou `onChange` com debounce curto (~300ms) para detectar quando o campo foi preenchido
- Quando o valor estabilizar e nao estiver vazio:
  - Se comeca com "TBR": grava no banco imediatamente, limpa o campo
  - Se NAO comeca com "TBR": exibe toast de erro e toca som de erro (beep via Audio API)
- O campo mantem foco para leitura continua com scanner
- O debounce e necessario porque scanners digitam caractere por caractere rapidamente; 300ms garante que o codigo completo foi inserido antes de processar

### 4. Tempo Total de Conferencia

Apos a linha de "Termino", exibir o tempo total da conferencia.

- Calculado como diferenca entre `finished_at` e `started_at`
- Formato: "Duracao: Xh Xmin" ou "Duracao: X min"
- So aparece quando ambos `started_at` e `finished_at` existem
- Icone de relogio com cor azul

### 5. Filtro de Data com Calendario

Adicionar no topo da pagina (ao lado do campo de busca TBR) um filtro de periodo com dois datepickers:

- Botao "Data Inicio" e "Data Fim" usando Popover + Calendar (Shadcn)
- Padrao: data de hoje para ambos
- Ao selecionar datas, a query `fetchRides` filtra por `completed_at` entre data inicio (00:00) e data fim (23:59:59)
- Permite consultar carregamentos de dias anteriores

---

### Detalhes Tecnicos

**Arquivo modificado:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**Novos estados:**
- `tbrSearch: string` -- campo de busca global
- `startDate: Date` e `endDate: Date` -- filtro de periodo (default: hoje)

**Leitura automatica TBR (sem Enter):**
```text
onChange -> atualiza estado do input
useEffect com debounce de 300ms no valor do input:
  - se vazio: nada
  - se comeca com "TBR": insert no banco, limpa campo, fetchRides()
  - se NAO comeca com "TBR": toast.error + som de erro, limpa campo
```

O `onKeyDown` com Enter sera removido. Toda a logica passa para o debounce no `onChange`.

**Exclusao TBR:**
```text
handleDeleteTbr(tbrId):
  await supabase.from("ride_tbrs").delete().eq("id", tbrId)
  await fetchRides()
```

**Filtro de busca TBR:**
- No render, se `tbrSearch` nao esta vazio, filtra `rides` para mostrar apenas os que tem TBRs contendo o codigo buscado

**Filtro de data:**
- `fetchRides` usa `startDate` e `endDate` no lugar de calcular "hoje"
- `.gte("completed_at", startDate.toISOString())` e `.lte("completed_at", endDate.toISOString())`

**Duracao:**
- `differenceInMinutes(new Date(finished_at), new Date(started_at))`
- Se >= 60: "Xh Xmin", senao "X min"

**Imports adicionais:** `Search, X, CalendarIcon, Timer` do lucide-react; `Popover, PopoverTrigger, PopoverContent` e `Calendar` do shadcn; `toast` do sonner; `differenceInMinutes` do date-fns

