

## Melhorias na Conferencia Carregamento, Fila e TBR

### 1. TBR Localizado em Verde (Busca Global)

Quando o campo de busca TBR no topo da Conferencia Carregamento tiver valor, os TBRs que correspondem ao termo buscado serao destacados com fundo verde dentro do card.

**Arquivo:** `ConferenciaCarregamentoPage.tsx`
- Na renderizacao de cada TBR na lista, verificar se `tbrSearch` nao esta vazio e se o codigo do TBR contem o termo
- Se sim, aplicar classe `bg-green-100 border-green-400` no item
- Caso contrario, manter o estilo atual `bg-muted/50`

---

### 2. Busca por Enter (Visao Geral e Conferencia)

O campo de busca TBR na Visao Geral ja funciona por Enter. No Conferencia Carregamento, o localizador (campo de busca no topo) passara a funcionar tambem apenas por Enter.

**Arquivo:** `ConferenciaCarregamentoPage.tsx`
- Remover o `onChange` direto do `tbrSearch` que filtra em tempo real
- Adicionar estado `tbrSearchCommitted` que so e atualizado ao pressionar Enter
- O filtro de cards usa `tbrSearchCommitted`; o input exibe `tbrSearch` livremente
- Ao limpar (botao X), limpar ambos os estados

---

### 3. Localizador Ignora Filtro de Data

O localizador de TBR na Conferencia Carregamento buscara em todos os carregamentos da unidade, independente das datas selecionadas.

**Arquivo:** `ConferenciaCarregamentoPage.tsx`
- Quando `tbrSearchCommitted` estiver preenchido:
  - Buscar TBRs pelo codigo na tabela `ride_tbrs` (sem filtro de data)
  - Identificar os `ride_id` correspondentes
  - Buscar esses rides diretamente (sem filtro de data)
  - Exibir apenas esses cards
- Quando vazio, manter o filtro de data normal

---

### 4. Geofencing para "Entrar na Fila"

Implementar um sistema de perimetro baseado em endereco para controlar o acesso ao botao "Entrar na Fila".

**Migracao SQL:** Adicionar colunas na tabela `units`:
- `geofence_address` text (endereco digitado pelo gerente)
- `geofence_lat` double precision
- `geofence_lng` double precision
- `geofence_radius_meters` integer default 500

**Geocodificacao:** Criar uma edge function `geocode-address` que usa a API gratuita do Nominatim (OpenStreetMap) para converter endereco em coordenadas.

**Tela de Configuracoes:** Adicionar campos para:
- Endereco (input de texto)
- Raio em metros (input numerico, padrao 500m)
- Botao "Definir Perimetro" que chama a edge function e salva lat/lng/raio na unidade

**Tela do Motorista (DriverQueue):**
- Ao abrir a pagina, solicitar geolocalizacao via `navigator.geolocation`
- Calcular distancia entre posicao do motorista e coordenada da unidade usando formula de Haversine
- Se a distancia for maior que o raio, desabilitar o botao "ENTRAR NA FILA" e exibir mensagem "Voce esta fora do perimetro da unidade"
- Se a unidade nao tiver geofence configurado, o botao funciona normalmente

---

### 5. Animacao Pulsante na Fila (Novo Motorista)

Quando um novo motorista entrar na fila, o botao flutuante "Fila" no canto inferior direito pulsara como alerta para o gerente.

**Arquivo:** `QueuePanel.tsx`
- Manter referencia do `count` anterior
- Quando `count` aumentar, ativar estado `isPulsing = true`
- Aplicar classe CSS `animate-pulse` + `ring-2 ring-primary ring-offset-2` no botao
- Ao clicar no botao (abrir o painel), desativar `isPulsing`

---

### 6. Contador de TBR no Card (Conferencia)

Adicionar um contador visual de TBRs no canto superior esquerdo do card, conforme indicado na imagem (Anexo 6).

**Arquivo:** `ConferenciaCarregamentoPage.tsx`
- No card, adicionar um Badge no canto superior esquerdo (oposto ao numero de sequencia)
- Exibir o numero de TBRs lidos: `rideTbrs.length`
- Estilo: badge com icone de barcode pequeno

---

### 7. Cards em Carrossel Horizontal com Setas

