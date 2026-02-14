
## Diretriz Global: Mobile-First

**TODAS** as telas, componentes e layouts deste sistema DEVEM ser:
- Totalmente responsivos e otimizados para dispositivos móveis (mobile-first)
- Auto-ajustáveis em qualquer tamanho de tela (celular, tablet, desktop)
- Testados visualmente em viewport mobile antes de finalizar

Padrões obrigatórios:
- Usar classes responsivas do Tailwind (`sm:`, `md:`, `lg:`)
- Inputs e botões com tamanhos touch-friendly (min 44px de altura)
- Espaçamentos adequados para toque (sem elementos muito próximos)
- Textos legíveis sem zoom em telas pequenas
- `viewport` meta tag configurada corretamente
- Safe area insets considerados para dispositivos com notch
