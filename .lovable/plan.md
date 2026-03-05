

## Diagnóstico — TBR permanece no carregamento após insucesso

### Causa raiz identificada

O problema está em **dois pontos do código** e afeta **todas as unidades/domínios**:

**1. `saveTbr` em ConferenciaCarregamentoPage (linha 869-936):** Quando um TBR é re-escaneado em um novo carregamento (previousTbrs existem + pisoEntry encontrado), o sistema:
- Fecha piso/rto entries do TBR ✓
- Insere novo ride_tbr no novo carregamento ✓
- **NÃO deleta o ride_tbr antigo do carregamento anterior** ✗

Resultado: o TBR fica em DOIS carregamentos ao mesmo tempo.

**2. Sem proteção no banco:** Não existe nenhum trigger que garanta a remoção automática do ride_tbr quando um registro de insucesso (piso/PS/RTO) é criado.

### Dados afetados confirmados
- **SSP9**: 672 ride_tbrs "fantasma" (deviam ter sido removidos)
- **UNIDADE 1**: 33 ride_tbrs "fantasma"
- Principais razões: "Removido do carregamento" (409), "Troca de motorista" (113), motivos de insucesso regulares (150+)

### Plano de correção em 3 camadas

**Camada 1 — Trigger no banco (prevenção definitiva)**

Criar um trigger `AFTER INSERT` em `piso_entries`, `ps_entries` e `rto_entries` que automaticamente deleta o ride_tbr correspondente. Isso garante que **qualquer** código que crie uma entrada de insucesso remove o TBR do carregamento, independente da página ou fluxo.

```sql
CREATE FUNCTION auto_remove_tbr_from_ride() ...
-- Quando piso/ps/rto é inserido com ride_id:
-- DELETE FROM ride_tbrs WHERE ride_id = NEW.ride_id AND UPPER(code) = UPPER(NEW.tbr_code)
```

Isso cobre:
- RetornoPisoPage (piso manual + PS via piso)
- PSPage (PS direto)
- RTOPage
- Cancelamento de carregamento
- Reset de carregamento
- Qualquer futuro fluxo

**Camada 2 — Correção no frontend (re-escaneamento)**

Arquivo: `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

No `saveTbr`, quando `previousTbrs` existem e `pisoEntries` confirmam insucesso (linha ~920): adicionar deleção dos ride_tbrs antigos ANTES de inserir o novo.

```typescript
// Deletar ride_tbrs antigos do TBR em rides anteriores
for (const prevTbr of previousTbrs) {
  supabase.from("ride_tbrs").delete().eq("id", prevTbr.id);
}
```

Isso é redundante com o trigger (camada 1), mas garante que a UI reflita imediatamente sem esperar realtime.

**Camada 3 — Saneamento do histórico completo**

Executar SQL de limpeza para deletar todos os ride_tbrs "fantasma" que já existem no banco — TBRs que estão em ride_tbrs mas têm um registro correspondente em piso_entries, ps_entries ou rto_entries para o mesmo ride_id.

```sql
DELETE FROM ride_tbrs WHERE id IN (
  SELECT rt.id FROM ride_tbrs rt
  WHERE EXISTS (SELECT 1 FROM piso_entries pe WHERE pe.ride_id = rt.ride_id AND UPPER(pe.tbr_code) = UPPER(rt.code))
     OR EXISTS (SELECT 1 FROM ps_entries ps WHERE ps.ride_id = rt.ride_id AND UPPER(ps.tbr_code) = UPPER(rt.code))
     OR EXISTS (SELECT 1 FROM rto_entries rto WHERE rto.ride_id = rt.ride_id AND UPPER(rto.tbr_code) = UPPER(rt.code))
);
```

Isso corrige ~705 registros em todas as unidades de uma vez.

### Arquivos afetados
1. Migration SQL — trigger `auto_remove_tbr_from_ride` em 3 tabelas
2. `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` — saveTbr: deletar ride_tbrs antigos ao re-escanear
3. SQL de dados — limpeza do histórico

### Resultado esperado
- TBR que vai para insucesso sai **imediatamente** do carregamento do motorista
- Funciona em **todas as unidades e domínios** sem exceção
- Histórico corrigido retroativamente
- Operação, Folha de Pagamento e visão do motorista passam a mostrar os números corretos

