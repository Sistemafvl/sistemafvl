

# Corrigir Modal QR Code na Visão do Motorista

## Problema
O modal de QR Code está usando o componente `TbrScanner` (feito para bipar TBRs), que inclui campo de texto manual, histórico de leituras e layout inadequado. Para entrada na fila via QR, o modal deve ser apenas a câmera com viewfinder, sem input manual. Além disso, o layout está quebrando em dispositivos móveis.

## Solução

### Arquivo: `src/pages/driver/DriverQueue.tsx`

Substituir o uso do `TbrScanner` dentro do Dialog por um scanner dedicado apenas com câmera:

1. **Remover TbrScanner do modal** — não usar o componente de bipar TBR
2. **Implementar câmera direta no modal** usando `BarcodeDetector` API (mesmo padrão do TbrScanner mas simplificado):
   - Abrir câmera traseira ao montar
   - Renderizar `<video>` com `QrViewfinder` por cima
   - Detectar QR codes dentro do viewfinder
   - Ao detectar, chamar `validateQrAndJoin(code)` e fechar o modal
3. **Layout responsivo do modal**:
   - Usar `Drawer` (vaul) em mobile e `Dialog` em desktop (padrão já usado no projeto)
   - Ou simplesmente usar `Dialog` com classes responsivas: `max-w-[95vw] sm:max-w-md`, altura do vídeo `aspect-[3/4] max-h-[70vh]`
   - Padding e espaçamento ajustados para telas pequenas
4. **Cleanup**: parar câmera ao fechar o modal

### Arquivos alterados
- `src/pages/driver/DriverQueue.tsx` — substituir TbrScanner por câmera direta com QrViewfinder, layout responsivo

