

# QR Codes para Entrada na Fila — Turnos Madrugada e Diurno

## O que muda

Dois botões na sidebar do Painel de Chamada (entre Avaliação e logos) que geram QR codes em PDF A4 para impressão. Cada QR code contém uma URL com parâmetros que, ao ser escaneada pelo motorista, entra automaticamente na fila. Um funciona de 00:00-05:00, outro de 05:01-23:59.

No lado do motorista, um botão "Entrar na Fila via QR Code" abre a câmera para escanear o QR code impresso.

## Funcionamento

1. **Geração do QR Code**: Cada botão gera um PDF A4 com QR code apontando para uma URL tipo `/driver/queue?qr=madrugada&unit=UNIT_ID&date=2026-03-23` ou `qr=diurno`
2. **Validação temporal**: Quando o motorista escaneia, a página de fila valida se o QR é válido para o horário atual (BRT):
   - `madrugada`: 00:00-05:00
   - `diurno`: 05:01-23:59
3. **Validade diária**: O QR inclui a data do dia — se a data não bater com hoje, é rejeitado
4. **Ação**: Se válido, chama `joinQueue()` automaticamente

## Implementação

### 1. Instalar biblioteca de QR Code
- Adicionar `qrcode` ao package.json para gerar QR codes em canvas/data URL

### 2. Sidebar — Botões de QR Code (`CallingPanelPage.tsx`)
- Dois botões compactos entre Avaliação e logos: "QR Madrugada (00-05h)" e "QR Diurno (05-24h)"
- Ao clicar, gerar PDF A4 via `jspdf` (já no projeto) com:
  - Título "FILA — TURNO MADRUGADA" ou "FILA — TURNO DIURNO"
  - QR Code centralizado (~200x200mm)
  - Nome da unidade e data
  - URL codificada: `{origin}/driver/queue?qr_turno=madrugada&qr_unit={unitId}&qr_date={hoje}`
- Abrir PDF para download/impressão

### 3. Tela do Motorista — Botão Scanner (`DriverQueue.tsx`)
- Abaixo do botão "ENTRAR NA FILA", adicionar botão "ENTRAR VIA QR CODE"
- Ao clicar, abrir scanner de câmera (o projeto já tem `TbrScanner` / `Html5QrcodeScanner`)
- Ao ler o QR, extrair parâmetros da URL e validar:
  - Turno correto para o horário BRT atual
  - Data = hoje
  - `unit_id` = unidade atual do motorista
- Se válido, chamar `joinQueue()` automaticamente
- Se inválido, exibir toast com motivo ("QR fora do horário", "QR expirado")

### 4. Alternativa: entrada via URL direta
- Se o motorista escanear o QR com a câmera nativa do celular (fora do app), a URL abrirá a página de fila com os query params
- Em `DriverQueue.tsx`, no `useEffect` inicial, verificar se há `qr_turno` nos search params e processar entrada automática

### Arquivos alterados
- `package.json` — adicionar `qrcode`
- `src/pages/dashboard/CallingPanelPage.tsx` — 2 botões + geração PDF
- `src/pages/driver/DriverQueue.tsx` — botão scanner + lógica de entrada via QR/URL params

