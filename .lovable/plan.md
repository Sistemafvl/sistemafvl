

# Plano: 3 Ajustes — Seller checkbox, TBR duplicado no PS, Horário nos TBRs bipados

## 1. Checkbox "Seller" no modal de PS

**Migração SQL:** Adicionar coluna `is_seller` (boolean, default false) na tabela `ps_entries`.

**Arquivo:** `src/pages/dashboard/PSPage.tsx`
- Adicionar estado `isSeller` (boolean, default false)
- Renderizar um checkbox com label "Este TBR é Seller" logo abaixo do botão "+ Novo motivo" (dentro do bloco de motivo)
- Incluir `is_seller: isSeller` no objeto de insert
- Na tabela de listagem, exibir um badge "Seller" ao lado do motivo quando `is_seller === true`
- No PDF, incluir indicação "Seller" nos registros marcados
- Resetar `isSeller` ao fechar o modal

## 2. Bloquear TBR duplicado no PS

**Arquivo:** `src/pages/dashboard/PSPage.tsx`
- No `handleSave`, antes de inserir, consultar `ps_entries` filtrando por `tbr_code = tbrCode` e `unit_id` e `status = 'open'`
- Se já existir um registro aberto com o mesmo TBR, exibir toast "Este TBR já possui um PS aberto" e não inserir
- Também verificar no `searchTbr`: ao abrir o modal, já alertar se existe PS aberto para aquele TBR

## 3. Horário de leitura nos TBRs bipados (Conferência Carregamento)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Na renderização da lista de TBRs (linha ~1503), entre o código do TBR e o botão X, adicionar o horário formatado como `HH:mm:ss.SSS` extraído de `t.scanned_at`
- Exibir em texto pequeno e cor muted para não poluir visualmente

## Resumo

| Arquivo | Alteração |
|---|---|
| Migração SQL | Adicionar `is_seller boolean default false` em `ps_entries` |
| `src/pages/dashboard/PSPage.tsx` | Checkbox seller, bloqueio de TBR duplicado, badge na tabela, indicação no PDF |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Exibir horário (HH:mm:ss.SSS) ao lado de cada TBR bipado |

