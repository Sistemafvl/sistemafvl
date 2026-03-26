
-- Etapa 5: Restringir DELETE/INSERT/UPDATE anon em tabelas críticas

-- DOMAINS: remover policies anon de escrita
DROP POLICY IF EXISTS "Anon can delete domains" ON public.domains;
DROP POLICY IF EXISTS "Anon can insert domains" ON public.domains;
DROP POLICY IF EXISTS "Anon can update domains" ON public.domains;

-- UNITS: remover policies anon de escrita
DROP POLICY IF EXISTS "Anon can delete units" ON public.units;
DROP POLICY IF EXISTS "Anon can insert units" ON public.units;
DROP POLICY IF EXISTS "Anon can update units" ON public.units;

-- MANAGERS: remover policies anon de escrita
DROP POLICY IF EXISTS "Anon can delete managers" ON public.managers;
DROP POLICY IF EXISTS "Anon can insert managers" ON public.managers;
DROP POLICY IF EXISTS "Anon can update managers" ON public.managers;

-- MANAGERS: remover policy de leitura anon (já tem managers_public view)
DROP POLICY IF EXISTS "Anon can read all managers" ON public.managers;

-- Etapa 2: Restringir leitura direta da tabela drivers para anon
-- A view drivers_public já existe e é usada em 20+ arquivos
DROP POLICY IF EXISTS "Anon can read drivers without password" ON public.drivers;
