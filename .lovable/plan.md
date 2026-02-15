

# Correção do Geofencing - Persistência e Mapa Simplificado

## Problema Principal Identificado

O update na tabela `units` **falha silenciosamente** porque a política RLS permite UPDATE apenas para o role `authenticated`, mas o app usa o role `anon` (sem Supabase Auth). O PATCH retorna status 204, mas 0 linhas são afetadas.

Prova: o PATCH envia os dados corretamente (`geofence_lat: -23.51`, `geofence_lng: -46.39`), mas o GET subsequente retorna `null` para todos os campos de geofence.

## Correções

### 1. Adicionar política RLS para permitir anon UPDATE na tabela `units`

Criar uma migration SQL:
```sql
CREATE POLICY "Anon can update units"
  ON public.units
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
```

### 2. Simplificar o mapa (remover alfinete arrastável)

Conforme solicitado, remover a funcionalidade de arrastar o pino. O mapa mostrará apenas:
- Marker fixo (não arrastável) na posição do endereço
- Círculo azul representando o raio
- Atualização em tempo real do círculo ao mudar o campo "Raio"

Remover do código:
- `pinMoved` e `savingPin` states
- `handleSavePin` function
- Listener de `postMessage` para `marker-moved`
- Botão "Salvar Posição"
- `draggable: true` do marker no HTML do Leaflet

### 3. Manter `srcdoc` com `sandbox="allow-scripts allow-same-origin"`

Adicionar o atributo `sandbox` de volta ao iframe para garantir que scripts e tiles carreguem corretamente.

## Detalhes Técnicos

**Arquivo:** `src/pages/dashboard/ConfiguracoesPage.tsx`

Mudanças:
- Remover states: `pinMoved`, `savingPin`
- Remover `handleSavePin`
- Remover useEffect de `marker-moved` listener
- No `mapSrcdoc`: remover `draggable:true` e evento `dragend`
- Adicionar `sandbox="allow-scripts allow-same-origin"` ao iframe
- Remover botão "Salvar Posição"

**Migration SQL:** nova política RLS para anon UPDATE em `units`

| Ação | Arquivo / Recurso |
|------|-------------------|
| Migration SQL | Adicionar RLS policy anon UPDATE em units |
| Editar | `src/pages/dashboard/ConfiguracoesPage.tsx` |

