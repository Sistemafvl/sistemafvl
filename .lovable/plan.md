## Correção — Amarelo confiável no 3º bipe ✅ IMPLEMENTADO

### Solução aplicada
- `scanCountsRef` persistente conta bipes por código/ride independente do estado React
- 1º bipe: salva normal
- 2º bipe: aviso vermelho temporário (1s), sem amarelo
- 3º bipe+: amarelo permanente no banco
- Reset do contador quando TBR é deletado manualmente
