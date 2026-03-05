

## Plano — 3 Correções: Alerta Sonoro, Notificação Global, Performance em Operação

### 1. Bug: Alerta dispara ao carregar a página (não apenas no sino)

**Causa raiz**: Em `DriverQueue.tsx`, `lastCalledAtRef` inicia como `null`. Quando o motorista abre a página e o `queue_entry` já tem `called_at` (de qualquer momento anterior), a condição `called_at !== null` dispara o alerta imediatamente.

**Correção** em `DriverQueue.tsx`:
- Na primeira execução de `fetchActiveRide` e `fetchQueue`, apenas **gravar** o `called_at` atual em `lastCalledAtRef` sem disparar o alerta. Usar um `initialLoadDoneRef` para distinguir o primeiro fetch dos subsequentes.
- O alerta só dispara quando `called_at` **muda** após o carregamento inicial (ou seja, quando o conferente clica no sino em tempo real).

### 2. Som toca apenas uma vez — deve ser loop contínuo + vibração

**Causa**: O `createAlertAudio` com `startBeeping` já implementa intervalo de 1.5s, mas o `triggerCallAlert` é chamado múltiplas vezes (tanto em `fetchActiveRide` quanto em `fetchQueue`), e a condição de guarda `if (isPlaying) return` pode estar conflitando.

**Correção**: Verificar que `startBeeping` realmente mantém o loop ativo. O som e vibração devem persistir até o clique em "Ciente". Garantir que não há chamadas duplicadas quebrando o intervalo.

### 3. Alerta deve funcionar em QUALQUER tela do motorista (não só na Fila)

**Causa**: A lógica de polling de `called_at` só existe em `DriverQueue.tsx`. Se o motorista está em Visão Geral ou outra tela, não recebe o alerta.

**Correção**:
- Mover a lógica de detecção de chamada para o `DriverLayout.tsx` (componente wrapper de todas as telas do motorista).
- Criar um componente `DriverCallAlert` que:
  - Faz polling do `queue_entry` com `called_at` via realtime subscription
  - Toca beep contínuo + vibração quando detecta nova chamada
  - Mostra overlay/banner fixo com "Sua Vez!", nome do conferente e botão "Ciente"
  - Funciona independente da rota atual

### 4. Operação: Performance deve mostrar total original (incluindo insucessos removidos)

**Causa**: `total_tbrs` conta apenas TBRs restantes em `ride_tbrs`. Quando um insucesso é registrado, o TBR é deletado de `ride_tbrs`, reduzindo o `total_tbrs`. O usuário quer ver `8/9` (8 concluídos de 9 originais).

**Correção** em `OperacaoPage.tsx`:
- Calcular `total_original = total_tbrs + piso_returns` (TBRs atuais + insucessos válidos)
- `concluidos = total_original - piso_returns` (que é simplesmente `total_tbrs` atual)
- Exibir `concluidos/total_original` em vez de `concluidos/total_tbrs`
- Performance = `concluidos / total_original * 100`

Na prática: `total_original = c.total_tbrs + c.piso_returns`, exibir `{c.total_tbrs}/{total_original}` e calcular performance como `(c.total_tbrs / total_original) * 100`.

### Arquivos afetados
1. `src/pages/driver/DriverQueue.tsx` — corrigir detecção inicial de `called_at`
2. `src/components/dashboard/DriverLayout.tsx` — adicionar componente de alerta global
3. `src/pages/dashboard/OperacaoPage.tsx` — ajustar cálculo de performance

