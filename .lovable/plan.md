
# Plano: Correções do Scanner de Câmera e PS

## Problemas identificados

### 1. Câmera lê o mesmo TBR múltiplas vezes (Conferência)
O cooldown de 1500ms no `recentCodes` é insuficiente — a câmera vê múltiplos QR codes simultaneamente e o mesmo código pode ser relido. Além disso, o `saveTbr` é chamado via `await` dentro do `setInterval`, o que pode causar corrida entre detecções.

### 2. TBR gravou 2x no carregamento
O `processedCodesRef` deveria impedir isso, mas como a câmera chama `saveTbr` diretamente (sem usar a fila `queueRef`), duas detecções podem entrar em paralelo antes do `processedCodesRef` ser atualizado (o `await` da verificação no banco demora).

### 3. PS não mostra histórico do TBR (câmera mobile)
O `searchTbr` usa `.maybeSingle()` na query `ride_tbrs`, que retorna **null** quando existem múltiplas entradas para o mesmo código (reincidências). Como TBR4567804 tem 3 registros, o `maybeSingle()` falha silenciosamente e mostra "sem histórico".

### 4. Câmera capta múltiplos códigos simultaneamente
O `detector.detect()` retorna um array de todos os barcodes visíveis. Atualmente usa `barcodes[0]`, mas deveria filtrar para pegar apenas o código mais central/focado, ou exigir que apenas 1 código esteja visível.

## Correções

### ConferenciaCarregamentoPage.tsx — Camera scanner

1. **Leitura única por sessão**: Após ler um TBR válido, pausar a detecção (não fechar câmera). Mostrar o código lido com confirmação visual. Só retomar detecção quando o usuário quiser bipar outro.
2. **Filtro de código único**: Se `detector.detect()` retorna múltiplos barcodes, ignorar a leitura e mostrar mensagem pedindo para focar em apenas um código.
3. **Lock síncrono antes do await**: Adicionar o código ao `processedCodesRef` ANTES de chamar `saveTbr` para evitar chamadas paralelas duplicatas.
4. **Aumentar cooldown**: De 1500ms para 5000ms no `recentCodes`.

### PSPage.tsx — Histórico do TBR

5. **Corrigir query**: Trocar `.maybeSingle()` por `.order("created_at", { ascending: false }).limit(1)` + `.maybeSingle()` para pegar o registro mais recente quando existem múltiplos.

### Ambas páginas — Foco único

6. **Validação de código único**: Nas duas páginas, quando `barcodes.length > 1`, filtrar apenas os que começam com "TBR" e se ainda houver mais de 1, não processar e pedir foco.

## Detalhes técnicos

| Arquivo | Alterações |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Lock síncrono na câmera, filtro de código único, cooldown maior, pausar após leitura |
| `PSPage.tsx` | Fix `.maybeSingle()` → `.order().limit(1)`, filtro de código único na câmera |
