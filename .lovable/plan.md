
# Plano - 5 Itens

## 1. Lapis de editar Rota, Login e Senha para funcionarios (nao apenas gerente)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

### Problema atual:
Na funcao `renderEditableField` (linha 1026-1043), o icone de lapis so aparece quando `managerSession` esta ativo. Funcionarios comuns (sem sessao de gerente) nao conseguem editar esses campos.

### Solucao:
- Remover a condicao `managerSession` do botao de edicao do lapis, permitindo que qualquer usuario com sessao de unidade possa editar rota, login e senha
- Manter a logica de validacao de login duplicado que ja existe em `handleSaveEdit`
- Remover tambem a condicao `!value && !managerSession` (linha 1026) que esconde campos vazios para nao-gerentes - campos vazios devem ser visiveis e editaveis por todos

## 2. Correcao do modo offline (instabilidade e perda de dados)

**Arquivos:** `src/hooks/use-offline-sync.ts`, `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

### Problema atual:
O hook `use-offline-sync` foi criado mas NAO foi integrado na `ConferenciaCarregamentoPage`. As funcoes `saveTbr` e `handleDeleteTbr` fazem chamadas diretas ao Supabase sem verificar `navigator.onLine`. Quando offline, essas chamadas falham silenciosamente, causando perda de dados e instabilidade.

### Solucao:
- Integrar o hook `useOfflineSync` na `ConferenciaCarregamentoPage`
- Nos metodos `saveTbr` e `handleDeleteTbr`, verificar `navigator.onLine`:
  - Se **online**: comportamento atual (chamada direta ao banco)
  - Se **offline**: usar `queueOp` do hook para enfileirar a operacao no IndexedDB + manter a atualizacao otimista da UI
- Na funcao `fetchRides`, quando offline: carregar dados do cache IndexedDB (via `getCachedRides` e `getCachedTbrs`)
- Quando online e dados carregados com sucesso: salvar no cache (via `cacheRides` e `cacheTbrs`)
- Desabilitar o canal Realtime quando offline para evitar erros de conexao

## 3. Restaurar notificacoes Toast

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` e demais paginas

### Problema atual:
Os toasts foram removidos em implementacoes anteriores conforme politica de interface limpa, mas o usuario quer que voltem.

### Solucao:
- Manter todos os toasts existentes no codigo (login duplicado, TBR em viagem, camera, etc.)
- Adicionar toasts de feedback nas operacoes criticas que estao sem notificacao:
  - Sucesso ao gravar TBR
  - Sucesso ao excluir TBR
  - Sucesso ao finalizar carregamento
  - Erro em operacoes de banco
- Os toasts de excecao aprovada (bloqueio TBR em viagem, notificacao de chamada de motorista) ja existem e serao mantidos

## 4. PS - Problem Solve: Filtros, foto, relatorio PDF, motivos e modal do Retorno Piso

**Arquivos:** `src/pages/dashboard/PSPage.tsx`, `src/pages/dashboard/RetornoPisoPage.tsx`

### Migracao de banco necessaria:
- Adicionar coluna `reason` (text, nullable) na tabela `ps_entries` para armazenar o motivo do PS
- Adicionar coluna `photo_url` (text, nullable) na tabela `ps_entries` para armazenar a URL da foto
- Criar tabela `ps_reasons` (id, unit_id, label, created_at) para motivos customizaveis do PS (mesma estrutura de `piso_reasons`)

### PSPage.tsx - Novos recursos:

**a) Filtro de data (De/Ate):**
- Dois seletores de data usando `Popover` + `Calendar` (mesmo padrao da ConferenciaCarregamento)
- Filtrar `loadEntries` com `.gte("created_at", startDate)` e `.lte("created_at", endDate)`

**b) Filtro de status:**
- Select com opcoes: "Todos", "Aberto", "Finalizado"
- Aplicar filtro `.eq("status", selectedStatus)` quando nao for "Todos"

