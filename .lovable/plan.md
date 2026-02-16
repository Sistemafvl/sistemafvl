
# 4 Melhorias no Sistema

## 1. Etiqueta de Tentativa no Retorno Piso (Anexo 1)

No modal do Retorno Piso, ao escanear um TBR, o sistema ja busca o historico de carregamentos anteriores (`ride_tbrs`). Vamos consultar o `trip_number` do TBR mais recente e exibir uma etiqueta/badge no canto superior direito do modal (onde o usuario sinalizou no screenshot):

- **2a tentativa**: Badge roxa "2a tentativa"
- **3a tentativa**: Badge laranja "3a tentativa"
- **4a+ tentativa**: Badge vermelha "4a+ tentativa"
- **1a tentativa** (ou sem historico): Nenhuma etiqueta

A logica: ao buscar o `ride_tbrs` para rastreio, tambem consultar o `trip_number` do registro mais recente. Se `trip_number >= 2`, exibir a badge correspondente.

**Arquivo**: `src/pages/dashboard/RetornoPisoPage.tsx`

---

## 2. Check Verde nos Cards Finalizados (Anexo 2)

Na pagina de Conferencia Carregamento, quando o card tem status `finished`, adicionar um icone de check verde (`CheckCircle`) no canto superior direito do card, proximo ao badge do numero de sequencia.

**Arquivo**: `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

---

## 3. Aspas nos Comentarios de Feedbacks (Anexo 3)

Na pagina de Feedbacks, os comentarios das avaliacoes serao envolvidos por aspas duplas para diferenciar visualmente o texto do comentario. Tambem sera adicionada a bio do motorista com formatacao distinta (ja existe com `border-l-2`, mantemos). O comentario passara de `{rev.comment}` para `"{rev.comment}"`.

**Arquivo**: `src/pages/dashboard/FeedbacksPage.tsx`

---

## 4. Tres Novos Slots de Upload (Outros 1, 2, 3) (Anexo 4)

Na pagina de Documentos do motorista, adicionar 3 novos tipos de documento ao array `DOC_TYPES`: "Outros 1", "Outros 2" e "Outros 3" com valores `outros_1`, `outros_2`, `outros_3`. O fluxo de upload, visualizacao e exclusao ja funciona genericamente baseado no `doc_type`, entao basta adicionar os itens ao array.

**Arquivo**: `src/pages/driver/DriverDocuments.tsx`

---

## Detalhes Tecnicos

### RetornoPisoPage.tsx
- Adicionar campo `trip_number` na interface `TbrTrackInfo`
- Na busca do `ride_tbrs`, incluir `trip_number` no select e propagar ao estado
- No modal, renderizar Badge colorida ao lado do titulo quando `trip_number >= 2`

### ConferenciaCarregamentoPage.tsx
- No bloco do card (linha ~839), quando `isFinished === true`, adicionar `<CheckCircle className="h-5 w-5 text-green-600" />` proximo aos badges existentes

### FeedbacksPage.tsx
- Linha 223: alterar `{rev.comment}` para `"{rev.comment}"`

### DriverDocuments.tsx
- Linha 20-24: adicionar 3 entradas ao array `DOC_TYPES`
