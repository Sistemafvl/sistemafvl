

## Plano — 3 Correções no Painel do Motorista

### 1. Contador de Posição na Fila errado

**Causa raiz**: A query em `fetchActiveRide` calcula `queuePosition` contando `driver_rides` com `loading_status IN ('pending','loading')` e `completed_at <= ride.completed_at`. O problema é que `completed_at` é o timestamp de criação do ride (default `now()`), e a comparação `<=` inclui o próprio registro. Mas além disso, rides de **outros dias** ou rides **cancelados** que ainda não tiveram `loading_status` atualizado podem estar inflando a contagem.

**Correção** em `DriverQueue.tsx`:
- Adicionar filtro `.gte("completed_at", today.toISOString())` para considerar apenas rides do dia atual (mesmo filtro já usado na query do próprio ride)
- Usar `.lt("completed_at", ride.completed_at)` + somar 1, em vez de `.lte()`, para garantir que a posição seja baseada em quantos vieram **antes**, não incluindo duplicatas com mesmo timestamp
- Alternativa mais simples e confiável: usar `sequence_number` diretamente — contar quantos rides pendentes/loading do dia têm `sequence_number` menor ou igual ao do motorista

```typescript
// Corrigido: contar apenas rides do dia com sequence <= meu
const { count } = await supabase
  .from("driver_rides")
  .select("*", { count: "exact", head: true })
  .eq("unit_id", ride.unit_id)
  .in("loading_status", ["pending", "loading"])
  .gte("completed_at", today.toISOString())
  .lte("sequence_number", ride.sequence_number);
setQueuePosition(count ?? null);
```

### 2. Texto informativo sobre Amazon Flex acima do Login

**Correção** em `DriverQueue.tsx`:
- Adicionar um parágrafo informativo entre a Rota e o Login, explicando que o login e senha são para o Amazon Flex e que após finalizar o carregamento, podem ser consultados em "Corridas" no menu.

### 3. Vibração ao chamar motorista + UI "Sua Vez!"

O mecanismo de chamada já existe (`called_at` + `triggerCallAlert` com beep sonoro). Precisa adicionar:

**No `triggerCallAlert`**:
- Chamar `navigator.vibrate([500, 200, 500, 200, 500])` em loop (intervalo de 2s) para vibrar o celular continuamente
- Parar vibração quando motorista clicar "Ciente"

**Na UI do card de Posição na Fila** (quando `called_at` existe):
- Mudar o texto de "Xº" para "Xº - Sua Vez!" com destaque amarelo/vermelho pulsante
- Adicionar botão "Ciente" que:
  - Para a vibração (`navigator.vibrate(0)`)
  - Para o beep sonoro
  - Fecha o toast
  - Limpa o `called_at` no banco (ou apenas localmente)

**No card de carregamento ativo** (view `activeRide`):
- O campo `called_at` já é gerido pela ConferenciaCarregamentoPage (botão sino). Quando o `called_at` é setado e o motorista tem activeRide, mostrar a posição com "Sua Vez!" + vibração

### Arquivos afetados
1. `src/pages/driver/DriverQueue.tsx` — todas as 3 correções

