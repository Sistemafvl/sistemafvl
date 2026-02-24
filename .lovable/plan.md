
# Correcao: TBRs nao saem do Retorno Piso ao entrar no carregamento

## Problema

Quando um TBR e escaneado pela primeira vez num carregamento (sem historico em ride_tbrs anteriores), o codigo que fecha a entrada no Retorno Piso **nunca e executado**. Isso porque a logica de fechar `piso_entries` esta dentro do bloco `if (previousTbrs.length > 0)` (linha 622), que so roda para TBRs que ja estiveram em viagens anteriores.

Para TBRs na primeira viagem, `previousTbrs` e vazio, o bloco inteiro e pulado, e a entrada no Retorno Piso permanece com status "open".

Os 4 TBRs da imagem confirmam isso: todos tem status "open" no banco mesmo estando em carregamentos ativos.

## Solucao

Mover a logica de fechar `piso_entries` e `rto_entries` para **fora** do bloco `if (previousTbrs.length > 0)`, garantindo que sempre execute ao escanear um TBR no carregamento.

## Detalhes Tecnicos

### Arquivo: `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Reorganizar o fluxo dentro de `saveTbr` (linhas 613-691):

1. Manter a verificacao de carregamento ativo (linhas 622-642) dentro do `if (previousTbrs.length > 0)`
2. Manter a verificacao de "TBR em viagem" (linhas 644-660) dentro do `if (previousTbrs.length > 0)` -- so faz sentido para reincidencias
3. **Mover** o fechamento de `piso_entries` (linhas 664-669) e `rto_entries` (linhas 674-678) para **depois** do bloco `if`, antes do insert
4. Executar o fechamento de piso **sempre**, independente de haver viagens anteriores

Estrutura resultante:

```
if (count === 0) {
  // Buscar previousTbrs
  let tripNumber = 1;

  if (previousTbrs.length > 0) {
    // Verificar carregamento ativo (bloquear)
    // Verificar se tem piso entry (bloquear se nao tem)
    tripNumber = previousTbrs.length + 1;
    playReincidenceBeep();
  }

  // SEMPRE fechar piso_entries e rto_entries (movido para fora)
  await supabase.from("piso_entries")
    .update({ status: "closed", closed_at: ... })
    .eq("tbr_code", code).eq("status", "open");

  await supabase.from("rto_entries")
    .update({ status: "closed", closed_at: ... })
    .eq("tbr_code", code).eq("status", "open");

  // Inserir no ride_tbrs...
}
```

### Resumo de arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Mover fechamento de piso_entries/rto_entries para fora do bloco de reincidencia |
