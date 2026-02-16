
# Transformar o Sistema FVL em um App Instalavel (PWA)

## O que e isso?

PWA (Progressive Web App) permite que qualquer pessoa que acesse o sistema pelo celular receba a opcao de "Instalar" o app na tela inicial. Ele abre em tela cheia, sem barra do navegador, como se fosse um aplicativo nativo -- mas sem precisar de App Store ou Play Store.

## O que sera feito

### 1. Instalar o plugin `vite-plugin-pwa`
Adicionar a dependencia que gera automaticamente o Service Worker e o manifesto do app.

### 2. Configurar o `vite.config.ts`
Adicionar o plugin PWA com:
- Nome do app: "Sistema FVL"
- Descricao: "Sistema Logistico Favela Llog"
- Cor do tema: azul escuro (#1e3a5f) combinando com a identidade visual
- Icones do app (192x192 e 512x512)
- Modo standalone (abre sem barra do navegador)
- Cache inteligente para funcionar offline

### 3. Criar icones PWA
Gerar icones nos tamanhos 192x192 e 512x512 na pasta `public/` a partir do logo existente.

### 4. Atualizar o `index.html`
Adicionar meta tags para:
- `theme-color` (cor da barra de status no celular)
- Link para o manifesto
- Icone Apple Touch

### 5. Criar pagina `/install`
Uma pagina dedicada com instrucoes visuais para instalar o app:
- Detecta automaticamente se o navegador suporta instalacao
- Mostra o botao "Instalar" quando disponivel
- Instrucoes para iPhone (Safari > Compartilhar > Adicionar a Tela de Inicio)
- Instrucoes para Android (menu > Instalar app)

### 6. Adicionar prompt de instalacao na tela inicial
Na pagina de login (`Index.tsx`), exibir um banner discreto sugerindo a instalacao quando o usuario ainda nao instalou.

---

## Detalhes Tecnicos

### Arquivos novos
- `public/pwa-192x192.png` -- Icone 192px
- `public/pwa-512x512.png` -- Icone 512px  
- `src/pages/InstallPage.tsx` -- Pagina de instalacao
- `src/hooks/use-pwa-install.ts` -- Hook para controlar o prompt de instalacao

### Arquivos modificados
- `vite.config.ts` -- Adicionar `VitePWA()` plugin
- `index.html` -- Meta tags PWA (theme-color, apple-touch-icon)
- `src/App.tsx` -- Rota `/install`
- `src/pages/Index.tsx` -- Banner de instalacao
- `package.json` -- Dependencia `vite-plugin-pwa`

### Configuracao do Service Worker
- Estrategia: `generateSW` (gerado automaticamente)
- Cache: HTML, CSS, JS, imagens, fontes
- Rota `/~oauth` excluida do cache (para nao interferir com autenticacao)
- Atualizacao automatica quando nova versao e publicada
