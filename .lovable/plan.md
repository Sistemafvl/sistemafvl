

# Plano: Ajustar input TBR e botões no mobile

## Problema
No mobile, o campo "Escanear TBR" ocupa muito espaço horizontal, fazendo os botões de câmera e teclado ficarem atrás do balão "Fila", dificultando o clique.

## Correção
Na `div` da linha 1630 (`flex gap-1`), reduzir a largura do input no mobile e garantir que os botões fiquem visíveis:

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` (linha 1630-1631) | Mudar `<div className="flex gap-1">` para `<div className="flex gap-1 items-center">` e no `div.relative.flex-1` (linha 1631) adicionar classe `max-w-[55%] sm:max-w-none` para limitar a largura do input apenas no mobile, empurrando os botões para fora da zona do balão |

Isso reduz o campo de input apenas na visão mobile (< 640px), mantendo os botões de câmera e teclado acessíveis ao lado.

