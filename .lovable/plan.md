

# Modificações no Painel de Chamada

## 1. Logo CUFA em branco
- Na linha 370, adicionar `brightness(0) invert(1)` via CSS filter na imagem `/logos/cufa.png` para torná-la branca
- Aplicar apenas nessa imagem (não afetar a logo FVL ao lado)

## 2. Botão de tela cheia (Fullscreen)
- Adicionar um botão pequeno (ícone `Maximize2`/`Minimize2` do Lucide) no canto superior da área central ou da sidebar
- Ao clicar, usar a Fullscreen API do navegador (`document.documentElement.requestFullscreen()`) para preencher toda a tela, ocultando barra do navegador, favoritos etc.
- Manter estado `isFullscreen` para alternar entre entrar/sair do fullscreen
- Listener no evento `fullscreenchange` para sincronizar o estado

### Arquivo alterado
- `src/pages/dashboard/CallingPanelPage.tsx`

