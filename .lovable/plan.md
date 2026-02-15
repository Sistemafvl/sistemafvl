

## Plano Completo: Toast Removal + Carrossel + Geocoding + Finalizar + Modal TBR + PS/RTO

### 1. Remover todos os Toasts do sistema

**`src/App.tsx`** - Remover imports e componentes `<Toaster />` e `<Sonner />`

**Arquivos que usam `toast` do sonner (remover import e todas as chamadas `toast.error/toast.success`):**
- `src/pages/dashboard/ConfiguracoesPage.tsx` (6 chamadas)
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (1 chamada)

**Arquivos que usam `useToast` do shadcn (remover import, `const { toast } = useToast()` e todas as chamadas `toast({...})`):**
- `src/components/DriverRegistrationModal.tsx`
- `src/components/dashboard/ConferenteRegistrationModal.tsx`
- `src/components/dashboard/DashboardSidebar.tsx`
- `src/components/UnitLoginForm.tsx`
- `src/pages/dashboard/ConferentesPage.tsx`
- `src/pages/dashboard/PSPage.tsx`
- `src/pages/dashboard/RTOPage.tsx`
- `src/pages/admin/DomainsUnitsPage.tsx`
- `src/pages/admin/ManagersPage.tsx`
- `src/pages/admin/AdminDriversPage.tsx`
- `src/pages/driver/DriverQueue.tsx`
- `src/components/dashboard/QueuePanel.tsx`

Todas as operacoes continuam funcionando normalmente, apenas sem feedback visual.

---

### 2. Carrossel sem barra de rolagem

**`src/pages/dashboard/ConferenciaCarregamentoPage.tsx`**

- Adicionar `overflow-x-hidden` no wrapper principal da pagina (`<div className="p-4 md:p-6 space-y-6">`) para impedir scroll horizontal na pagina inteira
- O container `ref={emblaRef}` ja tem `overflow-hidden` (linha 636), o que esta correto
- Ajustar a largura dos cards com classes responsivas: `w-[85vw] sm:w-[320px]` para se adaptar a telas menores
- Navegacao exclusivamente pelas setas ChevronLeft/ChevronRight

---

### 3. Corrigir icone do botao Finalizar

**`src/pages/dashboard/ConferenciaCarregamentoPage.tsx`**

- Linha 741: trocar `<Square className="h-3.5 w-3.5" />` por `<CheckCircle className="h-3.5 w-3.5" />` (ou `StopCircle`)
- Adicionar import de `CheckCircle` do lucide-react

---

### 4. Corrigir geocodificacao e mapa

**`src/pages/dashboard/ConfiguracoesPage.tsx`**

- Melhorar tratamento de erro ao invocar `geocode-address`: verificar se `res.data` vem como string (precisa de `JSON.parse`) ou objeto
- O mapa OSM iframe ja existe no codigo (linhas 140-149) mas so aparece quando `currentGeo.lat` e `currentGeo.lng` existem. Se o erro de geocodificacao for corrigido, o mapa aparecera apos salvar

**`supabase/functions/geocode-address/index.ts`**

- Melhorar User-Agent para evitar bloqueio do Nominatim
- Adicionar tratamento de resposta mais robusto

---

### 5. Modal TBR na Visao Geral (nao fechar sozinho)

**`src/pages/dashboard/DashboardHome.tsx`**

- Linha 174: mudar `onOpenChange={(open) => { if (!open) setShowTbrModal(false); }}` para `onOpenChange={() => {}}` (ignorar fechamento automatico)
- O usuario fecha apenas pelo botao X nativo do DialogContent

---

### 6. PS - Logica "Incluir" vs "Finalizar"

**`src/pages/dashboard/PSPage.tsx`**

Ao abrir o modal de historico TBR:
- Verificar se `tbrCode` ja existe na lista `entries` (PS abertos)
- Se ja existe: mostrar botao "Finalizar PS" que chama `handleFinalize(entry.id)` e fecha o modal
- Se nao existe: mostrar botao "Incluir PS" normalmente

**`src/pages/dashboard/RTOPage.tsx`**

Mesma logica aplicada: verificar se o TBR ja esta na lista de RTO abertos e mostrar "Finalizar RTO" ao inves de "Incluir RTO".

---

### 7. Remover prop `tooltip` do sidebar

**`src/components/ui/sidebar.tsx`**

- Linha 439: remover `tooltip?: string | Record<string, unknown>;` da interface do `SidebarMenuButton`

---

### Resumo de arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/App.tsx` | Remover Toaster e Sonner |
| `src/components/ui/sidebar.tsx` | Remover prop tooltip |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Carrossel responsivo, icone Finalizar, remover toast |
| `src/pages/dashboard/ConfiguracoesPage.tsx` | Fix geocoding, remover toasts |
| `src/pages/dashboard/DashboardHome.tsx` | Modal TBR nao fechar |
| `src/pages/dashboard/PSPage.tsx` | Logica Incluir vs Finalizar, remover toasts |
| `src/pages/dashboard/RTOPage.tsx` | Logica Incluir vs Finalizar, remover toasts |
| `src/pages/dashboard/ConferentesPage.tsx` | Remover toasts |
| `src/components/DriverRegistrationModal.tsx` | Remover toasts |
| `src/components/dashboard/ConferenteRegistrationModal.tsx` | Remover toasts |
| `src/components/dashboard/DashboardSidebar.tsx` | Remover toasts |
| `src/components/UnitLoginForm.tsx` | Remover toasts |
| `src/components/dashboard/QueuePanel.tsx` | Remover toasts |
| `src/pages/admin/DomainsUnitsPage.tsx` | Remover toasts |
| `src/pages/admin/ManagersPage.tsx` | Remover toasts |
| `src/pages/admin/AdminDriversPage.tsx` | Remover toasts |
| `src/pages/driver/DriverQueue.tsx` | Remover toasts |
| `supabase/functions/geocode-address/index.ts` | Melhorar tratamento de erro |

