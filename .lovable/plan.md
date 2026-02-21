

## Plano de Implementacao - 4 Ajustes Solicitados

### 1. Filtro de data do PS abrindo no dia de hoje (PSPage.tsx)

Atualmente o `startDate` inicia com 30 dias atras. Sera alterado para iniciar no dia de hoje (00:00) e o `endDate` tambem no dia de hoje (23:59), assim ao abrir a pagina o filtro ja mostra apenas os registros do dia.

**Arquivo:** `src/pages/dashboard/PSPage.tsx` (linha 94-95)
- `startDate`: `new Date()` com horas zeradas (hoje 00:00)
- `endDate`: `new Date()` com horas 23:59:59 (hoje 23:59)

---

### 2. PDF do PS com foto de cada registro (PSPage.tsx)

O PDF atual usa jsPDF com texto puro. Sera modificado para:
- Apos cada linha de informacoes do PS (TBR, Motorista, Rota, Motivo, Data, Status), se o registro tiver `photo_url`, carregar a imagem e inseri-la no PDF logo abaixo da linha
- Cada PS sera listado sequencialmente: informacoes + foto + proximo PS + foto, etc.
- Controle de quebra de pagina considerando a altura da imagem

**Arquivo:** `src/pages/dashboard/PSPage.tsx` (funcao `generatePDF`, linhas 384-418)
- Tornar a funcao `async` para carregar imagens
- Para cada entry com `photo_url`, carregar como base64 e usar `doc.addImage()`
- Foto com largura proporcional (~80mm) abaixo das informacoes

---

### 3. Barra de rolagem no modal PS do Retorno Piso (RetornoPisoPage.tsx)

O modal PS usa o componente `<Dialog>` do Radix, que nao tem scroll por padrao quando o conteudo ultrapassa a tela. Sera adicionado `max-h-[85vh] overflow-y-auto` ao `DialogContent` para garantir rolagem em dispositivos menores.

**Arquivo:** `src/pages/dashboard/RetornoPisoPage.tsx` (linha 513)
- Adicionar classes `max-h-[85vh] overflow-y-auto` ao `<DialogContent>`

---

### 4. Renomear "Top Retornos (Piso + RTO)" (DashboardInsights.tsx)

Alterar o titulo do card de ranking de `"Top Retornos (Piso + RTO)"` para `"Maiores Ofensores de Retorno TBRs"`.

**Arquivo:** `src/components/dashboard/DashboardInsights.tsx` (linha 271)
- Trocar a string do `title`

---

### Resumo dos arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/PSPage.tsx` | Data padrao = hoje; PDF com fotos |
| `src/pages/dashboard/RetornoPisoPage.tsx` | Scroll no modal PS |
| `src/components/dashboard/DashboardInsights.tsx` | Renomear titulo do card |

