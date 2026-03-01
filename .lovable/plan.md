

## Diagnóstico

Quando Ricardo clica "Iniciar", o banco atualiza `loading_status` para `"loading"`. O polling de 5 segundos no computador do Paulo busca esses dados atualizados, e como a condição para exibir o campo de TBR é apenas `isLoadingStatus` (linha 1859), o input de bipagem aparece automaticamente no card — **independente de quem é o conferente atribuído**. Não há filtro verificando se o conferente logado é o mesmo que iniciou aquele carregamento.

## Solução

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Adicionar uma verificação de **propriedade do conferente** antes de exibir o campo de input de TBR. Apenas o conferente que está atribuído àquele carregamento (`ride.conferente_id`) poderá ver o campo de escaneamento e interagir com a bipagem.

### Mudanças específicas:

1. **Campo de input TBR inline (linha ~1859)** — Mudar a condição de `isLoadingStatus` para `isLoadingStatus && isMyRide`, onde `isMyRide` verifica se `ride.conferente_id === conferenteSession?.id` (ou se é gerente, que pode tudo).

2. **Botão "Finalizar" e "Modo Foco" (linhas ~1740-1748)** — Restringir esses botões também ao conferente atribuído ou ao gerente.

3. **Focus Mode Overlay (linha ~1910)** — Adicionar verificação para que o overlay só abra se o ride pertence ao conferente logado.

4. **Para os outros conferentes** — O card continua visível com o status atualizado (mostrando "Carregando..."), a contagem de TBRs lidos, e o nome do conferente responsável, mas **sem** o campo de input de escaneamento e sem possibilidade de Finalizar/Retornar.

### Regra:
```
isMyRide = !!managerSession || ride.conferente_id === conferenteSession?.id
```

- **Gerente**: acesso total a todos os cards
- **Conferente**: só interage com cards onde ele é o conferente atribuído
- **Visualização**: todos veem o status e a lista de TBRs, mas só quem é responsável pode bipar e finalizar

