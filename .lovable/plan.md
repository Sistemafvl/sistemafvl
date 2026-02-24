

# Correcao de 3 Problemas: Sequencia, Camera QR e Toasts

## Problema 1 — Sequencia de Carregamento comecando em #4

**Causa raiz**: A edge function `create-ride-with-login` calcula o numero sequencial usando `new Date()` com `setHours(0, 0, 0, 0)`, que usa **meia-noite UTC** (21:00 do dia anterior no Brasil). Isso faz com que carregamentos do dia anterior (entre 21:00 e 23:59 horario de Brasilia) sejam contados como "hoje", inflando a sequencia.

**Exemplo**: Se ontem houve 3 carregamentos apos as 21h (horario de Brasilia), o `count` retorna 3 e o primeiro carregamento de hoje comeca em #4.

**Solucao**: Usar meia-noite no fuso horario de Brasilia (03:00 UTC) na edge function para calcular o inicio do dia.

### Arquivo: `supabase/functions/create-ride-with-login/index.ts`

Substituir o calculo do dia:
```typescript
// ANTES (UTC midnight = 21:00 Brazil)
const today = new Date();
today.setHours(0, 0, 0, 0);

// DEPOIS (Brazil midnight = 03:00 UTC)
const now = new Date();
const brStr = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
const brNow = new Date(brStr);
const yyyy = brNow.getFullYear();
const mm = String(brNow.getMonth() + 1).padStart(2, "0");
const dd = String(brNow.getDate()).padStart(2, "0");
const todayStart = `${yyyy}-${mm}-${dd}T03:00:00.000Z`;
```

---

## Problema 2 — Camera nao le QR Code

**Causa raiz**: O `BarcodeDetector` ja inclui `"qr_code"` nos formatos, porem faltam formatos comuns em etiquetas de transporte: `"data_matrix"` e `"pdf417"`. Alem disso, o cooldown de 3 segundos entre leituras do mesmo codigo pode parecer lento.

**Solucao**: 
- Adicionar `"data_matrix"` e `"pdf417"` aos formatos do detector
- Reduzir o cooldown de 3000ms para 1500ms para leitura mais responsiva

### Arquivo: `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Na inicializacao do BarcodeDetector (linha 266):
```typescript
// Adicionar data_matrix e pdf417
const detector = new BarcodeDetector({ 
  formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", 
            "data_matrix", "pdf417", "codabar", "itf", "upc_a", "upc_e"] 
});
```

No cooldown (linha 277): Reduzir de 3000 para 1500.

---

## Problema 3 — Toasts nao aparecem

**Causa raiz**: Todo o `ConferenciaCarregamentoPage` usa `await import("@/hooks/use-toast")` — que e o sistema de toast **Radix** (shadcn). Porem, o `App.tsx` (linha 40) so inclui o `<Toaster />` do **Sonner**, nao o componente `<Toaster />` do Radix (`src/components/ui/toaster.tsx`). Sem esse componente montado, os toasts do Radix sao disparados mas nunca renderizados.

**Solucao**: Adicionar o `<Toaster />` do Radix no `App.tsx` ao lado do Sonner.

### Arquivo: `src/App.tsx`

```typescript
import { Toaster } from "./components/ui/sonner";
import { Toaster as RadixToaster } from "./components/ui/toaster"; // Adicionar

const App = () => (
  <QueryClientProvider client={queryClient}>
    <OfflineIndicator />
    <Toaster />
    <RadixToaster />  {/* Adicionar */}
    <BrowserRouter>
      ...
    </BrowserRouter>
  </QueryClientProvider>
);
```

---

## Problema 2b — Delay no celular ao gravar TBR

**Causa raiz**: A funcao `saveTbr` faz multiplas queries sequenciais antes de confirmar a leitura (verifica carregamento ativo, verifica piso, fecha piso, fecha RTO, insere TBR). No celular com conexao mais lenta, isso gera delay perceptivel.

**Solucao**: Aplicar atualizacao otimista — adicionar o TBR na lista imediatamente e fazer as queries em background, igual ja e feito no delete.

### Arquivo: `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Na funcao `saveTbr`, mover o `setTbrs` (linha 682-685) para **antes** das queries de verificacao, e fazer as queries de piso/RTO em paralelo com `Promise.all`.

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/create-ride-with-login/index.ts` | Usar fuso de Brasilia para calculo de sequencia |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Adicionar formatos data_matrix/pdf417, reduzir cooldown, otimizar saveTbr |
| `src/App.tsx` | Adicionar RadixToaster para exibir notificacoes |

