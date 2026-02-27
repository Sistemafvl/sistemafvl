

# Plano: Tornar o lock do conferente permanente baseado nos dados do banco

## Problema
O `lockedConferenteIds` é um `Set` em memória que só é preenchido quando o usuário seleciona um conferente na sessão atual. Quando `fetchRides` roda (realtime, refresh, etc.), ele substitui os rides com dados novos do banco, mas o `lockedConferenteIds` pode não conter aquele ride — então por um instante (ou permanentemente, se o componente remontou) o dropdown fica ativo novamente.

## Correção
Após `setRides(mapped)` dentro do `fetchRides`, iterar sobre os rides carregados e adicionar automaticamente ao `lockedConferenteIds` todos os rides que já possuem `conferente_id` definido no banco. Isso garante que o lock é sempre derivado da verdade do servidor, não apenas de ações da sessão atual.

| Arquivo | Alteração |
|---|---|
| `ConferenciaCarregamentoPage.tsx` (~linha 390, dentro de `fetchRides`) | Após `setRides(mapped)`, adicionar `setLockedConferenteIds(prev => { const next = new Set(prev); mapped.forEach(r => { if (r.conferente_id) next.add(r.id); }); return next; })` |

Isso é uma alteração de ~3 linhas que resolve o problema na raiz: qualquer ride que tenha conferente definido no banco será sempre travado, independente de sessão, refresh, ou atualização realtime.

