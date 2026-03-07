

## Plan: Batch of UI/UX Adjustments for Sistema FVL

This plan addresses all 10+ requests from the user's message. Each item is grouped by scope.

---

### 1. Remove document upload requirement from driver registration
**File:** `src/components/DriverRegistrationModal.tsx`
- Remove `required: true` from the `DOC_TYPES` entries for CNH, CRLV, and Comprovante de Endereço (set all to `required: false`)
- Remove the `requiredDocsMissing` check that blocks the submit button
- Remove the toast error for missing documents in `handleSubmit`
- Remove the rollback logic that deletes the driver if document upload fails (lines 168-181)
- Keep the document upload section visible but entirely optional

### 2. Fix registration reliability (spinner hangs)
**File:** `src/components/DriverRegistrationModal.tsx`
- Add a success toast after successful registration so user gets clear feedback
- Add error handling toast for the initial insert failure (currently silent at line 144-147)
- Close modal and reset form immediately after driver insert succeeds, before document uploads
- Move document uploads to fire-and-forget (non-blocking) after modal closes, or show progress but don't block completion

### 3. Prevent browser auto-translation
**File:** `index.html`
- Add `translate="no"` attribute to `<html>` tag
- Add `<meta name="google" content="notranslate" />` to `<head>`
- Change `lang="en"` to `lang="pt-BR"`

### 4. Add keyboard icon next to camera in PS page (TBR manual entry)
**File:** `src/pages/dashboard/PSPage.tsx`
- Add a `Keyboard` icon button next to the existing `Camera` button (around line 893-901)
- On click, focus the input field and optionally show a visual hint that manual typing is active
- Import `Keyboard` from lucide-react (already imported in ConferenciaCarregamentoPage)

### 5. Change "Dias Trabalhados" card to "Quinzena" earnings counter in Driver Home
**File:** `src/pages/driver/DriverHome.tsx`
- Replace the "Dias Trabalhados" card (currently showing `metrics.workedDays`)
- New logic: determine current fortnight period (1st-15th or 16th-end of month) based on Brazil timezone
- Sum `totalGanho` for rides within that fortnight period
- Display as "Quinzena" with the calculated value formatted in BRL

### 6. Rename "Reincidências" to "Pend. Coleta"
**File:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Replace all occurrences of "Reincidências" with "Pend. Coleta" (lines ~2079 and ~2268)

### 7. Add unit filter to Motoristas Parceiros + fix search
**File:** `src/pages/dashboard/MotoristasParceirosPage.tsx`
- Add a new `Select` dropdown for units of the current domain
- Fetch units from the domain (`units` table filtered by `domain_id`)
- When a unit is selected, fetch `driver_rides` for that unit to get `driver_id`s, then filter the drivers list to only show those who have rides in that unit
- Fix the existing search filter — the current filter logic at line 191-201 looks correct, but need to verify `drivers_public` view returns data properly. The issue may be that `drivers_public` is a view and data might be null. Will add null-safe checks.

### 8. Ciclos page changes
**File:** `src/pages/dashboard/CiclosPage.tsx`

**8a. "Qtd Pacotes" field to auto-count TBRs of the day:**
- Change the `qtd_pacotes` field to be auto-populated with `metrics.totalTbrs` (read-only, showing the actual TBR count for the selected day)

**8b. Rename "Qtd Pacotes Informado" to "VRID":**
- Change label from "Qtd Pacotes Informado" to "VRID" (line ~360)
- Also update in the report modal (line ~533)

**8c. Change "Total Retornos" card to previous day's Piso insucesso count:**
- Replace the "Total Retornos" metric in the report modal (line ~498-500) with a count of `piso_entries` from the previous day that have operational return status
- Rename to "Insucessos (Dia Anterior)"

**8d. Change "Tempo Médio/TBR" card to vehicle type counter:**
- Replace with a card showing count of cars vs motos and their rates
- Query `drivers_public` for car_model to distinguish car/moto (heuristic or add classification)
- Display: "X Carros (R$ 3,35) | Y Motos (R$ 2,20)" + total motoristas

### 9. Replace delete icon with bell icon on Conferencia cards
**File:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`
- Remove the `Trash2` delete button that currently shows for managers (lines 1872-1880)
- Replace it with the bell/call driver button (currently at lines 1853-1868, only shown when `queue_entry_id` exists)
- Move the bell icon to the top-right position where delete was
- The bell should be visible to conferente (funcionario) view, not just manager
- Keep the bell conditional on `queue_entry_id` existing and ride not being finished/cancelled

### 10. Unit selector: hide dropdown until 3rd character typed
**File:** `src/components/UnitLoginForm.tsx`
- Modify the unit `Command` component to not show the list initially
- Only show `CommandGroup` with units when the search input has >= 3 characters
- Track the search value in the `CommandInput` using a state variable

### 11. Global BRL currency formatting fix
**Multiple files** — Create a global `formatBRL` utility and replace all `R$${value.toFixed(2)}` patterns.

**File:** `src/lib/utils.ts`
- Add a `formatBRL` function: `(val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`

**File:** `src/pages/dashboard/reports/pdf-utils.ts`
- Update `formatCurrency` to use the same locale-based formatting

**Files to update** (replace `R$${...toFixed(2)}` or `R$ ${...toFixed(2)}` patterns):
- `src/pages/driver/DriverHome.tsx` (line ~284, ~368)
- `src/pages/dashboard/DNRPage.tsx` (lines ~223, ~243, ~345)
- `src/pages/dashboard/FinanceiroPage.tsx` (line ~27)
- `src/pages/matriz/MatrizFinanceiro.tsx` (lines ~130-131, ~158-160, ~169-170)
- `src/components/dashboard/DashboardMetrics.tsx`
- `src/pages/dashboard/reports/PayrollReportContent.tsx`
- `src/pages/dashboard/reports/RankingReportContent.tsx`
- And any other files using raw `.toFixed(2)` for currency display

---

### Implementation Order
1. Global utility (`formatBRL` in utils.ts) — foundation for all currency fixes
2. `index.html` — translation prevention (quick)
3. `DriverRegistrationModal.tsx` — remove doc requirement + fix reliability
4. `PSPage.tsx` — add keyboard icon
5. `ConferenciaCarregamentoPage.tsx` — rename Reincidencias + replace delete with bell
6. `DriverHome.tsx` — quinzena card + currency fix
7. `CiclosPage.tsx` — all 4 sub-changes
8. `MotoristasParceirosPage.tsx` — unit filter + search fix
9. `UnitLoginForm.tsx` — delayed dropdown
10. All remaining files — global currency format migration

