
# Melhorias na Conferencia de Carregamento e Visao do Motorista

## 1. Botoes Cancelar/Trocar visiveis para funcionarios (com senha do gerente)

Atualmente os botoes "Cancelar" e "Trocar" so aparecem quando ha `managerSession`. A mudanca e remover essa condicao e sempre exibir os botoes, porem ao clicar em qualquer um deles, o sistema pedira a senha do gerente (`manager_password`) antes de prosseguir.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Linha 1074: remover a condicao `managerSession &&`
- No "Cancelar": ja pede senha (modal existente funciona)
- No "Trocar": adicionar um modal intermediario pedindo senha do gerente antes de abrir o modal de busca

---

## 2. Scroll automatico para o ultimo TBR lido

A lista de TBRs tem `max-h-32 overflow-y-auto`. Apos cada escaneamento, o scroll deve ir automaticamente para o final da lista.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Adicionar `useRef` para o container da lista de TBRs (por `rideId`)
- Apos `saveTbr` ser executado com sucesso, fazer `scrollTop = scrollHeight` no container

---

## 3. Leitura mais rapida + Deteccao de duplicata + Bug de exclusao

### Velocidade de leitura
- Reduzir o debounce de 150ms para **80ms** para gravar ainda mais rapido

### Deteccao de duplicata
- A logica de duplicata ja existe (count === 1 marca vermelho). Apenas confirmar que o debounce reduzido permite captura mais rapida de leituras consecutivas.

### Bug de exclusao (TBR volta apos clicar no X)
- **Causa raiz:** A funcao `handleDeleteTbr` faz update otimista no state, mas logo depois chama `fetchRides()` que refaz o fetch do banco. Se o DELETE nao completou antes do fetch, o TBR reaparece.
- **Solucao:** Usar `await` no delete e so entao fazer o fetch. Adicionar um `ref guard` para evitar cliques duplos. Remover o fetch automatico via realtime durante a exclusao para evitar race condition.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Linha 407-433: Refatorar `handleDeleteTbr` com guard ref e aguardar confirmacao do banco antes de chamar `fetchRides()`

---

## 4. Campo TBR travado para digitacao (modo scanner padrao)

O input de TBR deve ficar com `readOnly` quando estiver em modo scanner (padrao). Apenas ao clicar no icone de teclado (modo manual) o campo fica editavel para digitacao.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Linha 1158-1166: Adicionar `readOnly={!manualMode[ride.id]}` ao Input
- No modo scanner, o input aceita dados do scanner (que simula teclas) mas bloqueia digitacao manual -- na verdade, scanners injetam keystrokes, entao `readOnly` nao funciona. A solucao correta e: no modo scanner, o `onChange` so aceita mudancas de mais de 3 caracteres de uma vez (scanner envia tudo rapido), ou aceitar qualquer input mas so processar via debounce. Manter o campo editavel pois scanners precisam dele, mas adicionar um indicador visual de "bloqueado" e desabilitar o Enter manual.

**Alternativa mais pratica:** No modo scanner, o campo funciona normalmente (scanner injeta caracteres), mas pressionar Enter nao faz nada (so o debounce salva). No modo manual, o debounce e desabilitado e so Enter salva. Isso ja esta implementado. Para reforcar visualmente, adicionar um icone de cadeado e cor diferente no modo scanner.

---

## 5. Travar selecao de conferente apos escolha

Apos o conferente ser selecionado, o `Select` deve ficar desabilitado para o funcionario. Apenas o gerente pode alterar.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Linha 1037: Adicionar `disabled={!!ride.conferente_id && !managerSession}` ao Select
- Visualmente, o select travado fica com opacidade reduzida e cursor not-allowed

---

## 6. Icone de alerta para chamar motorista (com som e toast)

Adicionar um icone de alerta (sino/megafone) abaixo do contador de TBR no card. Ao clicar:
1. O sistema marca o `queue_entry` do motorista com um campo de notificacao (usaremos o campo `called_at` para sinalizar)
2. Na visao do motorista (`DriverQueue.tsx`), quando `called_at` for preenchido, exibir um toast persistente de alerta e tocar um som alto em loop ate o motorista fechar o toast
3. O som deve funcionar em segundo plano (criar Audio element no contexto de gesto do usuario)

### Conferencia (lado do operador)
**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Adicionar icone `Bell` ou `Megaphone` abaixo do badge de TBR count (top-left do card)
- Ao clicar, atualizar `queue_entries.called_at = now()` para o `queue_entry_id` da ride

### Motorista (lado do driver)
**Arquivo:** `src/pages/driver/DriverQueue.tsx`
- Monitorar mudancas no `queue_entries` via realtime
- Quando `called_at` for preenchido e o motorista estiver na fila:
  - Exibir toast persistente (variant destructive, sem auto-dismiss)
  - Tocar som de alerta em loop (beep alto)
  - O som continua mesmo em segundo plano (unlock audio no gesto)
  - Ao fechar o toast, o som para

---

## Resumo dos arquivos modificados

1. **`src/pages/dashboard/ConferenciaCarregamentoPage.tsx`**
   - Botoes Cancelar/Trocar visiveis para todos (senha pedida ao clicar)
   - Auto-scroll na lista de TBRs
   - Debounce reduzido para 80ms
   - Fix do bug de exclusao (guard ref + await)
   - Input TBR: visual de modo scanner vs manual
   - Select de conferente travado apos selecao (exceto gerente)
   - Icone de alerta para chamar motorista

2. **`src/pages/driver/DriverQueue.tsx`**
   - Toast persistente + som em loop quando chamado
   - Monitoramento realtime do `called_at`
