

## Plano: Relatório Reversa (módulo de conferência de PS para devolução)

### O que faz
Nova página no menu principal (após DNR) que lista todos os PS finalizados (`status = 'closed'`). O gerente/conferente clica em "Enviar Reversa" para abrir um modal de conferência com scanner. Ao bipar cada TBR da lista, ele é marcado como conferido. Ao final, mostra um resumo (OK vs Pendente), permite finalizar (removendo os conferidos da lista) ou cancelar, e gerar um PDF profissional com fotos do PS.

---

### Alterações

#### 1. Rota e Menu
**`src/App.tsx`:** Adicionar rota `/dashboard/reversa` → `ReversaPage`
**`src/components/dashboard/DashboardSidebar.tsx`:** Adicionar item "Relatório Reversa" no `menuItems` após DNR, com ícone `PackageSearch`

#### 2. Nova Página: `src/pages/dashboard/ReversaPage.tsx`

**Estado principal:**
- Carrega todos `ps_entries` com `status = 'closed'` da unidade (sem filtro de data — mostra tudo que está pendente de reversa)
- Lista com colunas: TBR, Motorista, Rota, Motivo, Data PS, Foto (ícone)
- Badge com contagem total de PS pendentes de reversa

**Botão "Enviar Reversa":**
- Abre modal fullscreen com:
  - Lista de todos os TBRs pendentes (com checkbox visual)
  - Campo de input + scanner (câmera) para bipar TBRs
  - Ao bipar um TBR que está na lista → marca como ✅ (verde) com animação
  - Ao bipar um TBR que NÃO está na lista → beep de erro + toast
  - Contadores em tempo real: "Conferidos: X / Total: Y"

**Tela de Resumo (após conferência):**
- Botão "Finalizar Conferência" abre resumo:
  - PS OK (conferidos): contagem + lista
  - PS Pendente (não lidos): contagem + lista
  - Botão "Finalizar" → remove os PS conferidos da lista (deleta do `ps_entries` ou marca com campo novo)
  - Botão "Cancelar" → volta ao modal de conferência

**Após finalizar:**
- Os TBRs conferidos saem da lista
- Os TBRs NÃO lidos permanecem na lista para próxima reversa

**Geração de PDF:**
- Botão "Imprimir Relatório" gera PDF profissional com:
  - Header com logo, nome da unidade, data
  - Tabela de todos os PS com: TBR, Motorista, Rota, Motivo, Data, Status (OK/Pendente)
  - Para cada PS com foto: inclui a foto no relatório
  - Footer com assinaturas e rodapé do sistema

#### 3. Banco de dados
Não precisa de nova tabela. Vou usar uma abordagem simples:
- Adicionar coluna `reversa_at` (timestamptz, nullable) na tabela `ps_entries`
- Quando o PS é conferido na reversa, `reversa_at = now()`
- A lista de "pendentes de reversa" = `status = 'closed' AND reversa_at IS NULL`
- Ao finalizar, os TBRs conferidos recebem `reversa_at = now()` e saem da lista

#### 4. Migração SQL
```sql
ALTER TABLE public.ps_entries ADD COLUMN IF NOT EXISTS reversa_at timestamptz DEFAULT NULL;
```

---

### Ordem de Implementação
1. Migração SQL (adicionar `reversa_at`)
2. Criar `ReversaPage.tsx` com lista, modal de conferência, resumo e PDF
3. Adicionar rota no `App.tsx`
4. Adicionar item no menu `DashboardSidebar.tsx`

