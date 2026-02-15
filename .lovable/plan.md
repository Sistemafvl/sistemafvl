

## Correcoes: Carrossel, Duplicatas TBR, Tooltips e Geofencing com Mapa

### 1. Corrigir carrossel horizontal (remover barra de rolagem)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

O problema e que o container do Embla esta permitindo scroll nativo alem do carrossel. A correcao:
- Adicionar `overflow-hidden` no container principal do carrossel
- Garantir que o container pai nao gere scrollbar horizontal
- Os cards so navegam pelas setas (ChevronLeft/ChevronRight), sem scrollbar visivel

---

### 2. Corrigir bug de duplicata/triplicata TBR

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

O problema atual: ao escanear o 3o TBR identico (ex: final 12), o sistema corretamente exclui os 2 ultimos e pinta o primeiro de amarelo. Porem, ao escanear o proximo TBR (ex: final 13), o realtime (`fetchRides`) recarrega todos os TBRs do banco, e como o insert do 2o e 3o ja foi feito no banco antes do delete via setTimeout, eles reaparecem.

**Solucao:**
- Mover a exclusao do banco para ANTES da insercao, ou nao inserir duplicatas no banco
- Na logica de duplicata (2a leitura): inserir otimisticamente no estado local, mas NAO inserir no banco. Apenas marcar vermelho e apos 1s remover do estado local
- Na logica de triplicata (3a leitura): idem, nao inserir no banco. Marcar vermelho, apos 1s remover os 2 ultimos do estado e pintar o primeiro amarelo permanentemente
- Ao receber update do realtime (fetchRides), preservar o flag `_yellowHighlight` dos TBRs que ja estao marcados

---

### 3. Remover todos os Tooltips do sistema

**Arquivos modificados:**
- `src/App.tsx` - Remover o `TooltipProvider` wrapper (manter so o conteudo interno)
- `src/components/ui/sidebar.tsx` - Remover imports e uso de Tooltip, TooltipTrigger, TooltipContent, TooltipProvider. O `SidebarMenuButton` nao renderiza mais tooltip
- `src/components/ui/tooltip.tsx` - Pode ser mantido (nao causa dano), mas todos os usos serao removidos

---

### 4. Geofencing com CEP, endereco completo e mapa

**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`

Reformular a secao de Geofencing:
- Adicionar campo de **CEP** que ao ser preenchido (8 digitos), consulta a API `viacep.com.br` para retornar rua, bairro, cidade e estado
- Preencher automaticamente o campo de endereco com os dados retornados
- Permitir edicao manual do endereco completo (numero, complemento)
- Ao clicar "Definir Perimetro", chamar a edge function `geocode-address` para converter em coordenadas
- Exibir um mapa estatico (iframe do OpenStreetMap) mostrando o ponto central e um circulo representando o raio
- O mapa usa a URL do Leaflet/OpenStreetMap via iframe ou uma imagem estatica com marcador

**Alternativa para o mapa:** Usar a biblioteca `leaflet` via CDN em um iframe inline, ou renderizar um mapa simples com a API de tiles do OpenStreetMap usando um elemento canvas/svg para desenhar o circulo. A abordagem mais simples e usar um iframe do OpenStreetMap centrado nas coordenadas salvas.

---

### 5. Corrigir modal TBR na Visao Geral

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

O modal ja tem `onPointerDownOutside={(e) => e.preventDefault()}` mas pode estar fechando por outras razoes (ex: interacao com Dialog). Verificar se ha algo no Dialog que causa o fechamento e garantir que:
- O `onOpenChange` so recebe `false` ao clicar no X
- Adicionar `onInteractOutside={(e) => e.preventDefault()}` e `onEscapeKeyDown` se necessario

---

### Detalhes Tecnicos

**Arquivos modificados:**
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (carrossel sem scrollbar, fix duplicata/triplicata)
- `src/pages/dashboard/ConfiguracoesPage.tsx` (CEP + endereco + mapa)
- `src/pages/dashboard/DashboardHome.tsx` (modal TBR estavel)
- `src/App.tsx` (remover TooltipProvider)
- `src/components/ui/sidebar.tsx` (remover tooltips do menu lateral)

**Logica corrigida para duplicatas:**
```text
handleTbrInputChange:
  count = ocorrencias do codigo na lista local
  
  Se count == 0: inserir no estado + banco normalmente
  
  Se count == 1 (2a leitura):
    - Inserir APENAS no estado local (NAO no banco)
    - Marcar ambos como _duplicate (vermelho)
    - Apos 1s: remover o 2o do estado local apenas
    - O 1o volta ao normal
  
  Se count >= 2 (3a leitura):
    - Inserir APENAS no estado local (NAO no banco)
    - Marcar todos como _triplicate (vermelho)
    - Apos 1s: remover 2o e 3o do estado local
    - Marcar 1o como _yellowHighlight permanente
  
  fetchRides (realtime): ao recarregar TBRs do banco,
    preservar _yellowHighlight dos TBRs ja marcados
```

**Consulta CEP (ViaCEP):**
```text
GET https://viacep.com.br/ws/{cep}/json/
Retorna: logradouro, bairro, localidade, uf
Preencher campo endereco: "{logradouro}, {bairro}, {localidade} - {uf}"
```

**Mapa OpenStreetMap (iframe):**
```text
Apos salvar coordenadas, exibir iframe:
https://www.openstreetmap.org/export/embed.html?bbox={lng-delta},{lat-delta},{lng+delta},{lat+delta}&layer=mapnik&marker={lat},{lng}
```

