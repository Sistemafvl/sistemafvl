

# Correcoes: Calculos Operacao, Foto Conferencia, Excluir Relatorio, Botao Espelho

## 1. Calculos errados na Operacao (Anexo 1 e 3)

**Problema identificado**: A pagina Operacao usa `tbrValue` da `unit_settings` para todos os motoristas, mas Vitoria Santana tem um valor customizado de R$ 2,20 na tabela `driver_custom_values`. O sistema deveria mostrar R$ 2,20 x 9 = R$ 19,80 para ela, mas mostra R$ 3,35 x 9 = R$ 30,15.

**Solucao**: Buscar `driver_custom_values` na `loadData()` e usar o valor personalizado de cada motorista ao calcular `totalGanho` e `mediaTbr` nos cards.

**Arquivo**: `src/pages/dashboard/OperacaoPage.tsx`
- Na funcao `loadData`: adicionar fetch de `driver_custom_values` junto com os demais queries
- Criar mapa `customValueMap<driverId, customTbrValue>`
- Passar o `customValue` no card data ou armazena-lo em estado separado
- No calculo dos mini-cards (linhas 232-234), usar `customValueMap.get(c.driver_id) ?? tbrValue` em vez de apenas `tbrValue`

## 2. Foto do motorista na Conferencia (Anexo 2)

**Problema**: O usuario quer a foto posicionada ao lado do nome do motorista, nao centralizada acima. Atualmente (linha 1324-1331), Avatar fica centralizado e o nome fica abaixo.

**Solucao**: Reorganizar o layout para colocar Avatar e nome lado a lado com `flex items-center gap-3`.

**Arquivo**: `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (linhas 1324-1331)
- Envolver Avatar + nome em `<div className="flex items-center gap-3">`
- Manter o Avatar no mesmo tamanho (h-16 w-16)
- Mover o nome para o lado direito do Avatar

## 3. Botao Excluir Relatorio no Financeiro (Anexo 4)

**Problema**: Relatorios duplicados nao podem ser excluidos. O usuario precisa de um botao para deletar relatorios do Financeiro, removendo tambem os registros de `driver_invoices` associados e liberando os DNRs marcados (`reported_in_payroll_id`).

**Solucao**: Adicionar botao de excluir em cada item da lista de relatorios e dentro da visao detalhada. Ao excluir:
1. Deletar `driver_invoices` com `payroll_report_id = reportId`
2. Limpar `reported_in_payroll_id` nos `dnr_entries` que apontavam para este relatorio
3. Deletar o `payroll_reports` com esse id
4. Requerer senha do gerente para confirmar

**Arquivo**: `src/pages/dashboard/FinanceiroPage.tsx`
- Adicionar estado para modal de confirmacao de exclusao (`deleteReportId`, `deletePassword`, `showDeleteModal`)
- Adicionar botao de lixeira (Trash2) em cada item da lista (ao lado do badge NF)
- Modal de confirmacao com campo de senha do gerente
- Funcao `handleDeleteReport`: validar senha -> deletar invoices -> limpar DNRs -> deletar report -> recarregar

## 4. Botao "Espelho" na Folha de Pagamento (Anexo 5)

**Problema**: O botao "Gerar PDF" salva o relatorio no Financeiro e cria registros no Recebiveis do motorista. O usuario quer um botao intermediario "Espelho" que gera o PDF sem salvar nada.

**Solucao**: Adicionar botao "Espelho" entre "Consultar" e "Gerar". Reutilizar `fetchPayrollData()` (que ja esta separado) e gerar o PDF sem inserir em `payroll_reports` nem marcar DNRs.

**Arquivo**: `src/pages/dashboard/RelatoriosPage.tsx`
- Criar funcao `fetchPayrollEspelho`: chama `fetchPayrollData()` + `generatePDFFromContainer()` sem salvar no banco
- Renomear "Gerar PDF" para "Gerar" no botao existente
- Adicionar botao "Espelho" entre Consultar e Gerar com icone `Eye`
- Layout: 3 botoes (Consultar | Espelho | Gerar) na secao de Folha de Pagamento

## Detalhes Tecnicos

### OperacaoPage.tsx - Custom TBR values

```typescript
// Na loadData(), adicionar ao Promise.all:
supabase.from("driver_custom_values").select("driver_id, custom_tbr_value").eq("unit_id", unitSession.id)

// Criar mapa:
const customValueMap = new Map<string, number>();
(customRes.data ?? []).forEach((cv: any) => {
  customValueMap.set(cv.driver_id, Number(cv.custom_tbr_value));
});

// Nos cards, substituir tbrValue por:
const driverTbrValue = customValueMap.get(c.driver_id) ?? tbrValue;
const totalGanho = concluidos * driverTbrValue;
const mediaTbr = c.total_tbrs > 0 ? totalGanho / c.total_tbrs : 0;
```

### ConferenciaCarregamentoPage.tsx - Layout Avatar + Nome

```tsx
// Substituir linhas 1324-1331 por:
<div className="flex items-center gap-3 mt-2">
  <Avatar className="h-16 w-16 shrink-0">
    {ride.driver_avatar && <AvatarImage src={ride.driver_avatar} />}
    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
      {(ride.driver_name ?? "M")[0].toUpperCase()}
    </AvatarFallback>
  </Avatar>
  <h3 className="text-lg font-bold">{ride.driver_name}</h3>
</div>
```

### FinanceiroPage.tsx - Excluir relatorio

```typescript
const handleDeleteReport = async () => {
  // 1. Validar senha do gerente
  // 2. Deletar driver_invoices com payroll_report_id
  // 3. Limpar reported_in_payroll_id nos dnr_entries
  // 4. Deletar payroll_reports
  // 5. Recarregar lista
};
```

Botao de lixeira ao lado de cada relatorio (com stopPropagation para nao abrir o detalhe):
```tsx
<button onClick={(e) => { e.stopPropagation(); openDeleteModal(r.id); }}>
  <Trash2 className="h-4 w-4 text-destructive" />
</button>
```

### RelatoriosPage.tsx - Botao Espelho

```typescript
const fetchPayrollEspelho = async () => {
  setLoading("espelho");
  const common = await ensureCommon();
  if (!common) { setLoading(null); return; }
  const result = await fetchPayrollData(common);
  if (!result) { setLoading(null); return; }
  // Apenas gerar PDF, sem salvar no banco
  setTimeout(async () => {
    if (payrollRef.current) {
      await generatePDFFromContainer(payrollRef.current, `espelho_folha_${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}.pdf`);
      toast({ title: "Espelho gerado!", description: "PDF de consulta baixado com sucesso." });
    }
  }, 500);
  setLoading(null);
};
```

Layout dos 3 botoes:
```tsx
<div className="flex gap-2">
  <Button variant="outline" className="flex-1">Consultar</Button>
  <Button variant="outline" className="flex-1">Espelho</Button>
  <Button className="flex-1">Gerar</Button>
</div>
```

### Resumo de arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/dashboard/OperacaoPage.tsx` | Buscar custom TBR values e usar nos calculos |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Colocar foto ao lado do nome (layout horizontal) |
| `src/pages/dashboard/FinanceiroPage.tsx` | Botao excluir relatorio com confirmacao por senha |
| `src/pages/dashboard/RelatoriosPage.tsx` | Botao "Espelho" (PDF sem salvar) + renomear "Gerar PDF" para "Gerar" |

