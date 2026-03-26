

# Fix: Retornos contando TBRs que ainda estão no carregamento

## Causa Raiz

O trigger `auto_remove_tbr_from_ride` deveria deletar o TBR de `ride_tbrs` quando um retorno (piso/ps/rto) é criado. Porém, para dados anteriores à criação do trigger (ou casos onde o trigger falhou), existem TBRs que estão **simultaneamente** em `ride_tbrs` E em `piso_entries`/`ps_entries`/`rto_entries`.

No caso do Marcos Melo em 16/03 (SQA9): ele tem 100 TBRs em `ride_tbrs`, mas 98 desses TBRs também têm entradas de retorno. Como o código do relatório conta esses retornos sem verificar se o TBR ainda está carregado, mostra 98 retornos e apenas 2 concluídos — quando deveria mostrar o contrário.

## Solução

### `src/pages/dashboard/RelatoriosPage.tsx` (linhas 606-620)

Antes de processar `netReturns`, criar um Set com os códigos TBR ativos (presentes em `ride_tbrs` para os rides do dia). Ao iterar `returnCodesForDay`, pular qualquer código que ainda exista em `ride_tbrs` — pois se o TBR está carregado, o retorno não é efetivo:

```typescript
// Códigos ativos na carga (ride_tbrs) — se estão lá, o retorno não vale
const activeTbrCodes = new Set(
  rTbrs.map((t: any) => t.code?.toString().toUpperCase()).filter(Boolean)
);

const netReturns = new Set<string>();
returnCodesForDay.forEach(codeUpper => {
  // TBR ainda está no carregamento → não é retorno efetivo
  if (activeTbrCodes.has(codeUpper)) return;

  // ... restante da lógica existente (lastRideId, etc.)
});
```

Isso corrige automaticamente **todas as unidades**, presente e futuro, sem necessidade de alterar dados no banco.

## Arquivos alterados
- **`src/pages/dashboard/RelatoriosPage.tsx`** — adicionar filtro de TBRs ativos antes de contar retornos

