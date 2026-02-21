

## Plano - Barra de rolagem no modal PS (PSPage.tsx)

### Problema

O modal de registro/visualizacao de PS ultrapassa a altura da tela em dispositivos menores (especialmente quando ha foto), impedindo o acesso ao botao de finalizar.

### Solucao

Adicionar `max-h-[85vh] overflow-y-auto` ao `<DialogContent>` do modal PS na pagina PSPage.tsx (linha 739), mesmo padrao ja aplicado no modal PS do Retorno Piso.

**Arquivo:** `src/pages/dashboard/PSPage.tsx` (linha 739)
- De: `<DialogContent className="sm:max-w-lg">`
- Para: `<DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">`

---

### Sobre as atualizacoes do sistema

As entradas no feed "Atualizacoes do Sistema" **nao sao automaticas**. Elas sao registros manuais na tabela `system_updates`, gerenciados pelo painel administrativo em `/admin/updates`. Para que novas mudancas aparecam no feed, e necessario adicionar manualmente uma nova entrada pelo painel admin.

