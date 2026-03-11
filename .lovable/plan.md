

# Plano: Contador de carregamentos pendentes no menu

## O que será feito
Adicionar um badge animado (pulsante) ao lado do item "Carregamento" no menu lateral, mostrando a quantidade de carregamentos com status "pending" (aguardando). Conforme forem iniciados (status → "loading"), o contador diminui em tempo real.

## Mudanças técnicas

### `src/components/dashboard/DashboardSidebar.tsx`
- Adicionar um `useEffect` que faz query em `driver_rides` filtrando por `unit_id`, `loading_status = "pending"` e `completed_at >= hoje`
- Inscrever um channel Realtime em `driver_rides` (evento UPDATE) para atualizar o contador automaticamente quando um carregamento muda de status
- No render do item "Carregamento" (linha 229-242), ao invés de usar o loop genérico, renderizar este item separadamente com um `Badge` ao lado do texto quando `pendingCount > 0`
- O badge terá classe `animate-pulse` do Tailwind com fundo laranja/amarelo para indicar atenção

### Estilo do badge
- Círculo pequeno com número, cor de fundo `bg-orange-500 text-white`
- Animação `animate-pulse` nativa do Tailwind
- Desaparece quando o contador chega a 0

