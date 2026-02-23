
# Plano: Botao X para Excluir/Resetar Carregamento

## O que sera feito

Adicionar um botao "X" no canto superior direito de cada card de carregamento (ao lado do badge de sequencia). Ao clicar:

1. Exige a senha do gerente (mesmo fluxo do Cancelar)
2. Move todos os TBRs lidos para o Retorno Piso com motivo "Carregamento resetado"
3. Deleta os registros de `ride_tbrs` do carregamento
4. Deleta o registro de `driver_rides` (o card desaparece completamente)
5. Libera a `queue_entry` associada (se houver)
6. Ao chamar `fetchRides()`, os contadores do dashboard recalculam automaticamente

## Diferenca entre Cancelar e Excluir

- **Cancelar**: O card permanece visivel (vermelho), status muda para "cancelled"
- **Excluir (X)**: O card desaparece completamente do sistema. TBRs vao para o Retorno Piso marcados como "resetados"

## Detalhes Tecnicos

### 1. Migracao SQL
Adicionar politica RLS de DELETE na tabela `driver_rides` (atualmente nao permite DELETE):

```sql
CREATE POLICY "Anyone can delete driver_rides"
  ON driver_rides FOR DELETE USING (true);
```

### 2. `ConferenciaCarregamentoPage.tsx`

**Novos estados:**
- `showDeleteModal` / `deleteRideId` / `deletePassword` / `deleteLoading`

**Novo handler `handleConfirmDelete`:**
- Valida senha do gerente (mesmo fluxo do cancelar)
- Busca TBRs do carregamento via estado local `tbrs[deleteRideId]`
- Insere TBRs no `piso_entries` com reason "Carregamento resetado"
- Deleta `ride_tbrs` onde `ride_id = deleteRideId`
- Deleta `driver_rides` onde `id = deleteRideId`
- Libera `queue_entry` se existir
- Chama `fetchRides()` para atualizar a lista

**UI - Botao X no card:**
Posicionar na area `top-3 right-3` (linha ~1232), antes dos outros elementos. Botao circular pequeno com icone `X`, visivel apenas quando nao esta cancelado.

**Modal de confirmacao:**
Identico ao modal de cancelamento, com titulo "Excluir Carregamento" e descricao avisando que TBRs serao enviados ao Retorno Piso.

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Adicionar politica DELETE em `driver_rides` |
| `ConferenciaCarregamentoPage.tsx` | Botao X, modal, handler de delete |
