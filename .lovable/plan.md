

## Aumentar o logotipo na tela de login

Alterar o tamanho `lg` no componente `LogoHeader.tsx` de `h-28` (112px) para `h-48` (192px).

### Detalhes tecnicos

**Arquivo:** `src/components/LogoHeader.tsx` (linha 10)

Alterar o mapa de tamanhos:
- `lg: "h-28"` passa a ser `lg: "h-48"`

Isso afeta a tela de login (Index), que usa `size="lg"`.

