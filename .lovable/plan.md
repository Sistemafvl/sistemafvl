

## Plano: Substituir "TBRs Final" por Contador Amarelo + Botão Insucesso em Lote

### Contexto

**Anexo 1:** O contador verde "TBRs Final" será removido. No lugar, um contador amarelo mostrando quantos TBRs foram marcados com highlight amarelo (bipados 3+ vezes). Confirmo: quando um TBR vai para insucessos (piso_entries), o trigger `auto_remove_tbr_from_ride` já remove automaticamente da `ride_tbrs`, descontabilizando do carregamento.

**Anexo 2:** Criar um botão ao lado do "TBRs Lidos" para lançar insucessos em lote. O conferente seleciona TBRs via checkbox, clica no botão, escolhe o motivo, e todos são enviados para piso_entries (insucessos).

---

### 1. Remover "TBRs Final" e adicionar contador "Reincidências" (amarelo)

Em `ConferenciaCarregamentoPage.tsx`, nos dois locais onde aparece "TBRs Final" (card normal ~linha 2019 e focus mode ~linha 2194):

- Remover o bloco condicional do "TBRs Final" verde
- Adicionar um contador amarelo: `⚠ Reincidências (X)` — conta TBRs com `_yellowHighlight === true` no array `rideTbrs`/`focusedTbrs`

### 2. Botão "Insucesso Lote" na área de TBRs

Ao lado do indicador "TBRs Lidos", adicionar um botão pequeno (ícone `AlertTriangle`) que aparece quando há TBRs selecionados via checkbox.

**Fluxo:**
1. Conferente marca checkboxes nos TBRs desejados (já existem checkboxes!)
2. Clica no botão "Insucesso Lote"
3. Modal abre com lista de motivos (mesmos `DEFAULT_REASONS` + `piso_reasons` customizados da unidade)
4. Escolhe o motivo → confirma
5. Para cada TBR selecionado: insere em `piso_entries` com o motivo escolhido (o trigger `auto_remove_tbr_from_ride` remove automaticamente da `ride_tbrs`)
6. Atualiza a UI

**Detalhes técnicos:**
- Novo state: `showBatchInsucessoModal`, `batchInsucessoRideId`, `batchInsucessoReason`, `batchInsucessoLoading`
- Carregar motivos: buscar `piso_reasons` da unidade + `DEFAULT_REASONS`
- No insert de cada TBR: `{ tbr_code, unit_id, reason, driver_name, route, ride_id, conferente_id }`
- Após inserção, limpar seleção e re-fetch rides

### Arquivos afetados
1. `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` — remover "TBRs Final", adicionar contador amarelo, adicionar botão + modal de insucesso em lote

