

## Plano: Corrigir Timeline TBR — Case sensitivity + Timestamps errados

### Problemas identificados

**1. Query `ride_tbrs` é case-sensitive (`.eq("code", code)`)** — linha 148
- Se o usuário busca "tbr319093505" (minúsculo), o `.eq()` não encontra "TBR319093505" no banco.
- Resultado: o sistema não acha o registro real do `ride_tbrs`, reconstrói tudo como "sintético" a partir de `piso_entries`, e o cabeçalho mostra dados errados.
- As outras tabelas (`piso_entries`, `ps_entries`, etc.) usam `.ilike()` e funcionam — a inconsistência está só na `ride_tbrs`.

**2. Timestamp sintético usa `piso.created_at - 1 segundo`** — linhas 240-245
- Quando o `ride_tbr` foi deletado pelo trigger, o sistema reconstrói o evento "Origem" usando a data do insucesso menos 1 segundo.
- Se o insucesso foi registrado horas depois do carregamento (ex: carregou de manhã, insucesso às 19h), o "Origem" aparece às 19:08 em vez de mostrar o horário real da manhã.
- A solução é usar `driver_rides.completed_at` (que registra quando o ride foi criado, ou seja, quando o motorista foi atribuído — de manhã) em vez de `earliestReturn - 1s`.

**3. Cabeçalho mostra motorista antigo (Micheal em vez de Sarah)**
- Consequência do bug #1: se a query case-sensitive não encontra o `ride_tbr` da Sarah, `realLoadEvents` fica vazio e o fallback mostra o último sintético (Micheal).

### Correções

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

**1. Trocar `.eq("code", code)` por `.ilike("code", code)` na query de `ride_tbrs` (linha 148)**
- Isso garante que a busca encontre o registro independente de maiúsculas/minúsculas.

**2. Usar `ride.completed_at` para timestamp de eventos sintéticos (linhas 240-245)**
- Substituir a lógica de `earliestReturn - 1000` por `ride.completed_at` diretamente.
- `completed_at` no `driver_rides` é o momento em que o ride foi criado (manhã), refletindo melhor quando o TBR foi carregado.

### Resultado esperado

- TBR316774261: Cabeçalho mostra Sarah (ride real atual). Timeline mostra Origem de manhã → Retorno Piso → Piso Fechado → Re-carregado (Sarah) → Carregamento Iniciado/Finalizado (Sarah).
- tbr319093505: "Origem" mostra o horário da manhã (quando o ride foi criado), não 19:08.

