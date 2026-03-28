-- Allow authenticated users to see all drivers for management purposes
DROP POLICY IF EXISTS "Anyone can check active drivers" ON public.drivers;
CREATE POLICY "Anyone can check active drivers" ON public.drivers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can read all drivers" ON public.drivers;
CREATE POLICY "Authenticated users can read all drivers" ON public.drivers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can update drivers" ON public.drivers;
CREATE POLICY "Authenticated users can update drivers" ON public.drivers FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete drivers" ON public.drivers;
CREATE POLICY "Authenticated users can delete drivers" ON public.drivers FOR DELETE TO authenticated USING (true);
