

# Melhorias no Geofencing - CEP, Mapa Interativo e Alfinete Arrastavel

## 1. CEP preenche apenas o nome da rua

Alterar a linha que monta o endereco a partir do CEP para usar somente `data.logradouro` (nome da rua), sem bairro nem cidade.

## 2. Mapa interativo com Leaflet (via CDN no iframe)

Substituir o iframe estatico do OpenStreetMap por um mapa Leaflet carregado via CDN dentro de um iframe blob. O mapa tera:

- **Marker arrastavel**: o usuario pode clicar e arrastar o alfinete para reposicionar a localizacao exata
- **Circulo de raio**: circulo azul semi-transparente que representa a area do geofencing
- **Redimensionamento em tempo real**: ao alterar o campo "Raio (metros)", o circulo atualiza automaticamente
- **Comunicacao iframe-pai**: quando o usuario arrasta o alfinete, o iframe envia um `postMessage` com as novas coordenadas (`lat`, `lng`). O componente pai escuta esse evento e atualiza o estado local
- **Zoom automatico**: o mapa ajusta o zoom para encaixar o circulo inteiro

## 3. Salvar posicao do alfinete arrastado

Quando o usuario arrastar o alfinete:
- As coordenadas locais (`currentGeo.lat`, `currentGeo.lng`) sao atualizadas via `postMessage`
- O botao "Definir Perimetro" salvara as coordenadas atuais (originais ou ajustadas pelo arraste) no banco
- Adicionar um novo botao "Salvar Posicao" que aparece quando o alfinete foi movido, permitindo salvar sem precisar redigitar o endereco

## Implementacao tecnica

**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`

### CEP (linha 56)
```
// De:
const addr = [data.logradouro, data.bairro, ...].filter(Boolean).join(", ");
// Para:
const addr = data.logradouro || "";
```

### Funcao geradora do HTML do mapa
```
const getLeafletMapHtml = (lat, lng, radius) => `
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
</head>
<body style="margin:0">
  <div id="map" style="width:100%;height:100%"></div>
  <script>
    var map = L.map('map');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
    var circle = L.circle([${lat}, ${lng}], {
      radius: ${radius}, color: '#3b82f6', fillOpacity: 0.15
    }).addTo(map);
    map.fitBounds(circle.getBounds());

    marker.on('dragend', function(e) {
      var pos = e.target.getLatLng();
      circle.setLatLng(pos);
      parent.postMessage({ type:'marker-moved', lat: pos.lat, lng: pos.lng }, '*');
    });

    window.addEventListener('message', function(e) {
      if (e.data.type === 'update-radius') {
        circle.setRadius(e.data.radius);
        map.fitBounds(circle.getBounds());
      }
    });
  </script>
</body>
</html>
`;
```

### Escuta de postMessage no componente React
- `useEffect` com listener de `message` para capturar `marker-moved`
- Atualiza `currentGeo.lat` e `currentGeo.lng` localmente
- Seta flag `pinMoved` para mostrar botao "Salvar Posicao"

### Comunicacao de raio para o iframe
- `useEffect` que observa `geoRadius` e envia `postMessage({ type: 'update-radius', radius })` para o iframe via `ref`
- O circulo no mapa redimensiona sem recarregar

### Botao "Salvar Posicao"
- Aparece apenas quando `pinMoved === true`
- Salva `currentGeo.lat`, `currentGeo.lng` e `geoRadius` no banco via update na tabela `units`
- Reseta `pinMoved` apos salvar

---

## Resumo

| Acao | Arquivo |
|------|---------|
| Editar | `src/pages/dashboard/ConfiguracoesPage.tsx` |

Nenhuma dependencia nova sera instalada. Leaflet carrega via CDN dentro do iframe isolado.