Substituir o grid de cards por um carrossel horizontal com navegacao por setas.

**Arquivo:** `ConferenciaCarregamentoPage.tsx`
- Usar `embla-carousel-react` (ja instalado) ou CSS com `overflow-x-auto` e `scroll-snap`
- Cards dispostos lado a lado em uma unica linha horizontal
- Setas de navegacao (ChevronLeft / ChevronRight) nas laterais
- Cada card com largura fixa (~320px)
- Scroll suave ao clicar nas setas

---

### 8. Contador de TBR na Visao do Motorista

Adicionar o mesmo contador de TBRs no card de "Carregamento Ativo" do motorista.

**Arquivo:** `DriverQueue.tsx`
- Buscar TBRs do `activeRide.id` na tabela `ride_tbrs`
- Exibir contador com icone de barcode: "TBRs: X"
- Posicionar no canto do card de carregamento ativo, conforme indicado na imagem

---

### 9. TBR Duplicado (2x) - Vermelho + Auto-exclusao

Quando o mesmo TBR for lido 2 vezes no mesmo card, ambos ficam em vermelho e o segundo e excluido automaticamente apos 2 segundos.

**Arquivo:** `ConferenciaCarregamentoPage.tsx`
- Ao inserir TBR (otimista), verificar se o codigo ja existe na lista `tbrs[rideId]`
- Se duplicado (2a leitura):
  - Inserir otimisticamente mas marcar como duplicado
  - Pintar ambos (original e copia) em vermelho (`bg-red-100 text-red-700`)
  - Apos 2 segundos: excluir o segundo do estado local e do banco
  - O primeiro volta ao estilo normal

---

### 10. TBR Triplicado (3x) - Amarelo + Auto-exclusao de 2

Quando o mesmo TBR for lido 3 vezes seguidas, os 2 ultimos sao excluidos apos 2 segundos e o primeiro fica amarelo.

**Arquivo:** `ConferenciaCarregamentoPage.tsx`
- Contar quantas vezes o codigo aparece na lista
- Se aparecer 3 vezes:
  - Pintar todos em vermelho momentaneamente
  - Apos 2 segundos: excluir os 2 ultimos (estado local + banco)
  - Pintar o primeiro em amarelo (`bg-yellow-100 text-yellow-700`) por alguns segundos

---

### Detalhes Tecnicos

**Arquivos modificados:**
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (itens 1, 2, 3, 6, 7, 9, 10)
- `src/pages/driver/DriverQueue.tsx` (itens 4, 8)
- `src/components/dashboard/QueuePanel.tsx` (item 5)

**Arquivos criados:**
- `supabase/functions/geocode-address/index.ts` (item 4)

**Migracao SQL (item 4):**
- Adicionar 4 colunas na tabela `units`: `geofence_address`, `geofence_lat`, `geofence_lng`, `geofence_radius_meters`

**Dependencias:** Nenhuma nova (embla-carousel-react ja instalado)

**Logica de duplicacao TBR (itens 9 e 10):**
```text
handleTbrInputChange:
  1. Contar ocorrencias do codigo na lista atual
  2. Se 0: inserir normalmente
  3. Se 1 (sera o 2o): inserir, marcar ambos como "duplicate"
     -> setTimeout 2s: excluir o 2o do estado + DB, limpar marca do 1o
  4. Se 2 (sera o 3o): inserir, marcar todos como "triplicate"  
     -> setTimeout 2s: excluir 2o e 3o do estado + DB, pintar 1o amarelo
```

**Geofencing - Formula de Haversine (no frontend):**
```text
function haversineDistance(lat1, lng1, lat2, lng2):
  R = 6371000 (raio da Terra em metros)
  dLat = toRad(lat2 - lat1)
  dLng = toRad(lng2 - lng1)
  a = sin(dLat/2)^2 + cos(lat1)*cos(lat2)*sin(dLng/2)^2
  return R * 2 * atan2(sqrt(a), sqrt(1-a))
```

**Busca TBR ignorando data (item 3):**
```text
1. ride_tbrs WHERE code ILIKE '%search%' AND ride_id IN (rides da unidade)
2. Com ride_ids encontrados, buscar driver_rides sem filtro de data
3. Exibir esses cards com TBRs encontrados destacados em verde
```