**c) Filtro de motivo:**
- Select com lista de motivos (DEFAULT_REASONS + motivos customizados da tabela `ps_reasons`)
- Incluir campo de busca no dropdown (usando Popover + Command, mesmo padrao do combobox)

**d) Botao de gerar relatorio PDF:**
- Botao ao lado dos filtros que gera um PDF com os dados filtrados da tabela
- Usar `jspdf` + `html2canvas` (ja instalados no projeto)
- O PDF contera: cabecalho com logo, titulo "Relatorio PS - Problem Solve", tabela com todos os registros filtrados, rodape com data de geracao

**e) Mecanismo de foto:**
- Ao escanear um TBR na tela PS, o modal de inclusao de PS tera:
  - Campo de motivo (Select com busca + botao "+" para adicionar novos motivos, mesma logica do Retorno Piso)
  - Botao "Tirar Foto" que abre a camera do dispositivo via `getUserMedia`
  - Preview da foto capturada com opcao de refazer
  - A foto sera enviada ao Storage do Supabase e a URL salva na coluna `photo_url`
- Substituir o campo `Textarea` de descricao pelo campo de motivo (Select) para padronizar

**f) Escaneamento direto na tela PS:**
- O scanner na tela PS cria um novo PS diretamente (mesmo efeito de transferir do Retorno Piso)
- Ao escanear, abre o modal com as info do TBR + campo de motivo + foto

### RetornoPisoPage.tsx - Modal ao clicar "PS":

**Problema atual:** O botao "PS" na tabela do Retorno Piso migra o registro diretamente sem pedir informacoes adicionais (`handleMigratePs`).

**Solucao:**
- Ao clicar "PS", abrir um modal (em vez de migrar diretamente)
- O modal contera:
  - Informacoes do TBR (codigo, motorista, rota)
  - Campo de motivo do PS (Select com busca, mesmos motivos: "3 tentativas de entrega", "produto danificado", "embalagem danificada", etc.)
  - Botao "+" para criar novos motivos (salva na tabela `ps_reasons`)
  - Botao "Tirar Foto" (mesma logica do PS)
  - Botao "Confirmar" que grava o PS com motivo e foto
- Manter a logica de fechar o `piso_entry` apos a migracao

## 5. Registrar atualizacoes do sistema

Ao final da implementacao, inserir registros automaticos na tabela `system_updates` descrevendo todas as mudancas realizadas.

---

## Detalhes Tecnicos

### Migracao SQL necessaria:

```text
1. ALTER TABLE ps_entries ADD COLUMN reason text;
2. ALTER TABLE ps_entries ADD COLUMN photo_url text;
3. CREATE TABLE ps_reasons (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     unit_id uuid NOT NULL REFERENCES units(id),
     label text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now()
   );
4. RLS policies para ps_reasons (mesmas de piso_reasons)
5. Criar bucket de storage "ps-photos" para as fotos
```

### Fluxo da foto:
```text
1. Usuario clica "Tirar Foto"
2. getUserMedia abre camera (chamada direta no onClick)
3. Frame capturado em canvas -> blob JPEG
4. Upload para storage bucket "ps-photos"
5. URL publica salva na coluna photo_url do ps_entry
```

### Fluxo do modal PS no Retorno Piso:
```text
1. Clica "PS" na linha do Retorno Piso
2. Modal abre com info do TBR
3. Seleciona motivo (ou cria novo com "+")
4. Opcionalmente tira foto
5. Clica "Confirmar"
6. Insere ps_entry com reason + photo_url
7. Fecha piso_entry (status closed)
8. Fecha modal e atualiza lista
```

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `ConferenciaCarregamentoPage.tsx` | Lapis para todos + integracao offline + toasts |
| `PSPage.tsx` | Filtros data/status/motivo + foto + PDF + scanner direto + campo reason |
| `RetornoPisoPage.tsx` | Modal ao clicar PS com motivo + foto |
| `use-offline-sync.ts` | Ajustes de estabilidade |
| Migracao SQL | Colunas reason/photo_url em ps_entries + tabela ps_reasons + storage bucket |
| Insercao de dados | Registros automaticos em system_updates |
