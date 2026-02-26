

# Plano: 3 Correções — Animação na Fila, Info no Rastreamento TBR, Validação TBR

## 1. Animação na reordenação de motoristas na fila

**Arquivo:** `src/components/dashboard/QueuePanel.tsx`

Ao clicar nos botões de subir/descer (ChevronUp/ChevronDown), a transição atual é instantânea — os cards simplesmente trocam de posição sem feedback visual.

**Solução:** Adicionar animação CSS de transição nos cards da fila. Ao clicar para mover, o card selecionado recebe uma classe temporária que o anima na direção do movimento (translateY para cima ou para baixo), e o card vizinho recebe a animação oposta. Após ~300ms, a lista atualiza com os dados reais.

Detalhes:
- Criar estado `animatingIdx` e `animatingDirection` para rastrear qual card está sendo movido
- Antes de chamar `handleMoveEntry`, aplicar classes CSS de transição (transform + transition)
- Após a animação (300ms), executar o swap real no banco
- Os cards se movem suavemente passando "por cima" um do outro

---

## 2. Informações adicionais no Rastreamento TBR (fallback)

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

Quando um TBR é encontrado apenas nas tabelas de ocorrências (PS, RTO, DNR, Piso) e não em `ride_tbrs`, o modal mostra campos vazios como "Início: —", "Término: —", "Status: Sem carregamento". O usuário quer ver:

- **Data de lançamento** — quando o TBR foi registrado na tela (campo `created_at` da entrada encontrada)
- **Tela de origem** — qual módulo registrou o TBR (PS, RTO, DNR ou Retorno Piso)

**Solução:**
- Adicionar dois novos campos ao `TbrResult`: `entry_date` (data de lançamento) e `entry_source` (tela de origem)
- Preencher esses campos no bloco de fallback com base em qual tabela encontrou o TBR
- Exibir no grid do modal: "**Lançamento:** dd/MM/yyyy HH:mm" e "**Origem:** PS / RTO / DNR / Retorno Piso"
- Quando o TBR vem de `ride_tbrs`, a origem é "Conferência Carregamento" e a data é o `scanned_at`

---

## 3. Validação de código TBR — rejeitar caracteres não numéricos

**Arquivos afetados:**
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (scanner + input manual)
- `src/pages/dashboard/PSPage.tsx` (input + scanner)
- `src/pages/dashboard/RTOPage.tsx` (input)
- `src/pages/dashboard/RetornoPisoPage.tsx` (input)
- `src/pages/dashboard/DashboardHome.tsx` (busca TBR)

O usuário observou que códigos com aspas e caracteres especiais (ex: `TBR3'23"2908`) são aceitos pelo sistema. Um TBR válido é composto apenas por letras "TBR" seguidas de **dígitos numéricos**.

**Solução:** Criar uma função utilitária `isValidTbrCode(code: string): boolean` que verifica:
1. O código começa com "TBR" (case-insensitive)
2. Após o prefixo "TBR", todos os caracteres restantes são dígitos (`/^\d+$/`)
3. Se o código não atende, mostrar erro e rejeitar a leitura

Aplicar essa validação em todos os pontos de entrada:
- No `saveTbr` da Conferência (antes do check `startsWith("TBR")`)
- No `handleTbrInput` do PS (antes do `searchTbr`)
- No `handleTbrKeyDown` do RTO (antes de processar)
- No `handleTbrKeyDown` do Retorno Piso (antes de processar)
- No scanner de câmera da Conferência e PS (no callback `onDetected`)
- Na busca TBR do Dashboard (antes de pesquisar)

A função ficará em `src/lib/utils.ts` para reutilização.

---

## Resumo de Arquivos

| Arquivo | Alteração |
|---|---|
| `src/lib/utils.ts` | Adicionar função `isValidTbrCode()` |
| `src/components/dashboard/QueuePanel.tsx` | Animação de transição nos cards ao reordenar |
| `src/pages/dashboard/DashboardHome.tsx` | Campos "Lançamento" e "Origem" no modal TBR + validação TBR |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Validação TBR no scanner e input |
| `src/pages/dashboard/PSPage.tsx` | Validação TBR no scanner e input |
| `src/pages/dashboard/RTOPage.tsx` | Validação TBR no input |
| `src/pages/dashboard/RetornoPisoPage.tsx` | Validação TBR no input |

