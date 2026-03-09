

# Plano: Botão de Conferência de Retorno com Modal de Verificação

## Resumo

Criar um botão "Conferência de Retorno" entre os cards de métricas e o card "Retorno Piso". Ao clicar, abre um modal/sheet onde o conferente pode bipar TBRs para dar check, visualizar detalhes de cada item conferido e gerar um PDF para impressão. O estado persiste entre aberturas do modal (itens já conferidos permanecem marcados).

## Estrutura do Modal

```text
┌─────────────────────────────────────────┐
│  ✅ Conferência de Retorno        [X]   │
│─────────────────────────────────────────│
│  [🔍 Bipe ou digite o TBR...       ]    │
│                                         │
│  Conferidos: 5 / 28 total               │
│─────────────────────────────────────────│
│  ☑ TBR319692907  Natan Ribeiro          │
│    Rota: 0821C | Danificado | 14:32     │
│  ☑ TBR319692908  João Silva             │
│    Rota: 0822A | 1ª tentativa | 15:10   │
│  ☐ TBR319692910  Maria Santos           │
│    Rota: 0823B | Ausente | 16:45        │
│  ...                                    │
│─────────────────────────────────────────│
│  [📄 Gerar PDF]                         │
└─────────────────────────────────────────┘
```

## Implementação

### No `RetornoPisoPage.tsx`:

1. **Estado persistente** — `checkedTbrs` (Set de IDs) armazenado via `useState`, sobrevive entre aberturas do modal (não reseta ao fechar).

2. **Botão entre cards e card principal** — Botão estilizado com ícone `ClipboardCheck`, posicionado após o grid de cards e antes do Card "Retorno Piso".

3. **Modal (Sheet lateral)** — Usa `Sheet` do shadcn para abrir um painel lateral com:
   - Input de scanner no topo para bipar TBRs
   - Ao bipar, localiza o TBR na lista de `entries` e marca como conferido (adiciona ao Set)
   - Lista todos os `entries` (filtrados ou não) com checkbox visual, mostrando: TBR, motorista, rota, motivo, hora
   - Contador "X de Y conferidos"
   - Possibilidade de desmarcar clicando no item

4. **Geração de PDF** — Botão "Gerar PDF" que usa `jspdf` + `html2canvas` para capturar a lista conferida e gerar um relatório imprimível com:
   - Cabeçalho com nome da unidade e data
   - Tabela com TBR, Motorista, Rota, Motivo, Data/Hora, Status (Conferido ✓ / Pendente)
   - Rodapé com total conferido vs total

5. **Reset** — Botão opcional para limpar conferidos e reiniciar.

## Arquivo alterado

- `src/pages/dashboard/RetornoPisoPage.tsx` — adicionar botão, modal Sheet, lógica de conferência e geração de PDF

