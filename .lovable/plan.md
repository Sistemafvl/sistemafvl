

# Exibir Cards de Ciclos (C1/C2/C3) na Sidebar do Painel de Chamada

## O que muda

Na sidebar esquerda do Painel de Chamada, substituir a seção atual "Ciclos do Dia" (que mostra abertura, início/término descarregamento, pacotes) por **3 cards empilhados verticalmente** — C1, C2, C3 — iguais aos da página de Carregamento, seguidos das métricas (Saídas, Na Fila) logo abaixo.

## Implementação

### Arquivo: `src/pages/dashboard/CallingPanelPage.tsx`

1. **Adicionar fetch de dados para ciclos**: Buscar `driver_rides` do dia (com `completed_at`) e `ride_tbrs` para calcular quantas saídas e TBRs em cada ciclo, usando os mesmos cutoffs:
   - C1: até 08:30 BRT (`T11:30:00.000Z`)
   - C2: até 09:30 BRT (`T12:30:00.000Z`)
   - C3: total do dia

2. **Novo estado**: `cycleMetrics` com `{ c1: { rides, tbrs }, c2: { rides, tbrs }, c3: { rides, tbrs } }`

3. **Render na sidebar**: 3 mini-cards verticais (adaptados ao fundo escuro `#001529`) com:
   - Titulo: "C1 (até 08:30)", "C2 (até 09:30)", "C3 (total)"
   - Numero de saídas e TBRs
   - Estilo: fundo `rgba(255,255,255,0.05)`, bordas sutis, texto claro

4. **Mover métricas para baixo**: "Saídas" e "Na Fila" ficam após os cards de ciclos

5. **Manter dados do cycle_records** (abertura galpão, pacotes) visíveis abaixo dos cards de ciclo ou integrados nos cards

