

## Melhorias: Configuracoes do Gerente, Duplicatas TBR, Modal Motorista, Busca TBR e Logins

### 1. Corrigir logica de duplicatas/triplicatas TBR

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

**Duplicata (2x leitura):**
- Ambos ficam vermelhos imediatamente
- Apos 1 segundo (nao 2), o segundo codigo e excluido automaticamente (estado + banco)
- O primeiro volta ao estilo normal

**Triplicata (3x leitura):**
- Apos 1 segundo, os 2 ultimos sao excluidos
- O primeiro fica amarelo **permanentemente** (remover o setTimeout que limpa o amarelo apos 3s)

---

### 2. Icone de olho no card da Conferencia (ver motorista)

**Arquivo:** `src/pages/dashboard/ConferenciaCarregamentoPage.tsx`

- Adicionar um icone de olho (Eye) ao lado do badge de sequencia no canto superior direito do card (onde indicado no anexo 4)
- Ao clicar, abrir um modal com:
  - Dados cadastrais do motorista (nome, CPF, placa, modelo, cor, email, WhatsApp, endereco)
  - Quantidade de corridas realizadas (total de `driver_rides` desse motorista)
  - Quantidade de TBRs carregados (soma de `ride_tbrs` de todos os rides desse motorista)
- Buscar dados do motorista via `drivers` e agregar contagens de `driver_rides` e `ride_tbrs`

---

### 3. Corrigir modal de busca TBR na Visao Geral

**Arquivo:** `src/pages/dashboard/DashboardHome.tsx`

O modal abre e fecha rapidamente. Corrigir:
- Remover qualquer logica que feche o modal automaticamente
- O modal so fecha ao clicar no X ou fora
- Ao pesquisar um TBR (Enter), buscar na tabela `ride_tbrs` pelo codigo
- Com o `ride_id`, buscar em `driver_rides` + `drivers` o historico completo
- Exibir no modal: motorista, rota, login, unidade, conferente, data de inicio/fim, status, e todos os movimentos do TBR (todas as leituras com datas)
- Se nao encontrado, exibir mensagem "TBR nao encontrado"

---

### 4. Tela de Configuracoes do Gerente

**Arquivo criado:** `src/pages/dashboard/ConfiguracoesPage.tsx`

**Rota:** `/dashboard/configuracoes` (ja existe no sidebar, mas nao tem pagina implementada)

**Modificar:** `src/App.tsx` - adicionar rota para `ConfiguracoesPage`

**Sessoes da pagina:**

#### 4.1 Perimetro / Geofencing
- Campo de endereco (input texto)
- Campo de raio em metros (input numerico, padrao 500)
- Botao "Definir Perimetro" que:
  - Chama a edge function `geocode-address` para converter endereco em lat/lng
  - Salva `geofence_address`, `geofence_lat`, `geofence_lng`, `geofence_radius_meters` na tabela `units`
- Exibir endereco e raio atual se ja configurado
- Toast de sucesso/erro

#### 4.2 Logins e Senhas
- Criar tabela `unit_logins` no banco para armazenar logins/senhas pre-cadastrados
  - `id` uuid PK
  - `unit_id` uuid NOT NULL
  - `login` text NOT NULL
  - `password` text NOT NULL
  - `active` boolean default true
  - `created_at` timestamptz default now()
- Interface CRUD para gerenciar logins:
  - Formulario: campos Login e Senha + botao Adicionar
  - Lista com botao de excluir
- RLS: policies publicas (mesmo padrao do projeto)

#### 4.3 Alterar modal "Programar" no QueuePanel
**Arquivo:** `src/components/dashboard/QueuePanel.tsx`
- O campo Login passa a ser um Select (dropdown) que lista os logins cadastrados em `unit_logins`
- Ao selecionar um login, a senha correspondente e preenchida automaticamente
- Manter opcao de digitar manualmente caso nao tenha logins cadastrados

---

### 5. Migracao SQL

Criar tabela `unit_logins`:
```
CREATE TABLE public.unit_logins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL,
  login text NOT NULL,
  password text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.unit_logins ENABLE ROW LEVEL SECURITY;
-- Policies publicas
CREATE POLICY "Anyone can read unit_logins" ON public.unit_logins FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unit_logins" ON public.unit_logins FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update unit_logins" ON public.unit_logins FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete unit_logins" ON public.unit_logins FOR DELETE USING (true);
```

---

### Resumo de arquivos

**Criados:**
- `src/pages/dashboard/ConfiguracoesPage.tsx`

**Modificados:**
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` (duplicatas 1s, amarelo permanente, icone olho + modal motorista)
- `src/pages/dashboard/DashboardHome.tsx` (modal TBR com historico completo, nao fechar sozinho)
- `src/components/dashboard/QueuePanel.tsx` (login como Select com logins pre-cadastrados)
- `src/App.tsx` (rota configuracoes)

**Migracao SQL:**
- Tabela `unit_logins`

