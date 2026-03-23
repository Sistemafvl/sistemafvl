

# Correção do Painel de Chamada e Notificação do Motorista

## Problema identificado

A coluna `parking_spot` **não existe** na tabela `queue_entries`. Quando o conferente clica no sino, o código tenta fazer um UPDATE incluindo `parking_spot` junto com `called_at` e `called_by_name`. O PostgREST **rejeita a operação inteira** porque a coluna não existe — resultado: `called_at` nunca é gravado, e nem o painel nem o celular do motorista recebem a notificação.

## Plano de correção

### Opção 1: Criar a coluna `parking_spot` (recomendado)
- Adicionar coluna `parking_spot TEXT` na tabela `queue_entries` via migration
- Assim o fluxo completo funciona como projetado (vaga informada ao painel)

### Opção 2: Remover `parking_spot` do update
- Remover a referência a `parking_spot` no `handleConfirmCall` e no modal
- Perda de funcionalidade da vaga

### Correção adicional: Replica Identity
- Alterar `queue_entries` para `REPLICA IDENTITY FULL` para que o Realtime envie o registro antigo completo no `payload.old`, garantindo comparação correta de `called_at` no CallingPanelPage

## Implementação (Opção 1)

1. **Migration SQL**: `ALTER TABLE queue_entries ADD COLUMN parking_spot TEXT;`  
   + `ALTER TABLE queue_entries REPLICA IDENTITY FULL;`

2. **CallingPanelPage.tsx**: Remover o `as any` do select (agora `parking_spot` existe) e garantir que o campo é exibido corretamente

3. **ConferenciaCarregamentoPage.tsx**: Remover o `as any` do update (agora a coluna existe)

Nenhum fluxo existente será afetado — apenas adiciona uma coluna nullable e corrige o Realtime.

