-- Add anon INSERT/DELETE/UPDATE policies for units (Master Admin operates as anon)
CREATE POLICY "Anon can insert units" ON public.units FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can delete units" ON public.units FOR DELETE TO anon USING (true);

-- Add anon INSERT/DELETE/UPDATE policies for domains
CREATE POLICY "Anon can insert domains" ON public.domains FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can delete domains" ON public.domains FOR DELETE TO anon USING (true);
CREATE POLICY "Anon can update domains" ON public.domains FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Add anon INSERT/DELETE/UPDATE policies for managers
CREATE POLICY "Anon can insert managers" ON public.managers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can delete managers" ON public.managers FOR DELETE TO anon USING (true);
CREATE POLICY "Anon can update managers" ON public.managers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can read all managers" ON public.managers FOR SELECT TO anon USING (true);