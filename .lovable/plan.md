
Objetivo: eliminar o “card quebrado” e garantir que o botão de navegação nunca trave na Conferência de Carregamento.

1) Endurecer a navegação do carrossel (arquivo `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`)
- Substituir `onClick={() => emblaApi?.scrollPrev()}` / `scrollNext()` por handlers dedicados (`handleCarouselPrev` / `handleCarouselNext`).
- Nos handlers:
  - validar `emblaApi`;
  - executar `emblaApi.reInit()` antes de navegar;
  - usar navegação por snap (`selectedScrollSnap() ± 1` + `scrollTo(target)`) em vez de depender só de `scrollPrev/scrollNext`.
- Adicionar rotina de “normalize” para corrigir estado parcial (card no meio) antes do avanço/retorno.

2) Re-sincronizar Embla sempre que a lista muda
- Criar `useEffect` com `emblaApi` + `displayRides.length` para:
  - registrar listeners `select` e `reInit`;
  - manter índice/snap atual em estado/ref;
  - forçar alinhamento no snap atual após `reInit` (evitar viewport parar em posição quebrada).
- Limpar listeners no unmount.

3) Reduzir refetch desnecessário que desestabiliza o carrossel
- Ajustar o subscription realtime de `ride_tbrs` para só reagir quando `ride_id` do evento pertence aos rides carregados da unidade atual (via `currentRideIdsRef`).
- Manter `driver_rides` por `unit_id`, mas evitar refetch global por qualquer TBR do sistema.
- Diminuir debounce de refetch do canal para janela menor e estável (ex.: ~300–500ms) para reduzir “pulos” de layout.

4) Blindar contra respostas fora de ordem no `fetchRides`
- Implementar controle de requisição ativa (`requestIdRef`).
- Só aplicar `setRides`/`setTbrs` se a resposta ainda for a mais recente.
- Evitar sobrescrever estado novo com resposta antiga (causa visual de card trocando/voltando).

5) Preservar posição atual após atualização de dados
- Antes de refetch, guardar `rideId` visível atual (snap selecionado).
- Após `setRides` + `reInit`, reposicionar no mesmo `rideId` (ou snap mais próximo se não existir mais).
- Resultado esperado: sem “quebra” visual ao atualizar lista durante operação.

Validação (prioridade alta)
- Cenário principal: navegar do #12 para trás até #1 usando apenas setas, repetindo cliques rápidos.
- Durante bipagem contínua: confirmar que as setas continuam funcionando e nenhum card fica “só no meio”.
- Realtime ativo: confirmar que updates não travam navegação nem reposicionam em estado parcial.
- Mobile e desktop: validar consistência do comportamento.

Detalhes técnicos (implementação)
- Arquivo único: `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`.
- Pontos de alteração:
  - configuração/uso do `useEmblaCarousel`;
  - botões de seta (bloco do header do carrossel);
  - `useEffect` do canal realtime (`ride_tbrs`/`driver_rides`);
  - função `fetchRides` (controle de concorrência e preservação de posição).
- Sem mudança de banco de dados nesta correção.
