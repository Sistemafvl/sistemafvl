-- Garantia absoluta de inserção e leitura para anon no painel admin

-- 1. Garante que as permissões de tabela existem
GRANT INSERT, UPDATE, DELETE, SELECT ON public.units TO anon;

-- 2. Remove as políticas rigorosas
DROP POLICY IF EXISTS "Anon can insert units" ON public.units;
DROP POLICY IF EXISTS "Anon can update units" ON public.units;

-- 3. Cria políticas garantindo que TODO INSERT funcione pelo painel Master Admin (anon)
CREATE POLICY "Anon can insert units" ON public.units FOR INSERT TO anon WITH CHECK (true);

-- No painel Master Admin, o usuário precisa poder ver inclusive as unidades inativas 
-- (para não criar duplicatas sem saber, ou a aplicação falhar na validação do UNIQUE)
DROP POLICY IF EXISTS "Anyone can read active units" ON public.units;
CREATE POLICY "Anyone can read units" ON public.units FOR SELECT TO anon USING (true);
