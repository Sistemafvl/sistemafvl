

## Plano: Simplificar Timeline TBR — Fluxo cronológico limpo

### Problema atual

A timeline mostra eventos redundantes e confusos:
- "Origem: Conferência Carregamento" + "Carregamento Iniciado" + "Re-carregado: Conferência Carregamento" + "Carregamento Finalizado" — muita repetição.
- O usuário quer ver o fluxo simples: **Iniciado no Micheal → TBR lido → Retorno Piso → Iniciado na Sarah → TBR lido → Finalizado**.

### Alterações

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

**1. Reformular os eventos de carregamento (linhas 252-289):**

Substituir a lógica atual por um fluxo mais limpo:

- **Para cada loadEvent (ride):**
  - Evento **"Iniciado: [Motorista]"** — usando `ride.started_at` (real) ou `ride.completed_at` (sintético) como timestamp. Mostra rota e motorista.
  - Evento **"TBR Lido"** — usando `scanned_at` do ride_tbr (se real) ou timestamp sintético. Mostra que o TBR foi bipado nesse carregamento.

- **Remover** os eventos separados "Origem: Conferência Carregamento", "Re-carregado: Conferência Carregamento", "Carregamento Iniciado", "Carregamento Finalizado".

- **Evento "Finalizado"** — aparece **apenas uma vez**, no último ride real, usando `ride.finished_at`. Sem duplicar para rides sintéticos.

**2. Novo formato dos eventos:**

```
09:48  [Conferente] Carregamento Iniciado
       Motorista: Sarah • Rota: 0814-2

10:16  [Conferente] TBR Lido
       Motorista: Micheal • Rota: 0814

10:39  [Conferente] Retorno Piso
       Troca de motorista • Micheal

10:44  [Conferente] Piso Fechado

10:44  [Conferente] TBR Re-carregado
       Motorista: Sarah • Rota: 0814-2

10:45  [Conferente] Carregamento Finalizado
       Motorista: Sarah • Rota: 0814-2
```

**3. Lógica simplificada:**

```typescript
loadEvents.forEach((evt, index) => {
  const ride = evt.ride;
  const driver = driverMap.get(ride?.driver_id);
  const confName = ...;
  
  // Evento: TBR lido/re-carregado neste ride
  timeline.push({
    timestamp: evt.timestamp,
    conferente: confName,
    action: index === 0 ? "TBR Lido" : "TBR Re-carregado",
    detail: `Motorista: ${driver?.name ?? "—"} • Rota: ${ride?.route ?? "—"}`,
    type: index === 0 ? "origin" : "loaded",
  });

  // Evento: Carregamento Iniciado (apenas para ride real com started_at)
  if (evt.isReal && ride?.started_at) {
    timeline.push({
      timestamp: ride.started_at,
      conferente: confName,
      action: "Carregamento Iniciado",
      detail: `Motorista: ${driver?.name} • Rota: ${ride?.route}`,
      type: "started",
    });
  }

  // Evento: Carregamento Finalizado (apenas último ride real com finished_at)
  if (evt.isReal && ride?.finished_at) {
    timeline.push({
      timestamp: ride.finished_at,
      conferente: confName,
      action: "Carregamento Finalizado",
      detail: `Motorista: ${driver?.name} • Rota: ${ride?.route}`,
      type: "finished",
    });
  }
});
```

### Resultado esperado

Timeline do TBR316774261:
```
09:48  Carregamento Iniciado — Sarah • Rota: 0814-2
10:16  TBR Lido — Micheal • Rota: 0814
10:39  Retorno Piso — Troca de motorista • Micheal
10:44  Piso Fechado
10:44  TBR Re-carregado — Sarah • Rota: 0814-2
10:45  Carregamento Finalizado — Sarah • Rota: 0814-2
```

Fluxo cronológico claro, sem repetições, mostrando exatamente o caminho do TBR.

