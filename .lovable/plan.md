
# Separar Visualizacao do Motorista por Unidade Logada

## Problema

Atualmente, quando o motorista faz login em uma unidade, ele ve dados de **todas as unidades** onde ja trabalhou. O Ricardo Brito, por exemplo, entrou em uma unidade diferente e esta vendo os numeros consolidados de todas, gerando confusao. O correto e mostrar apenas os dados da unidade em que ele esta logado.

## Paginas Afetadas

| Pagina | Situacao Atual | Correcao |
|---|---|---|
| Visao Geral (DriverHome) | Mostra corridas de todas as unidades | Filtrar por `unit_id` da sessao |
| Corridas (DriverRides) | Lista corridas de todas as unidades | Filtrar por `unit_id` da sessao |
| DNR (DriverDNR) | Mostra DNRs de todas as unidades | Filtrar por `unit_id` da sessao |
| Recebiveis (DriverRecebiveis) | Mostra folhas de todas as unidades | Filtrar por `unit_id` da sessao |
| Entrar na Fila (DriverQueue) | Ja usa `unitId` corretamente | Nenhuma mudanca |
| Perfil / Documentos / Config | Dados do motorista (sem unidade) | Nenhuma mudanca |
| Avaliar Unidades (DriverReviews) | Mostra todas (intencional) | Nenhuma mudanca |

## Paginas que NAO serao alteradas

- **Avaliar Unidades**: faz sentido ver todas as unidades que ja frequentou
- **Perfil, Documentos, Configuracoes**: dados pessoais do motorista, sem relacao com unidade
- **Entrar na Fila**: ja filtra pela unidade logada

## Detalhes Tecnicos

### 1. DriverHome.tsx

Adicionar `.eq("unit_id", unitSession.id)` na query principal de `driver_rides`. Isso automaticamente limita todos os calculos (TBRs, retornos, ganhos, graficos, insights) a unidade atual.

Tambem filtrar DNRs por `unit_id`:
```typescript
.eq("unit_id", unitSession.id)
```

### 2. DriverRides.tsx

Adicionar `.eq("unit_id", unitSession.id)` na query de `driver_rides`. Isso limita a lista de corridas a unidade logada.

### 3. DriverDNR.tsx

Adicionar `.eq("unit_id", unitSession.id)` na query de `dnr_entries`. Isso mostra apenas DNRs da unidade atual.

### 4. DriverRecebiveis.tsx

Filtrar folhas de pagamento (`payroll_reports`) pela `unit_id` da sessao. Isso garante que o motorista veja apenas os recebiveis da unidade em que esta logado.

### 5. DriverSidebar.tsx

Mostrar o nome da unidade logada no sidebar, abaixo do nome do motorista, para que fique claro em qual unidade ele esta operando.

Tambem filtrar o indicador de NF pendente pela unidade atual.

### Resultado Esperado

- Ricardo Brito logado na Unidade A vera apenas corridas, TBRs, DNRs e recebiveis da Unidade A
- Se ele fizer login na Unidade B, vera dados exclusivos da Unidade B
- O sidebar mostrara claramente em qual unidade ele esta operando

### Arquivos Modificados

| Arquivo | Alteracao |
|---|---|
| `src/pages/driver/DriverHome.tsx` | Filtrar `driver_rides` e `dnr_entries` por `unit_id` |
| `src/pages/driver/DriverRides.tsx` | Filtrar `driver_rides` por `unit_id` |
| `src/pages/driver/DriverDNR.tsx` | Filtrar `dnr_entries` por `unit_id` |
| `src/pages/driver/DriverRecebiveis.tsx` | Filtrar `payroll_reports` por `unit_id` |
| `src/components/dashboard/DriverSidebar.tsx` | Exibir nome da unidade logada |
