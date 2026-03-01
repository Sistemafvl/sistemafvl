

## Diagnóstico

O problema é o `dragFree: true` combinado com `emblaApi.reInit()` sendo chamado **a cada clique** nos handlers de navegação. O `reInit()` reseta o estado interno do Embla, e com `dragFree: true` os snaps não são rígidos — o carrossel pode parar em qualquer posição fracionária. Quando o `reInit()` roda, ele recalcula os snaps a partir da posição atual (que pode estar entre dois cards), causando o "recuo" observado.

## Solução

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

1. **Remover `dragFree: true`** da config do Embla (linha 186) — forçar snaps fixos para que cada card sempre alinhe perfeitamente:
```typescript
useEmblaCarousel({ align: "start", containScroll: false })
```

2. **Simplificar os handlers** (linhas 632-647) — remover o `reInit()` de cada clique e usar `scrollPrev/scrollNext` direto, que já respeitam snaps fixos:
```typescript
const handleCarouselPrev = useCallback(() => {
  if (!emblaApi) return;
  emblaApi.scrollPrev();
}, [emblaApi]);

const handleCarouselNext = useCallback(() => {
  if (!emblaApi) return;
  emblaApi.scrollNext();
}, [emblaApi]);
```

3. **Manter o `useEffect` de re-sync** (linhas 616-629) — este continua necessário para reposicionar quando a lista muda, mas o `reInit` só roda quando `rides.length` muda, não a cada clique.

