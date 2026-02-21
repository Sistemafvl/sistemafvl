
# Substituicao do Logotipo em Todo o Projeto

## O que sera feito

O logotipo atual (`src/assets/logo.png`) sera substituido pelo novo arquivo enviado. Como todo o projeto ja importa o logo a partir de `src/assets/logo.png`, basta copiar o novo arquivo para esse caminho -- todas as referencias serao atualizadas automaticamente.

## Locais que usam o logo

1. **`src/components/LogoHeader.tsx`** - Componente principal do logo (pagina inicial, sidebars, install page)
2. **`src/pages/dashboard/reports/pdf-utils.ts`** - Logo nos relatorios PDF

Ambos importam de `@/assets/logo.png`, entao a troca do arquivo resolve tudo de uma vez.

## Acoes

1. Copiar o novo logotipo (`user-uploads://ChatGPT_Image_...removebg-preview.png`) para `src/assets/logo.png`, substituindo o arquivo atual
2. Nenhuma alteracao de codigo necessaria -- os imports existentes continuam funcionando

## Observacao sobre PWA

Os icones do PWA (`public/pwa-192x192.png` e `public/pwa-512x512.png`) e o `public/favicon.ico` continuam com o icone antigo. Se quiser atualiza-los tambem, sera necessario fornecer versoes do novo logo nos tamanhos 192x192, 512x512 e favicon.
