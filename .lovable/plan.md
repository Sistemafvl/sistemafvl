
# Melhorias na Conferencia de Carregamento, Fila e Cadastro de Motorista

## Resumo das 4 demandas

1. **Icone de teclado no campo TBR** + otimizacao da leitura por scanner
2. **Botoes "Cancelar Carregamento" e "Trocar Motorista"** no card de carregamento
3. **Busca por nome no modal "Adicionar Motorista na Fila"** com dados extras (carro, placa, CPF)
4. **Campo "Numero da casa" + upload de documentos obrigatorios** no cadastro de motorista

---

## 1. Icone de Teclado + Otimizacao do Scanner

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

No campo de escaneamento de TBR (linha ~1006-1015):
- Reduzir o tamanho do input de TBR
- Adicionar um icone de teclado (`Keyboard` do Lucide) ao lado do input
- Por padrao, o input opera em modo "scanner" (debounce de 300ms atual sera reduzido para ~150ms para leitura mais rapida)
- Ao clicar no icone de teclado, o modo muda para "manual" -- o debounce desativa e o TBR so e salvo ao pressionar Enter
- Indicador visual: o icone de teclado fica destacado quando em modo manual
- Ao clicar novamente, volta ao modo scanner

**Logica:**
- Novo estado: `manualMode` por `rideId` (Record<string, boolean>)
- No modo scanner: debounce de 150ms (mais rapido que os 300ms atuais)
- No modo manual: sem debounce, salva somente ao pressionar Enter

---

## 2. Botoes "Cancelar Carregamento" e "Trocar Motorista"

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

### Cancelar Carregamento
- Adicionar botao vermelho "Cancelar" na area de acoes do card (ao lado dos botoes Iniciar/Finalizar/Retornar)
- Ao clicar, abre um modal pedindo a **senha do gerente** (`manager_password` da tabela `managers`)
- Validacao: busca o `manager_password` do gerente logado (via `managerSession.id`) e compara
- Ao confirmar:
  1. Todos os TBRs do carregamento sao inseridos como `piso_entries` (status "open", reason "Carregamento cancelado")
  2. O `driver_rides` e atualizado: `loading_status = "cancelled"`
  3. O `queue_entry` associado e marcado como `completed`
- Visualmente, o card fica com fundo vermelho claro e badge "Cancelado"

### Trocar Motorista
- Botao com icone de troca (`RefreshCw` ou `ArrowRightLeft`) logo abaixo do "Cancelar"
- Ao clicar, abre o **mesmo modal de adicionar motorista na fila** (reutiliza a logica do QueuePanel), porem com busca por nome e CPF (conforme item 3)
- Ao selecionar o novo motorista:
  1. Atualiza o `driver_id` do `driver_rides` atual
  2. Atualiza o `driver_id` do `queue_entry` associado
  3. Refresh dos dados

**Novos estados:** `showCancelModal`, `cancelPassword`, `showSwapModal`, `swapSearch`, `swapResults`, `selectedSwapDriver`

---

## 3. Busca por Nome no Modal "Adicionar Motorista na Fila"

**Arquivo:** `src/components/dashboard/QueuePanel.tsx`

No modal "Adicionar Motorista na Fila":
- Adicionar campo de busca por **nome** acima do campo de CPF
- Descricao atualizada: "Busque um motorista cadastrado pelo nome ou CPF"
- O campo de nome faz busca com `ilike` conforme o usuario digita (com debounce de 400ms)
- Resultados aparecem em uma lista/dropdown com:
  - Nome do motorista
  - CPF (formatado)
  - Modelo do carro
  - Cor do carro
  - Placa
- Ao selecionar um resultado, preenche o `foundDriver` diretamente (mesmo comportamento de apos buscar por CPF)
- O campo de CPF continua funcionando como antes (busca exata por Enter)

**Novos estados:** `nameSearch`, `nameResults`, `nameSearchLoading`

---

## 4. Cadastro de Motorista: Numero da Casa + Upload de Documentos

**Arquivo:** `src/components/DriverRegistrationModal.tsx`

### Campo "Numero"
- Adicionar campo `house_number` (Numero) entre Endereco e Bairro no grid
- Coluna na tabela `drivers`: necessaria nova migration para adicionar `house_number text`

### Upload de Documentos Obrigatorios
- Adicionar secao de upload de documentos no formulario de cadastro, com os mesmos 6 tipos do `DriverDocuments.tsx`: CNH, CRLV, Comprovante de Endereco, Outros 1, 2 e 3
- **Obrigatorios:** CNH, CRLV e Comprovante de Endereco (os 3 "Outros" sao opcionais)
- O upload funciona igual ao `DriverDocuments.tsx`: envia para o bucket `driver-documents` no Supabase Storage
- O submit so e habilitado quando os 3 documentos obrigatorios estiverem selecionados
- Apos o insert do motorista, os documentos sao inseridos na tabela `driver_documents`

### Migration necessaria
```sql
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS house_number text;
```

---

## Arquivos modificados

1. **`src/pages/dashboard/ConferenciaCarregamentoPage.tsx`**
   - Icone de teclado no campo TBR com toggle manual/scanner
   - Reduzir debounce para 150ms no modo scanner
   - Botao "Cancelar Carregamento" com modal de senha do gerente
   - Botao "Trocar Motorista" com modal de busca
   - Badge/estilo para carregamentos cancelados

2. **`src/components/dashboard/QueuePanel.tsx`**
   - Campo de busca por nome com resultados filtrados (nome, CPF, carro, placa, cor)
   - Manter campo de CPF existente

3. **`src/components/DriverRegistrationModal.tsx`**
   - Campo "Numero" (house_number)
   - Secao de upload de documentos (CNH*, CRLV*, Comprovante*, Outros 1-3)
   - Validacao de documentos obrigatorios antes do submit

4. **Migration SQL**
   - Adicionar coluna `house_number` na tabela `drivers`
