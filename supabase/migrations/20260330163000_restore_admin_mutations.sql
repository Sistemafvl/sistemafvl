-- Restore INSERT, UPDATE, DELETE permissions for the Admin Panel

-- 1. Grant permissions to anon role (required because the Master Admin uses the browser without a Supabase auth session)
GRANT INSERT, UPDATE, DELETE ON public.domains TO anon;
GRANT INSERT, UPDATE, DELETE ON public.units TO anon;
GRANT INSERT, UPDATE, DELETE ON public.managers TO anon;
GRANT INSERT, UPDATE, DELETE ON public.directors TO anon;
GRANT UPDATE, DELETE ON public.drivers TO anon;

-- 2. Re-create policies to allow operations while satisfying minimum RLS requirements

-- For domains
DROP POLICY IF EXISTS "Anon can insert domains" ON public.domains;
CREATE POLICY "Anon can insert domains" ON public.domains FOR INSERT TO anon WITH CHECK (length(name) > 0);

DROP POLICY IF EXISTS "Anon can update domains" ON public.domains;
CREATE POLICY "Anon can update domains" ON public.domains FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Anon can delete domains" ON public.domains;
CREATE POLICY "Anon can delete domains" ON public.domains FOR DELETE TO anon USING (true);

-- For units
DROP POLICY IF EXISTS "Anon can insert units" ON public.units;
CREATE POLICY "Anon can insert units" ON public.units FOR INSERT TO anon WITH CHECK (length(name) > 0);

DROP POLICY IF EXISTS "Anon can update units" ON public.units;
CREATE POLICY "Anon can update units" ON public.units FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Anon can delete units" ON public.units;
CREATE POLICY "Anon can delete units" ON public.units FOR DELETE TO anon USING (true);

-- For managers
DROP POLICY IF EXISTS "Anon can insert managers" ON public.managers;
CREATE POLICY "Anon can insert managers" ON public.managers FOR INSERT TO anon WITH CHECK (length(name) > 0);

DROP POLICY IF EXISTS "Anon can update managers" ON public.managers;
CREATE POLICY "Anon can update managers" ON public.managers FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Anon can delete managers" ON public.managers;
CREATE POLICY "Anon can delete managers" ON public.managers FOR DELETE TO anon USING (true);

-- For directors
DROP POLICY IF EXISTS "Anon can insert directors" ON public.directors;
CREATE POLICY "Anon can insert directors" ON public.directors FOR INSERT TO anon WITH CHECK (length(name) > 0);

DROP POLICY IF EXISTS "Anon can update directors" ON public.directors;
CREATE POLICY "Anon can update directors" ON public.directors FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Anon can delete directors" ON public.directors;
CREATE POLICY "Anon can delete directors" ON public.directors FOR DELETE TO anon USING (true);

-- For drivers (Update/Delete for admin usage)
DROP POLICY IF EXISTS "Anon can update drivers" ON public.drivers;
CREATE POLICY "Anon can update drivers" ON public.drivers FOR UPDATE TO anon USING (true);

DROP POLICY IF EXISTS "Anon can delete drivers" ON public.drivers;
CREATE POLICY "Anon can delete drivers" ON public.drivers FOR DELETE TO anon USING (true);
