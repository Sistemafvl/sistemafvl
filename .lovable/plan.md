

## Problema

O botão "Iniciar" sumiu para os demais conferentes porque a condição `isMyRide` verifica `ride.conferente_id === conferenteSession?.id`, mas antes de iniciar o carregamento, o `conferente_id` pode ser `null` ou pertencer a outro conferente. O isolamento deveria aplicar-se **apenas após o início** (status `loading`), não antes.

## Correção

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**Linha ~1736** — Remover `isMyRide` do botão "Iniciar":

```diff
- {!isLoadingStatus && !isFinished && isMyRide && (
+ {!isLoadingStatus && !isFinished && (
```

Assim:
- **Iniciar**: visível para qualquer conferente (como antes)
- **Finalizar / Modo Foco / Input TBR**: apenas para o conferente atribuído ou gerente (`isMyRide`)
- **Retornar**: apenas para o conferente atribuído ou gerente (`isMyRide`)

O isolamento continua funcionando: ao clicar "Iniciar", o sistema grava o `conferente_id` do conferente logado, e a partir daí só ele (ou o gerente) pode bipar e finalizar.

