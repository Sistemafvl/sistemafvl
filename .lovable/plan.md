

## Plano — Modal de Pré-visualização antes do PDF

### Conceito
Ao clicar em **Espelho** ou **Gerar**, o sistema busca os dados (mesma lógica atual de `fetchPayrollData`) e abre um modal com o resumo tabelado. No topo do modal, um botão **"Baixar PDF"** gera o PDF a partir dos dados já validados. Para **Gerar**, o botão também salva no banco e marca DNRs. Assim o usuário confere os números antes de confirmar.

O botão **Consultar** já abre modal — ele permanece como está, apenas sem botão de PDF.

### Mudanças

**1. `src/pages/dashboard/RelatoriosPage.tsx`**
- Criar estado `payrollMode: "consult" | "espelho" | "gerar" | null` para controlar qual ação abriu o modal
- **Espelho**: `fetchPayrollData` → abre modal com `payrollMode = "espelho"`. Botão no topo "Baixar PDF" gera o PDF sem salvar no banco.
- **Gerar**: `fetchPayrollData` → abre modal com `payrollMode = "gerar"`. Botão no topo "Confirmar e Gerar PDF" salva no banco, marca DNRs e gera o PDF (mesma lógica que `fetchPayroll` atual, mas disparada pelo botão do modal).
- **Consultar**: permanece igual (`payrollMode = "consult"`), sem botão de PDF.
- No modal existente, adicionar no topo (ao lado do título) o botão de ação conforme o `payrollMode`:
  - `"espelho"` → "Baixar PDF" (sem salvar)
  - `"gerar"` → "Confirmar e Gerar" (com confirmação, salva e gera PDF)
- Remover o `Dialog` de confirmação separado (`showGenerateConfirm`), pois a confirmação acontece dentro do modal após revisar os dados.
- Adicionar tabela detalhada por dia no modal (além dos cards resumidos), mostrando TBRs/Retornos/Concluídos por dia por motorista — mesma info que vai pro PDF.

**2. `src/pages/dashboard/FinanceiroPage.tsx`**
- Remover botão "Corrigir Relatórios" e todo o bloco de recalc (estado `showRecalcModal`, `recalcPassword`, `recalcing`, função `handleRecalcAll`, modal de recalc)
- Remover import de `recalcAllPayrollReports`

**3. `src/lib/payroll-recalc.ts`**
- Pode ser removido (já não será usado)

### Resultado
- Dados sempre conferidos visualmente antes de gerar PDF
- Sem necessidade de correção retroativa — dados vêm direto da fonte (Operação) a cada geração
- Interface mais confiável e transparente

