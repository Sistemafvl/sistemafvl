

# Correção dos Build Errors

## Problemas identificados

Há 3 erros de TypeScript no `DriverQueue.tsx`:

1. **Linha 113**: O select retorna `{id, route, login, password, sequence_number, loading_status, completed_at, unit_id}` mas faz cast para `ActiveRide` que exige `queue_entry_id` (ausente no select).
2. **Linha 494**: `RotateCcw` não está importado (falta no import da linha 2).
3. **Linha 503**: `completed_at` não existe no tipo `ActiveRide`.

## Solução

Atualizar a interface `ActiveRide` para incluir `completed_at` e tornar `queue_entry_id` opcional (já é `string | null`), e adicionar `RotateCcw` ao import dos ícones.

### Alterações em `src/pages/driver/DriverQueue.tsx`:

1. **Linha 2**: Adicionar `RotateCcw` ao import do lucide-react
2. **Interface ActiveRide (linhas 20-28)**: Adicionar `completed_at?: string | null` e `unit_id?: string`

São apenas 2 edições pequenas no mesmo arquivo. Nenhum outro arquivo precisa ser alterado.

