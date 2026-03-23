

# Mover Botões QR Code para o Painel de Fila

## O que muda

1. **Remover** os 2 botões QR e o texto "QR Fila" da sidebar do Painel de Chamada (`CallingPanelPage.tsx`, linhas 461-478)
2. **Adicionar** os 2 botões no `QueuePanel.tsx`, entre o header (título "Fila de Motoristas") e o campo de busca — na área marcada na imagem

## Implementação

### `src/components/dashboard/QueuePanel.tsx`
- Inserir entre o `</SheetHeader>` (linha 631) e o `<div className="px-3 pt-3 pb-1">` (linha 634) dois botões lado a lado (flex row, gap-2, px-3 pt-2)
- Mover a lógica `generateQrPdf` para o QueuePanel (precisa do `unitId` que já está disponível)
- Importar `QRCode` e `jsPDF`
- Botões compactos: ícone 🌙 / ☀️ + texto curto, estilo outline pequeno

### `src/pages/dashboard/CallingPanelPage.tsx`
- Remover linhas 461-478 (seção QR Code buttons inteira)

### Arquivos alterados
- `src/components/dashboard/QueuePanel.tsx` — adicionar botões QR + lógica de geração PDF
- `src/pages/dashboard/CallingPanelPage.tsx` — remover seção QR Code

