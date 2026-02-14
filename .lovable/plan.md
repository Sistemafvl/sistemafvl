
## Plano de Implementacao - 4 Melhorias

### 1. Conferencia Carregamento - 3 Botoes no Card

Adicionar abaixo das informacoes de cada card na pagina `ConferenciaCarregamentoPage.tsx`:

**Botao 1 - Selecionar Conferente:**
- Caixa de selecao (Select/Combobox) listando os conferentes ativos cadastrados na unidade (tabela `user_profiles`, filtrado por `unit_id` e `active = true`)
- Ao selecionar, salva o `conferente_id` no registro da ride

**Botao 2 - Iniciar:**
- Ao clicar, abre uma area de leitura de TBR dentro do card
- Um campo de input para escanear/digitar o codigo TBR
- Ao pressionar Enter, o TBR e registrado e um novo campo vazio aparece abaixo para o proximo TBR
- Lista de TBRs lidos visivel no card

**Botao 3 - Finalizar / Retornar:**
- Estado inicial: botao "Finalizar"
- Ao clicar em Finalizar, encerra o carregamento (muda status para finalizado), e o botao muda para "Retornar"
- Ao clicar em Retornar, reabre a area de leitura de TBR para adicionar novos codigos

**Migracao de Banco necessaria:**
- Nova tabela `ride_tbrs` com colunas: `id`, `ride_id` (FK para driver_rides), `code` (TEXT), `scanned_at` (TIMESTAMPTZ)
- Adicionar colunas em `driver_rides`: `conferente_id` (UUID, nullable, FK para user_profiles), `loading_status` (TEXT, default 'pending' -- valores: pending, loading, finished)
- Habilitar realtime para `ride_tbrs`

---

### 2. Corridas do Motorista - Ajustes

No arquivo `src/pages/driver/DriverRides.tsx`:
- Remover o badge "Concluida" de cada item da lista
- Adicionar as informacoes de **Rota**, **Login** e **Senha** vindas do registro `driver_rides` (colunas `route`, `login`, `password`)
- Exibir esses dados abaixo do nome da unidade/data, usando icones consistentes com a pagina de Conferencia

---

### 3. Menu Lateral (Sidebar) - Fechar ao Clicar no Mobile

Nos arquivos `src/components/dashboard/DriverSidebar.tsx` e `src/components/dashboard/DashboardSidebar.tsx`:
- Importar o hook `useSidebar` do componente de sidebar
- Ao clicar em um item do menu, chamar `setOpenMobile(false)` para fechar o menu no mobile
- Isso resolve o problema do menu ficar na frente apos selecionar uma opcao

---

### 4. Login - Popover Fechar ao Selecionar

No arquivo `src/components/UnitLoginForm.tsx`:
- Controlar o estado `open` dos Popovers de Dominio e Unidade manualmente
- Ao selecionar um item no CommandItem (`onSelect`), fechar o Popover correspondente setando `open = false`
- Isso resolve o problema da caixa de selecao continuar na frente apos escolher

---

### Detalhes Tecnicos

**SQL Migration:**
```sql
-- Novas colunas em driver_rides
ALTER TABLE public.driver_rides
  ADD COLUMN IF NOT EXISTS conferente_id UUID REFERENCES public.user_profiles(id),
  ADD COLUMN IF NOT EXISTS loading_status TEXT DEFAULT 'pending';

-- Nova tabela para TBRs escaneados
CREATE TABLE public.ride_tbrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.driver_rides(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ride_tbrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for ride_tbrs"
  ON public.ride_tbrs FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_tbrs;
```

**Arquivos modificados:**
- `src/pages/dashboard/ConferenciaCarregamentoPage.tsx` -- adicionar 3 botoes, logica de TBR, selecao de conferente
- `src/pages/driver/DriverRides.tsx` -- remover badge, adicionar rota/login/senha
- `src/components/dashboard/DriverSidebar.tsx` -- fechar sidebar mobile ao clicar
- `src/components/dashboard/DashboardSidebar.tsx` -- fechar sidebar mobile ao clicar
- `src/components/UnitLoginForm.tsx` -- controlar estado open dos Popovers
