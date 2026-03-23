

# Ajustes no Painel de Chamada

## Mudanças

### 1. Fundo com logo FVL
- Copiar a imagem enviada (`user-uploads://image-625.png`) para `public/logos/fvl_panel_bg.png`
- No estado idle, exibir esta imagem como logo principal (substituindo a rotação de logos ou adicionando como fundo)

### 2. Som de alerta alto (~6 segundos)
- Substituir o `<audio>` do bell.mp3 por um alerta gerado via Web Audio API (igual ao `DriverCallAlert`)
- Gerar um tom alto (square wave) alternando frequências (800Hz ↔ 1200Hz) com volume máximo (gain 0.7)
- Tocar por exatamente 6 segundos e parar automaticamente
- Isso garante som alto e compatível sem depender de arquivo MP3 externo

### Arquivos alterados
- `src/pages/dashboard/CallingPanelPage.tsx` — substituir audio ref por Web Audio API siren de 6s, usar logo FVL como idle

