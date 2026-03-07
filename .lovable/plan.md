

## Plano: Melhorar a Linha do Tempo do Rastreamento TBR

### Problemas identificados

A timeline atual tem várias lacunas que impedem a visão completa do ciclo de vida do TBR:

1. **PS/RTO mostram apenas 1 evento** — se o PS está aberto, mostra "PS Aberto"; se fechado, mostra "PS Fechado". Deveria mostrar **ambos** (abertura + fechamento como eventos separados), igual já faz com Piso.
2. **DNR não mostra evento de fechamento** — mostra apenas a criação, não o momento em que foi fechado/atualizado.
3. **Falta evento de início/finalização do carregamento** — quando o ride é iniciado (`started_at`) e finalizado (`finished_at`), não aparece na timeline.
4. **Falta evento de Resgate** — `rescue_entries` não são consultadas, então resgates não aparecem.
5. **Falta evento de Reativo** — `reativo_entries` não são consultadas.
6. **Falta tipo "started"/"finished"** no TimelineEvent — precisa expandir os tipos.
7. **Cabeçalho do modal mostra apenas dados do primeiro ride** — deveria mostrar o ride mais recente/ativo.

### Alterações

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

**1. Expandir TimelineEvent types:**
- Adicionar tipos: `"started" | "finished" | "rescue" | "reativo"`

**2. Adicionar queries para rescue_entries e reativo_entries:**
- Na Promise.all existente (linha 147), incluir:
  - `supabase.from("rescue_entries").select("*").ilike("tbr_code", code)`
  - `supabase.from("reativo_entries").select("*").ilike("tbr_code", code)`

**3. Corrigir PS — gerar 2 eventos (abertura + fechamento):**
- Sempre criar evento "PS Aberto" com `created_at`
- Se `closed_at` existir, criar segundo evento "PS Fechado" com `closed_at`
- Incluir detalhes de razão/foto em ambos

**4. Corrigir RTO — gerar 2 eventos:**
- Sempre criar evento "RTO Aberto" com `created_at`
- Se `closed_at` existir, criar segundo evento "RTO Fechado" com `closed_at`

**5. Corrigir DNR — gerar evento de abertura + fechamento/análise:**
- Sempre criar "DNR Aberto" com `created_at`
- Se `closed_at` ou status mudou, criar segundo evento

**6. Adicionar eventos de ride started/finished:**
- Para cada loadEvent, se `ride.started_at` existir, criar evento "Carregamento Iniciado"
- Se `ride.finished_at` existir, criar evento "Carregamento Finalizado"

**7. Adicionar eventos de rescue_entries:**
- Para cada rescue, criar evento mostrando "Resgate" com detalhes do motorista original e resgatador

**8. Adicionar eventos de reativo_entries:**
- Para cada reativo, criar evento "Reativo Ativado" com valor e detalhes

**9. Atualizar cores/dots na renderização:**
- Adicionar cores para os novos tipos: started (verde), finished (verde escuro), rescue (azul), reativo (roxo)

**10. Melhorar cabeçalho do modal:**
- Mostrar dados do ride mais recente (último loadEvent), não o primeiro

### Resultado esperado
A timeline passará a mostrar o ciclo completo:
Origem → Carregamento Iniciado → (Insucesso/PS/RTO) → Piso Fechado → Re-carregado → Carregamento Iniciado → Finalizado → Resgate → Reativo → DNR

