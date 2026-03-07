

## Plano: Remover "Piso Fechado" e adicionar hora no "TBR Lido"

### Problema
- O evento "Status: Piso Fechado" aparece solto na timeline sem contexto útil — é redundante pois o "TBR Re-carregado" já indica que o piso foi resolvido.
- O "TBR Lido" não mostra a hora do scan, ficaria mais claro com ela.

### Correções

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

**1. Remover o evento "Piso Fechado" da timeline (linhas 300-308)**
- Remover o bloco `if (p.closed_at)` que gera "Status: Piso Fechado". Manter apenas o "Retorno Piso" / "Insucesso".

**2. Adicionar horário no detail do "TBR Lido" e "TBR Re-carregado" (linhas 259-264)**
- No `detail`, incluir o horário formatado do scan junto com motorista e rota. Ex: `"10:16 • Motorista: Micheal • Rota: 0814"` — na verdade o horário já aparece na coluna de timestamp, então não precisa duplicar. O timestamp já está visível na renderização.

Aguardando — na screenshot o horário já aparece (06/03 10:16). O pedido é só remover "Piso Fechado". Confirmo: apenas remover o bloco de "Piso Fechado" (linhas 300-308).

