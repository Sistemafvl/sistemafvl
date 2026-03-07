

## Plano: 4 Correções Solicitadas

### 1. Botão de editar (lápis) nos Logins e Senhas + verificar exclusão
**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`

- Adicionar estado para edição inline (`editingLoginId`, `editLoginValue`, `editPasswordValue`)
- Na lista de logins (linhas 334-341), adicionar um botão com ícone `Pencil` ao lado do `Trash2`
- Ao clicar no lápis, o item entra em modo de edição com inputs inline para login e senha, e botões de salvar/cancelar
- Ao salvar, chamar `supabase.from("unit_logins").update({ login, password }).eq("id", id)`
- Importar `Pencil` do lucide-react (linha 7)
- A exclusão atual já faz `supabase.from("unit_logins").delete().eq("id", id)` — está correto, exclui do banco permanentemente

### 2. Balão de insucessos flutuante acima do botão Fila
**Arquivo:** `src/components/dashboard/DashboardLayout.tsx`

- Criar um componente `InsucessoBalloon` inline ou separado que:
  - Busca `piso_entries` do dia anterior com motivos operacionais (`OPERATIONAL_PISO_REASONS`) e status `open`
  - Cruza com `ride_tbrs` do dia atual: se o TBR do insucesso já foi lido hoje, não conta
  - Mostra um balão flutuante acima do botão Fila (`fixed bottom-[120px] right-6`) com o contador
  - Ao clicar, abre um modal/sheet listando TBR, rota, motorista, horário do insucesso
  - Tem um botão X para fechar, mas reabre automaticamente quando um TBR sai (contador muda)
  - Subscribe no realtime de `ride_tbrs` para decrementar conforme TBRs são lidos

**Arquivo:** `src/components/dashboard/QueuePanel.tsx` — ajustar posição do toast para não sobrepor o balão

### 3. Validação de login obrigatório ao finalizar carregamento
**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (linhas 2888-2915)

- No modal de Confirmar Finalização, verificar se `ride?.login` é nulo ou vazio
- Se vazio, desabilitar o botão "Confirmar e Finalizar" e mostrar um alerta vermelho: "Não é possível finalizar sem preencher o login do coletor"
- O conferente precisa voltar ao card e preencher o login antes de finalizar

### 4. Remover quadrados de Ciclo 1, 2 e 3 da página
**Arquivo:** `src/pages/dashboard/CiclosPage.tsx` (linhas 436-479)

- Remover o bloco `grid grid-cols-1 md:grid-cols-3` que renderiza os 3 cards de Ciclo 1, 2 e 3
- Manter os ciclos apenas no relatório (modal) que já os exibe corretamente

