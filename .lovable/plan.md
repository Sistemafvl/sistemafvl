

# Corrigir Tamanho do AdBanner e Configuração do AdSense

## Problemas Identificados

### 1. Tamanho inconsistente entre dispositivos
O `AdBanner` usa `min-h-[100px]` sem altura máxima. Quando o AdSense não carrega (comum em desenvolvimento/localhost), o `<ins>` pode expandir indefinidamente em alguns dispositivos. Em outros, fica compacto porque o navegador colapsa o elemento vazio.

### 2. Configuração do AdSense
O script do AdSense está corretamente incluído no `index.html` com o `client=ca-pub-6544232309154364`. O componente `AdBanner` tem `adClient` e `adSlot` corretos. **Porém**, os anúncios do AdSense só aparecem em domínios aprovados pela Google. O domínio `sistemafvl.lovable.app` (ou o domínio publicado) precisa estar verificado e aprovado no painel do AdSense. Em localhost/preview, nunca aparecerá anúncio real — isso é comportamento esperado do Google.

## Solução

### Arquivo: `src/components/AdBanner.tsx`
- Fixar altura consistente: `h-[100px]` (ou `min-h-[90px] max-h-[120px]`) para que fique igual em todos os dispositivos
- Remover `min-h-[100px]` que permite expansão ilimitada
- Manter o texto "Anúncio" centralizado como placeholder visual enquanto o ad não carrega
- Adicionar `overflow-hidden` com altura fixa para garantir que o espaço nunca fique "gigante"

### Resultado
O banner terá tamanho fixo (~100px) em todos os dispositivos, exatamente como no print. Quando o AdSense aprovar o domínio e começar a servir anúncios, eles preencherão esse espaço automaticamente.

