
# Plano de Correcoes - 3 Itens

## 1. Campo de busca no seletor de Login (modal Programar Carregamento) + Remover combobox do Conferente

**Arquivos:** `src/components/dashboard/QueuePanel.tsx`, `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

### O que sera feito:
- **QueuePanel.tsx**: Substituir o `Select` de logins no modal "Programar Carregamento" por um `Popover` + `Command` (combobox com busca), permitindo digitar para filtrar logins por nome. Manter o indicador de check verde para logins ja usados no dia.
- **ConferenciaCarregamentoPage.tsx**: Remover o componente `ConferenteCombobox` e reverter o seletor de conferente para um `Select` simples (sem campo de busca). Manter a logica de travamento (`lockedConferenteIds` via useState) que ja funciona corretamente - quando conferente e selecionado, o campo fica travado (exibe texto com icone de cadeado).

## 2. Fix DEFINITIVO da exclusao de TBR - CAUSA RAIZ ENCONTRADA

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` + migracao de banco de dados

### Causa raiz real:
A politica RLS da tabela `ride_tbrs` para DELETE exige o role `authenticated`, mas o sistema usa o role `anon` (chave anonima do Supabase). O DELETE retorna status 204 (sucesso), mas **nenhuma linha e realmente deletada** no banco de dados. Por isso o TBR sempre "volta" - ele nunca foi deletado de verdade.

### Solucao:
1. **Migracao SQL**: Alterar a politica RLS de DELETE na tabela `ride_tbrs` para permitir o role `anon` (ou `public`), igual as outras politicas da tabela (INSERT, SELECT, UPDATE ja permitem `public`)
2. Remover o `deletingRef` e o `realtimeLockUntil` que eram workarounds para um problema que nao existia - a exclusao simplesmente nao estava funcionando no banco
3. Simplificar o `handleDeleteTbr` para: deletar do banco, verificar sucesso, criar piso_entry, e chamar fetchRides normalmente

```sql
DROP POLICY "Authenticated can delete ride_tbrs" ON ride_tbrs;
CREATE POLICY "Anyone can delete ride_tbrs" ON ride_tbrs FOR DELETE USING (true);
```

**Nota importante:** Manter o lock temporal de 5 segundos como seguranca contra race conditions de Realtime, mesmo apos corrigir a RLS. O lock previne re-fetches desnecessarios durante as operacoes em cascata (piso_entries, rto_entries).

## 3. Leitura por camera (scanner de codigo de barras / QR Code) - Anexo 6

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

### O que sera feito:
- Adicionar um botao de camera (icone `Camera`) ao lado do campo de input TBR, visivel quando o carregamento esta no status "loading"
- Ao clicar, abre um modal com a camera do celular usando `navigator.mediaDevices.getUserMedia`
- Utilizar a API `BarcodeDetector` (nativa em navegadores modernos) para decodificar codigos de barras e QR codes em tempo real a partir do stream de video
- Para navegadores que nao suportam `BarcodeDetector`, exibir mensagem informando que o recurso nao esta disponivel nesse dispositivo
- Cada leitura bem-sucedida emite um som de beep agudo (frequencia 1000Hz, 150ms) e registra o TBR automaticamente via `saveTbr`
- Leituras com erro (TBR duplicado, bloqueado, etc.) emitem o som de erro ja existente (`playErrorBeep`)
- O modal da camera permanece aberto para leituras consecutivas, com um indicador visual do ultimo codigo lido
- Botao para fechar a camera e voltar ao modo manual

### Fluxo:
1. Usuario clica no icone de camera no card do carregamento (status loading)
2. Modal abre com preview da camera
3. Camera detecta codigo de barras/QR automaticamente
4. Beep de sucesso + TBR registrado
5. Continua escaneando ate fechar o modal

---

## Resumo de Arquivos

| Arquivo | Alteracao |
|---|---|
| `QueuePanel.tsx` | Substituir Select por Combobox com busca no seletor de login |
| `ConferenciaCarregamentoPage.tsx` | Reverter conferente para Select simples + camera scanner + simplificar delete |
| Migracao SQL | Corrigir politica RLS de DELETE em ride_tbrs |
