
# Plano de Correcoes - 3 Itens

## 1. Filtros de busca na pagina RTO (Anexo 1)

**Arquivo:** `src/pages/dashboard/RTOPage.tsx`

Adicionar filtros de busca na listagem de entradas RTO existentes, alem do campo de input para novo TBR:

- Adicionar um campo de busca textual abaixo do input de novo TBR (ou acima da tabela) com placeholder "Buscar por TBR, rota, conferente, CEP..."
- O filtro atua localmente sobre `entries`, filtrando por:
  - `tbr_code` (contém)
  - `route` (contém) 
  - `conferente_name` (contém)
  - `cep` (contém)
  - `description` (contém)
  - `driver_name` (contém)
- Estado: `searchFilter` string
- A paginacao deve operar sobre os resultados filtrados

## 2. Botao de editar NF no Recebiveis do Motorista (Anexo 2)

**Arquivo:** `src/pages/driver/DriverRecebiveis.tsx`

Quando o motorista ja enviou a NF (`invoiceUploaded === true`), atualmente so exibe "NF Enviada: nome.pdf". O usuario precisa de um botao para reenviar caso tenha anexado errado.

- Na secao onde `entry.invoiceUploaded` e true (linhas 173-176), adicionar um botao "Editar" (icone Pencil) ao lado do texto "NF Enviada"
- Ao clicar, abre um input file identico ao de upload original
- Ao selecionar novo arquivo, chama `handleUpload(entry.reportId, file)` que ja trata o caso de update (linhas 108-111 verificam `existing` e fazem UPDATE)
- O fluxo de upload ja esta preparado para substituir o arquivo existente

## 3. Fix definitivo da exclusao de TBR (Anexo 3 e 4) - URGENTE

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**Problema raiz identificado:** O `handleDeleteTbr` (linha 426) aguarda todas as operacoes e chama `fetchRides()`, mas logo apos (linhas 497-498) limpa o `deletingRef` e desativa o `skipRealtimeRef`. O problema e que eventos Realtime sao **asincronos** - eles podem chegar a qualquer momento apos as operacoes de banco (piso_entries insert, rto_entries update). Quando o `skipRealtimeRef` e resetado para `false` na linha 498, eventos Realtime pendentes que ja estavam na fila sao processados e chamam `fetchRides()` novamente, agora SEM o filtro do `deletingRef` (ja foi limpo).

**Solucao:**
- Adicionar um **delay de seguranca** (1500ms) APOS o `fetchRides()` completar, ANTES de limpar `deletingRef` e resetar `skipRealtimeRef`
- Isso garante que quaisquer eventos Realtime em cascata (provocados pelo insert em piso_entries ou update em rto_entries) sejam ignorados pelo `skipRealtimeRef` que ainda esta ativo
- O `deletingRef` permanece preenchido durante esse periodo, servindo como filtro de seguranca extra no `fetchRides` (linha 275)
- Tambem adicionar listener de DELETE no canal Realtime para ride_tbrs (atualmente so escuta INSERT e UPDATE) - sem isso, o Supabase nao notifica o cliente sobre delecoes, forçando re-fetches desnecessarios

**Logica revisada:**
```
handleDeleteTbr:
  1. Add to deletingRef, skip realtime
  2. Optimistic UI removal
  3. await DELETE from ride_tbrs
  4. await create/reopen piso_entry
  5. await reopen RTO if exists
  6. await fetchOpenRtos()
  7. await fetchRides()  // filtra via deletingRef (linha 275)
  8. await delay(1500ms) // espera eventos Realtime em cascata passarem
  9. deletingRef.delete(tbrId)
  10. skipRealtimeRef = false
```

Tambem no canal Realtime (linhas 393-398):
- Adicionar listener para DELETE em `ride_tbrs` que tambem verifica `skipRealtimeRef`

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `RTOPage.tsx` | Adicionar campo de busca/filtro na listagem de entradas |
| `DriverRecebiveis.tsx` | Botao editar para reenviar NF de servico |
| `ConferenciaCarregamentoPage.tsx` | Delay pos-fetchRides antes de limpar refs + listener DELETE |
