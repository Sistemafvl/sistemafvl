
# Adicionar Avaliação da Unidade na Sidebar do Painel de Chamada

## O que muda

No espaço entre "Métricas do Dia" e os logos parceiros (área sinalizada na imagem), adicionar um bloco mostrando a média de avaliação da unidade pelos motoristas, com estrelas e texto.

## Implementação

### Arquivo: `src/pages/dashboard/CallingPanelPage.tsx`

1. **Fetch da média de avaliações**: No `fetchSidebarData`, consultar `unit_reviews` filtrando por `unit_id`, calcular média e total de avaliações
2. **Novo estado**: `reviewStats: { avg: number; count: number }` (default `{ avg: 0, count: 0 }`)
3. **Render na sidebar**: Entre as métricas e os logos parceiros, adicionar bloco com:
   - Titulo "Avaliação" (estilo igual aos outros headers da sidebar)
   - Média numérica (ex: "4.3") com estrelas preenchidas proporcionalmente (5 estrelas, usando ícone `Star` do Lucide)
   - Texto "X avaliações" abaixo
   - Estilo consistente com o fundo escuro (`#001529`)
4. **Importar** `Star` do lucide-react
