

## Plano: Adicionar 3 campos de foto no PS

### Situação atual
A tabela `ps_entries` possui apenas uma coluna `photo_url`. A interface permite capturar apenas 1 foto por vez.

### Solução

#### 1. Migração SQL — adicionar `photo_url_2` e `photo_url_3`
```sql
ALTER TABLE public.ps_entries
  ADD COLUMN photo_url_2 TEXT,
  ADD COLUMN photo_url_3 TEXT;
```

#### 2. PSPage.tsx — interface com 3 slots de foto
- Substituir os estados únicos (`capturedPhoto`, `photoPreview`) por arrays de 3 posições
- Exibir 3 slots lado a lado (grid 3 colunas), cada um com botão "Tirar Foto" independente
- Cada slot permite capturar, visualizar e refazer a foto individualmente
- A câmera é compartilhada — ao clicar "Tirar Foto" em qualquer slot, a captura preenche aquele slot específico
- No `handleSave`, fazer upload de até 3 fotos e salvar em `photo_url`, `photo_url_2`, `photo_url_3`
- No modo edição, carregar as 3 previews existentes
- Na listagem/tabela, o botão de câmera abre as fotos disponíveis
- No PDF, incluir até 3 fotos por entrada

### Arquivos alterados
- **Nova migração SQL** — adicionar colunas `photo_url_2` e `photo_url_3`
- `src/pages/dashboard/PSPage.tsx` — interface de 3 fotos e lógica de upload/save/PDF

