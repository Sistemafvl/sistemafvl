
# Plano de Correcoes e Melhorias

## 1. Corrigir exclusao de TBR (Anexo 1)

**Problema raiz:** O listener Realtime na linha 393 (`ride_tbrs`) nao tem filtro, entao qualquer mudanca em qualquer TBR dispara `fetchRides()`. Mesmo com `skipRealtimeRef`, o `fetchRides()` chamado na linha 451 (dentro do proprio `handleDeleteTbr`) pode estar re-buscando o TBR antes que o DELETE seja propagado no banco.

**Solucao:**
- Remover o `await fetchRides()` de dentro de `handleDeleteTbr`. A remocao otimista do estado ja e suficiente.
- Manter apenas o `fetchOpenRtos()` caso necessario.
- Aumentar o delay do `skipRealtimeRef` de 500ms para 2000ms para garantir que o Realtime nao traga o TBR de volta.
- Apos o timeout, chamar `fetchRides()` uma unica vez para sincronizar.

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (linhas 420-456)

---

## 2. Alerta sonoro para o motorista (sino)

**Problema:** O codigo do `DriverQueue.tsx` ja possui a logica de alerta sonoro (`triggerCallAlert` linha 197) e o listener Realtime (linha 169). O problema e que o `createAlertAudio()` usa Web Audio API que requer interacao do usuario para debloquear o `AudioContext` em browsers modernos.

**Solucao:**
- Ao detectar `called_at` atualizado, se o `AudioContext` estiver bloqueado (state === 'suspended'), tentar `resume()` antes de tocar.
- Adicionar fallback com `new Audio()` usando data URI de um beep caso o AudioContext falhe.
- Garantir que o toast persista com `duration: Infinity` e que o som so pare quando o toast for fechado (ja implementado, mas precisa funcionar sem interacao previa).
- Melhorar a funcao `startBeeping` para usar um unico `AudioContext` persistente com `resume()` em vez de criar um novo a cada beep.

**Arquivo:** `src/pages/driver/DriverQueue.tsx` (linhas 37-83, 197-215)

---

## 3. DNR - Dois botoes de finalizacao (com/sem desconto)

**Problema:** Atualmente existe apenas um botao "Finalizar". Precisa ser dividido em dois:
- "Finalizar sem desconto" (status = 'closed', discounted = false)
- "Finalizar com desconto" (status = 'closed', discounted = true)

**Solucao:**

### 3.1 Banco de Dados (Migration)
Adicionar coluna `discounted` (boolean, default false) na tabela `dnr_entries`.

### 3.2 DNRPage.tsx (Gerente)
- Substituir o botao "Finalizar" por dois botoes:
  - "Finalizar sem desconto" (verde/outline) - seta `status='closed'`, `discounted=false`
  - "Finalizar com desconto" (vermelho/destructive) - seta `status='closed'`, `discounted=true`

### 3.3 DriverDNR.tsx (Motorista)
- Buscar tambem DNRs com status = 'closed' e `discounted = true`.
- DNRs em analise: card amarelo com "Procure o gerente para tratar este DNR Urgente!"
- DNRs fechados com desconto: card vermelho com mensagem informando que o valor sera descontado do pagamento.

### 3.4 Relatorios - PayrollReportContent
- Na geracao do relatorio (`RelatoriosPage.tsx`), buscar DNRs `discounted=true` e `closed` do periodo para cada motorista.
- Subtrair o valor total de DNRs do `totalValue` do motorista.
- Adicionar linha/card no relatorio individual mostrando DNRs descontados.
- Adicionar coluna "DNR" na tabela resumo geral.

### 3.5 DriverPayrollData Interface
- Adicionar campo `dnrDiscount: number` (valor total de DNRs descontados).

**Arquivos:**
- Migration SQL (adicionar coluna `discounted`)
- `src/pages/dashboard/DNRPage.tsx` (botoes)
- `src/pages/driver/DriverDNR.tsx` (exibir descontados + mudar frase)
- `src/pages/dashboard/RelatoriosPage.tsx` (buscar DNRs no relatorio)
- `src/pages/dashboard/reports/PayrollReportContent.tsx` (exibir DNR no relatorio)

---

## 4. Traduzir textos em ingles para PT-BR

**Alteracoes:**
- `src/pages/driver/DriverDNR.tsx` linha 68: adicionar `import { ptBR } from "date-fns/locale"` e usar `{ locale: ptBR }` no `format(date, "EEEE")` para exibir "Sabado" em vez de "Saturday".
- Verificar e corrigir qualquer outro texto em ingles que apareça na interface (como "finished" nos cards de status da Conferencia).

**Arquivos:** `src/pages/driver/DriverDNR.tsx`, verificacao geral em outros componentes.

---

## 5. Mudar frase do motorista no DNR

**De:** "Procure o gerente para tratar este DNR antes que seja descontado."
**Para:** "Procure o gerente para tratar este DNR Urgente!"

**Arquivo:** `src/pages/driver/DriverDNR.tsx` (linha 73)

---

## Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Adicionar coluna `discounted` boolean na `dnr_entries` |
| `ConferenciaCarregamentoPage.tsx` | Fix exclusao TBR (remover fetchRides do handleDeleteTbr, aumentar delay) |
| `DriverQueue.tsx` | Melhorar audio alert com AudioContext.resume() e fallback |
| `DNRPage.tsx` | 2 botoes: "Finalizar com desconto" e "Finalizar sem desconto" |
| `DriverDNR.tsx` | Exibir DNRs descontados, traduzir dia para PT-BR, trocar frase |
| `RelatoriosPage.tsx` | Buscar DNRs descontados e subtrair do total do motorista |
| `PayrollReportContent.tsx` | Adicionar campo DNR no relatorio individual e resumo |

---

## Detalhes Tecnicos

### handleDeleteTbr corrigido:
```text
1. Adicionar ao deletingRef (bloquear duplo clique)
2. Setar skipRealtimeRef = true
3. Remover otimisticamente do estado
4. await supabase.delete (aguardar confirmacao)
5. await fetchOpenRtos()
6. deletingRef.delete
7. setTimeout 2000ms -> skipRealtimeRef = false, fetchRides()
```

### AudioContext fix:
```text
- Criar AudioContext uma unica vez
- Antes de tocar: verificar audioCtx.state === 'suspended' -> await audioCtx.resume()
- Fallback: usar Audio() com data URI base64 de um beep WAV
- setInterval com beep a cada 1.5s
```

### DNR no relatorio:
```text
- Buscar dnr_entries where unit_id, discounted=true, status='closed', periodo
- Agrupar por driver_id, somar dnr_value
- DriverPayrollData.dnrDiscount = soma
- totalValue = (totalCompleted * tbrValue) - dnrDiscount
- Exibir metricBox "DNR" com valor negativo em vermelho
- Na tabela resumo: coluna "DNR" com valor descontado
```
