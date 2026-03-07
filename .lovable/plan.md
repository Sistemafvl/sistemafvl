

## Plano: Corrigir "Carregamento Iniciado" para mostrar o primeiro motorista

### Problema

O "Carregamento Iniciado" aparece com dados da Sarah (ride real) porque a lógica atual só gera esse evento para `evt.isReal`. Mas o TBR foi lido primeiro no Micheal — então o "Carregamento Iniciado" deveria mostrar o Micheal.

### Correção

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx` (linhas 252-288)

Mudar a lógica:

- **"Carregamento Iniciado"** — gerar apenas para `index === 0` (primeiro loadEvent), usando os dados desse ride (Micheal). Timestamp: `ride.started_at` se real, ou `evt.timestamp` se sintético.
- **"Carregamento Finalizado"** — manter apenas para o último ride real com `finished_at` (Sarah).
- Remover a condição `evt.isReal` do "Carregamento Iniciado".

### Resultado esperado

```
09:48  Carregamento Iniciado — Micheal • Rota: 0814
10:16  TBR Lido — Micheal • Rota: 0814
10:39  Retorno Piso — Troca de motorista • Micheal
10:44  TBR Re-carregado — Sarah • Rota: 0814-2
10:45  Carregamento Finalizado — Sarah • Rota: 0814-2
```

