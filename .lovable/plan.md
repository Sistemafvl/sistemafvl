

# Redesign Profissional do Painel de Chamada

## Layout (3 colunas)

```text
┌──────────────┬──────────────────────────────┬──────────────────┐
│  SIDEBAR     │       AREA CENTRAL           │  COLUNA DIREITA  │
│  ESQUERDA    │                              │                  │
│  (~250px)    │   (idle) Logos rotacionando   │  Relogio digital │
│  bg #001529  │   (call) Card motorista      │  Nome unidade    │
│              │                              │                  │
│  Logo FVL    │                              │  Lista da fila   │
│  ─────────   │                              │  (pos, nome,     │
│  CICLOS      │                              │   status)        │
│  C1/C2/C3    │                              │                  │
│  horarios    │                              │ ┌──────────────┐ │
│              │                              │ │ ULTIMAS      │ │
│  Metricas:   │                              │ │ CHAMADAS     │ │
│  TBRs dia    │                              │ │ motorista    │ │
│  Motoristas  │                              │ │ conferente   │ │
│  Na fila     │                              │ │ vaga, rota   │ │
│              │                              │ └──────────────┘ │
│  Logos       │                              │                  │
│  parceiros   │                              │                  │
└──────────────┴──────────────────────────────┴──────────────────┘
```

## Mudancas

### 1. Sidebar esquerda (fundo `#001529`, texto branco)
- Logo FavelaLLog no topo (`/logos/favela_llog.png`)
- Secao "Ciclos" com dados do dia (query `cycle_records` por `unit_id` e `record_date = today`)
  - Exibir horarios de abertura, inicio/termino descarregamento, qtd pacotes
- Metricas rapidas: total TBRs (via RPC `get_unit_tbr_count`), motoristas na fila (count `queue_entries` waiting/approved), saidas do dia (count `driver_rides` finished)
- Rodape: logos parceiros (CUFA, FVL) em miniatura

### 2. Area central (fundo branco, flex-1)
- Idle: rotacao de logos como ja esta (mantido)
- Chamada: card com avatar, nome, "SUA VEZ!", vaga, rota, conferente (mantido, com fundo `#001529` durante chamada)

### 3. Coluna direita (~280px, fundo `#f0f4f8`)
- Relogio digital grande (atualizado a cada segundo)
- Nome da unidade (query `units` por `unit_id`)
- Lista da fila atual: posicao, nome do motorista, status — query `queue_entries` where status in (waiting, approved) ordered by joined_at
- **Quadro "Ultimas Chamadas"** (canto inferior): ultimas 5 chamadas do dia, mostrando motorista, conferente, vaga, rota, horario — query `queue_entries` where `called_at` is not null, ordered desc, limit 5

### 4. Som de alerta suave (substituir sirene)
- Trocar square wave por **sine wave** (tom suave)
- Frequencia: sequencia de 3 "ding-dong" (523Hz -> 659Hz) com fade-in/fade-out via gain envelope
- Duracao total: ~4 segundos
- Volume: gain 0.4 (moderado, nao agressivo)

### Arquivo alterado
- `src/pages/dashboard/CallingPanelPage.tsx` — reescrita completa com layout 3 colunas, queries para ciclos/fila/ultimas chamadas, som suave

