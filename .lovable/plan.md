

## Plano: Corrigir destaque vermelho indevido + Inverter ordem dos TBRs

### Problema 1: TBR vermelho indevido
Quando um TBR é excluído de um motorista (cria `piso_entry` com `status: "open"`), e depois escaneado em outro motorista, o sistema fecha a `piso_entry`. Porém, há uma condição de corrida: o destaque vermelho é baseado no Set `pisoTbrCodes` (atualizado via realtime), que pode não ter sido atualizado no momento da renderização. Resultado: TBR aparece vermelho mesmo estando no carregamento ativo.

**Correção**: Na função `getTbrItemClass`, verificar se o TBR pertence ao carregamento atual antes de aplicar o destaque vermelho do piso. Se o TBR está em `ride_tbrs` do ride atual, ele NÃO deve ficar vermelho por causa de piso — pois foi escaneado e a piso_entry deveria estar fechada. A forma mais simples: a função já recebe o `tbr` que pertence ao ride, então basta verificar se esse TBR tem `trip_number >= 2` (reincidência) — caso tenha, o sistema já o categorizou como reincidência, não como retorno pendente.

Na verdade, a correção mais robusta: **excluir do `pisoTbrCodes` os códigos que estão atualmente em `ride_tbrs` de qualquer ride ativo**. Porém, isso é complexo. A solução mais simples e eficaz: na `getTbrItemClass`, não aplicar vermelho do piso se o TBR está sendo exibido dentro de um carregamento (ele está no ride, logo não é "pendente no piso"). Precisamos passar o contexto do ride para a função.

**Implementação**: Adicionar um parâmetro `rideId` à `getTbrItemClass`. Dentro da função, verificar se o TBR pertence ao ride atual consultando o estado `tbrs`. Se pertence, pular o check de `pisoTbrCodes`.

Alternativa mais simples: O TBR está na lista do ride — ele foi escaneado e está ativo. Se está ativo, a piso_entry deveria estar fechada. O problema é só timing do realtime. Solução: **simplesmente não marcar como vermelho se o TBR está na lista do ride ativo (status loading/pending)**. Para isso, coletar todos os códigos de TBRs ativos e excluí-los do check.

**Solução final escolhida**: Modificar `getTbrItemClass` para aceitar um parâmetro opcional `isInActiveRide: boolean`. Nos locais onde renderizamos TBRs dentro de um card de carregamento ativo, passar `true`. Quando `isInActiveRide` é `true`, pular o check de `pisoTbrCodes`.

### Problema 2: Inverter ordem dos TBRs
Atualmente os TBRs são ordenados por `scanned_at ascending` (primeiro bipado em cima). O usuário quer o último bipado em primeiro.

**Arquivos afetados**:

1. **`ConferenciaCarregamentoPage.tsx`**:
   - Alterar as 3 queries de `ride_tbrs` que usam `.order("scanned_at", { ascending: true })` para `ascending: false`
   - Ajustar a numeração `{i + 1}.` para contar do total para baixo: `{rideTbrs.length - i}.`
   - Modificar `getTbrItemClass` para não aplicar vermelho do piso quando o TBR está em um ride ativo
   - Ajustar o auto-scroll para ir ao **topo** da lista (já que o último bipado estará em primeiro)

2. **`OperacaoPage.tsx`** (modal de detalhes):
   - Alterar query de `ride_tbrs` no modal: `.order("scanned_at", { ascending: false })`
   - Na lógica de `hasReturn`: não marcar como vermelho se o TBR está no `ride_tbrs` do ride atual (já está correto pois cruza com returnSet que foi corrigido anteriormente)

### Mudanças detalhadas

**ConferenciaCarregamentoPage.tsx**:
- L412: `ascending: true` → `ascending: false`
- L460: `ascending: true` → `ascending: false`  
- L514: `ascending: true` → `ascending: false`
- `getTbrItemClass`: adicionar parâmetro `isInActiveRide?: boolean`, pular check `pisoTbrCodes` quando `true`
- L1739, L1895: Numeração `{rideTbrs.length - i}.` em vez de `{i + 1}.`
- Auto-scroll: `el.scrollTop = 0` em vez de `el.scrollHeight`

**OperacaoPage.tsx** (modal):
- L314: `ascending: true` → `ascending: false`

