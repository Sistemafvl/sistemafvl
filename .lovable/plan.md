

## Plano: Modo Foco ao Iniciar Bipagem

### Análise do problema atual
Hoje, quando o Conferente A clica "Iniciar" num card, o `loading_status` muda no banco via Realtime e o `fetchRides` re-renderiza toda a lista. Se o Conferente B (em outra aba/sessão) clica "Iniciar" em outro card, o Realtime dispara `fetchRides` no Conferente A também, podendo deslocar o carrossel ou mudar o foco do input de bipagem.

O seletor de conferente já resolve o **conflito de dados** (cada card tem seu conferente travado). Porém, o **conflito visual** (tela se movendo, input perdendo foco) ainda pode ocorrer porque o Realtime re-renderiza tudo.

### Solução: Modo Foco (Overlay)
Ao clicar "Iniciar", o card entra em **modo foco**: aparece centralizado na tela sobre um fundo escuro (overlay), isolando visualmente a bipagem. O conferente bipa apenas naquele card, sem interferência visual de outros.

### Isso resolve?
**Sim, completamente.** O overlay captura o foco do teclado e isola o input de bipagem. Mesmo que o Realtime atualize outros cards no fundo, o conferente não vê e não é afetado. Cada conferente (em sua máquina/aba) terá seu próprio overlay com seu próprio card.

---

### Mudanças

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

1. **Novo estado `focusedRideId: string | null`** — armazena o ID do ride em modo foco.

2. **`handleIniciar` atualizado** — após iniciar, seta `setFocusedRideId(rideId)` para ativar o overlay automaticamente.

3. **Overlay de foco** — Renderizar um `Dialog` (ou div fixa com z-50) quando `focusedRideId` estiver definido:
   - Fundo escuro semi-transparente (`bg-black/60`)
   - Card do motorista renderizado no centro, com largura máxima (~480px)
   - Contém todos os elementos: info do motorista, lista de TBRs, input de bipagem, botão Finalizar
   - Input de bipagem recebe `autoFocus` automaticamente
   - Botão "Minimizar" ou "X" para sair do modo foco e voltar ao carrossel

4. **Botão para entrar em modo foco manualmente** — Nos cards que já estão "em andamento", adicionar um ícone de "expandir" para reentrar no modo foco caso o conferente tenha saído.

5. **Ao Finalizar, sair do foco** — `handleFinalizar` seta `setFocusedRideId(null)` após finalizar.

6. **Realtime não afeta o overlay** — O card no overlay usa os mesmos estados `rides` e `tbrs`, então os dados ficam atualizados, mas o layout do overlay é fixo e não se move.

### Layout do Modo Foco
```text
┌──────────────────────────────────────────────┐
│             FUNDO ESCURO (overlay)            │
│                                               │
│    ┌───────────────────────────────────┐      │
│    │  [Avatar] Motorista Nome          │      │
│    │  Placa · Modelo · Cor             │      │
│    │  Rota: 0825  Login: xxx           │      │
│    │  Conferente: Ricardo (🔒)         │      │
│    │                                   │      │
│    │  TBRs Lidos (45)                  │      │
│    │  ┌─────────────────────────────┐  │      │
│    │  │ 1. ABC123  10:30:45.123    │  │      │
│    │  │ 2. DEF456  10:30:47.456    │  │      │
│    │  │ ...                        │  │      │
│    │  └─────────────────────────────┘  │      │
│    │  [ Escanear TBR... ] [📷] [⌨️]   │      │
│    │                                   │      │
│    │  [🔴 Finalizar]    [↙ Minimizar] │      │
│    └───────────────────────────────────┘      │
│                                               │
└──────────────────────────────────────────────┘
```

