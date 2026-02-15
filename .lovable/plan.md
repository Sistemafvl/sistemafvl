
# Cores de Status nos Cards de Conferencia

Adicionar cores de fundo sutis nos cards de carregamento para indicar visualmente o status de cada motorista.

## Cores

- **Pendente** (nao iniciado): Fundo branco (padrao, sem alteracao)
- **Em andamento** (loading): Fundo azul claro sutil
- **Finalizado** (finished): Fundo verde claro sutil

## Alteracao

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

Na renderizacao do card (linha ~651), adicionar classes condicionais de background baseadas no `status`:

```text
pending  -> sem classe adicional (bg padrao do Card)
loading  -> bg-blue-50 border-blue-200
finished -> bg-green-50 border-green-200
```

Sera uma unica linha de logica usando `cn()` para aplicar a classe correta ao componente `Card`, mantendo todas as outras propriedades intactas.
