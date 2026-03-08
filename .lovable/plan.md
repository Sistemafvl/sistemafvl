
# Plano Atualizado: Scanner Padronizado com Feedback Visual

Recebi seu pedido! Vou integrar o feedback visual (check verde e X vermelho) ao componente padronizado que estamos criando.

## O que será implementado

### 1. Novo Componente `TbrScanner` (`src/components/ui/TbrScanner.tsx`)
Este será o componente padrão para todo o sistema (começando pelo Socorrendo, e depois poderemos usar no carregamento e outras telas).

**Layout do Scanner:**
- **Câmera:** Ocupando o topo, mas com o "quadrante" (área de leitura) menor (30% da tela) e posicionado mais para cima (a 25% do topo), exatamente como no seu anexo. Apenas os códigos dentro deste quadrante serão lidos.
- **Feedback Visual Central:** 
  - Quando um código for lido com sucesso, o quadrante piscará em **verde** com um ícone de **✓ (Check)** bem no centro.
  - Quando houver erro (código inválido ou falha), piscará em **vermelho fraco** com um ícone de **✗ (X)**.
- **Histórico de Leituras:** Logo abaixo da câmera, uma lista com barra de rolagem (scroll) mostrando todos os TBRs lidos na sessão atual.
- **Padrão de Cores no Histórico:**
  - **Verde:** 1ª leitura
  - **Vermelho:** 2ª tentativa
  - **Amarelo:** 5+ tentativas
  (Assim como já funciona no carregamento).

### 2. Correção e Integração no `DriverRescue.tsx` (Modo Socorrendo)
- Substituir a câmera atual (que parou de funcionar) pelo novo componente `TbrScanner`.
- Garantir que a permissão da câmera (`getUserMedia`) seja acionada corretamente pelo clique do usuário, contornando bloqueios de segurança dos navegadores.
- Passar a função de processamento de resgate para o scanner, para que ele possa validar e dar o feedback visual correto (Check verde ou X vermelho) instantaneamente.

### 3. Otimizações de Leitura Embutidas
- O scanner usará a API nativa do navegador (`BarcodeDetector`).
- Intervalo de 100ms para detecção rápida.
- Cooldown de 5 segundos para evitar bipar o mesmo código várias vezes acidentalmente.
- Suporte a QR Code, Code 128, Code 39 e Data Matrix.

Dessa forma, o "Modo Socorrendo" ficará 100% funcional novamente e com a mesma identidade visual e de usabilidade que aplicaremos ao resto do sistema.
