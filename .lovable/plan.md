

# Plano: 6 Demandas do Motorista e Correções

## 1. Avisos diários ao motorista (modal 1x por dia)

### Abordagem
- Criar componente `DriverDailyNotices.tsx` com 4 avisos em sequência (um modal por vez)
- Usar `localStorage` com chave `driver_notices_seen_{driverId}_{YYYY-MM-DD}` para controlar exibição 1x/dia
- Renderizar no `DriverLayout.tsx` após o `DriverCallAlert`
- Cada aviso: título, corpo explicativo, botão "Ok, Ciente"

### Conteúdo dos 4 avisos:
1. **Conferência de informações**: Sempre confira quantidade de pacotes, login e senha do dia — devem bater com o coletor Amazon. Não saia da unidade sem verificar. Garante segurança e transparência financeira.
2. **Novidade: Socorrendo**: Se socorreu um colega na rua coletando pacotes, agora no menu "Socorrendo" você pode transferir esses pacotes para sua contagem de TBR, garantindo rapidez e agilidade.
3. **Dados bancários**: Passo a passo — (1) Acesse "Documentos" no menu lateral, (2) Role até "Dados Bancários / Pix", (3) Preencha tipo de chave, chave Pix e nome titular, (4) Clique em Salvar.
4. **Reativos na Quinzena**: Agora reativos ativados ficam visíveis nos cards principais e são somados junto à quinzena.

---

## 2. Card de posição no ranking (motorista)

### Abordagem
- No `DriverHome.tsx`, adicionar uma query usando a RPC `get_top_drivers_by_tbrs` para o período quinzenal vigente
- Localizar a posição do motorista logado no array retornado
- Exibir um card com: **"Sua Posição"** → `#X de Y` (ícone Trophy, cor dourada)
- Se o motorista não aparece no ranking (sem corridas finalizadas), mostrar "—"

---

## 3. Timeline: incluir evento de Reversa

### Problema
Quando um PS é fechado e entra no relatório de reversa (`reversa_at` preenchido em `ps_entries`), a timeline não mostra esse evento.

### Correção em `DashboardHome.tsx` (timeline builder, ~linha 307-333)
- Após os eventos de PS Aberto/Fechado, verificar se `ps.reversa_at` existe
- Se sim, adicionar evento "Status: Reversa Enviada" com timestamp `ps.reversa_at`
- Adicionar tipo `"reversa"` ao `TimelineEvent.type` union e ao `typePriority` (prioridade 11, antes de finished que vai para 12)
- Adicionar cores: `text-indigo-600` / `bg-indigo-600`

---

## 4. PS modal: mostrar histórico via piso_entries quando ride_tbrs não tem registro

### Problema
Quando um TBR vai direto de insucesso para PS, o trigger `auto_remove_tbr_from_ride` já deletou o `ride_tbrs`. A busca atual em `searchTbr` procura apenas em `ride_tbrs` e retorna `null` → "TBR sem histórico".

### Correção em `PSPage.tsx` (~linha 258-311)
- Se `ride_tbrs` não retornar resultado, buscar fallback em `piso_entries` (e `rto_entries`) pelo `tbr_code`
- Se encontrar, usar o `ride_id` do piso/rto para buscar o `driver_rides` e montar o histórico
- Isso mostra motorista, rota, login, conferente mesmo quando o TBR já saiu da carga

---

## 5. Scanner lento na Conferência de Carregamento

### Problema
O GIF mostra que ao escanear, o TBR demora para aparecer na lista, some e reaparece. A causa:

1. **`saveTbr` faz 3 queries sequenciais ANTES do optimistic update** (totalScans === 1): check closedPS, check existingTbr em outro ride, check piso_entries → ~300-600ms de latência antes do item aparecer na tela
2. **O `realtimeLockUntil` de 3s** e posterior refetch podem causar flicker

### Correção em `ConferenciaCarregamentoPage.tsx`:
- **Mover o optimistic update (setTbrs + setTbrInputs) para ANTES das queries de validação**
- Fazer as verificações (closedPS, existingTbr, piso trip_number) em paralelo com `Promise.all` onde possível
- Se alguma verificação falhar, fazer rollback removendo o tempId do state
- Isso garante: **leu → som → apareceu na tela → validou em background → próximo**
- Reduzir o `scanningPaused` delay de 1500ms para 800ms para leitura mais rápida

---

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/dashboard/DriverDailyNotices.tsx` | **Novo** — componente de avisos diários |
| `src/components/dashboard/DriverLayout.tsx` | Importar e renderizar `DriverDailyNotices` |
| `src/pages/driver/DriverHome.tsx` | Adicionar card de posição no ranking |
| `src/pages/dashboard/DashboardHome.tsx` | Timeline: adicionar evento Reversa + tipo no union |
| `src/pages/dashboard/PSPage.tsx` | Fallback para buscar histórico via piso/rto quando ride_tbrs vazio |
| `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` | Otimizar saveTbr: optimistic update antes das queries |

