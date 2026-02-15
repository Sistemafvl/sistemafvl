

## Correcao do Carrossel: Remover Barra de Rolagem + Setas de Navegacao

### Problema
A barra de rolagem horizontal continua aparecendo na parte inferior da pagina, mesmo com `overflow-x-hidden`. O Embla Carousel pode nao estar controlando o scroll corretamente, e o container flex dos cards esta extrapolando a area visivel.

### Solucao

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

1. **Mover as setas de navegacao para ACIMA dos cards** (alinhadas a direita, antes do container do carrossel), em vez de posiciona-las nas laterais. Isso evita que as setas fiquem cortadas e da mais espaco para os cards.

2. **Garantir que o container do Embla funcione corretamente:**
   - O `div` com `ref={emblaRef}` precisa ter `overflow: hidden` (ja tem)
   - Remover `gap-4` do container flex interno e usar `pl-4` em cada item (padrao Embla)
   - Cada card usa `flex-[0_0_85vw] sm:flex-[0_0_320px]` para definir tamanho fixo sem permitir crescimento

3. **Adicionar `overflow: hidden` em TODOS os containers pais** ate a raiz da pagina para garantir que nenhum nivel gere scrollbar horizontal

4. **Layout das setas:**
   - Duas setas (esquerda/direita) posicionadas no topo, acima dos cards, alinhadas a direita
   - Estilo compacto com icones ChevronLeft e ChevronRight
   - Desabilitadas quando nao pode navegar (inicio/fim)

### Detalhes Tecnicos

```text
Estrutura do carrossel:

  <div className="flex items-center justify-end gap-2 mb-2">
    <Button onClick={scrollPrev} disabled={!canScrollPrev}>
      <ChevronLeft />
    </Button>
    <Button onClick={scrollNext} disabled={!canScrollNext}>
      <ChevronRight />
    </Button>
  </div>

  <div className="overflow-hidden" ref={emblaRef}>
    <div className="flex">
      {rides.map(ride => (
        <div className="flex-[0_0_85vw] sm:flex-[0_0_320px] min-w-0 pl-4 first:pl-0">
          <Card>...</Card>
        </div>
      ))}
    </div>
  </div>
```

Isso garante:
- Zero scrollbar horizontal em qualquer dispositivo
- Cards deslizam suavemente ao clicar nas setas
- O primeiro card "desaparece" para a esquerda (atras do sidebar) ao avancar
- Layout responsivo: cards ocupam 85% da tela em mobile, 320px em desktop

