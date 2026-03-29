

## Plano: Tooltips explicativos nas colunas da Tabela Comparativa

### O que muda

Substituir o ícone `<Info>` isolado (que não faz nada) por tooltips individuais em cada cabeçalho de coluna da tabela. Ao passar o mouse sobre o nome da coluna, um balão aparece explicando o significado.

### Implementação

**Arquivo:** `src/pages/matriz/GeneralAnalysisPage.tsx`

1. Importar `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` de `@/components/ui/tooltip`
2. Remover o ícone `<Info>` solto no header do card (linha 128)
3. Envolver a tabela com `<TooltipProvider>`
4. Em cada `<TableHead>`, adicionar um `<Tooltip>` com o texto do nome da coluna + ícone `<Info>` pequeno ao lado, e um `<TooltipContent>` com a explicação:

| Coluna | Explicação |
|--------|-----------|
| Unidade | Código identificador da unidade operacional |
| Viagens | Total de viagens (TBRs) realizadas no período selecionado |
| Contestações | Quantidade de contestações registradas pelos motoristas |
| Pendentes | Contestações ainda não resolvidas pela gestão da unidade |
| Score | Índice de eficiência: razão entre contestações e viagens (quanto menor, melhor) |

### Detalhes técnicos
- Usar `<Tooltip>` do Radix (já existe no projeto) para hover nativo em desktop
- Cada header terá: `Nome da coluna` + pequeno ícone `Info` (h-3 w-3) envolto em `TooltipTrigger`
- O balão aparece ao passar o mouse, sem necessidade de clicar

